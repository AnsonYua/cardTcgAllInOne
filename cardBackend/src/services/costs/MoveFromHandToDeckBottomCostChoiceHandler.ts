// src/services/costs/MoveFromHandToDeckBottomCostChoiceHandler.ts
// Handles TARGET_CHOICE resolution for moveFromHandToDeckBottom cost, then executes a draw.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetChoiceEvent, TargetReference, EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectExecutor } from '../effects/EffectExecutor';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { AttackEffectUsageTracker } from '../effects/attack/AttackEffectUsageTracker';
import type { MoveFromHandToDeckBottomCostContext } from './MoveFromHandToDeckBottomCostFlow';

export class MoveFromHandToDeckBottomCostChoiceHandler {
    static tryHandle(
        gameEnv: GameEnvironment,
        event: TargetChoiceEvent,
        normalizedTargets: TargetReference[]
    ): { handled: boolean; success: boolean; error?: string } {
        const ctx = event.data?.context as MoveFromHandToDeckBottomCostContext | undefined;
        if (!ctx || ctx.kind !== 'COST_MOVE_FROM_HAND_TO_DECK_BOTTOM_THEN_DRAW') {
            return { handled: false, success: true };
        }

        const playerId = ctx.sourcePlayerId;
        const sourceCarduid = ctx.sourceCarduid;
        const drawCount = typeof ctx.drawCount === 'number' ? ctx.drawCount : 0;

        if (normalizedTargets.length === 0) {
            return { handled: true, success: true };
        }

        const costEffect = ensureEffectDefaults(event.data.effect);
        const costResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            costEffect,
            normalizedTargets,
            playerId,
            sourceCarduid
        );
        if (!costResult.success) {
            return { handled: true, success: false, error: costResult.error || 'moveFromHandToDeckBottom cost failed' };
        }

        const usageId = typeof ctx.attackEffectUsageId === 'string' ? ctx.attackEffectUsageId : (costEffect.effectId || 'attack_effect');
        const sourceCard = SlotZoneUtils.getCardByUid(gameEnv, sourceCarduid);
        if (sourceCard) {
            AttackEffectUsageTracker.markEffectUsed(sourceCard as any, usageId, gameEnv.currentTurn);
        }

        if (drawCount > 0) {
            const drawEffect: EffectDefinition = ensureEffectDefaults({
                effectId: `${costEffect.effectId}_then_draw`,
                type: 'internal',
                trigger: 'COST',
                action: 'draw',
                target: {
                    scope: 'self'
                },
                parameters: {
                    value: drawCount
                }
            } as any);

            const drawResult = EffectExecutor.applyPlayerDrawEffect(gameEnv, playerId, drawEffect, sourceCarduid);
            if (!drawResult.success) {
                return { handled: true, success: false, error: drawResult.error || 'draw after cost failed' };
            }
        }

        return { handled: true, success: true };
    }
}
