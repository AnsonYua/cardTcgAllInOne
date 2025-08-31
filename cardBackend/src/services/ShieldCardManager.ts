// src/services/ShieldCardManager.ts
// Shield card management system

import { GameEnvironment } from '../models/GameEnvironment';
import { ShieldCard } from '../models/CardSystem';

export class ShieldCardManager {
    
    /**
     * Draw 6 cards from deck and create 6 shield cards in shieldArea
     */
    static createShieldCardsFromDeck(gameEnv: GameEnvironment, playerId: string): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones || !player.deck) {
                console.error(`❌ Player ${playerId}, zones, or deck not found`);
                return false;
            }

            // Draw 6 cards from deck
            const drawnCards: string[] = [];
            for (let i = 0; i < 6 && player.deck.mainDeck.length > 0; i++) {
                const drawnCardUid = player.deck.mainDeck.shift();
                if (drawnCardUid) {
                    drawnCards.push(drawnCardUid);
                }
            }

            if (drawnCards.length < 6) {
                console.warn(`⚠️ Only drew ${drawnCards.length} cards for shields (deck too small)`);
            }

            // Create shield cards from drawn cards
            drawnCards.forEach(cardUid => {
                const cardId = cardUid.split('_')[0]; // Extract base card ID
                
                const shieldCard: ShieldCard = {
                    cardUid,
                    cardId,
                    placedAt: Date.now(),
                    placedBy: playerId,
                    isRested: false,
                    cardData: {
                        cardType: 'shield'
                    }
                };

                player.zones.shieldArea.push(shieldCard);
            });

            console.log(`🛡️ Created ${drawnCards.length} shield cards for player ${playerId}`);
            return true;

        } catch (error) {
            console.error(`❌ Error creating shield cards for ${playerId}:`, error);
            return false;
        }
    }

    /**
     * Remove shield card from shieldArea
     */
    static removeShieldCard(gameEnv: GameEnvironment, playerId: string, cardUid: string): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                return false;
            }

            const index = player.zones.shieldArea.findIndex(shield => shield.cardUid === cardUid);
            if (index >= 0) {
                player.zones.shieldArea.splice(index, 1);
                console.log(`🛡️ Removed shield card ${cardUid} from player ${playerId}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error(`❌ Error removing shield card for ${playerId}:`, error);
            return false;
        }
    }

    /**
     * Get shield count for a player
     */
    static getShieldCount(gameEnv: GameEnvironment, playerId: string): number {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                return 0;
            }

            return player.zones.shieldArea.length;
        } catch (error) {
            console.error(`❌ Error getting shield count for ${playerId}:`, error);
            return 0;
        }
    }

    /**
     * Clear all shield cards for a player
     */
    static clearAllShields(gameEnv: GameEnvironment, playerId: string): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                return false;
            }

            const shieldCount = player.zones.shieldArea.length;
            player.zones.shieldArea = [];
            console.log(`🛡️ Cleared ${shieldCount} shield cards for player ${playerId}`);
            return true;

        } catch (error) {
            console.error(`❌ Error clearing shields for ${playerId}:`, error);
            return false;
        }
    }
}