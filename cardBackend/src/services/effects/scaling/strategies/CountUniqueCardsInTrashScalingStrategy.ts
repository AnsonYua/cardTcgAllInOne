import { TrashConditionUtils } from '../../../conditions/TrashConditionUtils';
import type { CountUniqueCardsInTrashScalingConfig, EffectScalingContext } from '../EffectScalingTypes';

function resolvePlayerIdForScope(context: EffectScalingContext, scope: string | undefined): string | undefined {
    const normalized = typeof scope === 'string' ? scope.toLowerCase() : 'self';
    if (normalized.startsWith('opponent')) {
        return context.gameEnv.getOpponentId(context.sourcePlayerId) || undefined;
    }
    return context.sourcePlayerId;
}

function resolveMultiplier(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return 1;
}

export function isCountUniqueCardsInTrashScalingConfig(
    scaling: unknown
): scaling is CountUniqueCardsInTrashScalingConfig {
    if (!scaling || typeof scaling !== 'object') {
        return false;
    }
    const config = scaling as Record<string, unknown>;
    return String(config.type || '').toUpperCase() === 'COUNT_UNIQUE_CARDS_IN_TRASH';
}

export function resolveCountUniqueCardsInTrashScalingFactor(
    scaling: CountUniqueCardsInTrashScalingConfig,
    context: EffectScalingContext
): number {
    const playerId = resolvePlayerIdForScope(context, scaling.scope);
    if (!playerId) {
        return 0;
    }

    const filters = (scaling.filters && typeof scaling.filters === 'object')
        ? scaling.filters
        : {};

    const traitsAny = Array.isArray((filters as any).traitsAny)
        ? (filters as any).traitsAny.filter((v: unknown): v is string => typeof v === 'string')
        : [];

    const cardTypes = Array.isArray((filters as any).cardTypes)
        ? (filters as any).cardTypes.filter((v: unknown): v is string => typeof v === 'string')
        : [];

    const matchingCount = TrashConditionUtils.countMatching(context.gameEnv, playerId, {
        traitsAny,
        cardTypes,
        uniqueNames: true
    });
    if (matchingCount === null) {
        return 0;
    }

    return matchingCount * resolveMultiplier(scaling.multiplier);
}
