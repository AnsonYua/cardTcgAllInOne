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
import { DeployTargetManager, DeployTargetResult } from './DeployTargetManager';
import { ensureEffectDefaults } from '../utils/EffectNormalizationUtils';
import { EffectRuleCatalog } from './effects/EffectRuleCatalog';

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

            console.log("event Data for play card ", JSON.stringify(eventData))

        
            const cardData = CardDatabaseManager.getCardDetailsFromCarduid(eventData.carduid);
            if (!cardData?.effects?.rules) {
                return { success: true, effectsFound: 0 };
            }
            
            // Command cards played as pilots should not trigger command deploy effects
            if (cardData.cardType === 'command' && eventData.playAs === 'pilot') {
                console.log("event Data for play card here")
                return { success: true, effectsFound: 0 };
            }
        const deployEffects = EffectRuleCatalog.collectEffects(cardData, {
            trigger: 'ENTERS_PLAY',
            fallbackEffectId: 'deploy_effect',
            expectedTriggers: ['ENTERS_PLAY'],
            preFilter: (rawRule) => {
                    const triggerValue = rawRule['trigger'];
                    return typeof triggerValue === 'string' && triggerValue === 'ENTERS_PLAY';
                }
        }).map(effect => ensureEffectDefaults(effect));

        if (deployEffects.length === 0) {
            const fallbackActivatedEffects = this.findActivatedMainActionUntilEotEffects(cardData);
            fallbackActivatedEffects.forEach(effect => deployEffects.push(ensureEffectDefaults(effect)));

            if (deployEffects.length === 0) {
                return { success: true, effectsFound: 0 };
            }
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
            const result: DeployTargetResult = DeployTargetManager.processEffectWithTargetChoice(
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
     * Fallback: detect activated effects with a MAIN_PHASE timing window (treated as deploy-like).
     */
    private static findActivatedMainActionUntilEotEffects(cardData: any): EffectDefinition[] {
        if (!Array.isArray(cardData?.effects?.rules)) {
            return [];
        }

        return (cardData.effects.rules as EffectDefinition[]).filter(rule => {
            if (!rule || rule.type !== 'activated') {
                return false;
            }

            const timing = rule.timing as Record<string, unknown> | undefined;
            const windows = Array.isArray(timing?.['windows'])
                ? (timing!['windows'] as string[]).map(window => window.toUpperCase())
                : [];

            return windows.includes('MAIN_PHASE');
        });
    }

}
