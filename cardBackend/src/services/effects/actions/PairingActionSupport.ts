import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { EffectDefinition, PlayCardEventData } from '../../EventQueue/interfaces/GameEvent';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { CardEnteredPlayManager } from '../../CardEnteredPlayManager';
import { PairingEffectManager } from '../../PairingEffectManager';
import { PlayerCardManager } from '../../PlayerCardManager';
import { GameNotificationManager } from '../../GameNotificationManager';

type PairingSourceContextResult =
    | {
        success: true;
        player: any;
        sourceSlot: string;
      }
    | {
        success: false;
        error: string;
      };

export function resolvePairingSourceContext(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    actionLabel: string
): PairingSourceContextResult {
    if (!sourceCarduid) {
        return { success: false, error: `${actionLabel} requires sourceCarduid` };
    }

    const player = gameEnv.getPlayer(sourcePlayerId);
    if (!player?.zones) {
        return { success: false, error: `Player zones not found for ${actionLabel}` };
    }

    const sourceSlot = SlotZoneUtils.findSlotByCarduid(player.zones, sourceCarduid).slotName;
    if (!sourceSlot) {
        return { success: false, error: `Source unit ${sourceCarduid} not found in slots for ${actionLabel}` };
    }

    const slot = (player.zones as any)[sourceSlot];
    if (slot?.pilot) {
        return { success: false, error: `${actionLabel} requires the source unit to have no paired pilot` };
    }

    return {
        success: true,
        player,
        sourceSlot
    };
}

export function finalizePairingFromAction(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string,
    effect: EffectDefinition,
    pilotCarduid: string,
    notificationType: string
): { success: boolean; error?: string } {
    const placementResult = PlayerCardManager.placeCardWithEventData(gameEnv, sourcePlayerId, {
        carduid: pilotCarduid,
        playAs: 'pilot',
        targetUnit: sourceCarduid
    });

    if (!placementResult.success || !placementResult.placedZone) {
        return { success: false, error: placementResult.error || 'Failed to place paired pilot' };
    }

    const entered = CardEnteredPlayManager.handleCardEnteredPlay(gameEnv, sourcePlayerId, {
        carduid: pilotCarduid,
        playAs: 'pilot',
        slotName: placementResult.placedZone
    });
    if (!entered.success) {
        return { success: false, error: entered.error || 'Failed to handle pilot entering play' };
    }

    const eventData: PlayCardEventData = {
        carduid: pilotCarduid,
        playAs: 'pilot',
        slotName: placementResult.placedZone
    };
    const pairingEvent = PairingEffectManager.checkForPairingEffectsEvent(eventData, gameEnv, sourcePlayerId);
    if (pairingEvent) {
        gameEnv.enqueueForProcessing(pairingEvent);
    }

    if (placementResult.isOnLink) {
        PlayerCardManager.handleLinkFormation(gameEnv, sourcePlayerId, pilotCarduid);
    }

    const notificationManager = new GameNotificationManager(gameEnv);
    notificationManager.addNotificationEvent(
        notificationType,
        {
            playerId: sourcePlayerId,
            unitCarduid: sourceCarduid,
            pilotCarduid,
            slotName: placementResult.placedZone,
            sourceCarduid,
            effectId: effect.effectId,
            timestamp: Date.now()
        },
        'normal'
    );

    return { success: true };
}
