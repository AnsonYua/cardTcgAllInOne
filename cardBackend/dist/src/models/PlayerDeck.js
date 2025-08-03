"use strict";
// src/models/PlayerDeck.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerDeck = void 0;
const Deck_1 = require("./Deck");
/**
 * Represents a player's deck collection with Java-like clear field declarations
 */
class PlayerDeck {
    constructor(playerId, data = {}) {
        // Core player identification
        this.playerId = playerId;
        // Active deck identifier
        this.activeDeck = data.activeDeck || null;
        // Deck collection as plain object (TypeScript typed)
        this.decks = {};
        // Runtime mappings for gameplay compatibility
        this.deckUIDMapping = {};
        this.leaderUIMapping = {};
        // Initialize decks from data
        if (data.decks && typeof data.decks === 'object') {
            Object.entries(data.decks).forEach(([deckId, deckData]) => {
                this.decks[deckId] = Deck_1.Deck.fromJSON(deckData);
            });
        }
    }
    /**
     * Get the currently active deck
     * @returns Active deck instance or null if not found
     */
    getActiveDeck() {
        if (!this.activeDeck) {
            return null;
        }
        return this.decks[this.activeDeck] || null;
    }
    /**
     * Set the active deck by ID
     * @param deckId - Deck ID to activate
     * @returns True if deck was found and activated
     */
    setActiveDeck(deckId) {
        if (this.decks[deckId]) {
            this.activeDeck = deckId;
            return true;
        }
        return false;
    }
    /**
     * Add a new deck to the collection
     * @param deck - Deck instance to add
     */
    addDeck(deck) {
        if (!deck.id) {
            throw new Error('Deck must have an ID to be added to collection');
        }
        this.decks[deck.id] = deck;
        // Set as active if this is the first deck
        if (!this.activeDeck) {
            this.activeDeck = deck.id;
        }
    }
    /**
     * Remove a deck from the collection
     * @param deckId - Deck ID to remove
     * @returns True if deck was found and removed
     */
    removeDeck(deckId) {
        if (!this.decks[deckId]) {
            return false;
        }
        delete this.decks[deckId];
        // If the removed deck was active, set another deck as active
        if (this.activeDeck === deckId) {
            const remainingDeckIds = Object.keys(this.decks);
            this.activeDeck = remainingDeckIds.length > 0 ? remainingDeckIds[0] : null;
        }
        return true;
    }
    /**
     * Get all deck IDs
     * @returns Array of deck IDs
     */
    getDeckIds() {
        return Object.keys(this.decks);
    }
    /**
     * Get all deck instances
     * @returns Array of Deck instances
     */
    getAllDecks() {
        return Object.values(this.decks);
    }
    /**
     * Check if deck exists
     * @param deckId - Deck ID to check
     * @returns True if deck exists
     */
    hasDeck(deckId) {
        return !!this.decks[deckId];
    }
    /**
     * Generate UIDs for active deck cards (for gameplay compatibility)
     * @returns UID mapping with card and leader UIDs
     */
    generateActiveDecksUIDs() {
        const activeDeck = this.getActiveDeck();
        if (!activeDeck) {
            return { cardUID: [], leaderUID: [] };
        }
        // Generate unique IDs for cards and leaders
        const cardUID = activeDeck.cards.map((cardId, index) => `${cardId}_${Date.now()}_${index}`);
        const leaderUID = activeDeck.leader.map((leaderId, index) => `${leaderId}_${Date.now()}_${index}`);
        // Store for future reference
        if (activeDeck.id) {
            this.deckUIDMapping[activeDeck.id] = cardUID;
            this.leaderUIMapping[activeDeck.id] = leaderUID;
        }
        return { cardUID, leaderUID };
    }
    /**
     * Get player deck statistics
     * @returns Statistics about player's deck collection
     */
    getStats() {
        return {
            playerId: this.playerId,
            activeDeck: this.activeDeck,
            totalDecks: Object.keys(this.decks).length,
            deckList: this.getAllDecks().map(deck => deck.getStats())
        };
    }
    /**
     * Validate all decks in the collection
     * @returns Validation result with isValid boolean and errors array
     */
    validate() {
        const errors = [];
        if (!this.playerId) {
            errors.push('Player ID is required');
        }
        const deckIds = Object.keys(this.decks);
        if (deckIds.length === 0) {
            errors.push('Player must have at least one deck');
        }
        // Validate that active deck exists
        if (this.activeDeck && !this.decks[this.activeDeck]) {
            errors.push(`Active deck '${this.activeDeck}' not found in deck collection`);
        }
        // Validate each deck
        Object.entries(this.decks).forEach(([deckId, deck]) => {
            const deckValidation = deck.validate();
            if (!deckValidation.isValid) {
                errors.push(`Deck ${deckId}: ${deckValidation.errors.join(', ')}`);
            }
        });
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Convert to JSON format for storage (compatible with existing format)
     * @returns Plain object representation
     */
    toJSON() {
        const decksObj = {};
        Object.entries(this.decks).forEach(([deckId, deck]) => {
            decksObj[deckId] = deck.toJSON();
        });
        return {
            playerId: this.playerId,
            activeDeck: this.activeDeck,
            decks: decksObj
        };
    }
    /**
     * Create PlayerDeck instance from JSON data
     * @param playerId - Player ID
     * @param jsonData - Plain object data
     * @returns New PlayerDeck instance
     */
    static fromJSON(playerId, jsonData) {
        return new PlayerDeck(playerId, jsonData);
    }
}
exports.PlayerDeck = PlayerDeck;
exports.default = PlayerDeck;
//# sourceMappingURL=PlayerDeck.js.map