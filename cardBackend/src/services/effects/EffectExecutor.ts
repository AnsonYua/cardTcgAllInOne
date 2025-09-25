// src/services/effects/EffectExecutor.ts
// Centralized effect application helpers reused by effect managers

import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard, PilotZoneCard, TemporaryEffect } from '../../models/CardSystem';
import { EffectDefinition, EffectTiming, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { SLOT_ZONES } from '../../config/gameConstants';

export class EffectExecutor {

    /**
     * Apply effect to selected targets using unified application logic
     */
    static applyEffectToTargets(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        selectedTargets: TargetReference[],
        sourcePlayerId: string,
        sourceCarduid?: string
    ): { success: boolean; error?: string } {

        const action = this.getEffectAction(effect);
        if (!action) {
            return {
                success: false,
                error: 'Effect action is undefined'
            };
        }

        const parameters = this.getEffectParameters(effect);
        const timing = this.getEffectTiming(effect);

        console.log(`⚡ Applying effect ${action} to ${selectedTargets.length} target(s)`);

        try {
            for (const target of selectedTargets) {
                const result = this.applyEffectToSingleTarget(gameEnv, effect, target, sourcePlayerId, action, parameters);
                if (!result.success) {
                    console.error(`❌ Failed to apply effect to target ${target.carduid}: ${result.error}`);
                    return result;
                }
            }

            if (timing?.duration === 'UNTIL_END_OF_TURN' && sourceCarduid) {
                this.createTemporaryEffect(gameEnv, effect, selectedTargets, sourcePlayerId, sourceCarduid);
            }

            console.log(`✅ Successfully applied ${action} to all ${selectedTargets.length} target(s)`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error applying effect to targets:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Effect application failed'
            };
        }
    }

    /**
     * Clean up expired temporary effects at end of turn
     */
    static cleanupExpiredTemporaryEffects(gameEnv: GameEnvironment, endingPlayerId: string): void {
        console.log(`🧹 Cleaning up temporary effects for player ${endingPlayerId} (turn ${gameEnv.currentTurn})`);

        let totalExpiredCount = 0;

        for (const playerId of Object.keys(gameEnv.players)) {
            const player = gameEnv.getPlayer(playerId);
            if (!player) continue;

            for (const slotName of SLOT_ZONES) {
                const slot = player.zones[slotName];

                if (slot?.unit?.temporaryEffects) {
                    totalExpiredCount += this.removeExpiredEffectsFromCard(slot.unit, endingPlayerId, gameEnv.currentTurn);
                }

                if (slot?.pilot?.temporaryEffects) {
                    totalExpiredCount += this.removeExpiredEffectsFromCard(slot.pilot, endingPlayerId, gameEnv.currentTurn);
                }
            }
        }

        console.log(`✅ Cleaned up ${totalExpiredCount} expired temporary effects applied by player ${endingPlayerId}`);
    }

    /**
     * Determine effect action
     */
    static getEffectAction(effect: EffectDefinition): string | undefined {
        const directAction = typeof effect.action === 'string' ? effect.action : undefined;
        if (directAction && directAction.length > 0) {
            return directAction;
        }

        const nestedAction = effect.effect?.action;
        if (typeof nestedAction === 'string' && nestedAction.length > 0) {
            return nestedAction;
        }

        return undefined;
    }

    /**
     * Determine effect parameters
     */
    static getEffectParameters(effect: EffectDefinition): Record<string, unknown> | undefined {
        return effect.parameters ?? effect.effect?.parameters;
    }

    /**
     * Determine effect timing
     */
    static getEffectTiming(effect: EffectDefinition): EffectTiming | undefined {
        return effect.timing;
    }

    private static applyEffectToSingleTarget(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        target: TargetReference,
        sourcePlayerId: string,
        action: string,
        parameters?: Record<string, unknown>
    ): { success: boolean; error?: string } {

        console.log(`🎯 Applying ${action} to target: ${target.carduid} in ${target.zone}`);

        try {
            const targetPlayer = gameEnv.getPlayer(target.playerId);
            if (!targetPlayer) {
                return { success: false, error: `Target player ${target.playerId} not found` };
            }

            const slotResult = SlotZoneUtils.getSlotZone(targetPlayer.zones, target.zone);
            if (!slotResult.isValid || !slotResult.slot) {
                return { success: false, error: `Target zone ${target.zone} not found or invalid: ${slotResult.error}` };
            }

            const cardResult = SlotZoneUtils.findCardByUid(slotResult.slot, target.carduid);
            if (!cardResult) {
                return { success: false, error: `Target card ${target.carduid} not found in ${target.zone}` };
            }

            const targetCard = cardResult.card;

            switch (action) {
                case 'modifyAP': {
                    const apValue = typeof parameters?.value === 'number' ? parameters.value : 0;
                    targetCard.modifyAP = apValue;
                    console.log(`⚔️ Modified ${targetCard.carduid} AP by ${apValue}`);
                    break;
                }
                case 'modifyHP': {
                    const hpValue = typeof parameters?.value === 'number' ? parameters.value : 0;
                    const originalHP = targetCard.currentHP || targetCard.cardData?.hp || 0;
                    targetCard.currentHP = Math.max(0, originalHP + hpValue);
                    console.log(`❤️ Modified ${target.carduid} HP by ${hpValue}, from ${originalHP} to ${targetCard.currentHP}`);
                    break;
                }
                case 'damage': {
                    const damageValue = typeof parameters?.value === 'number' ? parameters.value : 0;
                    targetCard.damageReceived = (targetCard.damageReceived || 0) + damageValue;
                    console.log(`🩸 ${target.carduid} takes ${damageValue} damage (total: ${targetCard.damageReceived})`);
                    break;
                }
                case 'rest':
                    targetCard.isRested = true;
                    console.log(`💤 ${target.carduid} has been rested`);
                    break;
                case 'heal': {
                    const healValue = typeof parameters?.value === 'number' ? parameters.value : 0;
                    const healAmount = Math.min(healValue, targetCard.damageReceived || 0);
                    targetCard.damageReceived = (targetCard.damageReceived || 0) - healAmount;
                    console.log(`🩹 ${target.carduid} healed ${healAmount} damage`);
                    break;
                }
                default:
                    console.log(`⚠️ Unknown effect action: ${action}`);
                    return { success: false, error: `Unknown effect action: ${action}` };
            }

            return { success: true };

        } catch (error) {
            console.error(`❌ Error applying effect to single target:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Single target effect application failed'
            };
        }
    }

    private static createTemporaryEffect(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        selectedTargets: TargetReference[],
        sourcePlayerId: string,
        sourceCarduid: string
    ): void {

        console.log(`⏰ Creating temporary effect: ${effect.effectId} until end of turn`);

        for (const target of selectedTargets) {
            const targetPlayer = gameEnv.getPlayer(target.playerId);
            if (!targetPlayer) {
                console.error(`❌ Target player ${target.playerId} not found for temporary effect`);
                continue;
            }

            const slotResult = SlotZoneUtils.getSlotZone(targetPlayer.zones, target.zone);
            if (!slotResult.isValid || !slotResult.slot) {
                console.log(`⚠️ Target zone ${target.zone} not found: ${slotResult.error}`);
                continue;
            }

            const cardResult = SlotZoneUtils.findCardByUid(slotResult.slot, target.carduid);
            if (!cardResult) {
                console.log(`⚠️ Target card ${target.carduid} not found in ${target.zone}`);
                continue;
            }

            const targetCard = cardResult.card as UnitZoneCard | PilotZoneCard;
            const parameters = effect.parameters || effect.effect?.parameters || {};

            const tempEffect: TemporaryEffect = {
                sourceCarduid,
                modifyAP: effect.action === 'modifyAP' && typeof parameters.value === 'number' ? parameters.value : undefined,
                modifyHP: effect.action === 'modifyHP' && typeof parameters.value === 'number' ? parameters.value : undefined,
                duration: effect.timing?.duration || 'UNTIL_END_OF_TURN',
                appliedTurn: gameEnv.currentTurn,
                appliedBy: sourcePlayerId
            };

            if (!targetCard.temporaryEffects) {
                targetCard.temporaryEffects = [];
            }

            targetCard.temporaryEffects.push(tempEffect);

            if (tempEffect.modifyAP !== undefined) {
                targetCard.modifyAP = (targetCard.modifyAP || 0) + tempEffect.modifyAP;
                console.log(`✅ Applied AP effect ${tempEffect.modifyAP} to ${target.carduid} (new modifyAP: ${targetCard.modifyAP})`);
            }

            if (tempEffect.modifyHP !== undefined) {
                targetCard.modifyHP = (targetCard.modifyHP || 0) + tempEffect.modifyHP;
                console.log(`✅ Applied HP effect ${tempEffect.modifyHP} to ${target.carduid} (new modifyHP: ${targetCard.modifyHP})`);
            }

            console.log(`✅ Added temporary effect from ${sourceCarduid} to unit ${target.carduid}`);
        }
    }

    private static removeExpiredEffectsFromCard(
        card: UnitZoneCard | PilotZoneCard,
        endingPlayerId: string,
        currentTurn: number
    ): number {
        if (!card.temporaryEffects) {
            return 0;
        }

        const initialCount = card.temporaryEffects.length;
        card.temporaryEffects = card.temporaryEffects.filter(tempEffect => {
            const shouldExpire = tempEffect.duration === 'UNTIL_END_OF_TURN' &&
                                 tempEffect.appliedTurn === currentTurn &&
                                 tempEffect.appliedBy === endingPlayerId;

            if (shouldExpire) {
                console.log(`⏰ Expiring temporary effect from ${tempEffect.sourceCarduid} on card ${card.carduid}`);
                this.revertTemporaryEffectFromUnit(card, tempEffect);
            }

            return !shouldExpire;
        });

        return initialCount - card.temporaryEffects.length;
    }

    private static revertTemporaryEffectFromUnit(card: UnitZoneCard | PilotZoneCard, tempEffect: TemporaryEffect): void {
        if (tempEffect.modifyAP !== undefined) {
            const currentAP = card.modifyAP || 0;
            card.modifyAP = currentAP - tempEffect.modifyAP;
            console.log(`🔄 Reverted AP modification on ${card.carduid}: ${currentAP} → ${card.modifyAP}`);
        }

        if (tempEffect.modifyHP !== undefined) {
            const currentHP = card.modifyHP || 0;
            card.modifyHP = currentHP - tempEffect.modifyHP;
            console.log(`🔄 Reverted HP modification on ${card.carduid}: ${currentHP} → ${card.modifyHP}`);
        }
    }
}
