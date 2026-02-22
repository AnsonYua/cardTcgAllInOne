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
        const resolved = resolveReturnTarget(gameEnv, sourcePlayerId, effect, target);
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

function resolveReturnTarget(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    effect: EffectDefinition,
    target: TargetReference
) {
    const direct = SlotZoneUtils.resolveTargetReference(gameEnv, target);
    const expectsOpponent = isOpponentScope(effect);
    if (!expectsOpponent) {
        return direct;
    }
    if (direct && direct.playerId !== sourcePlayerId) {
        return direct;
    }

    // Safety fallback:
    // if the effect expects an opponent target but the incoming target resolves to self
    // (or fails due playerId drift), resolve by UID across players and keep zone consistency.
    const search = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
    if (!search.found || !search.playerId || !search.slotName || !search.type || !search.card) {
        return direct;
    }

    if (target.zone && target.zone !== search.slotName) {
        return direct;
    }

    if (search.playerId === sourcePlayerId) {
        return direct;
    }

    return {
        card: search.card,
        type: search.type,
        slotName: search.slotName,
        playerId: search.playerId
    };
}

function isOpponentScope(effect: EffectDefinition): boolean {
    const scope = typeof effect?.target?.scope === 'string' ? effect.target.scope.toLowerCase() : '';
    return scope.startsWith('opponent');
}
