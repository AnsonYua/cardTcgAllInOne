// src/mozGame/mozDeckHelper.ts

/**
 * TypeScript version of mozDeckHelper with proper type safety
 * Handles deck preparation, shuffling, and card drawing operations
 */

// ============ IMPORTS ============

import { PlayerDeckDataResp } from '../models/PlayerDeckDataResp';
import CardInfoUtils from '../services/CardInfoUtils';
import DeckManager from '../services/DeckManager';

// ============ INTERFACES ============

export interface DeckManagerInterface {
    getPlayerDecks(playerId: string): Promise<PlayerDeckWithUIDs>;
    getCardDetails(cardId: string): any;
}

export interface PlayerDeckWithUIDs {
    playerId: string;
    activeDeck: string;
    decks: Record<string, DeckData>;
    leaderUIDMapping: Record<string, string>;
    deckUIDMapping: Record<string, string>;
}

export interface DeckData {
    cardUID: string[];
    leaderUID: string[];
}

export interface DrawResult {
    drawnCards: string[];
    mainDeck: string[];
}

export interface DrawToHandResult {
    hand: string[];
    mainDeck: string[];
}

export interface CardData {
    cardType?: string;
    traits?: string[];
    [key: string]: any;
}

export interface LeaderData {
    zoneCompatibility?: Record<string, string[]>;
    [key: string]: any;
}

export interface FieldArea {
    cardDetails: CardData[];
    [key: string]: any;
}

// ============ MOZ DECK LOGIC CLASS ============

class MozDeckLogic {
    private deckManager: typeof DeckManager;
    private cardInfoUtils: typeof CardInfoUtils;

    constructor() {
        // Initialize DeckManager TypeScript singleton
        this.deckManager = DeckManager;
        this.cardInfoUtils = CardInfoUtils;
    }

    /**
     * Prepare deck for a player with shuffled cards and initial hand
     * @param playerId - Player ID to prepare deck for
     * @returns PlayerDeckDataResp instance with prepared deck data
     */
    async prepareDeckForPlayer(playerId: string): Promise<PlayerDeckDataResp> {
        console.log("debug prepareDeckForPlayer", playerId);
        
        // Get player default deck and generate a uid mapping for each card (including leader cards)
        const playerDeck = await this.deckManager.getPlayerDecks(playerId);
        
        // Deep clone to avoid modifying original data
        const playerDeckCopy = JSON.parse(JSON.stringify(playerDeck)) as PlayerDeckWithUIDs;
        
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
        const deckResp = new PlayerDeckDataResp(
            0, // currentLeaderIdx
            sumCardList, // leader
            hand, // hand
            mainDeck, // mainDeck
            playerDeckCopy.leaderUIDMapping, // leaderMapping
            playerDeckCopy.deckUIDMapping // cardMapping
            // handDetails will be auto-populated by constructor since empty
        );
        
        // Ensure handDetails are populated with card data
        deckResp.populateHandDetails();
        
        return deckResp;
    }

    /**
     * Reshuffle deck for a player and draw new hand
     * @param playerId - Player ID to reshuffle for
     * @returns PlayerDeckDataResp instance with new hand and shuffled deck
     */
    async reshuffleForPlayer(playerId: string): Promise<PlayerDeckDataResp> {
        const playerDeck = await this.deckManager.getPlayerDecks(playerId);
        
        const activeDeckId = playerDeck.activeDeck || "deck001";
        const activeDeck = playerDeck.decks[activeDeckId];
        
        if (!activeDeck) {
            throw new Error(`Active deck ${activeDeckId} not found for player ${playerId}`);
        }
        
        const mainDeckCard = this.shuffleMainDeck(activeDeck);
        const { drawnCards, mainDeck } = this.drawCards(mainDeckCard, 7);
        const hand = drawnCards;
        
        // CRITICAL FIX: Generate new UID mappings for reshuffled cards
        // This ensures the cardMapping includes all new UIDs created during reshuffle
        const cardMapping: Record<string, string> = {};
        
        // Create mappings for hand cards
        hand.forEach((cardUID) => {
            const cardId = this.extractCardIdFromUID(cardUID);
            if (cardId) {
                cardMapping[cardUID] = cardId;
            }
        });
        
        // Create mappings for remaining main deck cards
        mainDeck.forEach((cardUID) => {
            const cardId = this.extractCardIdFromUID(cardUID);
            if (cardId) {
                cardMapping[cardUID] = cardId;
            }
        });
        
        console.log("🔄 Reshuffle cardMapping generated:", Object.keys(cardMapping).length, "cards");
        
        // Return PlayerDeckDataResp class instance with complete UID mappings
        const deckResp = new PlayerDeckDataResp(
            0, // currentLeaderIdx (default)
            [], // leader (empty for reshuffle)
            hand, // hand
            mainDeck, // mainDeck
            {}, // leaderMapping (empty for reshuffle)
            cardMapping // cardMapping with new UIDs
        );
        
        // Ensure handDetails are populated with card data
        deckResp.populateHandDetails();
        
        return deckResp;
    }

    /**
     * Draw cards to hand from main deck
     * @param hand - Current hand (will be modified)
     * @param mainDeckOriginal - Main deck to draw from (will be modified)
     * @param count - Number of cards to draw (default: 1)
     * @returns Object with updated hand and main deck
     */
    drawToHand(hand: string[], mainDeckOriginal: string[], count: number = 1): DrawToHandResult {
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
    drawCards(mainDeck: string[], count: number = 1): DrawResult {
        if (count > mainDeck.length) {
            throw new Error(`Cannot draw ${count} cards. Only ${mainDeck.length} cards remaining.`);
        }
        const drawnCards = mainDeck.splice(0, count);
        return {
            drawnCards,    // Cards that were drawn
            mainDeck      // Updated main deck
        };
    }

    /**
     * Shuffle main deck cards
     * @param decks - Deck data containing cardUID array
     * @returns Shuffled array of card UIDs
     */
    shuffleMainDeck(decks: DeckData): string[] {
        return this.shuffle([...decks.cardUID]); // Create copy to avoid modifying original
    }

    /**
     * Shuffle leader deck cards and take first 5
     * @param decks - Deck data containing leaderUID array
     * @returns Shuffled array of first 5 leader UIDs
     */
    shuffleLeaderDeck(decks: DeckData): string[] {
        return this.shuffle([...decks.leaderUID]).slice(0, 5); // Create copy to avoid modifying original
    }

    /**
     * Enhanced Fisher-Yates shuffle algorithm with cryptographic randomness
     * Performs multiple shuffle passes with cryptographically secure random numbers
     * @param array - Array to shuffle (will be modified)
     * @returns Shuffled array
     */
    shuffle<T>(array: T[]): T[] {
        if (array.length <= 1) return array;
        
        // Import crypto module for cryptographically secure randomness
        const crypto = require('crypto');
        
        // Helper function to get cryptographically secure random integer
        const getSecureRandomInt = (max: number): number => {
            const randomBytes = crypto.randomBytes(4);
            const randomValue = randomBytes.readUInt32BE(0);
            return randomValue % max;
        };
        
        // Perform multiple shuffle passes for enhanced randomness
        const shufflePasses = Math.max(2, Math.ceil(Math.log2(array.length)) + 1);
        
        for (let pass = 0; pass < shufflePasses; pass++) {
            // Standard Fisher-Yates shuffle with secure random numbers
            for (let i = array.length - 1; i > 0; i--) {
                const j = getSecureRandomInt(i + 1);
                [array[i], array[j]] = [array[j], array[i]];
            }
            
            // Additional entropy injection: random swaps throughout the array
            const extraSwaps = Math.floor(array.length / 4) + 1;
            for (let k = 0; k < extraSwaps; k++) {
                const idx1 = getSecureRandomInt(array.length);
                const idx2 = getSecureRandomInt(array.length);
                if (idx1 !== idx2) {
                    [array[idx1], array[idx2]] = [array[idx2], array[idx1]];
                }
            }
        }
        
        return array;
    }

    /**
     * Get card details by card ID
     * @param cardId - Card ID to get details for
     * @returns Card details or null if not found
     */
    getDeckCardDetails(cardId: string): any {
        return this.deckManager.getCardDetails(cardId);
    }

    /**
     * Check if there are any character cards in the field area
     * @param fieldArea - Array of field area objects
     * @returns True if any character cards found, false otherwise
     */
    monsterInField(fieldArea: FieldArea[]): boolean {
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
    getFieldIdx(field: string): number {
        const fieldArr = ["top", "left", "right", "help", "sp"];
        return fieldArr.indexOf(field);
    }

    /**
     * Extract base card ID from UID (format: cardId_timestamp_index)
     * @param uid - Card UID to extract base ID from
     * @returns Base card ID or null if invalid format
     */
    private extractCardIdFromUID(uid: string): string | null {
        if (!uid) return null;
        
        // UID format: cardId_timestamp_index (e.g., "c-1_1754551822157_24")
        const parts = uid.split('_');
        if (parts.length >= 3) {
            return parts[0]; // Return the base card ID (e.g., "c-1")
        }
        
        return null;
    }

    /**
     * Check if card is eligible for a specific field based on leader compatibility
     * @param card - Card data to check
     * @param leader - Leader data with zone compatibility
     * @param area - Area/zone to check eligibility for
     * @returns True if card is eligible for the field, false otherwise
     */
    isCardEligibleForField(card: CardData, leader: LeaderData, area: string): boolean {
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

// Export singleton instance for backward compatibility
const mozDeckLogicInstance = new MozDeckLogic();
export default mozDeckLogicInstance;

// Also export the class for advanced usage
export { MozDeckLogic };