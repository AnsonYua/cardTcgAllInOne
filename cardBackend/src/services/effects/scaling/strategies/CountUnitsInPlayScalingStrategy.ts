import type { TargetFilters } from '../../../EventQueue/interfaces/GameEvent';
import { PlayerCardManager } from '../../../PlayerCardManager';
import { TargetFilterUtils } from '../../../targets/TargetFilterUtils';
import { validateComparisonFilter } from '../../../../utils/EffectNormalizationUtils';
import { SlotZoneUtils } from '../../../../utils/SlotZoneUtils';
import type { UnitZoneCard } from '../../../../models/CardSystem';
import type { CountUnitsInPlayScalingConfig, EffectScalingContext } from '../EffectScalingTypes';

function resolvePlayerIdsForScope(context: EffectScalingContext, scope: string | undefined): string[] {
    const normalizedScope = typeof scope === 'string' ? scope.toLowerCase() : '';

    if (normalizedScope.startsWith('opponent')) {
        const opponentId = context.gameEnv.getOpponentId(context.sourcePlayerId);
        return opponentId ? [opponentId] : [];
    }

    if (normalizedScope === 'any' || normalizedScope === 'both' || normalizedScope.startsWith('any')) {
        return Object.keys(context.gameEnv.players);
    }

    return [context.sourcePlayerId];
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

function matchesNumericFilter(actual: number, expected: unknown): boolean {
    if (typeof expected === 'number') {
        return actual === expected;
    }
    if (typeof expected === 'string') {
        return validateComparisonFilter(actual, expected);
    }
    return true;
}

function matchesFilters(
    context: EffectScalingContext,
    unit: UnitZoneCard,
    filters: TargetFilters | undefined
): boolean {
    if (!filters || typeof filters !== 'object') {
        return true;
    }

    const colorResult = TargetFilterUtils.validateColorFilter(unit.cardData?.color, filters);
    if (!colorResult.ok) {
        return false;
    }

    const traitResult = TargetFilterUtils.validateTraitFilters(unit.cardData?.traits || [], filters);
    if (!traitResult.ok) {
        return false;
    }

    if (!matchesNumericFilter(unit.cardData?.level || 0, filters.level)) {
        return false;
    }

    const totals = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(context.gameEnv, unit.carduid);
    if (!matchesNumericFilter(totals.totalAP || 0, filters.ap)) {
        return false;
    }
    if (!matchesNumericFilter(totals.totalHP || 0, filters.hp)) {
        return false;
    }

    return true;
}

export function isCountUnitsInPlayScalingConfig(scaling: unknown): scaling is CountUnitsInPlayScalingConfig {
    if (!scaling || typeof scaling !== 'object') {
        return false;
    }

    const config = scaling as Record<string, unknown>;
    return String(config.type || '').toUpperCase() === 'COUNT_UNITS_IN_PLAY';
}

export function resolveCountUnitsInPlayScalingFactor(
    scaling: CountUnitsInPlayScalingConfig,
    context: EffectScalingContext
): number {
    const playerIds = resolvePlayerIdsForScope(context, scaling.scope);
    if (playerIds.length === 0) {
        return 0;
    }

    const count = playerIds.reduce((total, playerId) => {
        const units = SlotZoneUtils
            .getAllPlayerSlotUnits(context.gameEnv, playerId)
            .map(entry => entry.unit as UnitZoneCard | undefined)
            .filter((unit): unit is UnitZoneCard => Boolean(unit));
        const matched = units.filter(unit => matchesFilters(context, unit, scaling.filters));
        return total + matched.length;
    }, 0);

    return count * resolveMultiplier(scaling.multiplier);
}
