// src/services/effects/SequenceEffectManager.ts
// Supports "sequence" effects with nested steps, including conditional branching and choice-driven pauses.

import { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { applyMoveTopDeckToTrash } from './actions/EffectDeckActions';
import { EffectExecutor } from './EffectExecutor';
import { DelayedTriggerManager } from './DelayedTriggerManager';
import { DeployTargetManager } from '../DeployTargetManager';
import type { SequenceContinuationAfterChoiceContext } from './sequence/SequenceContinuationContext';
import { EffectSelfTargetNormalizer } from '../targets/EffectSelfTargetNormalizer';
import { EffectConditionEvaluator } from '../conditions/EffectConditionEvaluator';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';

export type SequenceStep = {
    action: string;
    stepId?: string;
    effectId?: string;
    optional?: boolean;
    conditions?: Array<Record<string, unknown>>;
    target?: Record<string, unknown>;
    timing?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
};

type SequenceContext = {
    movedCards: any[];
    movedCardsByStepId: Record<string, any[]>;
    resolvedStepIds: Set<string>;
    sequenceEffectId?: string;
    previousTargets: Array<{ carduid: string; zone: string; playerId: string }>;
};

export type SequenceContinuationPayload = {
    steps: SequenceStep[];
    ctx: {
        movedCards?: any[];
        movedCardsByStepId?: Record<string, any[]>;
        resolvedStepIds?: string[];
        sequenceEffectId?: string;
        previousTargets?: Array<{ carduid: string; zone: string; playerId: string }>;
    };
};

export interface SequenceProcessResult {
    success: boolean;
    error?: string;
    requiresSelection?: boolean;
}

export class SequenceEffectManager {
    static processSequenceEffect(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): SequenceProcessResult {
        const steps = Array.isArray(effect.parameters?.steps)
            ? (effect.parameters!.steps as SequenceStep[])
            : [];

        const ctx: SequenceContext = {
            movedCards: [],
            movedCardsByStepId: {},
            resolvedStepIds: new Set<string>(),
            sequenceEffectId: typeof effect.effectId === 'string' ? effect.effectId : undefined,
            previousTargets: []
        };

        return this.runSteps(gameEnv, playerId, sourceCarduid, steps, ctx, cardPlayNotificationId);
    }

    static continueSequence(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        payload: SequenceContinuationPayload,
        cardPlayNotificationId?: string
    ): SequenceProcessResult {
        const ctx: SequenceContext = {
            movedCards: Array.isArray(payload.ctx?.movedCards) ? payload.ctx.movedCards : [],
            movedCardsByStepId: (payload.ctx?.movedCardsByStepId && typeof payload.ctx.movedCardsByStepId === 'object')
                ? (payload.ctx.movedCardsByStepId as Record<string, any[]>)
                : {},
            resolvedStepIds: new Set<string>(Array.isArray(payload.ctx?.resolvedStepIds) ? payload.ctx.resolvedStepIds : []),
            sequenceEffectId: typeof payload.ctx?.sequenceEffectId === 'string' ? payload.ctx.sequenceEffectId : undefined,
            previousTargets: Array.isArray(payload.ctx?.previousTargets) ? payload.ctx.previousTargets : []
        };

        const steps = Array.isArray(payload.steps) ? payload.steps : [];
        return this.runSteps(gameEnv, playerId, sourceCarduid, steps, ctx, cardPlayNotificationId);
    }

    private static runSteps(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        steps: SequenceStep[],
        ctx: SequenceContext,
        cardPlayNotificationId?: string
    ): SequenceProcessResult {
        if (steps.length === 0) {
            return { success: true };
        }

        for (let index = 0; index < steps.length; index++) {
            const step = steps[index];
            if (!step || typeof step.action !== 'string') {
                continue;
            }

            const stepAction = step.action;
            const params = (step.parameters || {}) as Record<string, unknown>;
            const stepId = typeof step.stepId === 'string' ? step.stepId : undefined;
            const stepEffect = this.buildStepEffect(step, stepId);
            const sourceCard = sourceCarduid ? SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid) : null;
            const stepEligible = EffectConditionEvaluator.validateEffectConditions(
                stepEffect,
                gameEnv,
                playerId,
                sourceCard as any
            );
            if (!stepEligible) {
                continue;
            }

            if (stepAction === 'conditional') {
                const conditionMet = this.evaluateConditional(
                    gameEnv,
                    playerId,
                    sourceCarduid,
                    ctx,
                    params
                );
                const branchSteps = conditionMet
                    ? (Array.isArray(params.then) ? (params.then as SequenceStep[]) : [])
                    : (Array.isArray(params.else) ? (params.else as SequenceStep[]) : []);
                if (branchSteps.length === 0) {
                    this.markResolved(ctx, stepId || step.effectId || stepAction);
                    continue;
                }

                const remaining = steps.slice(index + 1);
                const stitched = [...branchSteps, ...remaining];
                this.markResolved(ctx, stepId || step.effectId || stepAction);
                return this.runSteps(gameEnv, playerId, sourceCarduid, stitched, ctx, cardPlayNotificationId);
            }

            if (stepAction === 'moveTopDeckToTrash') {
                const count = typeof params.count === 'number' ? params.count : 0;
                if (count > 0) {
                    const result = applyMoveTopDeckToTrash(gameEnv, playerId, count, {
                        sourceCarduid,
                        effectId: ctx.sequenceEffectId,
                        reveal: params.reveal === true,
                        reason: typeof params.notes === 'string' ? params.notes : 'sequence_moveTopDeckToTrash'
                    });
                    if (!result.success) {
                        return { success: false, error: result.error || 'moveTopDeckToTrash failed' };
                    }
                    ctx.movedCards = result.movedCards;
                    if (stepId) {
                        ctx.movedCardsByStepId[stepId] = result.movedCards;
                    }
                }
                this.markResolved(ctx, stepId || step.effectId || stepAction);
                continue;
            }

            if (stepAction === 'discard') {
                const discardResult = this.processDiscardStep(
                    gameEnv,
                    playerId,
                    sourceCarduid,
                    step,
                    stepId,
                    params,
                    steps,
                    index,
                    ctx,
                    cardPlayNotificationId
                );
                if (discardResult) {
                    return discardResult;
                }
                continue;
            }

            if (stepAction === 'draw_if_moved_cards_match_traits') {
                const traitsAny = Array.isArray(params.traitsAny)
                    ? params.traitsAny.filter(item => typeof item === 'string')
                    : [];
                const value = typeof params.value === 'number' ? params.value : 0;

                const matched = traitsAny.length === 0
                    ? ctx.movedCards.length > 0
                    : ctx.movedCards.some((card: any) => {
                        const cardTraits = Array.isArray(card?.cardData?.traits) ? card.cardData.traits : [];
                        return traitsAny.some((trait: string) => cardTraits.includes(trait));
                    });

                if (matched && value > 0) {
                    const player = gameEnv.getPlayer(playerId);
                    if (!player?.deck) {
                        return { success: false, error: 'Player deck not found for conditional draw' };
                    }
                    EffectExecutor.drawCardsIntoHand(gameEnv, playerId, player.deck as any, value, {
                        drawContext: sourceCarduid ? `sequence:${sourceCarduid}` : 'sequence'
                    });
                }
                this.markResolved(ctx, stepId || step.effectId || stepAction);
                continue;
            }

            if (stepAction === 'registerDelayedTrigger') {
                const result = DelayedTriggerManager.registerFromSequenceStep(gameEnv, playerId, sourceCarduid, params);
                if (!result.success) {
                    return { success: false, error: result.error || 'registerDelayedTrigger failed' };
                }
                this.markResolved(ctx, stepId || step.effectId || stepAction);
                continue;
            }

            const stepScope = typeof (step.target as any)?.scope === 'string' ? ((step.target as any).scope as string) : '';

            if (stepScope === 'previous_target') {
                if (!Array.isArray(ctx.previousTargets) || ctx.previousTargets.length === 0) {
                    continue;
                }

                const maxCount = typeof (step.target as any)?.count === 'number'
                    ? ((step.target as any).count as number)
                    : 1;
                const targetsToApply = ctx.previousTargets.slice(0, Math.max(0, maxCount));

                const applyResult = EffectExecutor.applyEffectToTargets(
                    gameEnv,
                    stepEffect,
                    targetsToApply as any,
                    playerId,
                    sourceCarduid
                );
                if (!applyResult.success) {
                    return { success: false, error: applyResult.error || `Sequence step ${stepAction} failed` };
                }

                this.markResolved(ctx, stepId || step.effectId || stepAction);
                continue;
            }

            const normalizedStepEffect = EffectSelfTargetNormalizer.normalizeWithSourceCarduid(
                gameEnv,
                stepEffect,
                sourceCarduid
            );

            const result = DeployTargetManager.processEffectWithTargetChoice(
                gameEnv,
                playerId,
                sourceCarduid,
                normalizedStepEffect,
                cardPlayNotificationId
            );

            if (!result.success) {
                return { success: false, error: result.error || `Sequence step ${stepAction} failed` };
            }

            if (result.requiresSelection) {
                const remainingSteps = steps.slice(index + 1);
                const resolveKey = stepId || step.effectId || stepAction;
                this.attachContinuationToChoiceEvent(gameEnv, (result as any).choiceEventId, playerId, sourceCarduid, remainingSteps, ctx, resolveKey, cardPlayNotificationId);
                return { success: true, requiresSelection: true };
            }

            this.markResolved(ctx, stepId || step.effectId || stepAction);

            if (Array.isArray((result as any).affectedTargets) && (result as any).affectedTargets.length > 0) {
                ctx.previousTargets = (result as any).affectedTargets.map((t: any) => ({
                    carduid: t.carduid,
                    zone: t.zone,
                    playerId: t.playerId
                }));
            }
        }

        return { success: true };
    }

    private static processDiscardStep(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        step: SequenceStep,
        stepId: string | undefined,
        params: Record<string, unknown>,
        steps: SequenceStep[],
        index: number,
        ctx: SequenceContext,
        cardPlayNotificationId?: string
    ): SequenceProcessResult | null {
        const targetCount = typeof (step.target as any)?.count === 'number'
            ? ((step.target as any).count as number)
            : undefined;
        const count = typeof params.value === 'number'
            ? params.value
            : (typeof targetCount === 'number' ? targetCount : 1);

        if (count <= 0) {
            return null;
        }

        const targetConfig = (step.target && typeof step.target === 'object')
            ? ({ ...(step.target as Record<string, unknown>) } as Record<string, unknown>)
            : {};
        if (typeof targetConfig.type !== 'string') {
            targetConfig.type = 'card';
        }
        if (typeof targetConfig.scope !== 'string') {
            targetConfig.scope = 'self_hand';
        }
        if (typeof targetConfig.count !== 'number') {
            targetConfig.count = count;
        }
        if (!targetConfig.selection || typeof targetConfig.selection !== 'object') {
            targetConfig.selection = { type: 'player_choice' };
        }

        const discardEffect = ensureEffectDefaults({
            effectId: stepId || step.effectId || 'sequence_discard',
            type: 'internal',
            trigger: 'SEQUENCE_STEP',
            optional: Boolean(step.optional),
            action: 'discardFromHand',
            target: targetConfig as any,
            parameters: {
                ...(step.parameters ? { ...(step.parameters as Record<string, unknown>) } : {}),
                value: count
            }
        } as any);
        const normalizedDiscardEffect = EffectSelfTargetNormalizer.normalizeWithSourceCarduid(
            gameEnv,
            discardEffect,
            sourceCarduid
        );

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            playerId,
            sourceCarduid,
            normalizedDiscardEffect,
            cardPlayNotificationId
        );

        if (!result.success) {
            return { success: false, error: result.error || 'discard failed' };
        }

        if (result.requiresSelection) {
            const remainingSteps = steps.slice(index + 1);
            const resolveKey = stepId || step.effectId || 'discard';
            this.attachContinuationToChoiceEvent(gameEnv, (result as any).choiceEventId, playerId, sourceCarduid, remainingSteps, ctx, resolveKey, cardPlayNotificationId);
            return { success: true, requiresSelection: true };
        }

        this.markResolved(ctx, stepId || step.effectId || 'discard');
        return null;
    }

    private static attachContinuationToChoiceEvent(
        gameEnv: GameEnvironment,
        choiceEventId: string | undefined,
        playerId: string,
        sourceCarduid: string,
        remainingSteps: SequenceStep[],
        ctx: SequenceContext,
        resolveKey: string,
        cardPlayNotificationId?: string
    ): void {
        if (!choiceEventId) {
            return;
        }

        const choiceEvent = gameEnv.processingQueue.find((evt: any) => evt && evt.id === choiceEventId);
        if (!choiceEvent || !choiceEvent.data) {
            return;
        }

            const continuationContext: SequenceContinuationAfterChoiceContext = {
                kind: 'SEQUENCE_CONTINUATION_AFTER_CHOICE',
                playerId,
                sourceCarduid,
                remainingSteps,
                resolveKey,
                ctx: {
                    movedCards: ctx.movedCards,
                    movedCardsByStepId: ctx.movedCardsByStepId,
                    resolvedStepIds: Array.from(ctx.resolvedStepIds),
                    sequenceEffectId: ctx.sequenceEffectId,
                    previousTargets: ctx.previousTargets
                },
                ...(cardPlayNotificationId ? { cardPlayNotificationId } : {})
        };
        (choiceEvent.data as any).context = continuationContext;
    }

    private static markResolved(ctx: SequenceContext, key: string): void {
        if (!key) {
            return;
        }
        ctx.resolvedStepIds.add(key);
    }

    private static buildStepEffect(step: SequenceStep, stepId?: string): EffectDefinition {
        return ensureEffectDefaults({
            effectId: (typeof step.effectId === 'string' && step.effectId.length > 0)
                ? step.effectId
                : (stepId || step.action),
            type: 'internal',
            trigger: 'SEQUENCE_STEP',
            optional: Boolean(step.optional),
            action: step.action,
            ...(Array.isArray(step.conditions) ? { conditions: step.conditions as any } : {}),
            ...(step.target ? { target: step.target as any } : {}),
            ...(step.timing ? { timing: step.timing as any } : {}),
            ...(step.parameters ? { parameters: step.parameters as any } : {})
        } as any);
    }

    private static evaluateConditional(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        ctx: SequenceContext,
        params: Record<string, unknown>
    ): boolean {
        const conditions = Array.isArray(params.if) ? (params.if as Array<Record<string, unknown>>) : [];
        if (conditions.length === 0) {
            return false;
        }

        const sourceCard = sourceCarduid ? SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid) : null;

        return conditions.every(condition => {
            if (!condition || typeof condition !== 'object') {
                return false;
            }

            const type = typeof condition.type === 'string' ? condition.type : '';
            const stepId = typeof condition.stepId === 'string' ? condition.stepId : '';

            if (type === 'stepResolved') {
                return stepId.length > 0 && ctx.resolvedStepIds.has(stepId);
            }

            if (type === 'milledAnyCardHasTrait') {
                const trait = typeof condition.trait === 'string' ? condition.trait : '';
                if (trait.length === 0) {
                    return false;
                }

                const movedCards = stepId.length > 0 && Array.isArray(ctx.movedCardsByStepId[stepId])
                    ? ctx.movedCardsByStepId[stepId]
                    : ctx.movedCards;

                if (!Array.isArray(movedCards) || movedCards.length === 0) {
                    return false;
                }

                return movedCards.some((card: any) => {
                    const traits = Array.isArray(card?.cardData?.traits) ? card.cardData.traits : [];
                    return traits.includes(trait);
                });
            }

            if (type === 'milledCardHasTraitsAny') {
                const traitsAny = Array.isArray(condition.traits)
                    ? condition.traits.filter((entry): entry is string => typeof entry === 'string')
                    : Array.isArray(condition.traitsAny)
                        ? condition.traitsAny.filter((entry): entry is string => typeof entry === 'string')
                        : [];
                if (traitsAny.length === 0) {
                    return false;
                }

                const movedCards = stepId.length > 0 && Array.isArray(ctx.movedCardsByStepId[stepId])
                    ? ctx.movedCardsByStepId[stepId]
                    : ctx.movedCards;
                if (!Array.isArray(movedCards) || movedCards.length === 0) {
                    return false;
                }

                return movedCards.some((card: any) => {
                    const cardTraits = Array.isArray(card?.cardData?.traits) ? card.cardData.traits : [];
                    return traitsAny.some((trait: string) => cardTraits.includes(trait));
                });
            }

            return EffectConditionEvaluator.validateEffectConditions(
                ensureEffectDefaults({
                    effectId: 'sequence_conditional_runtime_check',
                    type: 'internal',
                    trigger: 'SEQUENCE_STEP',
                    action: 'noop',
                    conditions: [condition]
                } as any),
                gameEnv,
                playerId,
                sourceCard as any
            );
        });
    }
}
