// src/services/DeployEffectManager.ts
// Deploy effect processing system for ENTERS_PLAY triggered effects

import { GameEnvironment } from '../models/GameEnvironment';
import { CardDatabaseManager } from '../models/CardSystem';
import {
    DeployEffectEvent,
    EffectDefinition,
    EffectDetails,
    PlayCardEventData
} from './EventQueue/interfaces/GameEvent';
import { EventFactory } from './EventQueue/interfaces/GameEvent';
import { TargetChoiceManager, TargetChoiceResult } from './TargetChoiceManager';

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
            const normalizedEffect = this.ensureEffectDefaults(effect);
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
        const effectDetails = this.extractEffectDetails(rule.effect as EffectDetails | undefined);
        const parameters = this.extractParameters(rule, effectDetails);

        const normalized: EffectDefinition = {
            effectId: String(rule.effectId ?? 'deploy_effect'),
            type: typeof rule.type === 'string' ? rule.type : undefined,
            trigger: typeof rule.trigger === 'string' ? rule.trigger : undefined,
            optional: typeof rule.optional === 'boolean' ? rule.optional : undefined,
            target: (rule.target as EffectDefinition['target']) || undefined,
            action: effectDetails?.action,
            parameters,
            timing: this.extractTiming(rule),
            conditions: Array.isArray(rule.conditions) ? rule.conditions : undefined,
            description: rule.description as EffectDefinition['description'],
            effect: effectDetails || undefined
        };

        return normalized;
    }

    /**
     * Ensure event effects retain flattened action/parameters for downstream consumers.
     */
    private static ensureEffectDefaults(effect: EffectDefinition): EffectDefinition {
        const effectDetails = effect.effect ?? undefined;
        const action = effect.action ?? effectDetails?.action;
        const parameters = effect.parameters ?? effectDetails?.parameters;

        if (action === effect.action && parameters === effect.parameters) {
            return effect;
        }

        return {
            ...effect,
            action,
            parameters
        };
    }

    private static extractEffectDetails(effect: EffectDetails | undefined): EffectDetails | undefined {
        if (!effect) {
            return undefined;
        }
        if (typeof effect.action !== 'string') {
            return undefined;
        }
        return effect;
    }

    private static extractParameters(rule: Record<string, unknown>, effectDetails?: EffectDetails): Record<string, unknown> | undefined {
        if (rule.parameters && typeof rule.parameters === 'object') {
            return rule.parameters as Record<string, unknown>;
        }
        return effectDetails?.parameters;
    }

    private static extractTiming(rule: Record<string, unknown>): EffectDefinition['timing'] {
        const timing = rule.timing;
        if (!timing || typeof timing !== 'object') {
            return undefined;
        }
        const { duration, actionTurn } = timing as { duration?: string; actionTurn?: string };
        if (!duration && !actionTurn) {
            return undefined;
        }
        return { duration, actionTurn };
    }
}

