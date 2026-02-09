// src/services/costs/ExileFromTrashCostFlow.ts
// Cost flow: choose N matching cards in trash, exile them, then resolve follow-up effect.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, TargetChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { TargetResolver } from '../targets/TargetResolver';
import { TargetSelectionPipeline } from '../targets/TargetSelectionPipeline';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { EffectExecutor } from '../effects/EffectExecutor';

type ExileFromTrashCostConfig = {
    scope?: string;
    traitsAny?: string[];
    cardType?: string;
    count?: number;
};

export type ExileFromTrashCostContext = {
    kind: 'COST_EXILE_FROM_TRASH_THEN_EFFECT';
    sourceCarduid: string;
    followUpEffect: EffectDefinition;
    sourcePlayerId: string;
    cardPlayNotificationId?: string;
};

export type ExileFromTrashCostFlowResult =
    | { success: false; error: string }
    | { success: true; kind: 'requiresSelection'; choiceEventId: string }
    | { success: true; kind: 'paid' }
    | { success: true; kind: 'insufficientTargets' };

export class ExileFromTrashCostFlow {
    static enqueueCostChoice(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        cardPlayNotificationId?: string
    ): ExileFromTrashCostFlowResult {
        const costConfig = effect.cost && typeof effect.cost === 'object'
            ? ((effect.cost as any).exileFromTrash as ExileFromTrashCostConfig | undefined)
            : undefined;
        if (!costConfig) {
            return { success: false, error: 'exileFromTrash cost missing config' };
        }

        const requiredCount = typeof costConfig.count === 'number' ? costConfig.count : 0;
        if (requiredCount <= 0) {
            return { success: false, error: 'exileFromTrash cost requires count > 0' };
        }

        const costEffect = ensureEffectDefaults({
            effectId: `${effect.effectId || effect.action || 'effect'}_cost_exileFromTrash`,
            type: 'internal',
            trigger: 'COST',
            optional: effect.optional === true,
            action: 'exileFromTrash',
            target: {
                type: 'card',
                scope: typeof costConfig.scope === 'string' ? costConfig.scope : 'self_trash',
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
        let availableTargets = TargetResolver.generateAvailableTargets(gameEnv, playerId, targetConfig);
        availableTargets = TargetSelectionPipeline.apply(gameEnv, availableTargets, costEffect, sourceCarduid);

        if (availableTargets.length < requiredCount) {
            return { success: true, kind: 'insufficientTargets' };
        }

        const shouldEnqueueChoice = effect.optional === true || availableTargets.length > requiredCount;
        if (!shouldEnqueueChoice) {
            const costPayment = EffectExecutor.applyEffectToTargets(
                gameEnv,
                costEffect,
                availableTargets.slice(0, requiredCount),
                playerId,
                sourceCarduid
            );
            if (!costPayment.success) {
                return { success: false, error: costPayment.error || 'Failed to pay exileFromTrash cost' };
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
            kind: 'COST_EXILE_FROM_TRASH_THEN_EFFECT',
            sourceCarduid,
            followUpEffect: effect,
            sourcePlayerId: playerId,
            ...(cardPlayNotificationId ? { cardPlayNotificationId } : {})
        } satisfies ExileFromTrashCostContext;

        return { success: true, kind: 'requiresSelection', choiceEventId: choiceEvent.id };
    }
}
