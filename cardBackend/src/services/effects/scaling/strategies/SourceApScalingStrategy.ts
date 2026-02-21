import { PlayerCardManager } from '../../../PlayerCardManager';
import type { EffectScalingContext, SourceApScalingConfig } from '../EffectScalingTypes';

function asPositiveNumber(value: unknown): number | undefined {
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n !== 'number' || Number.isNaN(n) || !Number.isFinite(n) || n <= 0) {
        return undefined;
    }
    return n;
}

function resolveRounding(raw: unknown): 'floor' | 'ceil' | 'round' {
    if (typeof raw !== 'string') {
        return 'floor';
    }
    const normalized = raw.toLowerCase();
    if (normalized === 'ceil' || normalized === 'round' || normalized === 'floor') {
        return normalized;
    }
    return 'floor';
}

function applyRounding(value: number, rounding: 'floor' | 'ceil' | 'round'): number {
    if (rounding === 'ceil') {
        return Math.ceil(value);
    }
    if (rounding === 'round') {
        return Math.round(value);
    }
    return Math.floor(value);
}

export function isSourceApScalingConfig(scaling: unknown): scaling is SourceApScalingConfig {
    if (!scaling || typeof scaling !== 'object') {
        return false;
    }

    const config = scaling as Record<string, unknown>;
    return String(config.stat || '').toLowerCase() === 'ap'
        && String(config.scope || '').toLowerCase() === 'source'
        && asPositiveNumber(config.per) !== undefined;
}

export function resolveSourceApScalingFactor(
    scaling: SourceApScalingConfig,
    context: EffectScalingContext
): number | undefined {
    if (!context.sourceCarduid) {
        return undefined;
    }

    const per = asPositiveNumber(scaling.per);
    if (!per) {
        return undefined;
    }

    const slotTotals = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(context.gameEnv, context.sourceCarduid);
    const totalAP = Math.max(0, slotTotals.totalAP || 0);
    return applyRounding(totalAP / per, resolveRounding(scaling.rounding));
}
