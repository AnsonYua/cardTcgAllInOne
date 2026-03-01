// src/services/costs/AttackCostFlowInterceptor.ts
// Centralizes ATTACK_PHASE cost flows so AttackPhaseEffectManager stays small and consistent.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition, PlayerActionEvent } from '../EventQueue/interfaces/GameEvent';
import type { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { AttackResumeScheduler } from '../battle/AttackResumeScheduler';
import { DiscardFromHandCostFlow } from './DiscardFromHandCostFlow';
import { DestroyFriendlyUnitCostFlow } from './DestroyFriendlyUnitCostFlow';
import { MoveFromHandToDeckBottomCostFlow } from './MoveFromHandToDeckBottomCostFlow';
import { MoveFromTrashToDeckCostFlow } from './MoveFromTrashToDeckCostFlow';
import { EffectExecutor } from '../effects/EffectExecutor';
import { executeFollowUpEffectAfterPaidCost } from './CostFollowUpEffectExecutor';

export type AttackCostInterceptResult =
    | { handled: true; success: true; requiresSelection?: boolean; consumed?: boolean; error?: never }
    | { handled: true; success: false; error: string; requiresSelection?: never; consumed?: never }
    | { handled: false; success: true };

export class AttackCostFlowInterceptor {
    static intercept(
        gameEnv: GameEnvironment,
        playerId: string,
        attackEvent: PlayerActionEvent,
        sourceCard: UnitZoneCard | PilotZoneCard,
        effect: EffectDefinition
    ): AttackCostInterceptResult {
        if (effect.cost && typeof effect.cost === 'object' && (effect.cost as any).discardFromHand !== undefined) {
            const costResult = DiscardFromHandCostFlow.handleOrEnqueue(
                gameEnv,
                playerId,
                sourceCard.carduid,
                effect,
                typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                    ? ((attackEvent.data as any).attackNotificationId as string)
                    : undefined
            );
            if (!costResult.success) {
                return { handled: true, success: false, error: costResult.error || 'Failed to handle discardFromHand cost' };
            }
            if (costResult.kind === 'requiresSelection') {
                AttackResumeScheduler.enqueueResumeAttackAfterChoice(gameEnv, attackEvent, costResult.choiceEventId);
                return { handled: true, success: true, requiresSelection: true, consumed: false };
            }
            if (costResult.kind === 'paid') {
                const followUpResult = executeFollowUpEffectAfterPaidCost(gameEnv, {
                    sourcePlayerId: playerId,
                    sourceCarduid: sourceCard.carduid,
                    followUpEffect: ensureEffectDefaults(effect),
                    cardPlayNotificationId: typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                        ? ((attackEvent.data as any).attackNotificationId as string)
                        : undefined
                });
                if (!followUpResult.success) {
                    return { handled: true, success: false, error: followUpResult.error || 'Failed to resolve follow-up effect after discard cost' };
                }
                if (followUpResult.requiresSelection && followUpResult.choiceEventId) {
                    AttackResumeScheduler.enqueueResumeAttackAfterChoice(gameEnv, attackEvent, followUpResult.choiceEventId);
                    return { handled: true, success: true, requiresSelection: true, consumed: true };
                }
                return { handled: true, success: true, consumed: true };
            }
            return { handled: true, success: true, consumed: false };
        }

        if (effect.cost && typeof effect.cost === 'object' && (effect.cost as any).moveFromHandToDeckBottom) {
            const drawCount = typeof effect.parameters?.value === 'number' ? effect.parameters.value : 0;
            const costResult = MoveFromHandToDeckBottomCostFlow.handleOrEnqueue(
                gameEnv,
                playerId,
                sourceCard.carduid,
                effect,
                drawCount,
                typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                    ? ((attackEvent.data as any).attackNotificationId as string)
                    : undefined
            );
            if (!costResult.success) {
                return { handled: true, success: false, error: costResult.error || 'Failed to handle moveFromHandToDeckBottom cost' };
            }
            if (costResult.requiresSelection && costResult.choiceEventId) {
                AttackResumeScheduler.enqueueResumeAttackAfterChoice(gameEnv, attackEvent, costResult.choiceEventId);
                return { handled: true, success: true, requiresSelection: true, consumed: false };
            }
            if (costResult.paid) {
                const result = EffectExecutor.applyPlayerDrawEffect(gameEnv, playerId, effect, sourceCard.carduid);
                if (!result.success) {
                    return { handled: true, success: false, error: result.error || 'draw after cost failed' };
                }
                return { handled: true, success: true, consumed: true };
            }
            return { handled: true, success: true, consumed: false };
        }

        if (effect.cost && typeof effect.cost === 'object' && (effect.cost as any).destroyFriendlyUnit) {
            const costResult = DestroyFriendlyUnitCostFlow.enqueueCostChoice(
                gameEnv,
                playerId,
                sourceCard.carduid,
                effect,
                attackEvent,
                typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                    ? ((attackEvent.data as any).attackNotificationId as string)
                    : undefined
            );
            if (!costResult.success) {
                return { handled: true, success: false, error: costResult.error || 'Failed to enqueue destroyFriendlyUnit cost choice' };
            }
            if (costResult.requiresSelection) {
                // Cost flow will resume the attack after follow-up effect resolves.
                return { handled: true, success: true, requiresSelection: true, consumed: false };
            }
            return { handled: true, success: true, consumed: false };
        }

        if (effect.cost && typeof effect.cost === 'object' && (effect.cost as any).moveFromTrashToDeck) {
            const costResult = MoveFromTrashToDeckCostFlow.handleOrEnqueue(
                gameEnv,
                playerId,
                sourceCard.carduid,
                effect,
                attackEvent,
                typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                    ? ((attackEvent.data as any).attackNotificationId as string)
                    : undefined
            );
            if (!costResult.success) {
                return { handled: true, success: false, error: costResult.error || 'Failed to handle moveFromTrashToDeck cost' };
            }
            if (costResult.requiresSelection) {
                return { handled: true, success: true, requiresSelection: true, consumed: false };
            }
            if (costResult.paid) {
                const followUpResult = executeFollowUpEffectAfterPaidCost(gameEnv, {
                    sourcePlayerId: playerId,
                    sourceCarduid: sourceCard.carduid,
                    followUpEffect: ensureEffectDefaults(effect),
                    cardPlayNotificationId: typeof (attackEvent.data as any)?.attackNotificationId === 'string'
                        ? ((attackEvent.data as any).attackNotificationId as string)
                        : undefined
                });
                if (!followUpResult.success) {
                    return { handled: true, success: false, error: followUpResult.error || 'Failed to resolve follow-up effect after cost' };
                }
                if (followUpResult.requiresSelection && followUpResult.choiceEventId) {
                    AttackResumeScheduler.enqueueResumeAttackAfterChoice(gameEnv, attackEvent, followUpResult.choiceEventId);
                    return { handled: true, success: true, requiresSelection: true, consumed: true };
                }
                return { handled: true, success: true, consumed: true };
            }
            return { handled: true, success: true, consumed: false };
        }

        return { handled: false, success: true };
    }
}
