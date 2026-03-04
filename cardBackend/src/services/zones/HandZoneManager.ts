// src/services/zones/HandZoneManager.ts
// Centralized helpers for hand mutations + related notifications.

import type { GameEnvironment } from '../../models/GameEnvironment';
import type { CardData } from '../../models/CardSystem';
import { GameNotificationManager } from '../GameNotificationManager';

export interface AddToHandOptions {
    eventType?: string;
    sourceZone?: string;
    reason?: string;
    notify?: boolean;
    drawContext?: string;
    extraPayload?: Record<string, unknown>;
}

export class HandZoneManager {
    private static isPublicSourceZone(sourceZone?: string): boolean {
        const zone = (sourceZone || '').toLowerCase();
        return zone === 'trash' || zone.startsWith('slot') || zone === 'base' || zone === 'shield';
    }

    private static resolveRevealToOpponentDefault(options: AddToHandOptions): boolean {
        const reason = (options.reason || '').toLowerCase();
        if (reason === 'burst') return true;
        return this.isPublicSourceZone(options.sourceZone);
    }

    static addCardToHand(
        gameEnv: GameEnvironment,
        playerId: string,
        carduid: string,
        cardData?: CardData | Record<string, unknown>,
        options: AddToHandOptions = {}
    ): { success: boolean; error?: string } {
        const player = gameEnv.getPlayer(playerId);
        if (!player || !player.deck) {
            return {
                success: false,
                error: `Player ${playerId} not found`
            };
        }

        if (!Array.isArray(player.deck._handUids)) {
            player.deck._handUids = [];
        }

        let added = false;
        if (!player.deck._handUids.includes(carduid)) {
            player.deck._handUids.push(carduid);
            added = true;
        }

        if (Array.isArray(player.deck.handUids) && !player.deck.handUids.includes(carduid)) {
            player.deck.handUids.push(carduid);
            added = true;
        }

        const cardName = typeof (cardData as any)?.name === 'string' ? (cardData as any).name : 'Unknown';
        if (added) {
            console.log(`✅ Card ${carduid} (${cardName}) added to ${playerId}'s hand`);
        } else {
            console.log(`ℹ️ Card ${carduid} already in ${playerId}'s hand`);
        }

        if (added && options.notify !== false) {
            const notificationManager = new GameNotificationManager(gameEnv);
            const cardId = (cardData as { id?: string } | undefined)?.id;

            const eventType = options.eventType || 'CARD_ADDED_TO_HAND';
            const payload: Record<string, unknown> = {
                playerId,
                carduid,
                cardId,
                cardName,
                sourceZone: options.sourceZone,
                reason: options.reason,
                timestamp: Date.now(),
                ...(options.extraPayload || {})
            };

            if (eventType === 'CARD_ADDED_TO_HAND' && payload.revealToOpponent === undefined) {
                payload.revealToOpponent = this.resolveRevealToOpponentDefault(options);
            }

            if (eventType === 'CARD_DRAWN' && options.drawContext) {
                payload.drawContext = options.drawContext;
            }

            notificationManager.addNotificationEvent(
                eventType,
                payload,
                'normal'
            );
        }

        return { success: true };
    }
}
