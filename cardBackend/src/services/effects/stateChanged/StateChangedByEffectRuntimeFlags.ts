import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { CardStateChangedByEffectContext } from './StateChangedByEffectTypes';

function featureFlagEnabled(gameEnv: GameEnvironment, flagName: string): boolean {
    const flags = (gameEnv as any)?.runtimeFeatureFlags;
    if (!flags || typeof flags !== 'object') {
        return true;
    }
    if (typeof flags[flagName] !== 'boolean') {
        return true;
    }
    return flags[flagName] === true;
}

export function shouldProcessStateChangedByEffectContext(
    gameEnv: GameEnvironment,
    context: CardStateChangedByEffectContext
): boolean {
    if (!featureFlagEnabled(gameEnv, 'enableUnifiedStateChangedTriggers')) {
        return false;
    }
    if (!context.targetPlayerId || !context.targetCarduid) {
        return false;
    }
    if (context.toState === 'active' && !featureFlagEnabled(gameEnv, 'enableUnitSetActiveByEffectTrigger')) {
        return false;
    }
    return true;
}
