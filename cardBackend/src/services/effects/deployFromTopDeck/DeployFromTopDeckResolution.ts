// src/services/effects/deployFromTopDeck/DeployFromTopDeckResolution.ts

import type { GameEnvironment } from '../../../models/GameEnvironment';
import { CardDatabaseManager, type CardData } from '../../../models/CardSystem';
import { DeckZoneManager, type DeckBottomOrder } from '../../zones/DeckZoneManager';
import { getCardIdFromUid } from '../../../utils/CardUtils';
import { SlotZoneUtils } from '../../../utils/SlotZoneUtils';
import { UnitDeployService } from '../../deploy/UnitDeployService';
import {
    emitDeployCardsMovedToBottom,
    emitDeployFromTopDeckResolved
} from './DeployFromTopDeckNotificationUtils';

export function resolveDeployFromTopDeckSelection(
    gameEnv: GameEnvironment,
    deck: string[],
    lookedCarduids: string[],
    chosenUid: string,
    params: {
        order: DeckBottomOrder;
        playerId: string;
        sourceCarduid: string;
        destinationSlot: string;
        effectId?: string;
    }
): void {
    const extracted = DeckZoneManager.extractSpecific(deck, lookedCarduids);
    const chosenIndex = extracted.indexOf(chosenUid);
    const chosenCarduid = chosenIndex >= 0 ? extracted.splice(chosenIndex, 1)[0] : undefined;
    const restCarduids = [...extracted];

    if (chosenCarduid) {
        const cardId = getCardIdFromUid(chosenCarduid);
        const cardData = CardDatabaseManager.getCardDetails(cardId) as CardData | undefined;
        if (cardData?.cardType === 'unit') {
            const player = gameEnv.getPlayer(params.playerId);
            const slotResult = player?.zones ? SlotZoneUtils.getSlotZone(player.zones, params.destinationSlot) : null;
            if (slotResult?.isValid && slotResult.slot) {
                const deployResult = UnitDeployService.deployUnitCardToSlot(gameEnv, {
                    playerId: params.playerId,
                    destinationSlot: params.destinationSlot,
                    carduid: chosenCarduid,
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
                    emitDeployFromTopDeckResolved({
                        gameEnv,
                        playerId: params.playerId,
                        sourceCarduid: params.sourceCarduid,
                        effectId: params.effectId,
                        result: 'FAILED_DEPLOY',
                        deployedCarduid: chosenCarduid,
                        error: deployResult.error
                    });
                }
            }
        }
    }

    if (params.order === 'random') {
        for (let i = restCarduids.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [restCarduids[i], restCarduids[j]] = [restCarduids[j], restCarduids[i]];
        }
    }
    deck.push(...restCarduids);

    if (restCarduids.length > 0) {
        emitDeployCardsMovedToBottom({
            gameEnv,
            playerId: params.playerId,
            sourceCarduid: params.sourceCarduid,
            effectId: params.effectId,
            carduids: restCarduids,
            reason: 'deploy_from_top_deck_resolve_bottom'
        });
    }
    emitDeployFromTopDeckResolved({
        gameEnv,
        playerId: params.playerId,
        sourceCarduid: params.sourceCarduid,
        effectId: params.effectId,
        result: chosenCarduid ? 'DEPLOYED' : 'MOVED_TO_BOTTOM',
        deployedCarduid: chosenCarduid,
        movedCarduids: restCarduids
    });
}
