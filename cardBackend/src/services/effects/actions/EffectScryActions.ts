import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition } from '../../EventQueue/interfaces/GameEvent';
import { ScryTopDeckManager } from '../ScryTopDeckManager';

export function applyScryTopDeckEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    effect: EffectDefinition,
    sourceCarduid?: string
): { success: boolean; error?: string } {
    return ScryTopDeckManager.processScryTopDeckEffect(
        gameEnv,
        sourcePlayerId,
        sourceCarduid,
        effect
    );
}
