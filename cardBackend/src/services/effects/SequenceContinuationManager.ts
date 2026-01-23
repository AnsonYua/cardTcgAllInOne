// src/services/effects/SequenceContinuationManager.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { PlayerActionEvent } from '../EventQueue/interfaces/GameEvent';
import type { ExecutionResult } from '../ExecutionResult';
import { SequenceEffectManager, type SequenceContinuationPayload, type SequenceStep } from './SequenceEffectManager';

export class SequenceContinuationManager {
    static continueSequence(gameEnv: GameEnvironment, event: PlayerActionEvent): ExecutionResult {
        const payload = event.data as Record<string, unknown>;
        const sourceCarduid = typeof payload.sourceCarduid === 'string' ? payload.sourceCarduid : undefined;
        const sequence = payload.sequence as Record<string, unknown> | undefined;

        if (!sourceCarduid || !sequence) {
            return { success: false, error: 'continueSequence missing sourceCarduid/sequence payload' };
        }

        const stepsRaw = Array.isArray(sequence.steps) ? sequence.steps : [];
        const steps: SequenceStep[] = stepsRaw.filter((step): step is SequenceStep => {
            if (!step || typeof step !== 'object') {
                return false;
            }
            return typeof (step as { action?: unknown }).action === 'string';
        });

        const ctxRaw = typeof sequence.ctx === 'object' && sequence.ctx ? (sequence.ctx as Record<string, unknown>) : {};
        const continuationPayload: SequenceContinuationPayload = {
            steps,
            ctx: {
                movedCards: Array.isArray(ctxRaw.movedCards) ? (ctxRaw.movedCards as any[]) : [],
                resolvedStepIds: Array.isArray(ctxRaw.resolvedStepIds)
                    ? (ctxRaw.resolvedStepIds as unknown[]).filter((id): id is string => typeof id === 'string')
                    : [],
                sequenceEffectId: typeof ctxRaw.sequenceEffectId === 'string' ? (ctxRaw.sequenceEffectId as string) : undefined
            }
        };

        const cardPlayNotificationId = typeof payload.cardPlayNotificationId === 'string'
            ? (payload.cardPlayNotificationId as string)
            : undefined;

        const result = SequenceEffectManager.continueSequence(
            gameEnv,
            event.playerId,
            sourceCarduid,
            continuationPayload,
            cardPlayNotificationId
        );

        if (!result.success) {
            return { success: false, error: result.error };
        }

        return { success: true, ...(result.requiresSelection ? { requiresSelection: true } : {}) };
    }
}
