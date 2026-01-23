// src/services/effects/continuous/ContinuousActionRegistry.ts
// Centralizes "continuous action" application so ContinuousEffectManager doesn't grow more branches.

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { ContinuousKeywordGrantManager } from './ContinuousKeywordGrantManager';
import { ContinuousBattleDamagePreventionManager } from './ContinuousBattleDamagePreventionManager';
import { ContinuousEffectDamagePreventionManager } from './ContinuousEffectDamagePreventionManager';
import { ContinuousBreachGrantManager } from './ContinuousBreachGrantManager';

export type ContinuousEffectEntry = {
    sourceCarduid: string;
    sourcePlayerId: string;
    effectData: EffectDefinition;
};

export class ContinuousActionRegistry {
    static apply(
        gameEnv: GameEnvironment,
        action: string,
        entry: ContinuousEffectEntry,
        targets: any[]
    ): number | null {
        switch (action) {
            case 'grant_keyword':
                return ContinuousKeywordGrantManager.applyToTargets(gameEnv, entry, targets);
            case 'grant_breach':
                return ContinuousBreachGrantManager.applyToTargets(gameEnv, entry, targets);
            case 'prevent_battle_damage':
                return ContinuousBattleDamagePreventionManager.applyToTargets(gameEnv, entry, targets);
            case 'prevent_damage':
                return ContinuousEffectDamagePreventionManager.applyToTargets(gameEnv, entry, targets);
            default:
                return null;
        }
    }
}
