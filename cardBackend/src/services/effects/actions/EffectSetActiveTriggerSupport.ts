import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { UnitSetActiveByEffectTriggeredEffectManager } from '../UnitSetActiveByEffectTriggeredEffectManager';

export function processUnitSetActiveByEffectTrigger(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    target: TargetReference,
    options: {
        isUnit: boolean;
        wasRested: boolean;
    }
): { success: boolean; error?: string } {
    if (!options.isUnit || !options.wasRested) {
        return { success: true };
    }

    const triggerResult = UnitSetActiveByEffectTriggeredEffectManager.process(gameEnv, {
        sourcePlayerId,
        targetPlayerId: target.playerId,
        targetCarduid: target.carduid,
        fromState: 'rested'
    });
    if (!triggerResult.success) {
        return {
            success: false,
            error: triggerResult.error || 'Failed to process UNIT_SET_ACTIVE_BY_EFFECT trigger'
        };
    }

    return { success: true };
}
