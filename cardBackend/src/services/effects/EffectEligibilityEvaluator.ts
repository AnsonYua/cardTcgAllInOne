import type { GameEnvironment } from '../../models/GameEnvironment';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { ContinuousEffectManager } from '../ContinuousEffectManager';

export class EffectEligibilityEvaluator {
    static shouldExecute(params: {
        gameEnv: GameEnvironment;
        sourcePlayerId: string;
        sourceCard: any | null;
        effect: EffectDefinition;
    }): boolean {
        const { gameEnv, sourcePlayerId, sourceCard, effect } = params;

        if (!sourceCard) {
            return true;
        }

        if (!ContinuousEffectManager.sourceConditionsMet(effect as any, sourceCard as any, gameEnv, sourcePlayerId)) {
            return false;
        }

        if (!ContinuousEffectManager.validateEffectConditions(effect, gameEnv, sourcePlayerId, sourceCard as any)) {
            return false;
        }

        return true;
    }
}

