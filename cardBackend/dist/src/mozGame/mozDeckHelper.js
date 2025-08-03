"use strict";
// src/mozGame/mozDeckHelper.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MozDeckLogic = void 0;
/**
 * TypeScript version of mozDeckHelper with proper type safety
 * Handles deck preparation, shuffling, and card drawing operations
 */
// ============ IMPORTS ============
const PlayerDeckDataResp_1 = require("../models/PlayerDeckDataResp");
const CardInfoUtils_1 = __importDefault(require("../services/CardInfoUtils"));
// ============ MOZ DECK LOGIC CLASS ============
class MozDeckLogic {
    constructor() {
        // Import DeckManager with proper path resolution for compiled code
        // The path needs to work from the compiled dist/ directory
        const path = require('path');
        const isCompiled = __dirname.includes('dist');
        const deckManagerPath = isCompiled
            ? path.join(__dirname, '../../../src/services/DeckManager.js')
            : path.join(__dirname, '../services/DeckManager.js');
        this.deckManager = require(deckManagerPath);
        this.cardInfoUtils = CardInfoUtils_1.default;
    }
    /**
     * Prepare deck for a player with shuffled cards and initial hand
     * @param playerId - Player ID to prepare deck for
     * @returns PlayerDeckDataResp instance with prepared deck data
     */
    async prepareDeckForPlayer(playerId) {
        console.log("debug prepareDeckForPlayer", playerId);
        // Get player default deck and generate a uid mapping for each card (including leader cards)
        const playerDeck = await this.deckManager.getPlayerDecks(playerId);
        // Deep clone to avoid modifying original data
        const playerDeckCopy = JSON.parse(JSON.stringify(playerDeck));
        const activeDeckId = playerDeckCopy.activeDeck || "deck001";
        const activeDeck = playerDeckCopy.decks[activeDeckId];
        if (!activeDeck) {
            throw new Error(`Active deck ${activeDeckId} not found for player ${playerId}`);
        }
        // Shuffle and prepare cards
        const sumCardList = this.shuffleLeaderDeck(activeDeck);
        const mainDeckCard = this.shuffleMainDeck(activeDeck);
        const { drawnCards, mainDeck } = this.drawCards(mainDeckCard, 7);
        const hand = drawnCards;
        console.log("debug leaderUIDMapping", JSON.stringify(playerDeckCopy.leaderUIDMapping));
        // Return PlayerDeckDataResp class instance instead of plain object
        return new PlayerDeckDataResp_1.PlayerDeckDataResp(0, // currentLeaderIdx
        sumCardList, // leader
        hand, // hand
        mainDeck, // mainDeck
        playerDeckCopy.leaderUIDMapping, // leaderMapping
        playerDeckCopy.deckUIDMapping // cardMapping
        );
    }
    /**
     * Reshuffle deck for a player and draw new hand
     * @param playerId - Player ID to reshuffle for
     * @returns PlayerDeckDataResp instance with new hand and shuffled deck
     */
    async reshuffleForPlayer(playerId) {
        const playerDeck = await this.deckManager.getPlayerDecks(playerId);
        const activeDeckId = playerDeck.activeDeck || "deck001";
        const activeDeck = playerDeck.decks[activeDeckId];
        if (!activeDeck) {
            throw new Error(`Active deck ${activeDeckId} not found for player ${playerId}`);
        }
        const mainDeckCard = this.shuffleMainDeck(activeDeck);
        const { drawnCards, mainDeck } = this.drawCards(mainDeckCard, 7);
        const hand = drawnCards;
        // Return PlayerDeckDataResp class instance with only hand and mainDeck updated
        return new PlayerDeckDataResp_1.PlayerDeckDataResp(0, // currentLeaderIdx (default)
        [], // leader (empty for reshuffle)
        hand, // hand
        mainDeck, // mainDeck
        {}, // leaderMapping (empty for reshuffle)
        {} // cardMapping (empty for reshuffle)
        );
    }
    /**
     * Draw cards to hand from main deck
     * @param hand - Current hand (will be modified)
     * @param mainDeckOriginal - Main deck to draw from (will be modified)
     * @param count - Number of cards to draw (default: 1)
     * @returns Object with updated hand and main deck
     */
    drawToHand(hand, mainDeckOriginal, count = 1) {
        const { drawnCards, mainDeck } = this.drawCards(mainDeckOriginal, count);
        for (let i = 0; i < drawnCards.length; i++) {
            hand.push(drawnCards[i]);
        }
        return {
            hand: hand,
            mainDeck: mainDeck
        };
    }
    /**
     * Draw cards from main deck
     * @param mainDeck - Main deck array (will be modified)
     * @param count - Number of cards to draw (default: 1)
     * @returns Object with drawn cards and updated main deck
     */
    drawCards(mainDeck, count = 1) {
        if (count > mainDeck.length) {
            throw new Error(`Cannot draw ${count} cards. Only ${mainDeck.length} cards remaining.`);
        }
        const drawnCards = mainDeck.splice(0, count);
        return {
            drawnCards, // Cards that were drawn
            mainDeck // Updated main deck
        };
    }
    /**
     * Shuffle main deck cards
     * @param decks - Deck data containing cardUID array
     * @returns Shuffled array of card UIDs
     */
    shuffleMainDeck(decks) {
        return this.shuffle([...decks.cardUID]); // Create copy to avoid modifying original
    }
    /**
     * Shuffle leader deck cards and take first 5
     * @param decks - Deck data containing leaderUID array
     * @returns Shuffled array of first 5 leader UIDs
     */
    shuffleLeaderDeck(decks) {
        return this.shuffle([...decks.leaderUID]).slice(0, 5); // Create copy to avoid modifying original
    }
    /**
     * Fisher-Yates shuffle algorithm
     * @param array - Array to shuffle (will be modified)
     * @returns Shuffled array
     */
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    /**
     * Get card details by card ID
     * @param cardId - Card ID to get details for
     * @returns Card details or null if not found
     */
    getDeckCardDetails(cardId) {
        return this.deckManager.getCardDetails(cardId);
    }
    /**
     * Check if there are any character cards in the field area
     * @param fieldArea - Array of field area objects
     * @returns True if any character cards found, false otherwise
     */
    monsterInField(fieldArea) {
        for (let i = 0; i < fieldArea.length; i++) {
            if (fieldArea[i].cardDetails &&
                fieldArea[i].cardDetails.length > 0 &&
                fieldArea[i].cardDetails[0].cardType === "character") {
                return true;
            }
        }
        return false;
    }
    /**
     * Get field index by field name
     * @param field - Field name (top, left, right, help, sp)
     * @returns Field index or -1 if not found
     */
    getFieldIdx(field) {
        const fieldArr = ["top", "left", "right", "help", "sp"];
        return fieldArr.indexOf(field);
    }
    /**
     * Check if card is eligible for a specific field based on leader compatibility
     * @param card - Card data to check
     * @param leader - Leader data with zone compatibility
     * @param area - Area/zone to check eligibility for
     * @returns True if card is eligible for the field, false otherwise
     */
    isCardEligibleForField(card, leader, area) {
        // Check if card has "all" trait (universal compatibility)
        if (card.traits) {
            for (const trait of card.traits) {
                if (trait === "all") {
                    return true;
                }
            }
        }
        // Check leader zone compatibility
        const allowedTypes = leader.zoneCompatibility?.[area] || [];
        for (const allowedType of allowedTypes) {
            if (allowedType === "all") {
                return true;
            }
            // Check if card has matching trait
            if (card.traits) {
                for (const trait of card.traits) {
                    if (trait === allowedType) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
exports.MozDeckLogic = MozDeckLogic;
// Export singleton instance for backward compatibility
const mozDeckLogicInstance = new MozDeckLogic();
exports.default = mozDeckLogicInstance;
//# sourceMappingURL=mozDeckHelper.js.map