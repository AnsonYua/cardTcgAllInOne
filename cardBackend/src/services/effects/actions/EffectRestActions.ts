import { GameEnvironment } from '../../../models/GameEnvironment';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { TargetCardResolver } from '../../targets/TargetCardResolver';
import { GameNotificationManager } from '../../GameNotificationManager';
import { UnitRestedByEffectTriggeredEffectManager } from '../UnitRestedByEffectTriggeredEffectManager';

export function applyRestEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
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

        const wasRested = resolved.card.isRested === true;
        resolved.card.isRested = true;
        notificationManager.addNotificationEvent('CARD_RESTED', {
            playerId: target.playerId,
            carduid: target.carduid,
            zone: target.zone,
            timestamp: Date.now()
        });

        if (!wasRested && resolved.kind === 'unit') {
            const triggerResult = UnitRestedByEffectTriggeredEffectManager.process(gameEnv, {
                sourcePlayerId,
                targetPlayerId: target.playerId,
                targetCarduid: target.carduid
            });
            if (!triggerResult.success) {
                return { success: false, error: triggerResult.error || 'Failed to process UNIT_RESTED_BY_EFFECT trigger' };
            }
        }
    }

    return { success: true };
}
