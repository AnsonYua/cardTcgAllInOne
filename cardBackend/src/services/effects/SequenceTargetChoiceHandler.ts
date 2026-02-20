// src/services/effects/SequenceTargetChoiceHandler.ts
// Handles TARGET_CHOICE resolution for sequence steps so the sequence can continue with access to selected targets.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetChoiceEvent, TargetReference } from '../EventQueue/interfaces/GameEvent';
import { ensureEffectDefaults } from '../../utils/EffectNormalizationUtils';
import { EffectExecutor } from './EffectExecutor';
import { EventFactory } from '../EventQueue/EventFactory';
import { isSequenceContinuationAfterChoiceContext } from './sequence/SequenceContinuationContext';

export class SequenceTargetChoiceHandler {
    static tryHandle(
        gameEnv: GameEnvironment,
        event: TargetChoiceEvent,
        normalizedTargets: TargetReference[]
    ): { handled: boolean; success: boolean; error?: string } {
        const ctx = (event.data as any)?.context;
        if (!isSequenceContinuationAfterChoiceContext(ctx)) {
            return { handled: false, success: true };
        }

        const normalizedEffect = ensureEffectDefaults(event.data.effect);

        const applyResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            normalizedEffect,
            normalizedTargets,
            event.playerId,
            (event.data as any).sourceCarduid
        );
        if (!applyResult.success) {
            return { handled: true, success: false, error: applyResult.error || 'sequence step effect failed' };
        }

        const resolvedStepIds = Array.isArray(ctx.ctx?.resolvedStepIds) ? [...ctx.ctx.resolvedStepIds] : [];
        const stepApplied = normalizedTargets.length > 0;
        if (ctx.resolveKey && stepApplied) {
            resolvedStepIds.push(ctx.resolveKey);
        }

        const continuation = EventFactory.createPlayerActionEvent(event.playerId, 'continueSequence', {
            sourceCarduid: ctx.sourceCarduid,
            sequence: {
                steps: ctx.remainingSteps,
                ctx: {
                    movedCards: Array.isArray(ctx.ctx?.movedCards) ? ctx.ctx.movedCards : [],
                    resolvedStepIds,
                    sequenceEffectId: typeof ctx.ctx?.sequenceEffectId === 'string' ? ctx.ctx.sequenceEffectId : undefined,
                    previousTargets: normalizedTargets.map(t => ({ carduid: t.carduid, zone: t.zone, playerId: t.playerId }))
                }
            },
            ...(ctx.cardPlayNotificationId ? { cardPlayNotificationId: ctx.cardPlayNotificationId } : {})
        });

        gameEnv.enqueueForProcessing(continuation);

        return { handled: true, success: true };
    }
}
