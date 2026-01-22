import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { ConditionalTokenDeployManager } from '../ConditionalTokenDeployManager';

export function applyConditionalTokenDeployEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition
): { success: boolean; error?: string } {
    if (!ConditionalTokenDeployManager.conditionsSatisfied(effect, gameEnv, sourcePlayerId)) {
        return { success: true };
    }

    const planResult = ConditionalTokenDeployManager.buildPlan(gameEnv, sourcePlayerId, effect);
    if (!planResult.success) {
        return { success: false, error: planResult.error };
    }

    return ConditionalTokenDeployManager.executePlan(
        gameEnv,
        sourcePlayerId,
        sourceCarduid || 'unknown',
        planResult.plan
    );
}
