import type { GameEnvironment } from '../../../models/GameEnvironment';
import type {
    PlayerActionEvent,
    PlayerActionEventData,
    QueuedAttackEffectDefinition
} from '../../EventQueue/interfaces/GameEvent';
import { EventFactory } from '../../EventQueue/EventFactory';
import { AttackResumeScheduler } from '../../battle/AttackResumeScheduler';

export type AttackEffectChainContinuation = {
    kind: 'ATTACK_EFFECT_CHAIN_CONTINUATION';
    attackPlayerId: string;
    originalAttackEventData: PlayerActionEventData;
    remainingEffects: QueuedAttackEffectDefinition[];
    attackNotificationId?: string;
};

export function createAttackEffectChainContinuation(
    attackEvent: PlayerActionEvent,
    remainingEffects: QueuedAttackEffectDefinition[]
): AttackEffectChainContinuation {
    return {
        kind: 'ATTACK_EFFECT_CHAIN_CONTINUATION',
        attackPlayerId: attackEvent.playerId,
        originalAttackEventData: {
            ...(attackEvent.data || {}),
            playerId: attackEvent.playerId
        },
        remainingEffects: Array.isArray(remainingEffects) ? [...remainingEffects] : [],
        attackNotificationId: typeof (attackEvent.data as any)?.attackNotificationId === 'string'
            ? ((attackEvent.data as any).attackNotificationId as string)
            : undefined
    };
}

export function withAttackEffectChainContinuation(
    context: Record<string, unknown> | undefined,
    continuation?: AttackEffectChainContinuation
): Record<string, unknown> | undefined {
    if (!continuation) {
        return context;
    }

    if (!context || Object.keys(context).length === 0) {
        return { ...continuation };
    }

    return {
        ...context,
        attackEffectChainContinuation: continuation
    };
}

export function extractAttackEffectChainContinuation(
    context: unknown
): AttackEffectChainContinuation | undefined {
    if (!context || typeof context !== 'object') {
        return undefined;
    }

    const direct = context as Partial<AttackEffectChainContinuation>;
    if (direct.kind === 'ATTACK_EFFECT_CHAIN_CONTINUATION') {
        return direct as AttackEffectChainContinuation;
    }

    const nested = (context as Record<string, unknown>).attackEffectChainContinuation;
    if (!nested || typeof nested !== 'object') {
        return undefined;
    }

    const typedNested = nested as Partial<AttackEffectChainContinuation>;
    return typedNested.kind === 'ATTACK_EFFECT_CHAIN_CONTINUATION'
        ? (typedNested as AttackEffectChainContinuation)
        : undefined;
}

export function enqueueAttackEffectChainContinuation(
    gameEnv: GameEnvironment,
    continuation: AttackEffectChainContinuation | undefined,
    resolvedChoiceEventId?: string
): void {
    if (!continuation) {
        return;
    }

    const remainingEffects = Array.isArray(continuation.remainingEffects)
        ? continuation.remainingEffects
        : [];

    if (remainingEffects.length > 0) {
        const [nextEffect, ...rest] = remainingEffects;
        const nextEvent = EventFactory.createAttackPhaseEffectEvent({
            attackPlayerId: continuation.attackPlayerId,
            originalAttackEventData: continuation.originalAttackEventData,
            effect: nextEffect,
            remainingEffects: rest,
            attackNotificationId: continuation.attackNotificationId
        });
        gameEnv.enqueueForProcessing(nextEvent);
        return;
    }

    const originalAttackEvent = EventFactory.createPlayerActionEvent(
        continuation.attackPlayerId,
        continuation.originalAttackEventData.actionType,
        {
            ...continuation.originalAttackEventData,
            playerId: continuation.attackPlayerId,
            actionType: continuation.originalAttackEventData.actionType
        }
    );

    AttackResumeScheduler.enqueueResumeAttack(
        gameEnv,
        originalAttackEvent,
        resolvedChoiceEventId
            ? { resumeAfterChoiceEventId: resolvedChoiceEventId }
            : undefined
    );
}
