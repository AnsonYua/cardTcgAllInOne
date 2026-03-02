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
import { StatChangeTriggeredEffectCollector } from './effects/StatChangeTriggeredEffectCollector';
import { EffectUsageTracker } from './effects/EffectUsageTracker';
import { extractNumericValue } from './effects/actions/EffectActionUtils';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { EffectConditionEvaluator } from './conditions/EffectConditionEvaluator';
import { TriggeredEffectProcessor } from './effects/TriggeredEffectProcessor';
import type { DeployTargetResult } from './DeployTargetResult';
import { DeployAffordabilityEvaluator } from './deploy/DeployAffordabilityEvaluator';
import {
    enqueueAttackEffectChainContinuation,
    extractAttackEffectChainContinuation
} from './effects/attack/AttackEffectChainContinuation';

export type { DeployTargetResult } from './DeployTargetResult';

type ProcessEffectWithTargetChoiceOptions = {
    skipConditionValidation?: boolean;
    choiceContext?: Record<string, unknown>;
};

export class DeployTargetManager {
    private static buildAvailableTargetsForEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        selectionContext?: {
            justLinkedUnitCarduid?: string;
        },
        dynamicFilterContext?: {
            previousTargets?: TargetReference[];
        }
    ): { targetConfig: ReturnType<typeof TargetResolver.resolveTargetConfig>; availableTargets: TargetReference[] } {
        const targetConfig = TargetResolver.resolveTargetConfig(effect);

        let availableTargets = TargetScopeResolverRegistry.resolve(gameEnv, sourceCarduid, effect);
        if (!availableTargets) {
            availableTargets = TargetResolver.generateAvailableTargets(
                gameEnv,
                playerId,
                targetConfig,
                sourceCarduid,
                dynamicFilterContext
            );
        }

        availableTargets = TargetSelectionPipeline.apply(
            gameEnv,
            availableTargets,
            effect,
            sourceCarduid,
            selectionContext
        );

        const excludePairedUnit = effect.parameters?.excludePairedUnit === true;
        if (excludePairedUnit) {
            const pairedUnitCarduid = this.resolvePairedUnitCarduidForExclusion(
                gameEnv,
                playerId,
                sourceCarduid,
                effect
            );
            if (pairedUnitCarduid) {
                availableTargets = TargetSelectionUtils.excludeCarduid(availableTargets, pairedUnitCarduid);
            }
        }

        availableTargets = CostReplacementManager.augmentRestBaseTargets(
            gameEnv,
            playerId,
            sourceCarduid,
            effect,
            availableTargets
        );

        availableTargets = this.filterDeployTargetsByAffordabilityIfNeeded(
            gameEnv,
            playerId,
            sourceCarduid,
            effect,
            availableTargets
        );

        return { targetConfig, availableTargets };
    }

    private static filterDeployTargetsByAffordabilityIfNeeded(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        availableTargets: TargetReference[]
    ): TargetReference[] {
        const action = typeof effect.action === 'string' ? effect.action.toLowerCase() : '';
        if (action !== 'deploy' || effect.parameters?.payCost !== true) {
            return availableTargets;
        }

        return availableTargets.filter((target) =>
            DeployAffordabilityEvaluator.evaluate(gameEnv, playerId, target, effect, sourceCarduid).isAffordable
        );
    }

    private static resolvePairedUnitCarduidForExclusion(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition
    ): string | null {
        const pairedSlot = typeof (effect as any).pairedSlot === 'string'
            ? ((effect as any).pairedSlot as string)
            : '';
        const player = gameEnv.getPlayer(playerId);
        if (!player?.zones) {
            return null;
        }

        if (pairedSlot) {
            const pairedUnitCarduid = (player.zones as any)[pairedSlot]?.unit?.carduid;
            return typeof pairedUnitCarduid === 'string' && pairedUnitCarduid.length > 0
                ? pairedUnitCarduid
                : null;
        }

        const sourceLocation = SlotZoneUtils.findSlotByCarduid(player.zones, sourceCarduid);
        if (sourceLocation?.slotName && sourceLocation?.pilot) {
            const pairedUnitCarduid = (player.zones as any)[sourceLocation.slotName]?.unit?.carduid;
            return typeof pairedUnitCarduid === 'string' && pairedUnitCarduid.length > 0
                ? pairedUnitCarduid
                : null;
        }

        return null;
    }

    static evaluateImmediateResolution(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        selectionContext?: {
            justLinkedUnitCarduid?: string;
        },
        dynamicFilterContext?: {
            previousTargets?: TargetReference[];
        }
    ): { resolvable: boolean; noOpNoTargets: boolean; reason?: string } {
        const normalizedEffect = ensureEffectDefaults(effect);
        const effectAction = EffectExecutor.getEffectAction(normalizedEffect);

        if (EffectExecutor.actionSupportsNoTargets(effectAction)) {
            return { resolvable: true, noOpNoTargets: false };
        }

        try {
            const { availableTargets } = this.buildAvailableTargetsForEffect(
                gameEnv,
                playerId,
                sourceCarduid,
                normalizedEffect,
                selectionContext,
                dynamicFilterContext
            );

            if (availableTargets.length > 0) {
                return { resolvable: true, noOpNoTargets: false };
            }

            const failIfNoTargets = normalizedEffect.parameters?.failIfNoTargets === true ||
                (normalizedEffect.target as any)?.required === true;
            if (failIfNoTargets) {
                return { resolvable: true, noOpNoTargets: false, reason: 'no_targets_required' };
            }

            return { resolvable: false, noOpNoTargets: true, reason: 'no_targets' };
        } catch (error) {
            return {
                resolvable: true,
                noOpNoTargets: false,
                reason: error instanceof Error ? error.message : 'resolution_preview_failed'
            };
        }
    }

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
        cardPlayNotificationId?: string,
        selectionContext?: {
            justLinkedUnitCarduid?: string;
        },
        dynamicFilterContext?: {
            previousTargets?: TargetReference[];
        },
        options?: ProcessEffectWithTargetChoiceOptions
    ): DeployTargetResult {
        const normalizedEffect = ensureEffectDefaults(effect);
        const effectAction = EffectExecutor.getEffectAction(normalizedEffect);
        const effectLabel = normalizedEffect.effectId || effectAction || 'unknown';
        console.log(`🎯 Processing effect ${effectLabel} requiring target selection`);

        try {
            const sourceCard = sourceCarduid ? SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid) : null;
            const shouldValidateConditions = options?.skipConditionValidation !== true;
            if (
                shouldValidateConditions &&
                !EffectConditionEvaluator.validateEffectConditions(normalizedEffect, gameEnv, playerId, sourceCard as any)
            ) {
                console.log(`⏭️ Skipping ineligible effect ${effectLabel} (timing/conditions not met)`);
                return {
                    success: true,
                    autoApplied: true,
                    affectedTargets: []
                };
            }

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

            const { targetConfig, availableTargets } = this.buildAvailableTargetsForEffect(
                gameEnv,
                playerId,
                sourceCarduid,
                normalizedEffect,
                selectionContext,
                dynamicFilterContext
            );
            
            if (availableTargets.length === 0) {
                console.log(`⚠️ No eligible targets found for ${effect.effectId}`);
                const failIfNoTargets = normalizedEffect.parameters?.failIfNoTargets === true ||
                    (normalizedEffect.target as any)?.required === true;
                if (failIfNoTargets) {
                    return {
                        success: false,
                        error: `No eligible targets found for ${effectLabel}`,
                        failureKind: 'NO_TARGETS_REQUIRED'
                    };
                }
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
                    ...((selectionContext || options?.choiceContext)
                        ? {
                            context: {
                                ...(selectionContext || {}),
                                ...(options?.choiceContext || {})
                            }
                        }
                        : {}),
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
                const applyAllTargets =
                    scopeValue === 'any_all_unit' ||
                    (scopeValue.includes('all') && targetConfig.count > 1);
                const targetsToApply = applyAllTargets ? availableTargets : availableTargets.slice(0, targetConfig.count);
                const result = EffectExecutor.applyEffectToTargets(gameEnv, normalizedEffect, targetsToApply, playerId, sourceCarduid);
                if (result.success) {
                    const triggerResult = this.maybeTriggerApReducedByEnemyEffects(gameEnv, playerId, normalizedEffect, targetsToApply);
                    if (!triggerResult.success) {
                        return { success: false, error: triggerResult.error || 'AP reduced trigger failed' };
                    }
                    const supportTriggerResult = this.maybeTriggerSupportApIncreased(gameEnv, playerId, sourceCarduid, normalizedEffect, targetsToApply);
                    if (!supportTriggerResult.success) {
                        return { success: false, error: supportTriggerResult.error || 'Support AP increase trigger failed' };
                    }
                }
                const finalAffectedTargets = result.success
                    ? (Array.isArray(result.appliedTargets) ? result.appliedTargets : targetsToApply)
                    : [];
                
                console.log(`🤖 Auto-applied ${effect.effectId} to ${finalAffectedTargets.length} target(s)`);
                return {
                    success: result.success,
                    error: result.error,
                    autoApplied: true,
                    affectedTargets: finalAffectedTargets
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

            const normalizedSelections: TargetChoiceSelection[] = Array.isArray(selectedTargets)
                ? selectedTargets
                : [];

            const availableTargets: TargetReference[] = Array.isArray(eventData.availableTargets)
                ? eventData.availableTargets
                : [];
            const normalizedTargets: TargetReference[] = normalizedSelections.map((selection) =>
                this.hydrateSelectedTargetFromAvailableTargets(selection, availableTargets)
            );

            // Even if the player declined an optional selection (empty array), context handlers may need
            // to run (e.g., optional COST flows that must resume an attack after declining the cost).
            const contextResult = TargetChoiceContextHandlerRegistry.tryHandle(gameEnv, event, normalizedTargets);
            if (contextResult.handled) {
                return contextResult.success
                    ? { success: true }
                    : { success: false, error: contextResult.error || 'TARGET_CHOICE context handler failed' };
            }

            const attackEffectContinuation = extractAttackEffectChainContinuation(eventData.context);

            if (normalizedSelections.length === 0) {
                if (normalizedEffect.optional === true) {
                    enqueueAttackEffectChainContinuation(gameEnv, attackEffectContinuation, event.id);
                    return { success: true };
                }
                return { success: false, error: 'No targets selected for effect' };
            }

            const validation = TargetCountUtils.validateSelectedCount(
                normalizedSelections.length,
                normalizedEffect.target?.count
            );
            if (!validation.ok) {
                return { success: false, error: validation.error };
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

            const triggerResult = this.maybeTriggerApReducedByEnemyEffects(gameEnv, event.playerId, normalizedEffect, normalizedTargets);
            if (!triggerResult.success) {
                return { success: false, error: triggerResult.error || 'AP reduced trigger failed' };
            }
            const supportTriggerResult = this.maybeTriggerSupportApIncreased(
                gameEnv,
                event.playerId,
                eventData.sourceCarduid,
                normalizedEffect,
                normalizedTargets
            );
            if (!supportTriggerResult.success) {
                return { success: false, error: supportTriggerResult.error || 'Support AP increase trigger failed' };
            }

            console.log(`✅ Successfully applied ${normalizedEffect.effectId} to ${normalizedSelections.length} selected target(s)`);
            enqueueAttackEffectChainContinuation(gameEnv, attackEffectContinuation, event.id);
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

    private static hydrateSelectedTargetFromAvailableTargets(
        selection: TargetChoiceSelection,
        availableTargets: TargetReference[]
    ): TargetReference {
        const canonical = availableTargets.find((target) =>
            target?.carduid === selection.carduid &&
            target?.zone === selection.zone &&
            target?.playerId === selection.playerId
        );

        if (canonical) {
            return {
                carduid: canonical.carduid,
                zone: canonical.zone,
                playerId: canonical.playerId,
                ...(canonical.cardData ? { cardData: canonical.cardData } : {}),
                ...(Array.isArray(canonical.tags) ? { tags: [...canonical.tags] } : {}),
                ...(canonical.computed && typeof canonical.computed === 'object'
                    ? { computed: { ...canonical.computed } }
                    : {})
            };
        }

        return {
            carduid: selection.carduid,
            zone: selection.zone,
            playerId: selection.playerId
        };
    }

    private static maybeTriggerApReducedByEnemyEffects(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        effect: EffectDefinition,
        appliedTargets: TargetReference[]
    ): { success: boolean; error?: string } {
        const effectAction = EffectExecutor.getEffectAction(effect);
        if (effectAction !== 'modifyAP') {
            return { success: true };
        }

        const value = extractNumericValue(effect.parameters);
        if (value === undefined || value >= 0) {
            return { success: true };
        }

        for (const target of appliedTargets) {
            if (!target?.carduid || !target?.playerId) {
                continue;
            }

            if (target.playerId === sourcePlayerId) {
                continue;
            }

            const collected = StatChangeTriggeredEffectCollector.collectApReducedByEnemyEffect(gameEnv, {
                targetCarduid: target.carduid,
                targetPlayerId: target.playerId,
                sourcePlayerId
            });
            if (!collected.success) {
                return { success: false, error: collected.error };
            }

            for (const triggered of collected.effects) {
                const triggeredResult = this.processEffectWithTargetChoice(
                    gameEnv,
                    target.playerId,
                    target.carduid,
                    triggered.effect
                );

                if (!triggeredResult.success) {
                    return { success: false, error: triggeredResult.error || 'Failed to apply AP_REDUCED_BY_ENEMY_EFFECT effect' };
                }

                if (triggered.oncePerTurn && triggered.usageKey) {
                    const resolvedTarget = SlotZoneUtils.getCardByUid(gameEnv, target.carduid) as any;
                    if (resolvedTarget) {
                        EffectUsageTracker.markUsedThisTurn(resolvedTarget, triggered.usageKey, gameEnv.currentTurn);
                    }
                }
            }
        }

        return { success: true };
    }

    private static maybeTriggerSupportApIncreased(
        gameEnv: GameEnvironment,
        sourcePlayerId: string,
        sourceCarduid: string | undefined,
        effect: EffectDefinition,
        appliedTargets: TargetReference[]
    ): { success: boolean; error?: string } {
        if (!sourceCarduid) {
            return { success: true };
        }

        const effectAction = EffectExecutor.getEffectAction(effect);
        if (effectAction !== 'modifyAP') {
            return { success: true };
        }

        const value = extractNumericValue(effect.parameters);
        if (value === undefined || value <= 0) {
            return { success: true };
        }

        if (!this.isSupportLikeApBoost(effect)) {
            return { success: true };
        }

        const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid) as any;
        if (!sourceCard || sourceCard?.cardData?.cardType !== 'unit') {
            return { success: true };
        }

        const sourceOwner = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, sourceCarduid);
        if (!sourceOwner.found || sourceOwner.playerId !== sourcePlayerId) {
            return { success: true };
        }

        const hasZaftTarget = appliedTargets.some(target => {
            const targetCard = SlotZoneUtils.getCardByUid(gameEnv, target.carduid) as any;
            const traits = Array.isArray(targetCard?.cardData?.traits) ? targetCard.cardData.traits : [];
            return traits.includes('ZAFT');
        });
        if (!hasZaftTarget) {
            return { success: true };
        }

        return TriggeredEffectProcessor.processForSourceCard(gameEnv, sourcePlayerId, sourceCard, {
            trigger: 'SUPPORT_AP_INCREASED',
            expectedTriggers: ['SUPPORT_AP_INCREASED'],
            fallbackEffectId: 'support_ap_increased',
            defaultTargetScope: 'self'
        });
    }

    private static isSupportLikeApBoost(effect: EffectDefinition): boolean {
        const cost = effect.cost && typeof effect.cost === 'object'
            ? (effect.cost as Record<string, unknown>)
            : {};
        const restsSelf = cost['restSelf'] === true || cost['rest'] === 'self' || cost['tap'] === 'self';
        if (!restsSelf) {
            return false;
        }

        const params = effect.parameters && typeof effect.parameters === 'object'
            ? (effect.parameters as Record<string, unknown>)
            : {};
        if (params['excludeSource'] === true) {
            return true;
        }

        const target = effect.target && typeof effect.target === 'object'
            ? (effect.target as Record<string, unknown>)
            : {};
        const filters = target['filters'] && typeof target['filters'] === 'object'
            ? (target['filters'] as Record<string, unknown>)
            : {};

        return filters['excludeSelf'] === true;
    }

}
