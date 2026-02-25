import type { GameEnvironment } from '../../models/GameEnvironment';
import { createZoneCard } from '../../models/CardSystem';
import { copyNameAliases } from '../../utils/NameAliasUtils';
import { HandZoneManager } from './HandZoneManager';

export type SlotCardType = 'unit' | 'pilot';

export type SlotCardEntry = {
    card: any;
    type: SlotCardType;
};

export type SlotToHandMoveResult = {
    success: boolean;
    error?: string;
    moved: Array<{ carduid: string; fromZone: string; ownerPlayerId: string; type: SlotCardType }>;
};

export type SlotToTrashMoveResult = {
    success: boolean;
    error?: string;
    moved: Array<{ carduid: string; fromZone: string; ownerPlayerId: string; type: SlotCardType }>;
};

type MoveContext = {
    sourcePlayerId: string;
    sourceCarduid?: string;
    effectId?: string;
};

export class SlotExitTransferService {
    static movePlannedCardsToHand(
        gameEnv: GameEnvironment,
        ownerPlayerId: string,
        destinationPlayerId: string,
        slotName: string,
        plannedCards: SlotCardEntry[],
        context: MoveContext
    ): SlotToHandMoveResult {
        const owner = gameEnv.getPlayer(ownerPlayerId);
        if (!owner?.zones || !owner?.deck) {
            return { success: false, error: `Owner player ${ownerPlayerId} not found`, moved: [] };
        }

        const slot = (owner.zones as any)[slotName];
        if (!slot) {
            return { success: false, error: `Slot ${slotName} not found for player ${ownerPlayerId}`, moved: [] };
        }

        const detached = this.detachPlannedCardsFromSlot(slot, slotName, plannedCards);
        if (!detached.success) {
            return { success: false, error: detached.error, moved: [] };
        }

        const moved: Array<{ carduid: string; fromZone: string; ownerPlayerId: string; type: SlotCardType }> = [];
        for (const entry of detached.cards) {
            const slotCard = entry.card;

            const addResult = HandZoneManager.addCardToHand(
                gameEnv,
                destinationPlayerId,
                slotCard.carduid,
                slotCard.cardData as any,
                {
                    eventType: 'CARD_RETURNED_TO_HAND',
                    sourceZone: slotName,
                    reason: 'returnToHand',
                    extraPayload: {
                        sourcePlayerId: context.sourcePlayerId,
                        sourceCarduid: context.sourceCarduid,
                        effectId: context.effectId
                    }
                }
            );

            if (!addResult.success) {
                return { success: false, error: addResult.error, moved };
            }

            moved.push({
                carduid: slotCard.carduid,
                fromZone: slotName,
                ownerPlayerId,
                type: entry.type
            });
        }

        return { success: true, moved };
    }

    static movePlannedCardsToTrash(
        gameEnv: GameEnvironment,
        ownerPlayerId: string,
        slotName: string,
        plannedCards: SlotCardEntry[]
    ): SlotToTrashMoveResult {
        const owner = gameEnv.getPlayer(ownerPlayerId);
        if (!owner?.zones) {
            return { success: false, error: `Owner player ${ownerPlayerId} not found`, moved: [] };
        }
        if (!owner.zones.trashArea) {
            owner.zones.trashArea = [];
        }

        const slot = (owner.zones as any)[slotName];
        if (!slot) {
            return { success: false, error: `Slot ${slotName} not found for player ${ownerPlayerId}`, moved: [] };
        }

        const detached = this.detachPlannedCardsFromSlot(slot, slotName, plannedCards);
        if (!detached.success) {
            return { success: false, error: detached.error, moved: [] };
        }

        const moved: Array<{ carduid: string; fromZone: string; ownerPlayerId: string; type: SlotCardType }> = [];
        for (const entry of detached.cards) {
            const slotCard = entry.card;
            const trashCard = createZoneCard(slotCard.carduid, slotCard.cardId, slotCard.cardData, ownerPlayerId);
            copyNameAliases(slotCard, trashCard);
            owner.zones.trashArea.push(trashCard);
            moved.push({
                carduid: slotCard.carduid,
                fromZone: slotName,
                ownerPlayerId,
                type: entry.type
            });
        }

        return { success: true, moved };
    }

    private static detachPlannedCardsFromSlot(
        slot: any,
        slotName: string,
        plannedCards: SlotCardEntry[]
    ): { success: boolean; error?: string; cards: SlotCardEntry[] } {
        const detached: SlotCardEntry[] = [];
        const movedCarduids = new Set<string>();

        for (const entry of plannedCards) {
            const slotCard = slot?.[entry.type];
            if (!slotCard || slotCard.carduid !== entry.card.carduid) {
                return {
                    success: false,
                    error: `${entry.type === 'unit' ? 'Unit' : 'Pilot'} ${entry.card.carduid} not found in expected slot ${slotName}`,
                    cards: []
                };
            }
            slot[entry.type] = null;
            if (!movedCarduids.has(slotCard.carduid)) {
                movedCarduids.add(slotCard.carduid);
                detached.push({
                    card: slotCard,
                    type: entry.type
                });
            }
        }

        return { success: true, cards: detached };
    }
}
