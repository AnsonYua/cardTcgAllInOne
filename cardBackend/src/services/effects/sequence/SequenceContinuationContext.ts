import type { SequenceStep } from '../SequenceEffectManager';

export type SequenceContinuationAfterChoiceContext = {
    kind: 'SEQUENCE_CONTINUATION_AFTER_CHOICE';
    playerId: string;
    sourceCarduid: string;
    remainingSteps: SequenceStep[];
    resolveKey: string;
    ctx: {
        movedCards?: any[];
        resolvedStepIds?: string[];
        sequenceEffectId?: string;
        previousTargets?: Array<{ carduid: string; zone: string; playerId: string }>;
    };
    cardPlayNotificationId?: string;
};

export function isSequenceContinuationAfterChoiceContext(
    value: unknown
): value is SequenceContinuationAfterChoiceContext {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const v = value as any;
    return v.kind === 'SEQUENCE_CONTINUATION_AFTER_CHOICE' &&
        typeof v.playerId === 'string' &&
        typeof v.sourceCarduid === 'string' &&
        Array.isArray(v.remainingSteps) &&
        typeof v.resolveKey === 'string' &&
        v.ctx && typeof v.ctx === 'object';
}

