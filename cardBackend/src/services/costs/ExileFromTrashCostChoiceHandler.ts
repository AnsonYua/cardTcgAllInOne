// src/services/costs/ExileFromTrashCostChoiceHandler.ts
// Handles TARGET_CHOICE resolution for exileFromTrash cost, then continues with the follow-up effect.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetChoiceEvent, TargetReference, EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectExecutor } from '../effects/EffectExecutor';
import { DeployTargetManager } from '../DeployTargetManager';
import type { ExileFromTrashCostContext } from './ExileFromTrashCostFlow';

export class ExileFromTrashCostChoiceHandler {
    static tryHandle(
        gameEnv: GameEnvironment,
        event: TargetChoiceEvent,
        normalizedTargets: TargetReference[]
    ): { handled: boolean; success: boolean; error?: string } {
        const ctx = event.data?.context as ExileFromTrashCostContext | undefined;
        if (!ctx || ctx.kind !== 'COST_EXILE_FROM_TRASH_THEN_EFFECT') {
            return { handled: false, success: true };
        }

        const sourcePlayerId = ctx.sourcePlayerId;
        const sourceCarduid = ctx.sourceCarduid;

        // Optional cost declined: do not resolve follow-up effect.
        if (normalizedTargets.length === 0) {
            return { handled: true, success: true };
        }

        // 1) Pay cost (exile selected cards from trash)
        const costEffect = ensureEffectDefaults(event.data.effect);
        const costResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            costEffect,
            normalizedTargets,
            sourcePlayerId,
            sourceCarduid
        );
        if (!costResult.success) {
            return { handled: true, success: false, error: costResult.error || 'exileFromTrash cost failed' };
        }

        // 2) Resolve follow-up effect without re-triggering cost flow
        const followUpEffect = ensureEffectDefaults({
            ...(ctx.followUpEffect as EffectDefinition),
            cost: undefined
        } as any);

        const followUpResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            sourcePlayerId,
            sourceCarduid,
            followUpEffect,
            ctx.cardPlayNotificationId
        );
        if (!followUpResult.success) {
            return { handled: true, success: false, error: followUpResult.error || 'follow-up effect failed' };
        }

        return { handled: true, success: true };
    }
}

