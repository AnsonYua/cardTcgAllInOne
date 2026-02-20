// src/services/costs/DiscardFromHandCostChoiceHandler.ts
// Handles TARGET_CHOICE resolution for discardFromHand cost, then continues with follow-up effect.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetChoiceEvent, TargetReference, EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectExecutor } from '../effects/EffectExecutor';
import { DeployTargetManager } from '../DeployTargetManager';
import type { DiscardFromHandCostContext } from './DiscardFromHandCostFlow';

export class DiscardFromHandCostChoiceHandler {
    static tryHandle(
        gameEnv: GameEnvironment,
        event: TargetChoiceEvent,
        normalizedTargets: TargetReference[]
    ): { handled: boolean; success: boolean; error?: string } {
        const ctx = event.data?.context as DiscardFromHandCostContext | undefined;
        if (!ctx || ctx.kind !== 'COST_DISCARD_FROM_HAND_THEN_EFFECT') {
            return { handled: false, success: true };
        }

        const sourcePlayerId = ctx.sourcePlayerId;
        const sourceCarduid = ctx.sourceCarduid;

        // Optional cost declined: do not resolve follow-up effect.
        if (normalizedTargets.length === 0) {
            return { handled: true, success: true };
        }

        const costEffect = ensureEffectDefaults(event.data.effect);
        const costResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            costEffect,
            normalizedTargets,
            sourcePlayerId,
            sourceCarduid
        );
        if (!costResult.success) {
            return { handled: true, success: false, error: costResult.error || 'discardFromHand cost failed' };
        }

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

