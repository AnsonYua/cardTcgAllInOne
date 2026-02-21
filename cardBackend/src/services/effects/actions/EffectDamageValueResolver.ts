import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { EffectScalingResolver } from '../scaling/EffectScalingResolver';
import { extractNumericValue } from './EffectActionUtils';

export function resolveEffectDamageValue(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
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

    const resolved = EffectScalingResolver.resolveScaledValue(baseValue, scaling, {
        gameEnv,
        sourcePlayerId,
        sourceCarduid,
        effectId: effect.effectId
    });
    return Math.max(0, resolved);
}
