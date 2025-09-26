// src/services/DeployEffectManager.ts
// Deploy effect processing system for ENTERS_PLAY triggered effects

import { GameEnvironment } from '../models/GameEnvironment';
import { CardDatabaseManager } from '../models/CardSystem';
import {
    DeployEffectEvent,
    EffectDefinition,
    PlayCardEventData
} from './EventQueue/interfaces/GameEvent';
import { EventFactory } from './EventQueue/interfaces/GameEvent';
import { TargetChoiceManager, TargetChoiceResult } from './TargetChoiceManager';
import { ensureEffectDefaults, normalizeEffectRule } from '../utils/EffectNormalizationUtils';

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

            const deployEffects: EffectDefinition[] = [];
            for (const rule of cardData.effects.rules) {
                if (rule?.trigger === 'ENTERS_PLAY') {
                    deployEffects.push(this.normalizeDeployEffect(rule));
                }
            }

            if (deployEffects.length === 0) {
                return { success: true, effectsFound: 0 };
            }

            const deployEvent = EventFactory.createDeployEffectEvent(playerId, eventData.carduid, deployEffects);
            gameEnv.processingQueue.push(deployEvent);

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

        for (const effect of event.data.effects) {
            const normalizedEffect = ensureEffectDefaults(effect);
            const result: TargetChoiceResult = TargetChoiceManager.processEffectWithTargetChoice(
                gameEnv,
                event.playerId,
                event.data.carduid,
                normalizedEffect
            );

            if (!result.success && !result.requiresSelection) {
                const errorMessage = result.error || `Effect ${normalizedEffect.effectId} failed`;
                failures.push(errorMessage);
            }
        }

        if (failures.length > 0) {
            const combinedError = failures.join('; ');
            console.error(`❌ Deploy effects failed: ${combinedError}`);
            return { success: false, error: combinedError };
        }

        return { success: true };
    }

    /**
     * Normalize raw rule data from card JSON into EffectDefinition shape.
     */
    private static normalizeDeployEffect(rule: Record<string, unknown>): EffectDefinition {
        const normalized = normalizeEffectRule(rule, {
            fallbackEffectId: 'deploy_effect',
            expectedTriggers: ['ENTERS_PLAY'],
            defaultTrigger: 'ENTERS_PLAY'
        });

        if (!normalized) {
            return {
                effectId: 'deploy_effect',
                trigger: 'ENTERS_PLAY'
            };
        }

        return normalized;
    }
}
