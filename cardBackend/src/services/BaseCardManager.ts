// src/services/BaseCardManager.ts
// Base card management system

import { GameEnvironment } from '../models/GameEnvironment';
import { BaseCard, createZoneCard } from '../models/CardSystem';
import { GameEngine } from './GameEngine';

export class BaseCardManager {
    
    /**
     * Draw 1 card from deck and create base card in base zone
     */
    static createBaseCardsFromDeck(gameEnv: GameEnvironment, playerId: string): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones || !player.deck) {
                console.error(`❌ Player ${playerId}, zones, or deck not found`);
                return false;
            }

            // Try to load base card data from database, fallback to default
            const baseCardId = "base_default";
            const fullCardData = GameEngine.getCardDetails(baseCardId);
            
            let baseCard: BaseCard;
            baseCard = createZoneCard(
                    baseCardId,
                    baseCardId,
                    { ...fullCardData, cardType: 'base' },
                    playerId
            ) as BaseCard;

            player.zones.base.push(baseCard);

            console.log(`🏰 Created base card for player ${playerId}, currentHP: ${baseCard.currentHP}`);
            return true;

        } catch (error) {
            console.error(`❌ Error creating base card for ${playerId}:`, error);
            return false;
        }
    }

    /**
     * Remove base card from base zone
     */
    static removeBaseCard(gameEnv: GameEnvironment, playerId: string, cardUid: string): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                return false;
            }

            const index = player.zones.base.findIndex(base => base.cardUid === cardUid);
            if (index >= 0) {
                player.zones.base.splice(index, 1);
                console.log(`🏰 Removed base card ${cardUid} from player ${playerId}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error(`❌ Error removing base card for ${playerId}:`, error);
            return false;
        }
    }

    /**
     * Get base count for a player
     */
    static getBaseCount(gameEnv: GameEnvironment, playerId: string): number {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                return 0;
            }

            return player.zones.base.length;
        } catch (error) {
            console.error(`❌ Error getting base count for ${playerId}:`, error);
            return 0;
        }
    }

    /**
     * Update base card HP after damage
     */
    static updateBaseCardHP(gameEnv: GameEnvironment, playerId: string, cardUid: string, damageReceived: number): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                return false;
            }

            const baseCard = player.zones.base.find(base => base.cardUid === cardUid);
            if (!baseCard) {
                return false;
            }

            baseCard.damageReceived = damageReceived;
            baseCard.currentHP = (baseCard.originalHP || 1) - damageReceived;

            console.log(`🏰 Updated base card ${cardUid} HP: ${baseCard.currentHP} (${baseCard.originalHP} - ${damageReceived})`);
            return true;

        } catch (error) {
            console.error(`❌ Error updating base card HP for ${playerId}:`, error);
            return false;
        }
    }

    /**
     * Clear all base cards for a player
     */
    static clearAllBases(gameEnv: GameEnvironment, playerId: string): boolean {
        try {
            const player = gameEnv.players[playerId];
            if (!player || !player.zones) {
                return false;
            }

            const baseCount = player.zones.base.length;
            player.zones.base = [];
            console.log(`🏰 Cleared ${baseCount} base cards for player ${playerId}`);
            return true;

        } catch (error) {
            console.error(`❌ Error clearing bases for ${playerId}:`, error);
            return false;
        }
    }
}