// src/services/costs/DiscardFromHandCostFlow.ts
// Cost flow: choose/discard N matching hand cards, then resolve follow-up effect.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { TargetResolver } from '../targets/TargetResolver';
import { TargetSelectionPipeline } from '../targets/TargetSelectionPipeline';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { EffectExecutor } from '../effects/EffectExecutor';
import { CostChoiceUtils } from './CostChoiceUtils';

type DiscardFromHandCostConfig = {
    scope?: string;
    cardType?: string;
    traitsAny?: string[];
    count?: number;
};

export type DiscardFromHandCostContext = {
    kind: 'COST_DISCARD_FROM_HAND_THEN_EFFECT';
    sourceCarduid: string;
    followUpEffect: EffectDefinition;
    sourcePlayerId: string;
    cardPlayNotificationId?: string;
};

export type DiscardFromHandCostFlowResult =
    | { success: false; error: string }
    | { success: true; kind: 'requiresSelection'; choiceEventId: string }
    | { success: true; kind: 'paid' }
    | { success: true; kind: 'insufficientTargets' };

export class DiscardFromHandCostFlow {
    static handleOrEnqueue(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): DiscardFromHandCostFlowResult {
        const rawCost = effect.cost && typeof effect.cost === 'object'
            ? (effect.cost as any).discardFromHand
            : undefined;
        const costConfig = this.normalizeCostConfig(rawCost);
        if (!costConfig) {
            return { success: false, error: 'discardFromHand cost missing config' };
        }

        const requiredCount = typeof costConfig.count === 'number' ? costConfig.count : 1;
        if (requiredCount <= 0) {
            return { success: false, error: 'discardFromHand cost requires count > 0' };
        }

        const costEffect = ensureEffectDefaults({
            effectId: `${effect.effectId || effect.action || 'effect'}_cost_discardFromHand`,
            type: 'internal',
            trigger: 'COST',
            optional: effect.optional === true,
            action: 'discardFromHand',
            target: {
                type: 'card',
                scope: typeof costConfig.scope === 'string' ? costConfig.scope : 'self_hand',
                count: requiredCount,
                filters: {
                    ...(typeof costConfig.cardType === 'string' ? { cardType: costConfig.cardType } : {}),
                    ...(Array.isArray(costConfig.traitsAny) ? { traitsAny: costConfig.traitsAny } : {})
                },
                selection: {
                    type: 'player_choice'
                }
            }
        } as any);

        const targetConfig = TargetResolver.resolveTargetConfig(costEffect);
        let availableTargets = TargetResolver.generateAvailableTargets(gameEnv, playerId, targetConfig, sourceCarduid);
        availableTargets = TargetSelectionPipeline.apply(gameEnv, availableTargets, costEffect, sourceCarduid);

        if (availableTargets.length < requiredCount) {
            return { success: true, kind: 'insufficientTargets' };
        }

        const shouldEnqueueChoice = CostChoiceUtils.shouldEnqueueChoice(effect, availableTargets.length, requiredCount);
        if (!shouldEnqueueChoice) {
            const costPayment = EffectExecutor.applyEffectToTargets(
                gameEnv,
                costEffect,
                availableTargets.slice(0, requiredCount),
                playerId,
                sourceCarduid
            );
            if (!costPayment.success) {
                return { success: false, error: costPayment.error || 'Failed to pay discardFromHand cost' };
            }
            return { success: true, kind: 'paid' };
        }

        const choiceEvent: TargetChoiceEvent = ChoiceEventScheduler.enqueueTargetChoice(gameEnv, {
            playerId,
            sourceCarduid,
            effect: costEffect,
            availableTargets,
            cardPlayNotificationId
        });

        choiceEvent.data.context = {
            kind: 'COST_DISCARD_FROM_HAND_THEN_EFFECT',
            sourceCarduid,
            followUpEffect: effect,
            sourcePlayerId: playerId,
            ...(cardPlayNotificationId ? { cardPlayNotificationId } : {})
        } satisfies DiscardFromHandCostContext;

        return { success: true, kind: 'requiresSelection', choiceEventId: choiceEvent.id };
    }

    private static normalizeCostConfig(rawCost: unknown): DiscardFromHandCostConfig | null {
        if (typeof rawCost === 'number') {
            return { count: rawCost };
        }
        if (!rawCost || typeof rawCost !== 'object') {
            return null;
        }
        return rawCost as DiscardFromHandCostConfig;
    }
}

