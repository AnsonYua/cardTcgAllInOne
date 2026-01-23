// src/services/effects/actions/EffectSequenceActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { SequenceEffectManager } from '../SequenceEffectManager';

export function applySequenceEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition
): { success: boolean; error?: string } {
    if (!sourceCarduid) {
        return { success: false, error: 'sequence effect requires sourceCarduid' };
    }

    const result = SequenceEffectManager.processSequenceEffect(gameEnv, sourcePlayerId, sourceCarduid, effect);
    return { success: result.success, error: result.error };
}

