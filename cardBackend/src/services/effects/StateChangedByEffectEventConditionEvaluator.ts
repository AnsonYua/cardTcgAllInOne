import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import type { CardState, CardStateChangedByEffectContext } from './stateChanged/StateChangedByEffectTypes';

type NormalizedStateChangedEventCondition = {
    sourceController?: 'self' | 'opponent' | 'any';
    targetController?: 'self' | 'opponent' | 'any';
    targetCarduid?: string;
    fromState?: CardState;
    toState?: CardState;
    targetCardType?: string;
};

function normalizeState(value: unknown): CardState | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.toLowerCase();
    if (normalized === 'rested' || normalized === 'active') {
        return normalized;
    }
    return undefined;
}

function normalizeController(value: unknown, fallback: 'self' | 'any'): 'self' | 'opponent' | 'any' {
    if (typeof value !== 'string') {
        return fallback;
    }
    const normalized = value.toLowerCase();
    if (normalized === 'self' || normalized === 'opponent' || normalized === 'any') {
        return normalized;
    }
    return fallback;
}

function normalizeCondition(raw: Record<string, unknown>): NormalizedStateChangedEventCondition | null {
    const type = typeof raw.type === 'string' ? raw.type : '';
    if (type !== 'unitRestedByEffectEvent' && type !== 'unitStateChangedByEffectEvent') {
        return null;
    }

    const targetCarduid = typeof raw.targetCarduid === 'string' ? raw.targetCarduid : undefined;
    const sourceController = normalizeController(raw.sourceController, 'any');
    const targetController = normalizeController(raw.targetController, 'self');
    const targetCardType = typeof raw.targetCardType === 'string' ? raw.targetCardType.toLowerCase() : undefined;

    if (type === 'unitRestedByEffectEvent') {
        return {
            sourceController,
            targetController,
            targetCarduid,
            toState: 'rested',
            targetCardType: targetCardType || 'unit'
        };
    }

    return {
        sourceController,
        targetController,
        targetCarduid,
        fromState: normalizeState(raw.fromState),
        toState: normalizeState(raw.toState),
        targetCardType
    };
}

export class StateChangedByEffectEventConditionEvaluator {
    static eventConditionsSatisfied(
        conditions: unknown,
        context: CardStateChangedByEffectContext,
        ownerPlayerId: string,
        sourceCarduid?: string
    ): boolean {
        if (!Array.isArray(conditions) || conditions.length === 0) {
            return true;
        }

        for (const rawCondition of conditions) {
            if (!rawCondition || typeof rawCondition !== 'object') {
                continue;
            }

            const normalized = normalizeCondition(rawCondition as Record<string, unknown>);
            if (!normalized) {
                continue;
            }

            if (normalized.sourceController === 'self' && context.sourcePlayerId !== ownerPlayerId) {
                return false;
            }
            if (normalized.sourceController === 'opponent' && context.sourcePlayerId === ownerPlayerId) {
                return false;
            }

            if (normalized.targetController === 'self' && context.targetPlayerId !== ownerPlayerId) {
                return false;
            }
            if (normalized.targetController === 'opponent' && context.targetPlayerId === ownerPlayerId) {
                return false;
            }

            if (normalized.targetCarduid) {
                const targetCarduidNormalized = normalized.targetCarduid.toLowerCase();
                const expectedTargetCarduid =
                    targetCarduidNormalized === 'self' || targetCarduidNormalized === 'source'
                        ? sourceCarduid
                        : normalized.targetCarduid;
                if (expectedTargetCarduid && expectedTargetCarduid !== context.targetCarduid) {
                    return false;
                }
            }

            if (normalized.targetCardType && normalized.targetCardType !== 'any') {
                if (context.targetCardType !== normalized.targetCardType) {
                    return false;
                }
            }

            if (normalized.fromState && context.fromState !== normalized.fromState) {
                return false;
            }
            if (normalized.toState && context.toState !== normalized.toState) {
                return false;
            }
        }

        return true;
    }

    static stripEventConditions(effect: EffectDefinition): EffectDefinition {
        const conditions = Array.isArray(effect.conditions)
            ? effect.conditions.filter((condition: any) => {
                const type = typeof condition?.type === 'string' ? condition.type : '';
                return type !== 'unitRestedByEffectEvent' && type !== 'unitStateChangedByEffectEvent';
            })
            : undefined;

        return {
            ...effect,
            conditions
        };
    }
}
