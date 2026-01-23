import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { TargetCardResolver } from '../../targets/TargetCardResolver';
import { GameNotificationManager } from '../../GameNotificationManager';

export function applyRestEffect(
    gameEnv: GameEnvironment,
    _sourcePlayerId: string,
    _sourceCarduid: string | undefined,
    _effect: EffectDefinition | null,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const notificationManager = new GameNotificationManager(gameEnv);

    for (const target of selectedTargets) {
        const resolved = TargetCardResolver.resolve(gameEnv, target);
        if (!resolved) {
            return {
                success: false,
                error: `Target card ${target.carduid} not found in zone ${target.zone}`
            };
        }

        resolved.card.isRested = true;
        notificationManager.addNotificationEvent('CARD_RESTED', {
            playerId: target.playerId,
            carduid: target.carduid,
            zone: target.zone,
            timestamp: Date.now()
        });
    }

    return { success: true };
}
