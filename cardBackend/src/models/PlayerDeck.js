// src/models/PlayerDeck.js

const Deck = require('./Deck');

/**
 * Represents a player's deck collection with Java-like clear field declarations
 */
class PlayerDeck {
    constructor(playerId, data = {}) {
        // Core player identification
        this.playerId = playerId;
        
        // Active deck identifier
        this.activeDeck = data.activeDeck || null;
        
        // Deck collection as plain object (Java-like field declaration)
        this.decks = {};
        
        // Runtime mappings for gameplay compatibility
        this.deckUIDMapping = {};
        this.leaderUIMapping = {};
        
        // Initialize decks from data
        if (data.decks && typeof data.decks === 'object') {
            Object.entries(data.decks).forEach(([deckId, deckData]) => {
                this.decks[deckId] = Deck.fromJSON(deckData);
            });
        }
    }

    /**
     * Get the currently active deck
     * @returns {Deck|null} Active deck instance or null if not found
     */
    getActiveDeck() {
        if (!this.activeDeck) {
            return null;
        }
        return this.decks[this.activeDeck] || null;
    }

    /**
     * Set the active deck by ID
     * @param {string} deckId - Deck ID to activate
     * @returns {boolean} True if deck was found and activated
     */
    setActiveDeck(deckId) {
        if (this.decks[deckId]) {
            this.activeDeck = deckId;
            return true;
        }
        return false;
    }

    /**
     * Add a deck to the player's collection
     * @param {Deck} deck - Deck instance to add
     * @returns {boolean} True if deck was added successfully
     */
    addDeck(deck) {
        if (!(deck instanceof Deck)) {
            throw new Error('Expected Deck instance');
        }
        
        const validation = deck.validate();
        if (!validation.isValid) {
            throw new Error(`Invalid deck: ${validation.errors.join(', ')}`);
        }
        
        this.decks[deck.id] = deck;
        
        // Set as active if it's the first deck
        if (!this.activeDeck) {
            this.activeDeck = deck.id;
        }
        
        return true;
    }

    /**
     * Remove a deck from the player's collection
     * @param {string} deckId - Deck ID to remove
     * @returns {boolean} True if deck was removed
     */
    removeDeck(deckId) {
        if (!this.decks[deckId]) {
            return false;
        }
        
        delete this.decks[deckId];
        
        // Reset active deck if it was removed
        if (this.activeDeck === deckId) {
            const remainingDeckIds = Object.keys(this.decks);
            this.activeDeck = remainingDeckIds.length > 0 ? remainingDeckIds[0] : null;
        }
        
        return true;
    }

    /**
     * Get deck by ID
     * @param {string} deckId - Deck ID to retrieve
     * @returns {Deck|null} Deck instance or null if not found
     */
    getDeck(deckId) {
        return this.decks[deckId] || null;
    }

    /**
     * Get all decks as an array
     * @returns {Deck[]} Array of deck instances
     */
    getAllDecks() {
        return Object.values(this.decks);
    }

    /**
     * Get deck names mapped to IDs
     * @returns {Object} Object with deckId -> deckName mappings
     */
    getDeckNames() {
        const names = {};
        Object.entries(this.decks).forEach(([deckId, deck]) => {
            names[deckId] = deck.name;
        });
        return names;
    }

    /**
     * Generate UIDs for active deck (for gameplay compatibility)
     * @returns {Object} Generated UID mappings and arrays
     */
    generateActiveDecksUIDs() {
        const activeDeck = this.getActiveDeck();
        if (!activeDeck) {
            throw new Error('No active deck found');
        }

        const { deckUIDMapping, leaderUIMapping } = activeDeck.generateCardUIDs();
        
        // Store mappings on player deck for compatibility
        this.deckUIDMapping = deckUIDMapping;
        this.leaderUIMapping = leaderUIMapping;
        
        return {
            deckUIDMapping,
            leaderUIMapping,
            cardUID: activeDeck.cardUID,
            leaderUID: activeDeck.leaderUID
        };
    }

    /**
     * Get player deck statistics
     * @returns {Object} Statistics about player's deck collection
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
     * Validate player deck structure
     * @returns {Object} Validation result with isValid boolean and errors array
     */
    validate() {
        const errors = [];
        
        if (!this.playerId) {
            errors.push('Player ID is required');
        }
        
        if (Object.keys(this.decks).length === 0) {
            errors.push('Player must have at least one deck');
        }
        
        if (this.activeDeck && !this.decks[this.activeDeck]) {
            errors.push('Active deck ID does not exist in deck collection');
        }
        
        // Validate all decks
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
     * @returns {Object} Plain object representation
     */
    toJSON() {
        const decksObj = {};
        Object.entries(this.decks).forEach(([deckId, deck]) => {
            decksObj[deckId] = deck.toJSON();
        });
        
        return {
            activeDeck: this.activeDeck,
            decks: decksObj,
            // Include runtime mappings for compatibility
            deckUIDMapping: this.deckUIDMapping,
            leaderUIMapping: this.leaderUIMapping
        };
    }

    /**
     * Create PlayerDeck instance from JSON data
     * @param {string} playerId - Player ID
     * @param {Object} jsonData - Plain object data
     * @returns {PlayerDeck} New PlayerDeck instance
     */
    static fromJSON(playerId, jsonData) {
        return new PlayerDeck(playerId, jsonData);
    }
}

module.exports = PlayerDeck;