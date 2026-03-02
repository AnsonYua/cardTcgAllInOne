// src/services/costs/DestroyFriendlyUnitCostFlow.ts
// Implements cost flows that require a TARGET_CHOICE before an effect can resolve.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, PlayerActionEvent, TargetChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { TargetResolver } from '../targets/TargetResolver';
import { TargetSelectionPipeline } from '../targets/TargetSelectionPipeline';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import type { AttackEffectChainContinuation } from '../effects/attack/AttackEffectChainContinuation';

type DestroyFriendlyUnitCostConfig = {
    target: Record<string, unknown>;
    excludeSource?: boolean;
};

export type DestroyFriendlyUnitCostContext = {
    kind: 'COST_DESTROY_FRIENDLY_UNIT_THEN_EFFECT';
    sourceCarduid: string;
    followUpEffect: EffectDefinition;
    attackEventData: Record<string, unknown>;
    attackActionType: string;
    attackPlayerId: string;
    attackEffectUsageId: string;
    cardPlayNotificationId?: string;
    attackEffectChainContinuation?: AttackEffectChainContinuation;
};

export class DestroyFriendlyUnitCostFlow {
    static enqueueCostChoice(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        attackEvent: PlayerActionEvent,
        cardPlayNotificationId?: string,
        attackEffectChainContinuation?: AttackEffectChainContinuation
    ): { success: boolean; requiresSelection?: boolean; error?: string; choiceEventId?: string } {
        const costConfig = effect.cost && typeof effect.cost === 'object'
            ? ((effect.cost as any).destroyFriendlyUnit as DestroyFriendlyUnitCostConfig | undefined)
            : undefined;
        if (!costConfig || !costConfig.target || typeof costConfig.target !== 'object') {
            return { success: false, error: 'destroyFriendlyUnit cost missing target config' };
        }

        const costEffect = ensureEffectDefaults({
            effectId: `${effect.effectId || effect.action || 'effect'}_cost_destroyFriendlyUnit`,
            type: 'internal',
            trigger: 'COST',
            optional: true,
            action: 'destroy',
            target: {
                ...(costConfig.target as any),
                selection: {
                    type: 'player_choice'
                }
            },
            parameters: {
                excludeSource: costConfig.excludeSource === true
            }
        } as any);

        const targetConfig = TargetResolver.resolveTargetConfig(costEffect);
        let availableTargets = TargetResolver.generateAvailableTargets(gameEnv, playerId, targetConfig, sourceCarduid);
        availableTargets = TargetSelectionPipeline.apply(gameEnv, availableTargets, costEffect, sourceCarduid);

        if (availableTargets.length === 0) {
            return { success: true };
        }

        const choiceEvent: TargetChoiceEvent = ChoiceEventScheduler.enqueueTargetChoice(gameEnv, {
            playerId,
            sourceCarduid,
            effect: costEffect,
            availableTargets,
            cardPlayNotificationId
        });

        const eventData = attackEvent.data as Record<string, unknown>;
        const actionType = typeof eventData.actionType === 'string' ? (eventData.actionType as string) : 'attackUnit';
        const attackEffectUsageId = effect.effectId || effect.action || 'attack_effect';

        choiceEvent.data.context = {
            kind: 'COST_DESTROY_FRIENDLY_UNIT_THEN_EFFECT',
            sourceCarduid,
            followUpEffect: effect,
            attackEventData: { ...eventData },
            attackActionType: actionType,
            attackPlayerId: playerId,
            attackEffectUsageId,
            ...(cardPlayNotificationId ? { cardPlayNotificationId } : {}),
            ...(attackEffectChainContinuation ? { attackEffectChainContinuation } : {})
        } satisfies DestroyFriendlyUnitCostContext;

        return { success: true, requiresSelection: true, choiceEventId: choiceEvent.id };
    }
}
