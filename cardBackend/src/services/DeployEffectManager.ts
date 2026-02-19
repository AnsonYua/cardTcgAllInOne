// src/services/DeployEffectManager.ts
// Deploy effect processing system for ENTERS_PLAY triggered effects

import { GameEnvironment } from '../models/GameEnvironment';
import { CardDatabaseManager } from '../models/CardSystem';
import {
    DeployEffectEvent,
    EffectDefinition,
    PlayCardEventData
} from './EventQueue/interfaces/GameEvent';
import { EventFactory } from './EventQueue/EventFactory';
import { DeployTargetManager } from './DeployTargetManager';
import type { DeployTargetResult } from './DeployTargetResult';
import { ensureEffectDefaults } from '../utils/EffectNormalizationUtils';
import { EffectRuleCatalog } from './effects/EffectRuleCatalog';
import { GameNotificationManager } from './GameNotificationManager';
import { GamePhase } from '../models/GameEnums';
import { EffectTimingWindowUtils } from '../utils/EffectTimingWindowUtils';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { EffectEligibilityEvaluator } from './effects/EffectEligibilityEvaluator';
import { DeployEffectOptionPresenter } from './effects/DeployEffectOptionPresenter';
import { ChoiceEventScheduler } from './choices/ChoiceEventScheduler';
import { EventPriority } from './EventQueue/interfaces/GameEvent';
import { ChoiceNotificationEmitter } from './notifications/ChoiceNotificationEmitter';
import { CardPlayNotificationLifecycle } from './notifications/CardPlayNotificationLifecycle';

export interface ExecutionResult {
    success: boolean;
    error?: string;
}

interface DeployQueueResult {
    success: boolean;
    effectsFound: number;
    error?: string;
}

/**
 * DeployEffectManager queues and resolves deploy-triggered effects defined on card data.
 * Effects are normalized into EffectDefinition objects so downstream managers avoid `any` usage.
 */
export class DeployEffectManager {

    /**
     * Inspect a played card for deploy effects and enqueue a typed event when present.
     */
    static checkAndQueueDeployEffects(
        eventData: PlayCardEventData,
        playerId: string,
        gameEnv: GameEnvironment
    ): DeployQueueResult {
        try {
            const cardData = CardDatabaseManager.getCardDetailsFromCarduid(eventData.carduid);
            if (!cardData?.effects?.rules) {
                return { success: true, effectsFound: 0 };
            }
            
            // Command cards played as pilots should not trigger command deploy effects
            if (cardData.cardType === 'command' && eventData.playAs === 'pilot') {
                return { success: true, effectsFound: 0 };
            }
            
            const deployEffects: EffectDefinition[] = [];

            const triggeredDeployEffects = EffectRuleCatalog.collectEffects(cardData, {
                trigger: 'ENTERS_PLAY',
                fallbackEffectId: 'deploy_effect',
                expectedTriggers: ['ENTERS_PLAY'],
                preFilter: (rawRule) => {
                    const triggerValue = rawRule['trigger'];
                    return typeof triggerValue === 'string' && triggerValue === 'ENTERS_PLAY';
                }
            }).map(effect => ensureEffectDefaults(effect));

            triggeredDeployEffects.forEach(effect => deployEffects.push(effect));

            // NOTE: Activated abilities must be triggered manually by the player (e.g. via PLAYER_ACTION).
            // Do not auto-queue `type: activated` effects just because the card was played during MAIN_PHASE.
            const playEffects = this.findPlayEffectsExecutableOnPlay(cardData, gameEnv);
            playEffects.forEach(effect => deployEffects.push(ensureEffectDefaults(effect)));

            if (deployEffects.length === 0) {
                return { success: true, effectsFound: 0 };
            }

            const deployEvent = EventFactory.createDeployEffectEvent(
                playerId,
                eventData.carduid,
                deployEffects,
                eventData.cardPlayNotificationId
            );
            gameEnv.enqueueForProcessing(deployEvent);

            console.log(`🚀 DeployEffectManager queued ${deployEffects.length} deploy effect(s) for ${eventData.carduid}`);
            return { success: true, effectsFound: deployEffects.length };

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown deploy effect error';
            console.error(`❌ Failed to queue deploy effects for ${eventData.carduid}: ${message}`);
            return {
                success: false,
                effectsFound: 0,
                error: message
            };
        }
    }

    /**
     * Resolve a DEPLOY_EFFECT_TRIGGERED event by applying each effect.
     */
    static executeDeployEffect(event: DeployEffectEvent, gameEnv: GameEnvironment): ExecutionResult {
        console.log(`🚀 Executing deploy effects for card ${event.data.carduid}`);

        const failures: string[] = [];
        let requiresTargetChoice = false;

        const sourceLookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, event.data.carduid);
        const sourceCard = sourceLookup.found ? (sourceLookup.card || sourceLookup.unit || sourceLookup.pilot) : null;

        const remainingEffects = Array.isArray((event.data as any).remainingEffects)
            ? (((event.data as any).remainingEffects as unknown[]) as EffectDefinition[])
            : [];

        const normalizedEffects = (Array.isArray(event.data.effects) ? event.data.effects : [])
            .map(effect => ensureEffectDefaults(effect));

        const eligibleEffects = normalizedEffects.filter(effect => EffectEligibilityEvaluator.shouldExecute({
            gameEnv,
            sourcePlayerId: event.playerId,
            sourceCard,
            effect
        }));

        // If multiple deploy effects are eligible, pause and let the player choose which effect resolves next.
        if (eligibleEffects.length > 1) {
            const options = this.buildDeployEffectOrderOptions(eligibleEffects, event.data.carduid);

            ChoiceEventScheduler.enqueuePromptChoice(gameEnv, {
                playerId: event.playerId,
                choiceId: `deploy_effect_order_${event.id}`,
                headerText: 'Choose Deploy Effect',
                promptText: 'Select which deploy effect to resolve first.',
                availableOptions: options,
                defaultOptionIndex: 0,
                sourceCarduid: event.data.carduid,
                context: {
                    kind: 'DEPLOY_EFFECT_ORDER',
                    deployCarduid: event.data.carduid,
                    effects: eligibleEffects,
                    cardPlayNotificationId: event.data.cardPlayNotificationId
                },
                cardPlayNotificationId: event.data.cardPlayNotificationId
            });

            return { success: true };
        }

        if (eligibleEffects.length === 0) {
            if (event.data.cardPlayNotificationId) {
                CardPlayNotificationLifecycle.markCompleted(gameEnv, event.data.cardPlayNotificationId);
            }
            return { success: true };
        }

        // Resolve exactly one effect per event to avoid auto-executing multiple effects in a fixed order.
        const normalizedEffect = eligibleEffects[0];

        const result: DeployTargetResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            event.playerId,
            event.data.carduid,
            normalizedEffect,
            event.data.cardPlayNotificationId
        );

        if (!result.success && !result.requiresSelection) {
            const errorMessage = result.error || `Effect ${normalizedEffect.effectId} failed`;
            failures.push(errorMessage);
        }
        if (result.requiresSelection) {
            requiresTargetChoice = true;
        }

        if (failures.length > 0) {
            const combinedError = failures.join('; ');
            console.error(`❌ Deploy effects failed: ${combinedError}`);
            return { success: false, error: combinedError };
        }

        // Schedule remaining effects after the current one (and after any pending TARGET_CHOICE).
        if (remainingEffects.length > 0) {
            if (remainingEffects.length === 1) {
                const nextEvent = EventFactory.createDeployEffectEvent(
                    event.playerId,
                    event.data.carduid,
                    [remainingEffects[0]],
                    event.data.cardPlayNotificationId
                );
                nextEvent.priority = EventPriority.NORMAL;
                gameEnv.enqueueForProcessing(nextEvent);
            } else {
                const options = this.buildDeployEffectOrderOptions(remainingEffects, event.data.carduid);

                const followUpChoice = EventFactory.createPromptChoiceEvent({
                    playerId: event.playerId,
                    choiceId: `deploy_effect_order_${event.id}_followup`,
                    headerText: 'Choose Deploy Effect',
                    promptText: 'Select which deploy effect to resolve first.',
                    sourceCarduid: event.data.carduid,
                    availableOptions: options,
                    defaultOptionIndex: 0,
                    context: {
                        kind: 'DEPLOY_EFFECT_ORDER',
                        deployCarduid: event.data.carduid,
                        effects: remainingEffects,
                        cardPlayNotificationId: event.data.cardPlayNotificationId
                    }
                });
                followUpChoice.priority = EventPriority.NORMAL;
                gameEnv.enqueueForProcessing(followUpChoice);
                ChoiceNotificationEmitter.emitPromptChoiceCreated(gameEnv, followUpChoice);
            }
        }

        // Notify frontend that a deploy effect step finished, so it can refresh UI/state immediately.
        new GameNotificationManager(gameEnv).addNotificationEvent(
            'GAME_ENV_REFRESH',
            {
                playerId: event.playerId,
                reason: 'DEPLOY_EFFECT_STEP_RESOLVED',
                sourceCarduid: event.data.carduid,
                effectId: normalizedEffect.effectId,
                remainingEffects: remainingEffects.length,
                timestamp: Date.now()
            },
            'normal'
        );

        if (!requiresTargetChoice && remainingEffects.length === 0 && event.data.cardPlayNotificationId) {
            CardPlayNotificationLifecycle.markCompleted(gameEnv, event.data.cardPlayNotificationId);
        }

        return { success: true };
    }

    private static buildDeployEffectOrderOptions(
        effects: EffectDefinition[],
        sourceCarduid: string
    ): Array<{ index: number; label: string; payload: { effect: EffectDefinition } }> {
        return effects.map((effect, index) => ({
            index,
            label: DeployEffectOptionPresenter.describe(effect, sourceCarduid),
            payload: {
                effect
            }
        }));
    }

    /**
     * Phase-aware detection for immediate "play" effects (command cards).
     * Activated abilities are intentionally excluded (they require a manual trigger + cost payment).
     */
    private static findPlayEffectsExecutableOnPlay(
        cardData: any,
        gameEnv: GameEnvironment
    ): EffectDefinition[] {
        if (!Array.isArray(cardData?.effects?.rules)) {
            return [];
        }

        const currentPhase = gameEnv.phase;
        const inMainPhase = currentPhase === GamePhase.MAIN_PHASE;
        const inActionStepPhase = currentPhase === GamePhase.ACTION_STEP_PHASE;

        if (!inMainPhase && !inActionStepPhase) {
            return [];
        }

        return (cardData.effects.rules as EffectDefinition[]).filter(rule => {
            if (!rule) {
                return false;
            }

            const isPlayEffect = rule.type === 'play' && cardData?.cardType === 'command';
            if (!isPlayEffect) {
                return false;
            }

            if (inMainPhase && EffectTimingWindowUtils.allowsPhase(rule, GamePhase.MAIN_PHASE)) {
                return true;
            }

            if (inActionStepPhase && EffectTimingWindowUtils.allowsPhase(rule, GamePhase.ACTION_STEP_PHASE)) {
                return true;
            }

            return false;
        });
    }

}
