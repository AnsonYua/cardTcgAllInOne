// src/services/effects/actions/EffectReturnToHandActions.ts

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { SlotExitCoordinator } from '../../zones/SlotExitCoordinator';
import { GameNotificationManager } from '../../GameNotificationManager';
import { ContinuousEffectManager } from '../../ContinuousEffectManager';

export function applyReturnToHandEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const returned: Array<{ carduid: string; fromZone: string; ownerPlayerId: string }> = [];

    for (const target of selectedTargets) {
        const resolved = SlotZoneUtils.resolveTargetReference(gameEnv, target);
        if (!resolved) {
            return {
                success: false,
                error: `Target card ${target.carduid} not found in zone ${target.zone}`
            };
        }

        if (resolved.type !== 'unit' && resolved.type !== 'pilot') {
            return {
                success: false,
                error: `returnToHand currently supports unit/pilot targets only (got ${resolved.type || 'unknown'})`
            };
        }

        const ownerPlayerId = resolved.playerId;
        const moveResult = SlotExitCoordinator.moveTargetToHand(
            gameEnv,
            ownerPlayerId,
            resolved.slotName,
            resolved.type,
            effect,
            {
                sourcePlayerId,
                sourceCarduid,
                effectId: effect.effectId
            }
        );
        if (!moveResult.success) {
            return { success: false, error: moveResult.error || 'Failed to move cards to hand' };
        }

        for (const moved of moveResult.moved) {
            returned.push({
                carduid: moved.carduid,
                fromZone: moved.fromZone,
                ownerPlayerId: moved.ownerPlayerId
            });
        }
    }

    ContinuousEffectManager.processAllContinuousEffects(gameEnv);

    const notificationManager = new GameNotificationManager(gameEnv);
    notificationManager.addNotificationEvent(
        'RETURN_TO_HAND_RESOLVED',
        {
            playerId: sourcePlayerId,
            sourceCarduid,
            effectId: effect.effectId,
            returned,
            timestamp: Date.now()
        },
        'normal'
    );

    return { success: true };
}
