import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { PlayerCardManager } from '../../PlayerCardManager';
import { extractNumericValue } from './EffectActionUtils';

type DamageScalingRounding = 'floor' | 'ceil' | 'round';

function resolveRoundingMode(rawValue: unknown): DamageScalingRounding {
    if (typeof rawValue !== 'string') {
        return 'floor';
    }

    const normalized = rawValue.toLowerCase();
    if (normalized === 'ceil' || normalized === 'round' || normalized === 'floor') {
        return normalized;
    }

    return 'floor';
}

function roundByMode(value: number, mode: DamageScalingRounding): number {
    if (mode === 'ceil') {
        return Math.ceil(value);
    }
    if (mode === 'round') {
        return Math.round(value);
    }
    return Math.floor(value);
}

function resolvePositiveNumber(rawValue: unknown): number | undefined {
    const value = typeof rawValue === 'string' ? Number(rawValue) : rawValue;
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value) || value <= 0) {
        return undefined;
    }
    return value;
}

function resolveSourceApScalingFactor(
    gameEnv: GameEnvironment,
    sourceCarduid: string | undefined,
    per: number,
    rounding: DamageScalingRounding
): number | undefined {
    if (!sourceCarduid) {
        return undefined;
    }

    const sourceTotals = PlayerCardManager.getCurrentUnitCardInSlotAPandHP(gameEnv, sourceCarduid);
    const totalAP = Math.max(0, sourceTotals.totalAP || 0);
    return roundByMode(totalAP / per, rounding);
}

export function resolveEffectDamageValue(
    gameEnv: GameEnvironment,
    effect: EffectDefinition,
    sourceCarduid?: string
): number {
    const baseValue = extractNumericValue(effect.parameters) ?? 0;
    if (!effect.parameters || typeof effect.parameters !== 'object') {
        return Math.max(0, baseValue);
    }

    const scaling = (effect.parameters as Record<string, unknown>)['scaling'];
    if (!scaling || typeof scaling !== 'object') {
        return Math.max(0, baseValue);
    }

    const scalingConfig = scaling as Record<string, unknown>;
    const stat = typeof scalingConfig['stat'] === 'string' ? scalingConfig['stat'].toLowerCase() : '';
    const scope = typeof scalingConfig['scope'] === 'string' ? scalingConfig['scope'].toLowerCase() : '';
    const per = resolvePositiveNumber(scalingConfig['per']);
    if (stat !== 'ap' || scope !== 'source' || !per) {
        return Math.max(0, baseValue);
    }

    const scalingFactor = resolveSourceApScalingFactor(
        gameEnv,
        sourceCarduid,
        per,
        resolveRoundingMode(scalingConfig['rounding'])
    );
    if (typeof scalingFactor !== 'number' || Number.isNaN(scalingFactor) || !Number.isFinite(scalingFactor)) {
        return Math.max(0, baseValue);
    }

    return Math.max(0, baseValue * scalingFactor);
}
