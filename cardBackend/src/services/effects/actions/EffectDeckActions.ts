// src/services/effects/actions/EffectDeckActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { CardDatabaseManager, createZoneCard } from '../../../models/CardSystem';

export interface MoveTopDeckToTrashResult {
    success: boolean;
    error?: string;
    movedCards: any[];
}

export function applyMoveTopDeckToTrash(
    gameEnv: GameEnvironment,
    playerId: string,
    count: number
): MoveTopDeckToTrashResult {
    const player = gameEnv.getPlayer(playerId);
    if (!player?.deck || !player?.zones) {
        return { success: false, error: 'Player deck/zones not found', movedCards: [] };
    }

    const deck = player.deck;
    if (!Array.isArray(deck.mainDeck)) {
        return { success: false, error: 'Player mainDeck not found', movedCards: [] };
    }

    const moved: any[] = [];
    for (let i = 0; i < count && deck.mainDeck.length > 0; i++) {
        const carduid = deck.mainDeck.shift();
        if (!carduid || typeof carduid !== 'string') {
            continue;
        }

        const cardId = carduid.split('_')[0];
        const cardData = CardDatabaseManager.getCardDetails(cardId) || {
            id: cardId,
            name: `Unknown Card ${cardId}`,
            cardType: 'unknown'
        };

        const zoneCard = createZoneCard(carduid, cardId, cardData as any, playerId);
        player.zones.trashArea.push(zoneCard);
        moved.push(zoneCard);
    }

    return { success: true, movedCards: moved };
}

