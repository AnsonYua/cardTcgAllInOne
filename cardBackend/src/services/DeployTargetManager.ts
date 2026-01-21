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
import { EventFactory } from './EventQueue/EventFactory';
import { EffectExecutor } from './effects/EffectExecutor';
import { ensureEffectDefaults } from '../utils/EffectNormalizationUtils';
import { TargetResolver, ResolvedTargetConfig } from './targets/TargetResolver';

export interface DeployTargetResult {
    success: boolean;
    error?: string;
    requiresSelection?: boolean;    // true if TARGET_CHOICE event created
    autoApplied?: boolean;         // true if effect auto-applied (single target)
    affectedTargets?: TargetReference[];
}


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
            const availableTargets = TargetResolver.generateAvailableTargets(gameEnv, playerId, targetConfig);
            
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

            console.log("data 111111111 ",JSON.stringify(this.requiresPlayerChoice(targetConfig, availableTargets)))
            
            // Decision logic: Choice vs Auto-application
            if (this.requiresPlayerChoice(targetConfig, availableTargets)) {
                // Create TARGET_CHOICE event for player selection - pass objects directly
                const choiceEvent = EventFactory.createTargetChoiceEvent({
                    playerId,
                    sourceCarduid,
                    effect: normalizedEffect,
                    availableTargets
                });

                if (cardPlayNotificationId) {
                    choiceEvent.data.cardPlayNotificationId = cardPlayNotificationId;
                }
                
                // Add to processing queue for game event processing
                gameEnv.enqueueForProcessing(choiceEvent);
                
                console.log(`🎮 Created TARGET_CHOICE event ${choiceEvent.id} with ${availableTargets.length} targets`);
                return { 
                    success: true, 
                    requiresSelection: true 
                };
                
            } else {
                // Auto-apply to single target or all targets (based on count)
                const targetsToApply = availableTargets.slice(0, targetConfig.count);
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

            if (!selectedTargets) {
                return {
                    success: false,
                    error: 'No targets selected for effect'
                };
            }

            if (selectedTargets.length === 0) {
                return {
                    success: false,
                    error: 'No targets selected for effect'
                };
            }

            const normalizedTargets: TargetReference[] = selectedTargets.map((selection) => ({
                carduid: selection.carduid,
                zone: selection.zone,
                playerId: selection.playerId
            }));

            // Apply effect to selected targets - pass eventData object directly to minimize conversions
            const normalizedEffect = ensureEffectDefaults(eventData.effect);
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

    /**
     * Determine if player choice is required
     * 
     * Logic:
     * - If count=1 and multiple targets available → Requires choice
     * - If count>1 → Always requires choice (select multiple)
     * - If only one target or auto-select scenarios → No choice needed
     */

    /**
     * Determine if player choice is required
     * 
     * Logic:
     * - If count=1 and multiple targets available → Requires choice
     * - If count>1 → Always requires choice (select multiple)
     * - If only one target or auto-select scenarios → No choice needed
     */
    private static requiresPlayerChoice(targetConfig: ResolvedTargetConfig, availableTargets: TargetReference[]): boolean {
        console.log("requiresPlayerChoice 00 " + JSON.stringify(targetConfig))
        if (targetConfig.scope === "self_shield" || targetConfig.scope === "opponent_shield") {
            return false;
        }

        const scopeValue = typeof targetConfig.scope === 'string'
            ? targetConfig.scope.toLowerCase()
            : '';

        if (scopeValue.includes('all')) {
            return false;
        }

        console.log("requiresPlayerChoice 11")
        // Multiple target selection always requires choice
        if (targetConfig.count > 1) {
            return availableTargets.length > 0;
        }
        console.log("requiresPlayerChoice 22")
        // Single target selection requires choice only if multiple options
        if (targetConfig.count === 1) {
            return availableTargets.length > 1;
        }
        console.log("requiresPlayerChoice 333")
        
        // Zero or negative count - no choice needed
        return false;
    }
    
    /**
     * Clean up expired temporary effects at end of turn
     * Now works with unit-stored effects instead of player-level effects
     */
    static cleanupExpiredTemporaryEffects(gameEnv: GameEnvironment, endingPlayerId: string): void {
        EffectExecutor.cleanupExpiredTemporaryEffects(gameEnv, endingPlayerId);
    }

}
