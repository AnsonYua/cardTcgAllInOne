"use strict";
// src/services/CardInfoUtils.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardInfoUtils = void 0;
// ============ CARD INFO UTILS CLASS ============
class CardInfoUtils {
    constructor() {
        // Import DeckManager with proper path resolution for compiled code
        // Use require for compatibility with compiled JavaScript
        // Path works from dist/src/services/ to src/services/DeckManager.js bridge
        this.deckManager = require('../../../src/services/DeckManager');
    }
    /**
     * Get current leader card for a player
     * @param gameEnv - Game environment with unified structure
     * @param playerId - Player ID to get leader for
     * @returns Leader card data or throws error
     */
    getCurrentLeader(gameEnv, playerId) {
        // Validate unified structure
        if (!gameEnv.players) {
            throw new Error('Game environment must have unified structure with gameEnv.players');
        }
        const playerData = gameEnv.players[playerId];
        if (!playerData) {
            throw new Error(`Player ${playerId} not found in gameEnv.players`);
        }
        const deck = playerData.deck;
        if (!deck) {
            throw new Error(`Player ${playerId} does not have deck data`);
        }
        if (!deck.leader || deck.leader.length === 0) {
            throw new Error(`Player ${playerId} has no leader cards`);
        }
        if (deck.currentLeaderIdx >= deck.leader.length) {
            throw new Error(`Player ${playerId} currentLeaderIdx ${deck.currentLeaderIdx} out of bounds for leader array length ${deck.leader.length}`);
        }
        const currentLeaderUID = deck.leader[deck.currentLeaderIdx];
        if (!currentLeaderUID) {
            throw new Error(`Player ${playerId} current leader UID is undefined at index ${deck.currentLeaderIdx}`);
        }
        if (!deck.leaderMapping) {
            throw new Error(`Player ${playerId} does not have leaderMapping`);
        }
        const currentLeaderCardId = deck.leaderMapping[currentLeaderUID];
        if (!currentLeaderCardId) {
            throw new Error(`Player ${playerId} leader UID ${currentLeaderUID} not found in leaderMapping`);
        }
        const leaderCard = this.deckManager.getLeaderCards(currentLeaderCardId);
        if (!leaderCard) {
            throw new Error(`Leader card ${currentLeaderCardId} not found in DeckManager`);
        }
        return leaderCard;
    }
    /**
     * Get card details by card ID
     * @param cardId - Card ID to retrieve
     * @returns Card data or null if not found
     */
    getCardDetails(cardId) {
        if (!cardId) {
            return null;
        }
        return this.deckManager.getCardDetails(cardId);
    }
    /**
     * Get leader card details by card ID
     * @param cardId - Leader card ID to retrieve
     * @returns Leader card data or null if not found
     */
    getLeaderCards(cardId) {
        if (!cardId) {
            return null;
        }
        return this.deckManager.getLeaderCards(cardId);
    }
    /**
     * Validate that a card exists
     * @param cardId - Card ID to validate
     * @returns True if card exists, false otherwise
     */
    cardExists(cardId) {
        return this.getCardDetails(cardId) !== null;
    }
    /**
     * Validate that a leader card exists
     * @param cardId - Leader card ID to validate
     * @returns True if leader card exists, false otherwise
     */
    leaderCardExists(cardId) {
        return this.getLeaderCards(cardId) !== null;
    }
    /**
     * Get card power value
     * @param cardId - Card ID to get power for
     * @returns Card power or 0 if not found or no power
     */
    getCardPower(cardId) {
        const card = this.getCardDetails(cardId);
        return (card === null || card === void 0 ? void 0 : card.power) || 0;
    }
    /**
     * Get card game type
     * @param cardId - Card ID to get game type for
     * @returns Card game type or empty string if not found
     */
    getCardGameType(cardId) {
        const card = this.getCardDetails(cardId);
        return (card === null || card === void 0 ? void 0 : card.gameType) || '';
    }
    /**
     * Get card traits
     * @param cardId - Card ID to get traits for
     * @returns Card traits array or empty array if not found
     */
    getCardTraits(cardId) {
        const card = this.getCardDetails(cardId);
        return (card === null || card === void 0 ? void 0 : card.traits) || [];
    }
    /**
     * Check if card has specific trait
     * @param cardId - Card ID to check
     * @param trait - Trait to check for
     * @returns True if card has the trait, false otherwise
     */
    hasCardTrait(cardId, trait) {
        const traits = this.getCardTraits(cardId);
        return traits.includes(trait);
    }
    /**
     * Get leader zone compatibility
     * @param leaderId - Leader card ID
     * @param zone - Zone to check compatibility for
     * @returns Array of compatible game types or empty array
     */
    getLeaderZoneCompatibility(leaderId, zone) {
        const leader = this.getLeaderCards(leaderId);
        if (!leader || !leader.zoneCompatibility) {
            return [];
        }
        const zoneKey = zone.toLowerCase();
        return leader.zoneCompatibility[zoneKey] || [];
    }
    /**
     * Check if card is compatible with leader's zone
     * @param cardId - Character card ID
     * @param leaderId - Leader card ID
     * @param zone - Zone to check compatibility for
     * @returns True if compatible, false otherwise
     */
    isCardCompatibleWithZone(cardId, leaderId, zone) {
        const card = this.getCardDetails(cardId);
        const compatibleTypes = this.getLeaderZoneCompatibility(leaderId, zone);
        if (!card || !card.gameType) {
            return false;
        }
        // Check if zone allows all types
        if (compatibleTypes.includes('all') || compatibleTypes.includes('ALL')) {
            return true;
        }
        // Check if card's game type is in compatible types
        return compatibleTypes.includes(card.gameType);
    }
    /**
     * Get leader initial points
     * @param leaderId - Leader card ID
     * @returns Leader initial points or 0 if not found
     */
    getLeaderInitialPoints(leaderId) {
        const leader = this.getLeaderCards(leaderId);
        return (leader === null || leader === void 0 ? void 0 : leader.initialPoint) || 0;
    }
}
exports.CardInfoUtils = CardInfoUtils;
// Export singleton instance for backward compatibility
const cardInfoUtilsInstance = new CardInfoUtils();
exports.default = cardInfoUtilsInstance;
