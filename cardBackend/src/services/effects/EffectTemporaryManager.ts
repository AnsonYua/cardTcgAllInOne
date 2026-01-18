import { GameEnvironment } from '../../models/GameEnvironment';
import { UnitZoneCard, PilotZoneCard, TemporaryEffect } from '../../models/CardSystem';
import { EffectDefinition, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { SLOT_ZONES } from '../../config/gameConstants';

export class EffectTemporaryManager {
    static createTemporaryEffect(
        gameEnv: GameEnvironment,
        effect: EffectDefinition,
        selectedTargets: TargetReference[],
        sourcePlayerId: string,
        sourceCarduid: string
    ): void {
        console.log(`⏰ Creating temporary effect: ${effect.effectId} until end of turn`);

        for (const target of selectedTargets) {
            const resolvedTarget = SlotZoneUtils.resolveTargetReference(gameEnv, target);
            if (!resolvedTarget) {
                continue;
            }

            const targetCard = resolvedTarget.card as UnitZoneCard | PilotZoneCard;
            const parameters = effect.parameters || {};
            const parameterValue = parameters['value'];

            const tempEffect: TemporaryEffect = {
                sourceCarduid,
                modifyAP: effect.action === 'modifyAP' && typeof parameterValue === 'number' ? parameterValue : undefined,
                modifyHP: effect.action === 'modifyHP' && typeof parameterValue === 'number' ? parameterValue : undefined,
                duration: effect.timing?.duration || 'UNTIL_END_OF_TURN',
                appliedTurn: gameEnv.currentTurn,
                appliedBy: sourcePlayerId,
                endOnSourceDestroyed: effect.timing?.endOnSourceDestroyed === true
            };

            if (!targetCard.temporaryEffects) {
                targetCard.temporaryEffects = [];
            }

            targetCard.temporaryEffects.push(tempEffect);
            console.log(`✅ Added temporary effect from ${sourceCarduid} to unit ${target.carduid}`);
        }
    }

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

    static removeTemporaryEffectsFromSource(gameEnv: GameEnvironment, sourceCarduid: string): number {
        if (!sourceCarduid) {
            return 0;
        }

        let removedCount = 0;
        Object.values(gameEnv.players || {}).forEach(player => {
            if (!player?.zones) {
                return;
            }

            for (const slotName of Object.keys(player.zones)) {
                const slot = (player.zones as any)[slotName];
                if (!slot) {
                    continue;
                }

                const cards = [];
                if (slot.unit) {
                    cards.push(slot.unit);
                }
                if (slot.pilot) {
                    cards.push(slot.pilot);
                }

                cards.forEach(card => {
                    if (!card?.temporaryEffects || card.temporaryEffects.length === 0) {
                        return;
                    }

                    const before = card.temporaryEffects.length;
                    card.temporaryEffects = card.temporaryEffects.filter((tempEffect: TemporaryEffect) => {
                        const shouldRemove = tempEffect.sourceCarduid === sourceCarduid && tempEffect.endOnSourceDestroyed;
                        if (shouldRemove) {
                            this.revertTemporaryEffectFromUnit(card, tempEffect);
                            removedCount += 1;
                        }
                        return !shouldRemove;
                    });

                    if (before !== card.temporaryEffects.length) {
                        console.log(`🧹 Removed ${before - card.temporaryEffects.length} temporary effect(s) from ${card.carduid}`);
                    }
                });
            }
        });

        return removedCount;
    }

    static applyContinueCardEffect(card: UnitZoneCard | PilotZoneCard, action: string, value: number): boolean {
        switch (action) {
            case 'modifyAP': {
                const previous = (card as any).continueModifyAP || 0;
                (card as any).continueModifyAP = previous + value;
                console.log(
                    `  ⚡ Card ${card.carduid}: continueModifyAP ${previous} → ${(card as any).continueModifyAP} (${value > 0 ? '+' : ''}${value})`
                );
                return true;
            }
            case 'modifyHP': {
                const previous = (card as any).continueModifyHP || 0;
                (card as any).continueModifyHP = previous + value;
                console.log(
                    `  ❤️ Card ${card.carduid}: continueModifyHP ${previous} → ${(card as any).continueModifyHP} (${value > 0 ? '+' : ''}${value})`
                );
                return true;
            }
            default:
                console.log(`⚠️ Unsupported direct card effect action: ${action}`);
                return false;
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
            const effectTurn = tempEffect.appliedTurn ?? currentTurn;
            const shouldExpire = tempEffect.duration === 'UNTIL_END_OF_TURN' && effectTurn <= currentTurn;

            if (shouldExpire) {
                const appliedBy = tempEffect.appliedBy ?? 'unknown';
                console.log(
                    `⏰ Expiring temporary effect from ${tempEffect.sourceCarduid} applied by ${appliedBy} on card ${card.carduid} (ending player ${endingPlayerId}, effect turn ${effectTurn})`
                );
                this.revertTemporaryEffectFromUnit(card, tempEffect);
            }

            return !shouldExpire;
        });

        return initialCount - card.temporaryEffects.length;
    }

    private static revertTemporaryEffectFromUnit(card: UnitZoneCard | PilotZoneCard, tempEffect: TemporaryEffect): void {
        if (tempEffect.modifyAP !== undefined) {
            const currentAP = (card as any).modifyAP || 0;
            const nextAP = currentAP - tempEffect.modifyAP;
            (card as any).modifyAP = nextAP;
            console.log(`🔄 Reverted AP modification on ${card.carduid}: ${currentAP} → ${nextAP}`);
        }

        if (tempEffect.modifyHP !== undefined) {
            const currentHP = (card as any).modifyHP || 0;
            const nextHP = currentHP - tempEffect.modifyHP;
            (card as any).modifyHP = nextHP;
            console.log(`🔄 Reverted HP modification on ${card.carduid}: ${currentHP} → ${nextHP}`);
        }
    }
}
