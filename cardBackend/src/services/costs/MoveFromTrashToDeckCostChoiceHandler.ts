// src/services/costs/MoveFromTrashToDeckCostChoiceHandler.ts
// Handles TARGET_CHOICE resolution for moveFromTrashToDeck cost, then continues the follow-up effect and resumes the attack.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetChoiceEvent, TargetReference, EffectDefinition, PlayerActionEvent } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectExecutor } from '../effects/EffectExecutor';
import { EventFactory } from '../EventQueue/EventFactory';
import { AttackResumeScheduler } from '../battle/AttackResumeScheduler';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { AttackEffectUsageTracker } from '../effects/attack/AttackEffectUsageTracker';
import {
    enqueueAttackEffectChainContinuation,
    withAttackEffectChainContinuation
} from '../effects/attack/AttackEffectChainContinuation';
import type { MoveFromTrashToDeckCostContext } from './MoveFromTrashToDeckCostFlow';
import { executeFollowUpEffectAfterPaidCost } from './CostFollowUpEffectExecutor';

export class MoveFromTrashToDeckCostChoiceHandler {
    static tryHandle(
        gameEnv: GameEnvironment,
        event: TargetChoiceEvent,
        normalizedTargets: TargetReference[]
    ): { handled: boolean; success: boolean; error?: string } {
        const ctx = event.data?.context as MoveFromTrashToDeckCostContext | undefined;
        if (!ctx || ctx.kind !== 'COST_MOVE_FROM_TRASH_TO_DECK_THEN_EFFECT') {
            return { handled: false, success: true };
        }

        const attackPlayerId = ctx.attackPlayerId;
        const sourceCarduid = ctx.sourceCarduid;
        const followUpEffect = ensureEffectDefaults(ctx.followUpEffect as EffectDefinition);

        const originalAttackEvent: PlayerActionEvent = EventFactory.createPlayerActionEvent(
            attackPlayerId,
            ctx.attackActionType,
            {
                ...(ctx.attackEventData || {}),
                playerId: attackPlayerId,
                actionType: ctx.attackActionType
            }
        );

        // Player declined (optional): no cost paid => do not apply follow-up effect, just resume attack.
        if (normalizedTargets.length === 0) {
            if (ctx.attackEffectChainContinuation) {
                enqueueAttackEffectChainContinuation(gameEnv, ctx.attackEffectChainContinuation, event.id);
            } else {
                AttackResumeScheduler.enqueueResumeAttackAfterChoice(gameEnv, originalAttackEvent, event.id);
            }
            return { handled: true, success: true };
        }

        // 1) Pay cost (move selected trash cards to deck + shuffle)
        const costEffect = ensureEffectDefaults(event.data.effect);
        const costResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            costEffect,
            normalizedTargets,
            attackPlayerId,
            sourceCarduid
        );
        if (!costResult.success) {
            return { handled: true, success: false, error: costResult.error || 'moveFromTrashToDeck cost failed' };
        }

        // Mark usage only if the player paid the cost.
        const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid);
        if (sourceCard) {
            AttackEffectUsageTracker.markEffectUsed(sourceCard as any, ctx.attackEffectUsageId, gameEnv.currentTurn);
        }

        // 2) Apply follow-up effect (sequence) - may enqueue another TARGET_CHOICE.
        const followUpResult = executeFollowUpEffectAfterPaidCost(gameEnv, {
            sourcePlayerId: attackPlayerId,
            sourceCarduid,
            followUpEffect,
            choiceContext: withAttackEffectChainContinuation(undefined, ctx.attackEffectChainContinuation),
            cardPlayNotificationId: typeof (ctx.attackEventData as any)?.attackNotificationId === 'string'
                ? ((ctx.attackEventData as any).attackNotificationId as string)
                : undefined
        });

        if (!followUpResult.success) {
            return { handled: true, success: false, error: followUpResult.error || 'follow-up effect failed' };
        }

        if (followUpResult.requiresSelection && followUpResult.choiceEventId) {
            return { handled: true, success: true };
        }

        if (ctx.attackEffectChainContinuation) {
            enqueueAttackEffectChainContinuation(gameEnv, ctx.attackEffectChainContinuation, event.id);
        } else {
            AttackResumeScheduler.enqueueResumeAttackAfterChoice(gameEnv, originalAttackEvent, event.id);
        }
        return { handled: true, success: true };
    }
}
