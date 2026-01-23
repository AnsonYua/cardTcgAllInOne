// src/services/effects/actions/EffectReturnToHandActions.ts

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { HandZoneManager } from '../../zones/HandZoneManager';
import { GameNotificationManager } from '../../GameNotificationManager';

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
        const owner = gameEnv.getPlayer(ownerPlayerId);
        if (!owner?.zones || !owner?.deck) {
            return { success: false, error: `Owner player ${ownerPlayerId} not found for returnToHand` };
        }

        const slot = (owner.zones as any)[resolved.slotName];
        const isUnit = resolved.type === 'unit';
        const slotKey = isUnit ? 'unit' : 'pilot';
        if (!slot?.[slotKey] || slot[slotKey].carduid !== target.carduid) {
            return {
                success: false,
                error: `${isUnit ? 'Unit' : 'Pilot'} ${target.carduid} not found in expected slot ${resolved.slotName}`
            };
        }

        const movedCard = slot[slotKey];
        slot[slotKey] = null;

        const addResult = HandZoneManager.addCardToHand(
            gameEnv,
            ownerPlayerId,
            movedCard.carduid,
            movedCard.cardData as any,
            {
                eventType: 'CARD_RETURNED_TO_HAND',
                sourceZone: resolved.slotName,
                reason: 'returnToHand',
                extraPayload: {
                    sourcePlayerId,
                    sourceCarduid,
                    effectId: effect.effectId
                }
            }
        );

        if (!addResult.success) {
            return addResult;
        }

        returned.push({ carduid: movedCard.carduid, fromZone: resolved.slotName, ownerPlayerId });
    }

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
