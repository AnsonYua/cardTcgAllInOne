// src/services/costs/MoveFromTrashToDeckCostFlow.ts
// Cost flow: choose N cards in trash, move them to deck, then optionally shuffle. Used by ATTACK_PHASE effects (e.g. GD01-003).

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, PlayerActionEvent, TargetChoiceEvent } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { TargetResolver } from '../targets/TargetResolver';
import { TargetSelectionPipeline } from '../targets/TargetSelectionPipeline';
import { ChoiceEventScheduler } from '../choices/ChoiceEventScheduler';
import { EffectExecutor } from '../effects/EffectExecutor';
import { CostChoiceUtils } from './CostChoiceUtils';
import type { AttackEffectChainContinuation } from '../effects/attack/AttackEffectChainContinuation';

type MoveFromTrashToDeckCostConfig = {
    scope?: string;
    count?: number;
    shuffle?: boolean;
};

export type MoveFromTrashToDeckCostContext = {
    kind: 'COST_MOVE_FROM_TRASH_TO_DECK_THEN_EFFECT';
    sourceCarduid: string;
    followUpEffect: EffectDefinition;
    attackEventData: Record<string, unknown>;
    attackActionType: string;
    attackPlayerId: string;
    attackEffectUsageId: string;
    cardPlayNotificationId?: string;
    attackEffectChainContinuation?: AttackEffectChainContinuation;
};

export class MoveFromTrashToDeckCostFlow {
    static handleOrEnqueue(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceCarduid: string,
        effect: EffectDefinition,
        attackEvent: PlayerActionEvent,
        cardPlayNotificationId?: string,
        attackEffectChainContinuation?: AttackEffectChainContinuation
    ): { success: boolean; paid?: boolean; requiresSelection?: boolean; choiceEventId?: string; error?: string } {
        const costConfig = effect.cost && typeof effect.cost === 'object'
            ? ((effect.cost as any).moveFromTrashToDeck as MoveFromTrashToDeckCostConfig | undefined)
            : undefined;
        if (!costConfig) {
            return { success: true, paid: false };
        }

        const requiredCount = typeof costConfig.count === 'number' ? costConfig.count : 0;
        if (requiredCount <= 0) {
            return { success: false, error: 'moveFromTrashToDeck cost requires count > 0' };
        }

        const shuffle = costConfig.shuffle === true;

        const costEffect = ensureEffectDefaults({
            effectId: `${effect.effectId || effect.action || 'effect'}_cost_moveFromTrashToDeck`,
            type: 'internal',
            trigger: 'COST',
            optional: effect.optional === true,
            action: 'moveFromTrashToDeck',
            target: {
                type: 'card',
                scope: typeof costConfig.scope === 'string' ? costConfig.scope : 'self_trash',
                count: requiredCount,
                selection: {
                    type: 'player_choice'
                }
            },
            parameters: {
                shuffle
            }
        } as any);

        const targetConfig = TargetResolver.resolveTargetConfig(costEffect);
        let availableTargets = TargetResolver.generateAvailableTargets(gameEnv, playerId, targetConfig, sourceCarduid);
        availableTargets = TargetSelectionPipeline.apply(gameEnv, availableTargets, costEffect, sourceCarduid);

        if (availableTargets.length < requiredCount) {
            return { success: true, paid: false };
        }

        const shouldEnqueueChoice = CostChoiceUtils.shouldEnqueueChoice(effect, availableTargets.length, requiredCount);
        if (!shouldEnqueueChoice) {
            const result = EffectExecutor.applyEffectToTargets(
                gameEnv,
                costEffect,
                availableTargets.slice(0, requiredCount),
                playerId,
                sourceCarduid
            );
            if (!result.success) {
                return { success: false, error: result.error || 'Failed to pay moveFromTrashToDeck cost' };
            }
            return { success: true, paid: true };
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

        const followUpEffect = ensureEffectDefaults({
            ...effect,
            optional: false,
            cost: undefined
        } as any);

        const attackEffectUsageId = effect.effectId || effect.action || 'attack_effect';

        choiceEvent.data.context = {
            kind: 'COST_MOVE_FROM_TRASH_TO_DECK_THEN_EFFECT',
            sourceCarduid,
            followUpEffect,
            attackEventData: { ...eventData },
            attackActionType: actionType,
            attackPlayerId: playerId,
            attackEffectUsageId,
            ...(cardPlayNotificationId ? { cardPlayNotificationId } : {}),
            ...(attackEffectChainContinuation ? { attackEffectChainContinuation } : {})
        } satisfies MoveFromTrashToDeckCostContext;

        return { success: true, requiresSelection: true, choiceEventId: choiceEvent.id };
    }
}
