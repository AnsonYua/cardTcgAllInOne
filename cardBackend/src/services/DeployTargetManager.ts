/**
 * Deploy Target Manager
 * 
 * Handles all deploy target selection scenarios including:
 * - Deploy effects requiring player choice
 * - Pairing effects with multiple eligible targets  
 * - Future effect types requiring target selection
 * 
 * Replaces DEPLOY_TARGET_CHOICE with unified TARGET_CHOICE system.
 */

import { GameEnvironment } from '../models/GameEnvironment';
import {
    EventStatus,
    EffectDefinition,
    TargetChoiceEvent,
    TargetChoiceSelection,
    TargetReference
} from './EventQueue/interfaces/GameEvent';
import { EffectExecutor } from './effects/EffectExecutor';
import { ensureEffectDefaults } from '../utils/EffectNormalizationUtils';
import { TargetResolver } from './targets/TargetResolver';
import { TargetChoicePolicy } from './choices/TargetChoicePolicy';
import { ChoiceEventScheduler } from './choices/ChoiceEventScheduler';
import { TargetSelectionPipeline } from './targets/TargetSelectionPipeline';
import { EffectActionRouter } from './effects/EffectActionRouter';
import { CostReplacementManager } from './costs/CostReplacementManager';
import { TargetScopeResolverRegistry } from './targets/TargetScopeResolverRegistry';
import { TargetCountUtils } from './targets/TargetCountUtils';
import { CostFlowInterceptor } from './costs/CostFlowInterceptor';
import { TargetChoiceContextHandlerRegistry } from './choices/TargetChoiceContextHandlerRegistry';
import { TargetSelectionUtils } from './targets/TargetSelectionUtils';
import type { DeployTargetResult } from './DeployTargetResult';

export type { DeployTargetResult } from './DeployTargetResult';

export class DeployTargetManager {

    /**
     * Main entry point: Process effect that may require target selection
     * 
     * Logic:
     * - If multiple targets available and count=1 → Create TARGET_CHOICE event
     * - If single target available → Auto-apply effect
     * - If no targets available → Effect succeeds but does nothing
     */
    static processEffectWithTargetChoice(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): DeployTargetResult {
        const normalizedEffect = ensureEffectDefaults(effect);
        const effectAction = EffectExecutor.getEffectAction(normalizedEffect);
        const effectLabel = normalizedEffect.effectId || effectAction || 'unknown';
        console.log(`🎯 Processing effect ${effectLabel} requiring target selection`);

        try {
            const intercepted = CostFlowInterceptor.intercept(
                gameEnv,
                playerId,
                sourceCarduid,
                normalizedEffect,
                cardPlayNotificationId
            );
            if (intercepted) {
                return intercepted;
            }

            const routedResult = EffectActionRouter.tryProcessEffectAction(
                gameEnv,
                playerId,
                sourceCarduid,
                normalizedEffect,
                cardPlayNotificationId
            );
            if (routedResult) {
                return routedResult;
            }
            if (EffectExecutor.actionSupportsNoTargets(effectAction)) {
                const result = EffectExecutor.applyEffectToTargets(gameEnv, normalizedEffect, [], playerId, sourceCarduid);
                return {
                    success: result.success,
                    error: result.error,
                    autoApplied: true,
                    affectedTargets: []
                };
            }

            const targetConfig = TargetResolver.resolveTargetConfig(normalizedEffect);
            // Generate available targets based on config
            let availableTargets = TargetScopeResolverRegistry.resolve(gameEnv, sourceCarduid, normalizedEffect);
            if (!availableTargets) {
                availableTargets = TargetResolver.generateAvailableTargets(gameEnv, playerId, targetConfig);
            }
            availableTargets = TargetSelectionPipeline.apply(availableTargets, normalizedEffect, sourceCarduid);

            const excludePairedUnit = normalizedEffect.parameters?.excludePairedUnit === true;
            const pairedSlot = typeof (normalizedEffect as any).pairedSlot === 'string' ? ((normalizedEffect as any).pairedSlot as string) : '';
            if (excludePairedUnit && pairedSlot) {
                const player = gameEnv.getPlayer(playerId);
                const pairedUnitCarduid = player?.zones && (player.zones as any)[pairedSlot]?.unit?.carduid;
                if (typeof pairedUnitCarduid === 'string' && pairedUnitCarduid.length > 0) {
                    availableTargets = TargetSelectionUtils.excludeCarduid(availableTargets, pairedUnitCarduid);
                }
            }

            availableTargets = CostReplacementManager.augmentRestBaseTargets(
                gameEnv,
                playerId,
                sourceCarduid,
                normalizedEffect,
                availableTargets
            );
            
            if (availableTargets.length === 0) {
                console.log(`⚠️ No eligible targets found for ${effect.effectId}`);
                if (effectAction === 'damageShield') {
                    const result = EffectExecutor.applyEffectToTargets(gameEnv, normalizedEffect, [], playerId, sourceCarduid);
                    return {
                        success: result.success,
                        error: result.error,
                        autoApplied: true,
                        affectedTargets: []
                    };
                }
                return { 
                    success: true, 
                    autoApplied: true,
                    affectedTargets: [] 
                };
            }

            // Decision logic: Choice vs Auto-application
            const requiresChoice = TargetChoicePolicy.requiresChoice(targetConfig, availableTargets, normalizedEffect);
            if (requiresChoice) {
                const choiceEvent = ChoiceEventScheduler.enqueueTargetChoice(gameEnv, {
                    playerId,
                    sourceCarduid,
                    effect: normalizedEffect,
                    availableTargets,
                    cardPlayNotificationId
                });
                
                console.log(`🎮 Created TARGET_CHOICE event with ${availableTargets.length} targets`);
                return { 
                    success: true, 
                    requiresSelection: true,
                    choiceEventId: choiceEvent.id
                };
                
            } else {
                // Auto-apply to single target or all targets (based on count)
                const scopeValue = typeof targetConfig.scope === 'string' ? targetConfig.scope.toLowerCase() : '';
                const targetsToApply = scopeValue.includes('all')
                    ? availableTargets
                    : availableTargets.slice(0, targetConfig.count);
                const result = EffectExecutor.applyEffectToTargets(gameEnv, normalizedEffect, targetsToApply, playerId, sourceCarduid);
                
                console.log(`🤖 Auto-applied ${effect.effectId} to ${targetsToApply.length} target(s)`);
                return {
                    success: result.success,
                    error: result.error,
                    autoApplied: true,
                    affectedTargets: result.success ? targetsToApply : []
                };
            }
            
        } catch (error) {
            console.error(`❌ Error in processEffectWithTargetChoice:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Target choice processing failed'
            };
        }
    }

    /**
     * Execute TARGET_CHOICE event when player makes selection
     */
    static executeTargetChoice(event: TargetChoiceEvent, gameEnv: GameEnvironment): { success: boolean; error?: string } {
        console.log(`🎯 Executing TARGET_CHOICE event: ${event.id} (${event.status})`);
        try {
            if (event.status !== EventStatus.RESOLVING) {
                console.log(`⚠️ Unexpected event status: ${event.status} (expected RESOLVING)`);
                return { success: true }; // Skip - should not happen in correct flow
            }

            // Get event data object directly without destructuring to minimize conversions
            const eventData = event.data;
            
            // Use selectedTargets directly from eventData, normalizing to array if needed
            const selectedTargets: TargetChoiceSelection[] | undefined =
                eventData.selectedTargets ??
                (eventData.selectedTarget ? [eventData.selectedTarget] : undefined);

            const normalizedEffect = ensureEffectDefaults(eventData.effect);
            const selectionType = typeof normalizedEffect.target?.selection?.type === 'string'
                ? normalizedEffect.target.selection.type.toLowerCase()
                : '';

            if (!selectedTargets || selectedTargets.length === 0) {
                if (normalizedEffect.optional === true) {
                    return { success: true };
                }
                return { success: false, error: 'No targets selected for effect' };
            }

            if (selectionType === 'player_choice') {
                const validation = TargetCountUtils.validateSelectedCount(
                    selectedTargets.length,
                    normalizedEffect.target?.count
                );
                if (!validation.ok) {
                    return { success: false, error: validation.error };
                }
            }

            const normalizedTargets: TargetReference[] = selectedTargets.map((selection) => ({
                carduid: selection.carduid,
                zone: selection.zone,
                playerId: selection.playerId
            }));

            // Apply effect to selected targets - pass eventData object directly to minimize conversions
            const contextResult = TargetChoiceContextHandlerRegistry.tryHandle(gameEnv, event, normalizedTargets);
            if (contextResult.handled) {
                return contextResult.success
                    ? { success: true }
                    : { success: false, error: contextResult.error || 'TARGET_CHOICE context handler failed' };
            }

            const result = EffectExecutor.applyEffectToTargets(
                gameEnv,
                normalizedEffect,
                normalizedTargets,
                event.playerId,
                eventData.sourceCarduid
            );

            if (!result.success) {
                console.log(`❌ Failed to apply effect to selected targets: ${result.error}`);
                return result;
            }

            console.log(`✅ Successfully applied ${normalizedEffect.effectId} to ${selectedTargets.length} selected target(s)`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error in executeTargetChoice:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Target choice execution failed'
            };
        }
    }

    // Choice requirement logic lives in TargetChoicePolicy.
    
    /**
     * Clean up expired temporary effects at end of turn
     * Now works with unit-stored effects instead of player-level effects
     */
    static cleanupExpiredTemporaryEffects(gameEnv: GameEnvironment, endingPlayerId: string): void {
        EffectExecutor.cleanupExpiredTemporaryEffects(gameEnv, endingPlayerId);
    }

}
