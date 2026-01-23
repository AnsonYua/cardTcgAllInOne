// src/services/effects/actions/EffectPairActions.ts

import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition, TargetReference, PlayCardEventData } from '../../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../../GameNotificationManager';
import { PairingEffectManager } from '../../PairingEffectManager';
import { CardEnteredPlayManager } from '../../CardEnteredPlayManager';
import { PlayerCardManager } from '../../PlayerCardManager';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';

export function applyPairFromTrashEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (!sourceCarduid) {
        return { success: false, error: 'pair_from_trash requires sourceCarduid' };
    }

    if (selectedTargets.length === 0) {
        return { success: false, error: 'pair_from_trash requires a selected pilot from trash' };
    }

    const target = selectedTargets[0];
    if (target.playerId !== sourcePlayerId) {
        return { success: false, error: 'pair_from_trash can only select from your own trash' };
    }

    const player = gameEnv.getPlayer(sourcePlayerId);
    if (!player?.zones) {
        return { success: false, error: 'Player zones not found for pair_from_trash' };
    }

    const sourceSlot = SlotZoneUtils.findSlotByCarduid(player.zones, sourceCarduid).slotName;
    if (!sourceSlot) {
        return { success: false, error: `Source unit ${sourceCarduid} not found in slots for pair_from_trash` };
    }

    const slot = (player.zones as any)[sourceSlot];
    if (slot?.pilot) {
        return { success: false, error: 'pair_from_trash requires the source unit to have no paired pilot' };
    }

    if (!Array.isArray(player.zones.trashArea)) {
        player.zones.trashArea = [];
    }

    const trashIndex = player.zones.trashArea.findIndex((card: any) => card?.carduid === target.carduid);
    if (trashIndex < 0) {
        return { success: false, error: `Pilot ${target.carduid} not found in trash for pair_from_trash` };
    }

    const removedTrashCard = player.zones.trashArea.splice(trashIndex, 1)[0];

    const placementResult = PlayerCardManager.placeCardWithEventData(gameEnv, sourcePlayerId, {
        carduid: target.carduid,
        playAs: 'pilot',
        targetUnit: sourceCarduid
    });

    if (!placementResult.success || !placementResult.placedZone) {
        player.zones.trashArea.push(removedTrashCard);
        return { success: false, error: placementResult.error || 'Failed to pair pilot from trash' };
    }

    const entered = CardEnteredPlayManager.handleCardEnteredPlay(gameEnv, sourcePlayerId, {
        carduid: target.carduid,
        playAs: 'pilot',
        slotName: placementResult.placedZone
    });
    if (!entered.success) {
        return { success: false, error: entered.error || 'Failed to handle pilot entering play' };
    }

    const eventData: PlayCardEventData = {
        carduid: target.carduid,
        playAs: 'pilot',
        slotName: placementResult.placedZone
    };
    const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(eventData, gameEnv, sourcePlayerId);
    if (pairingEvent) {
        gameEnv.enqueueForProcessing(pairingEvent);
    }

    if (placementResult.isOnLink) {
        PlayerCardManager.handleLinkFormation(gameEnv, sourcePlayerId, target.carduid);
    }

    const notificationManager = new GameNotificationManager(gameEnv);
    notificationManager.addNotificationEvent(
        'PILOT_PAIRED_FROM_TRASH',
        {
            playerId: sourcePlayerId,
            unitCarduid: sourceCarduid,
            pilotCarduid: target.carduid,
            slotName: placementResult.placedZone,
            sourceCarduid,
            effectId: effect.effectId,
            timestamp: Date.now()
        },
        'normal'
    );

    return { success: true };
}
