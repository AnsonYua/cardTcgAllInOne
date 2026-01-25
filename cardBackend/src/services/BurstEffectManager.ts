// src/services/BurstEffectManager.ts
// Centralized burst effect processing helpers

import {
    BurstEffectChoiceEvent,
    EventStatus,
    ShieldCardAttackedEvent,
    EffectDefinition
} from './EventQueue/interfaces/GameEvent';
import { EventFactory } from './EventQueue/EventFactory';
import { GameEnvironment } from '../models/GameEnvironment';
import { ExecutionResult } from './ExecutionResult';
import { PlayerCardManager } from './PlayerCardManager';
import { getCardIdFromUid } from '../utils/CardUtils';
import { DeployTargetManager } from './DeployTargetManager';
import { ensureEffectDefaults, resolveEffectActionFromRule } from '../utils/EffectNormalizationUtils';
import { isPlayOrActivatedEffect } from '../utils/EffectTypeRouter';
import { EffectExecutor } from './effects/EffectExecutor';
import { ChoiceNotificationEmitter } from './notifications/ChoiceNotificationEmitter';
import { BurstChoiceService } from './effects/BurstChoiceService';
import { EffectTimingWindowUtils } from '../utils/EffectTimingWindowUtils';
import { DefenseAreaBattleDamageTriggeredEffectManager } from './effects/DefenseAreaBattleDamageTriggeredEffectManager';
import { ShieldAreaCardDamagedTriggerDispatcher } from './effects/ShieldAreaCardDamagedTriggerDispatcher';

export interface BurstEffectSummary {
    effectId: string;
    type: string; // normalized action identifier (e.g., deploy, addToHand)
    description: string;
    parameters?: Record<string, unknown>;
    triggerType?: string; // original rule.type for logging/debugging
}

export class BurstEffectManager {

    static processShieldCardAttack(event: ShieldCardAttackedEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🛡️ Executing SHIELD_CARD_ATTACKED event: ${event.id}`);

        try {
            const { defendingPlayerId, shieldCards, attackingPlayerId, attackerSlot } = event.data;
            const defender = gameEnv.getPlayer(defendingPlayerId);

            if (!defender) {
                return {
                    success: false,
                    error: `Defending player ${defendingPlayerId} not found`
                };
            }

            for (const shieldCard of shieldCards) {
                const shieldCardId = getCardIdFromUid(shieldCard.carduid);
                console.log(`🛡️ Processing shield card: ${shieldCardId}`);

                const burstEffects = this.findBurstEffects(shieldCard.cardData);

                if (burstEffects.length > 0) {
                    console.log(`💥 Found ${burstEffects.length} burst effect(s)`);

                    const cardData = { ...shieldCard.cardData };
                    cardData.cardType = cardData.originalCardType || cardData.cardType;

                    const formattedTarget = {
                        ...shieldCard,
                        cardId: shieldCardId,
                        cardData,
                        dialogDisplayType: 'singleCard',
                        displayName: cardData.name || shieldCardId,
                        ownerPlayerId: defendingPlayerId,
                        playerId: defendingPlayerId,
                        sourceZone: 'shieldArea',
                        attackContext: attackingPlayerId && attackerSlot
                            ? {
                                attackingPlayerId,
                                attackerSlot
                            }
                            : undefined
                    };

                    BurstChoiceService.enqueueBurstChoice(gameEnv, defendingPlayerId, formattedTarget);
                } else {
                    console.log(`📝 No burst effects found on card ${shieldCardId}`);

                    const removed = this.removeFromShieldWithLogging(gameEnv, defendingPlayerId, shieldCard.carduid);
                    if (removed) {
                        const cardDataForTrash = { ...shieldCard.cardData };
                        this.restoreCardType(cardDataForTrash);
                        PlayerCardManager.moveCardToTrash(
                            gameEnv,
                            defendingPlayerId,
                            shieldCard.carduid,
                            shieldCardId,
                            cardDataForTrash
                        );

                        if (attackingPlayerId && attackerSlot) {
                            const triggerResult = DefenseAreaBattleDamageTriggeredEffectManager.handleShieldCardDestroyed(gameEnv, {
                                attackingPlayerId,
                                attackerSlot
                            });
                            if (!triggerResult.success) {
                                return { success: false, error: triggerResult.error || 'Failed to process DEFENSE_AREA_BATTLE_DAMAGE triggers' };
                            }

                            ShieldAreaCardDamagedTriggerDispatcher.dispatch({
                                gameEnv,
                                attackingPlayerId,
                                attackerSlot,
                                defendingPlayerId,
                                defenseArea: 'shield',
                                damagedCarduid: shieldCard.carduid
                            });
                        }
                    } else {
                        console.error(`❌ Failed to remove card ${shieldCard.carduid} from shield before trashing`);
                    }
                }
            }

            return { success: true };

        } catch (error) {
            console.error(`❌ Error in processShieldCardAttack:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Shield card attack execution failed'
            };
        }
    }

    static processBurstEffectChoice(event: BurstEffectChoiceEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`💥 Executing BURST_EFFECT_CHOICE event: ${event.id} (${event.status})`);

        try {
            const { playerId, availableTargets, choiceId, userDecision } = event.data;
            const target = availableTargets[0];

            if (!target) {
                return {
                    success: false,
                    error: 'No available targets in burst choice event'
                };
            }

            if (event.status !== EventStatus.RESOLVING) {
                console.log(`⚠️ Unexpected event status: ${event.status} (expected RESOLVING)`);
                return { success: true };
            }

            console.log(`🚀 User decided: ${userDecision} for burst choice: ${choiceId}`);

            if (userDecision === 'DECLINE') {
                const declineResult = this.handleBurstDecline(gameEnv, playerId, target.carduid, target.cardData, target.cardId);
                BurstChoiceService.restoreBurstCurrentPlayer(gameEnv, event);
                if (declineResult.success) {
                    ChoiceNotificationEmitter.emitBurstChoiceResolved(gameEnv, event, 'DECLINE');
                    this.maybeTriggerDefenseAreaBattleDamageFromBurstTarget(gameEnv, target);
                }
                return declineResult;
            }

            if (userDecision === 'ACTIVATE') {
                const burstEffects = this.findBurstEffects(target.cardData);
                if (burstEffects.length === 0) {
                    BurstChoiceService.restoreBurstCurrentPlayer(gameEnv, event);
                    return {
                        success: false,
                        error: 'No burst effects found on card'
                    };
                }

                const burstEffect = burstEffects[0];
                const executionResult = this.executeBurstEffect(
                    gameEnv,
                    playerId,
                    target.carduid,
                    target.cardData,
                    burstEffect
                );

                if (!executionResult.success) {
                    BurstChoiceService.restoreBurstCurrentPlayer(gameEnv, event);
                    return executionResult;
                }

                console.log(`✅ Burst effect ${burstEffect.type} executed successfully`);
                BurstChoiceService.restoreBurstCurrentPlayer(gameEnv, event);
                ChoiceNotificationEmitter.emitBurstChoiceResolved(gameEnv, event, 'ACTIVATE');
                this.maybeTriggerDefenseAreaBattleDamageFromBurstTarget(gameEnv, target);
                return { success: true };
            }

            return {
                success: false,
                error: `Invalid userDecision: ${userDecision}`
            };

        } catch (error) {
            console.error(`❌ Error in processBurstEffectChoice:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Burst effect choice execution failed'
            };
        }
    }

    static executeBurstEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        carduid: string,
        cardData: any,
        burstEffect: any
    ): ExecutionResult {
        console.log(`💥 Executing burst effect ${burstEffect.type} for card ${carduid}`);

        try {
            this.restoreCardType(cardData);

            let executionResult: ExecutionResult;
            switch (burstEffect.type) {
                case 'addToHand':
                    executionResult = this.addCardToHand(gameEnv, playerId, carduid, cardData);
                    break;

                case 'deploy':
                    executionResult = this.executeBurstDeploy(gameEnv, playerId, carduid, cardData, burstEffect);
                    break;

                case 'activate_ability':
                    executionResult = this.executeBurstActivateAbility(gameEnv, playerId, carduid, cardData, burstEffect);
                    break;

                default:
                    return {
                        success: false,
                        error: `Unknown burst effect type: ${burstEffect.type}`
                    };
            }

            if (executionResult.success) {
                this.removeFromShieldWithLogging(gameEnv, playerId, carduid);

                if (burstEffect.type === 'activate_ability') {
                    const cardId = getCardIdFromUid(carduid);
                    PlayerCardManager.moveCardToTrash(gameEnv, playerId, carduid, cardId, cardData);
                }
            }

            return executionResult;

        } catch (error) {
            console.error(`❌ Error executing burst effect:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Burst effect execution failed'
            };
        }
    }

    private static executeBurstActivateAbility(
        gameEnv: GameEnvironment,
        playerId: string,
        carduid: string,
        cardData: any,
        burstEffect: any
    ): ExecutionResult {
        const abilityType = burstEffect?.parameters?.abilityType || 'main';
        console.log(`✨ Executing burst ability activation (${abilityType}) for card ${carduid}`);

        const effects = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
        const activatedEffects = effects.filter((rule: EffectDefinition) => isPlayOrActivatedEffect(rule));

        if (activatedEffects.length === 0) {
            return {
                success: false,
                error: 'No activated abilities available on this card'
            };
        }

        const abilityEffect = this.selectAbilityEffect(activatedEffects, abilityType);
        if (!abilityEffect) {
            return {
                success: false,
                error: `No ${abilityType} ability found on this card`
            };
        }

        const normalizedAbility = ensureEffectDefaults({ ...abilityEffect });
        const targetResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            playerId,
            carduid,
            normalizedAbility
        );

        if (!targetResult.success) {
            return {
                success: false,
                error: targetResult.error || 'Failed to resolve burst ability targets'
            };
        }

        console.log(`✅ Burst ability ${normalizedAbility.effectId || normalizedAbility.action} queued/applied successfully`);
        return { success: true };
    }

    private static selectAbilityEffect(effects: EffectDefinition[], abilityType: string): EffectDefinition | undefined {
        if (abilityType !== 'main') {
            return effects[0];
        }

        const mainPhaseEffect = effects.find(effect => {
            const timingRecord = effect.timing;
            if (!timingRecord) {
                return false;
            }

            if (EffectTimingWindowUtils.includesWindow(effect, 'MAIN_PHASE')) {
                return true;
            }

            if (typeof timingRecord.duration === 'string' && timingRecord.duration.toUpperCase() === 'MAIN_PHASE') {
                return true;
            }

            if (typeof timingRecord.actionTurn === 'string' && timingRecord.actionTurn.toUpperCase() === 'ACTION_STEP') {
                return true;
            }

            return false;
        });

        return mainPhaseEffect || effects[0];
    }

    static addCardToHand(
        gameEnv: GameEnvironment,
        playerId: string,
        carduid: string,
        cardData: any
    ): ExecutionResult {
        console.log(`➕ Adding card ${carduid} to ${playerId}'s hand`);
        return EffectExecutor.addCardToPlayerHand(gameEnv, playerId, carduid, cardData, {
            sourceZone: 'shield',
            reason: 'burst'
        });
    }

    static removeCardFromShield(
        gameEnv: GameEnvironment,
        playerId: string,
        carduid: string
    ): ExecutionResult {
        console.log(`🛡️ Removing card ${carduid} from ${playerId}'s shield`);
        return EffectExecutor.removeCardFromShield(gameEnv, playerId, carduid);
    }

    static findBurstEffects(cardData: any): BurstEffectSummary[] {
        if (!cardData?.effects?.rules) {
            return [];
        }

        const burstEffects: BurstEffectSummary[] = [];

        for (const effect of cardData.effects.rules) {
            if (effect.trigger && effect.trigger === 'BURST_CONDITION') {
                const effectAction = resolveEffectActionFromRule(effect) || 'unknown';
                const effectParameters = this.extractBurstParameters(effect);
                const description = this.createBurstEffectDescription(effect, cardData, effectAction);

                burstEffects.push({
                    effectId: effect.effectId || `burst_${effectAction}_${cardData.cardId || 'unknown'}`,
                    type: effectAction,
                    description,
                    parameters: effectParameters,
                    triggerType: effect.type
                });

                console.log(`🔍 Found burst effect: ${effectAction} (rule.type=${effect.type || 'unknown'}) on card ${cardData.cardId}`);
            }
        }

        return burstEffects;
    }

    private static extractBurstParameters(effect: any): Record<string, unknown> | undefined {
        const nested = effect?.effect?.parameters;
        const direct = effect?.parameters;

        if (!nested && !direct) {
            return undefined;
        }

        return {
            ...(typeof nested === 'object' ? nested : undefined),
            ...(typeof direct === 'object' ? direct : undefined)
        } as Record<string, unknown>;
    }

    static createBurstEffectDescription(effect: any, cardData: any, effectAction?: string): string {
        const cardName = cardData.name || cardData.cardId || 'Unknown Card';
        const action = effectAction || resolveEffectActionFromRule(effect) || 'unknown';

        switch (action) {
            case 'addToHand':
                return `【Burst】 ${cardName}: Add this card to your hand`;
            case 'activate_ability':
                return `【Burst】 ${cardName}: Activate main effect`;
            case 'deploy':
                return `【Burst】 ${cardName}: Deploy this card to the field`;
            default:
                return `【Burst】 ${cardName}: Activate burst effect (${action})`;
        }
    }

    private static handleBurstDecline(
        gameEnv: GameEnvironment,
        playerId: string,
        carduid: string,
        cardData: any,
        cardId?: string
    ): ExecutionResult {
        console.log(`❌ Player declined burst effect - moving card to trash`);

        const defender = gameEnv.getPlayer(playerId);
        if (!defender) {
            return {
                success: false,
                error: `Player ${playerId} not found`
            };
        }

        const removed = this.removeFromShieldWithLogging(gameEnv, playerId, carduid);
        if (!removed) {
            console.log(`⚠️ Warning: Card ${carduid} not found in shield zone`);
        }

        const cardDataForTrash = { ...cardData };
        this.restoreCardType(cardDataForTrash);

        PlayerCardManager.moveCardToTrash(gameEnv, playerId, carduid, cardId || getCardIdFromUid(carduid), cardDataForTrash);

        console.log(`🗑️ Card ${cardId || carduid} moved to trash after decline`);
        return { success: true };
    }



    private static executeBurstDeploy(
        gameEnv: GameEnvironment,
        playerId: string,
        carduid: string,
        cardData: any,
        burstEffect: any
    ): ExecutionResult {
        console.log(`🚀 Executing deploy burst effect for card ${carduid}`);

        try {
            const playCardEvent = EventFactory.createBurstDeployEvent(
                playerId,
                carduid,
                cardData,
                burstEffect
            );

            gameEnv.enqueueForProcessing(playCardEvent);
            console.log(`📤 Burst deploy event enqueued: ${playCardEvent.id}`);

            return { success: true };

        } catch (error) {
            console.error(`❌ Error executing burst deploy:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Burst deploy execution failed'
            };
        }
    }

    private static restoreCardType(cardData: any): boolean {
        if (cardData?.originalCardType) {
            console.log(`🔄 Restoring card type: ${cardData.cardType} → ${cardData.originalCardType}`);
            cardData.cardType = cardData.originalCardType;
            return true;
        }

        console.log(`⚠️ Warning: No originalCardType found, keeping current cardType: ${cardData?.cardType}`);
        return false;
    }

    private static removeFromShieldWithLogging(
        gameEnv: GameEnvironment,
        playerId: string,
        carduid: string
    ): boolean {
        const result = EffectExecutor.removeCardFromShield(gameEnv, playerId, carduid);
        return result.success;
    }

    private static maybeTriggerDefenseAreaBattleDamageFromBurstTarget(gameEnv: GameEnvironment, target: any): void {
        const context = target?.attackContext;
        if (!context || typeof context.attackingPlayerId !== 'string' || typeof context.attackerSlot !== 'string') {
            return;
        }

        const triggerResult = DefenseAreaBattleDamageTriggeredEffectManager.handleShieldCardDestroyed(gameEnv, {
            attackingPlayerId: context.attackingPlayerId,
            attackerSlot: context.attackerSlot
        });
        if (!triggerResult.success) {
            console.error(triggerResult.error || 'Failed to process DEFENSE_AREA_BATTLE_DAMAGE triggers');
        }

        ShieldAreaCardDamagedTriggerDispatcher.dispatch({
            gameEnv,
            attackingPlayerId: context.attackingPlayerId,
            attackerSlot: context.attackerSlot,
            defendingPlayerId: typeof target?.ownerPlayerId === 'string' ? target.ownerPlayerId : '',
            defenseArea: 'shield',
            damagedCarduid: typeof target?.carduid === 'string' ? target.carduid : undefined
        });
    }
}
