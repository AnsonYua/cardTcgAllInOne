// src/services/deploy/UnitDeployService.ts
// Centralizes "deploy a unit into a slot" side-effects:
// - place in slot
// - emit notificationQueue event for frontend
// - run CardEnteredPlayManager hooks (deploy triggers, continuous refresh)

import type { GameEnvironment } from '../../models/GameEnvironment';
import { createZoneCard, type UnitZoneCard } from '../../models/CardSystem';
import { SlotZoneUtils } from '../../utils/SlotZoneUtils';
import { GameNotificationManager } from '../GameNotificationManager';
import { CardEnteredPlayManager } from '../CardEnteredPlayManager';

type UnitDeployParams = {
    playerId: string;
    destinationSlot: string;
    carduid: string;
    cardId: string;
    cardData: any;
    sourceCarduid?: string;
    fromZone?: string;
    notificationType: string;
    notificationExtra?: Record<string, unknown>;
};

export class UnitDeployService {
    static deployUnitCardToSlot(
        gameEnv: GameEnvironment,
        params: UnitDeployParams
    ): { success: boolean; error?: string } {
        const player = gameEnv.getPlayer(params.playerId) || gameEnv.players[params.playerId];
        if (!player?.zones) {
            return { success: false, error: 'Player zones unavailable for unit deploy' };
        }

        const slotResult = SlotZoneUtils.getSlotZone(player.zones, params.destinationSlot);
        if (!slotResult.isValid || !slotResult.slot) {
            return { success: false, error: `Invalid destination slot ${params.destinationSlot}` };
        }

        if (!SlotZoneUtils.isEmpty(slotResult.slot)) {
            return { success: false, error: `Destination slot ${params.destinationSlot} is not empty` };
        }

        const unitCard = createZoneCard(
            params.carduid,
            params.cardId,
            params.cardData,
            params.playerId,
            'unit'
        ) as UnitZoneCard;
        slotResult.slot.unit = unitCard;

        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            params.notificationType,
            {
                playerId: params.playerId,
                sourceCarduid: params.sourceCarduid,
                carduid: params.carduid,
                cardId: params.cardId,
                fromZone: params.fromZone,
                toZone: params.destinationSlot,
                timestamp: Date.now(),
                ...(params.notificationExtra || {})
            },
            'normal'
        );

        const enterPlayResult = CardEnteredPlayManager.handleCardEnteredPlay(gameEnv, params.playerId, {
            carduid: params.carduid,
            playAs: 'unit',
            slotName: params.destinationSlot
        });
        if (!enterPlayResult.success) {
            return { success: false, error: enterPlayResult.error || 'Failed to handle unit entering play' };
        }

        return { success: true };
    }
}

