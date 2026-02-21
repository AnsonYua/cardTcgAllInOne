// src/services/effects/EffectScalingUtils.ts

import type { GameEnvironment } from '../../models/GameEnvironment';
import { EffectScalingResolver } from './scaling/EffectScalingResolver';

export class EffectScalingUtils {
    static resolveScalingFactor(
        gameEnv: GameEnvironment,
        playerId: string,
        scaling: unknown
    ): number {
        return EffectScalingResolver.resolveScaledValue(1, scaling, {
            gameEnv,
            sourcePlayerId: playerId
        });
    }
}
