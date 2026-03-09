import type { GameEnvironment } from '../../../models/GameEnvironment';
import { CardDatabaseManager, type CardData } from '../../../models/CardSystem';
import { getCardIdFromUid } from '../../../utils/CardUtils';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { DeckZoneManager, type DeckBottomOrder } from '../../zones/DeckZoneManager';
import { HandZoneManager } from '../../zones/HandZoneManager';
import { UnitDeployService } from '../../deploy/UnitDeployService';
import {
    emitTopDeckSelectionCardsMovedToBottom,
    emitTopDeckSelectionResolved
} from './TopDeckSelectionNotificationUtils';

function shuffleInPlace<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
}

export function resolveTopDeckSelection(
    gameEnv: GameEnvironment,
    deck: string[],
    lookedCarduids: string[],
    chosenUid: string | undefined,
    params: {
        order: DeckBottomOrder;
        toZone: 'hand' | 'play';
        reveal: boolean;
        playerId: string;
        sourceCarduid: string;
        effectId?: string;
        destinationSlot?: string;
    }
): void {
    const extracted = DeckZoneManager.extractSpecific(deck, lookedCarduids);
    const chosenIndex = chosenUid ? extracted.indexOf(chosenUid) : -1;
    const selectedCarduid = chosenIndex >= 0 ? extracted.splice(chosenIndex, 1)[0] : undefined;
    const restCarduids = [...extracted];

    if (selectedCarduid && params.toZone === 'hand') {
        const cardId = getCardIdFromUid(selectedCarduid);
        const cardData = CardDatabaseManager.getCardDetails(cardId) as CardData;
        HandZoneManager.addCardToHand(gameEnv, params.playerId, selectedCarduid, cardData, {
            eventType: 'CARD_ADDED_TO_HAND',
            sourceZone: 'deck',
            reason: 'select_from_top_deck',
            extraPayload: {
                reveal: params.reveal,
                revealToOpponent: params.reveal,
                sourceCarduid: params.sourceCarduid,
                effectId: params.effectId
            }
        });
    }

    if (selectedCarduid && params.toZone === 'play') {
        const cardId = getCardIdFromUid(selectedCarduid);
        const cardData = CardDatabaseManager.getCardDetails(cardId) as CardData | undefined;
        if (cardData?.cardType === 'unit' && params.destinationSlot) {
            const player = gameEnv.getPlayer(params.playerId);
            const slotResult = player?.zones ? SlotZoneUtils.getSlotZone(player.zones, params.destinationSlot) : null;
            if (slotResult?.isValid && slotResult.slot) {
                const deployResult = UnitDeployService.deployUnitCardToSlot(gameEnv, {
                    playerId: params.playerId,
                    destinationSlot: params.destinationSlot,
                    carduid: selectedCarduid,
                    cardId,
                    cardData,
                    sourceCarduid: params.sourceCarduid,
                    fromZone: 'deck',
                    notificationType: 'CARD_DEPLOYED_FROM_TOP_DECK',
                    notificationExtra: {
                        effectId: params.effectId
                    }
                });
                if (!deployResult.success) {
                    emitTopDeckSelectionResolved({
                        gameEnv,
                        playerId: params.playerId,
                        sourceCarduid: params.sourceCarduid,
                        effectId: params.effectId,
                        toZone: params.toZone,
                        result: 'FAILED_DEPLOY',
                        selectedCarduid,
                        error: deployResult.error
                    });
                }
            }
        }
    }

    if (params.order === 'random') {
        shuffleInPlace(restCarduids);
    }
    deck.push(...restCarduids);

    if (restCarduids.length > 0) {
        emitTopDeckSelectionCardsMovedToBottom({
            gameEnv,
            playerId: params.playerId,
            sourceCarduid: params.sourceCarduid,
            effectId: params.effectId,
            carduids: restCarduids,
            reason: params.toZone === 'play' ? 'select_from_top_deck_resolve_bottom_play' : 'select_from_top_deck_resolve_bottom_hand'
        });
    }

    emitTopDeckSelectionResolved({
        gameEnv,
        playerId: params.playerId,
        sourceCarduid: params.sourceCarduid,
        effectId: params.effectId,
        toZone: params.toZone,
        result: selectedCarduid
            ? (params.toZone === 'play' ? 'DEPLOYED' : 'ADDED_TO_HAND')
            : 'MOVED_TO_BOTTOM',
        selectedCarduid,
        movedCarduids: restCarduids,
    });
}
