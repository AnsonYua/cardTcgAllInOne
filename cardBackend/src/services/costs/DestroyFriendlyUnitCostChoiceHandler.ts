// src/services/costs/DestroyFriendlyUnitCostChoiceHandler.ts
// Handles TARGET_CHOICE resolution for destroyFriendlyUnit cost, then continues the follow-up effect and resumes the attack.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetChoiceEvent, TargetReference, EffectDefinition, PlayerActionEvent } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectExecutor } from '../effects/EffectExecutor';
import { DeployTargetManager } from '../DeployTargetManager';
import { EventFactory } from '../EventQueue/EventFactory';
import { AttackResumeScheduler } from '../battle/AttackResumeScheduler';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { AttackEffectUsageTracker } from '../effects/attack/AttackEffectUsageTracker';
import type { DestroyFriendlyUnitCostContext } from './DestroyFriendlyUnitCostFlow';

export class DestroyFriendlyUnitCostChoiceHandler {
    static tryHandle(
        gameEnv: GameEnvironment,
        event: TargetChoiceEvent,
        normalizedTargets: TargetReference[]
    ): { handled: boolean; success: boolean; error?: string } {
        const ctx = event.data?.context as DestroyFriendlyUnitCostContext | undefined;
        if (!ctx || ctx.kind !== 'COST_DESTROY_FRIENDLY_UNIT_THEN_EFFECT') {
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
            AttackResumeScheduler.enqueueResumeAttackAfterChoice(gameEnv, originalAttackEvent, event.id);
            return { handled: true, success: true };
        }

        // 1) Apply cost (destroy selected friendly unit)
        const destroyEffect = ensureEffectDefaults(event.data.effect);
        const destroyResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            destroyEffect,
            normalizedTargets,
            attackPlayerId,
            sourceCarduid
        );
        if (!destroyResult.success) {
            return { handled: true, success: false, error: destroyResult.error || 'destroyFriendlyUnit cost failed' };
        }

        const usageId = typeof ctx.attackEffectUsageId === 'string' ? ctx.attackEffectUsageId : (followUpEffect.effectId || 'attack_effect');
        const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid);
        if (sourceCard) {
            AttackEffectUsageTracker.markEffectUsed(sourceCard as any, usageId, gameEnv.currentTurn);
        }

        // 2) Apply follow-up effect (damage) - may enqueue another TARGET_CHOICE.
        const followUpResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            attackPlayerId,
            sourceCarduid,
            followUpEffect,
            typeof (ctx.attackEventData as any)?.attackNotificationId === 'string'
                ? ((ctx.attackEventData as any).attackNotificationId as string)
                : undefined
        );

        if (!followUpResult.success) {
            return { handled: true, success: false, error: followUpResult.error || 'follow-up effect failed' };
        }

        if (followUpResult.requiresSelection && followUpResult.choiceEventId) {
            // Resume attack after the follow-up choice resolves.
            AttackResumeScheduler.enqueueResumeAttackAfterChoice(gameEnv, originalAttackEvent, followUpResult.choiceEventId);
            return { handled: true, success: true };
        }

        // Follow-up auto-resolved; resume attack now.
        AttackResumeScheduler.enqueueResumeAttackAfterChoice(gameEnv, originalAttackEvent, event.id);
        return { handled: true, success: true };
    }
}
