// src/services/effects/actions/EffectDiscardActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { CardDatabaseManager, createZoneCard } from '../../../models/CardSystem';
import { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../../GameNotificationManager';

export function applyDiscardFromHandEffect(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    _effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const player = gameEnv.getPlayer(sourcePlayerId);
    if (!player?.deck || !player?.zones) {
        return { success: false, error: 'Player not found for discardFromHand' };
    }

    const notificationManager = new GameNotificationManager(gameEnv);

    for (const target of selectedTargets) {
        if (target.playerId !== sourcePlayerId) {
            return { success: false, error: 'discardFromHand can only discard your own hand cards' };
        }

        const removed = player.deck.playCardFromHand(target.carduid);
        if (!removed) {
            return { success: false, error: `Card ${target.carduid} not found in hand for discard` };
        }

        const cardId = target.carduid.split('_')[0];
        const cardData = target.cardData || CardDatabaseManager.getCardDetails(cardId);
        if (!cardData) {
            return { success: false, error: `Card data not found for ${cardId} discard` };
        }

        const zoneCard = createZoneCard(target.carduid, cardId, cardData as any, sourcePlayerId);
        player.zones.trashArea.push(zoneCard);
        console.log(`🗑️ Discarded ${cardId} from hand to trash`);

        notificationManager.addNotificationEvent('CARD_DISCARDED_FROM_HAND', {
            playerId: sourcePlayerId,
            carduid: target.carduid,
            cardId,
            fromZone: 'hand',
            toZone: 'trash',
            sourceCarduid,
            timestamp: Date.now()
        });
    }

    return { success: true };
}
