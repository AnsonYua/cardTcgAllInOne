import type { GameEnvironment } from '../../models/GameEnvironment';
import { StateChangedByEffectTriggerDispatcher } from './StateChangedByEffectTriggerDispatcher';

export interface UnitSetActiveByEffectContext {
    sourcePlayerId: string;
    targetPlayerId: string;
    targetCarduid: string;
    fromState: 'rested' | 'active';
}

export class UnitSetActiveByEffectTriggeredEffectManager {
    static process(
        gameEnv: GameEnvironment,
        context: UnitSetActiveByEffectContext
    ): { success: boolean; error?: string; requiresSelection?: boolean } {
        return StateChangedByEffectTriggerDispatcher.process(gameEnv, {
            sourcePlayerId: context.sourcePlayerId,
            targetPlayerId: context.targetPlayerId,
            targetCarduid: context.targetCarduid,
            targetCardType: 'unit',
            fromState: context.fromState,
            toState: 'active'
        });
    }
}
