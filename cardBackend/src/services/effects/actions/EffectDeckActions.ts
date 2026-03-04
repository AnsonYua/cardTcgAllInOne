// src/services/effects/actions/EffectDeckActions.ts

import { GameEnvironment } from '../../../models/GameEnvironment';
import { CardDatabaseManager, createZoneCard } from '../../../models/CardSystem';
import type { EffectDefinition, TargetReference } from '../../EventQueue/interfaces/GameEvent';
import { GameNotificationManager } from '../../GameNotificationManager';
import { DeckZoneManager } from '../../zones/DeckZoneManager';

export interface MoveTopDeckToTrashResult {
    success: boolean;
    error?: string;
    movedCards: any[];
}

export function applyMoveTopDeckToTrash(
    gameEnv: GameEnvironment,
    playerId: string,
    count: number,
    options: {
        sourceCarduid?: string;
        effectId?: string;
        reveal?: boolean;
        reason?: string;
    } = {}
): MoveTopDeckToTrashResult {
    const player = gameEnv.getPlayer(playerId);
    if (!player?.deck || !player?.zones) {
        return { success: false, error: 'Player deck/zones not found', movedCards: [] };
    }

    if (!Array.isArray(player.zones.trashArea)) {
        player.zones.trashArea = [];
    }

    const deck = player.deck;
    if (!Array.isArray(deck.mainDeck)) {
        return { success: false, error: 'Player mainDeck not found', movedCards: [] };
    }

    const moved: any[] = [];
    // Intentionally a legal no-op when the deck is empty so sequence effects like
    // "mill, then if milled card matches..." can fizzle without failing card play.
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

    if (moved.length > 0) {
        const notificationManager = new GameNotificationManager(gameEnv);
        notificationManager.addNotificationEvent(
            'CARDS_MOVED_TO_TRASH',
            {
                playerId,
                carduids: moved.map(card => card.carduid),
                count: moved.length,
                fromZone: 'deck',
                toZone: 'trash',
                // Contract: reveal=true means all viewers may see card identity in popup/notification UIs.
                reveal: options.reveal === true,
                sourceCarduid: options.sourceCarduid,
                effectId: options.effectId,
                reason: options.reason || 'moveTopDeckToTrash',
                timestamp: Date.now()
            },
            'normal'
        );
    }

    return { success: true, movedCards: moved };
}

export function applyMoveFromHandToDeckBottom(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const player = gameEnv.getPlayer(sourcePlayerId);
    if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
        return { success: false, error: 'Player deck not found for moveFromHandToDeckBottom' };
    }

    const reveal = effect.parameters?.reveal === true;
    const moved: string[] = [];

    for (const target of selectedTargets) {
        if (target.playerId !== sourcePlayerId) {
            return { success: false, error: 'moveFromHandToDeckBottom can only move from your own hand' };
        }

        const removed = player.deck.playCardFromHand(target.carduid);
        if (!removed) {
            return { success: false, error: `Card ${target.carduid} not found in hand for moveFromHandToDeckBottom` };
        }

        player.deck.mainDeck.push(target.carduid);
        moved.push(target.carduid);
    }

    const revealed = reveal
        ? moved.map((carduid) => {
            const cardId = carduid.split('_')[0];
            const cardData = CardDatabaseManager.getCardDetails(cardId);
            return {
                carduid,
                cardId,
                name: cardData?.name,
                traits: Array.isArray(cardData?.traits) ? cardData.traits : [],
                cardType: cardData?.cardType
            };
        })
        : [];

    const notificationManager = new GameNotificationManager(gameEnv);
    if (reveal && revealed.length > 0) {
        notificationManager.addNotificationEvent('HAND_CARDS_REVEALED', {
            playerId: sourcePlayerId,
            sourceCarduid,
            effectId: effect.effectId,
            cards: revealed,
            revealToOpponent: true,
            timestamp: Date.now()
        }, 'normal');
    }

    notificationManager.addNotificationEvent('CARDS_MOVED_TO_DECK_BOTTOM', {
        playerId: sourcePlayerId,
        sourceCarduid,
        effectId: effect.effectId,
        carduids: moved,
        count: moved.length,
        fromZone: 'hand',
        toZone: 'deck_bottom',
        reveal,
        revealToOpponent: reveal,
        ...(reveal ? { cards: revealed } : {}),
        reason: 'moveFromHandToDeckBottom',
        timestamp: Date.now()
    }, 'normal');

    return { success: true };
}

export function applyMoveFromTrashToDeck(
    gameEnv: GameEnvironment,
    sourcePlayerId: string,
    sourceCarduid: string | undefined,
    effect: EffectDefinition,
    selectedTargets: TargetReference[]
): { success: boolean; error?: string } {
    if (selectedTargets.length === 0) {
        return { success: true };
    }

    const player = gameEnv.getPlayer(sourcePlayerId);
    if (!player?.deck || !Array.isArray(player.deck.mainDeck)) {
        return { success: false, error: 'Player deck not found for moveFromTrashToDeck' };
    }

    if (!player?.zones || !Array.isArray(player.zones.trashArea)) {
        return { success: false, error: 'Player trash not found for moveFromTrashToDeck' };
    }

    const moved: string[] = [];

    for (const target of selectedTargets) {
        if (target.playerId !== sourcePlayerId) {
            return { success: false, error: 'moveFromTrashToDeck can only move from your own trash' };
        }

        const index = player.zones.trashArea.findIndex((card: any) => card?.carduid === target.carduid);
        if (index < 0) {
            return { success: false, error: `Card ${target.carduid} not found in trash for moveFromTrashToDeck` };
        }

        const [removed] = player.zones.trashArea.splice(index, 1);
        if (!removed?.carduid) {
            continue;
        }

        player.deck.mainDeck.push(target.carduid);
        moved.push(target.carduid);
    }

    const shuffle = effect.parameters?.shuffle === true;
    if (shuffle) {
        DeckZoneManager.shuffle(player.deck.mainDeck);
    }

    const notificationManager = new GameNotificationManager(gameEnv);
    notificationManager.addNotificationEvent('CARDS_MOVED_FROM_TRASH_TO_DECK', {
        playerId: sourcePlayerId,
        sourceCarduid,
        effectId: effect.effectId,
        carduids: moved,
        count: moved.length,
        fromZone: 'trash',
        toZone: 'deck',
        shuffle,
        reason: 'moveFromTrashToDeck',
        timestamp: Date.now()
    }, 'normal');

    return { success: true };
}
