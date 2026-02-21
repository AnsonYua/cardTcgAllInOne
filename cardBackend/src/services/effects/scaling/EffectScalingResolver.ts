import type { EffectScalingContext } from './EffectScalingTypes';
import {
    isSourceApScalingConfig,
    resolveSourceApScalingFactor
} from './strategies/SourceApScalingStrategy';
import {
    isCountUnitsInPlayScalingConfig,
    resolveCountUnitsInPlayScalingFactor
} from './strategies/CountUnitsInPlayScalingStrategy';
import {
    isCountUniqueCardsInTrashScalingConfig,
    resolveCountUniqueCardsInTrashScalingFactor
} from './strategies/CountUniqueCardsInTrashScalingStrategy';

function warnUnsupportedScaling(scaling: unknown, context: EffectScalingContext): void {
    try {
        console.warn(
            `⚠️ Unsupported scaling config for effect ${context.effectId || 'unknown_effect'}: ${JSON.stringify(scaling)}`
        );
    } catch {
        console.warn(`⚠️ Unsupported scaling config for effect ${context.effectId || 'unknown_effect'}`);
    }
}

export class EffectScalingResolver {
    static resolveScaledValue(
        baseValue: number,
        scaling: unknown,
        context: EffectScalingContext
    ): number {
        const normalizedBaseValue = Number.isFinite(baseValue) ? baseValue : 0;
        if (!scaling || typeof scaling !== 'object') {
            return normalizedBaseValue;
        }

        if (isSourceApScalingConfig(scaling)) {
            const factor = resolveSourceApScalingFactor(scaling, context);
            if (typeof factor === 'number' && Number.isFinite(factor)) {
                return normalizedBaseValue * factor;
            }
            warnUnsupportedScaling(scaling, context);
            return normalizedBaseValue;
        }

        if (isCountUnitsInPlayScalingConfig(scaling)) {
            const factor = resolveCountUnitsInPlayScalingFactor(scaling, context);
            if (Number.isFinite(factor)) {
                return normalizedBaseValue * factor;
            }
            warnUnsupportedScaling(scaling, context);
            return normalizedBaseValue;
        }

        if (isCountUniqueCardsInTrashScalingConfig(scaling)) {
            const factor = resolveCountUniqueCardsInTrashScalingFactor(scaling, context);
            if (Number.isFinite(factor)) {
                return normalizedBaseValue * factor;
            }
            warnUnsupportedScaling(scaling, context);
            return normalizedBaseValue;
        }

        warnUnsupportedScaling(scaling, context);
        return normalizedBaseValue;
    }
}
