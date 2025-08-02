// src/models/DecksCollection.js

const Deck = require('./Deck');
const PlayerDeck = require('./PlayerDeck');

/**
 * Represents the player deck collection
 */
class DecksCollection {
    constructor(data = {}) {
        this.metadata = data.metadata || {
            version: '1.1',
            lastUpdated: new Date().toISOString().split('T')[0],
            description: 'Player deck configurations'
        };
        
        // Player deck collections (Java-like field declaration)
        this.playerDecks = {};
        
        // Initialize from data
        this.initializeFromData(data);
    }

    /**
     * Initialize collection from JSON data
     * @param {Object} data - Raw JSON data
     */
    initializeFromData(data) {
        // Load player decks
        if (data.playerDecks && typeof data.playerDecks === 'object') {
            Object.entries(data.playerDecks).forEach(([playerId, playerData]) => {
                this.playerDecks[playerId] = PlayerDeck.fromJSON(playerId, playerData);
            });
        }
    }


    /**
     * Get player deck collection
     * @param {string} playerId - Player ID
     * @returns {PlayerDeck|null} Player deck collection or null
     */
    getPlayerDecks(playerId) {
        return this.playerDecks[playerId] || null;
    }

    /**
     * Create or update player deck collection
     * @param {string} playerId - Player ID
     * @param {PlayerDeck} playerDeck - Player deck collection
     */
    setPlayerDecks(playerId, playerDeck) {
        if (!(playerDeck instanceof PlayerDeck)) {
            throw new Error('Expected PlayerDeck instance');
        }
        
        this.playerDecks[playerId] = playerDeck;
    }


    /**
     * Get all player IDs
     * @returns {string[]} Array of player IDs
     */
    getAllPlayerIds() {
        return Object.keys(this.playerDecks);
    }

    /**
     * Check if player exists
     * @param {string} playerId - Player ID to check
     * @returns {boolean} True if player exists
     */
    hasPlayer(playerId) {
        return !!this.playerDecks[playerId];
    }

    /**
     * Remove player and their decks
     * @param {string} playerId - Player ID to remove
     * @returns {boolean} True if player was removed
     */
    removePlayer(playerId) {
        if (!this.playerDecks[playerId]) {
            return false;
        }
        
        delete this.playerDecks[playerId];
        return true;
    }

    /**
     * Get collection statistics
     * @returns {Object} Statistics about the entire collection
     */
    getStats() {
        return {
            metadata: this.metadata,
            playerDecks: {
                count: Object.keys(this.playerDecks).length,
                players: Object.values(this.playerDecks).map(playerDeck => playerDeck.getStats())
            }
        };
    }

    /**
     * Validate entire collection
     * @returns {Object} Validation result with isValid boolean and errors array
     */
    validate() {
        const errors = [];
        
        // Validate player decks
        Object.entries(this.playerDecks).forEach(([playerId, playerDeck]) => {
            const playerValidation = playerDeck.validate();
            if (!playerValidation.isValid) {
                errors.push(`Player ${playerId}: ${playerValidation.errors.join(', ')}`);
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
        const playerDecksObj = {};
        Object.entries(this.playerDecks).forEach(([playerId, playerDeck]) => {
            playerDecksObj[playerId] = playerDeck.toJSON();
        });
        
        return {
            metadata: this.metadata,
            playerDecks: playerDecksObj
        };
    }

    /**
     * Create DecksCollection instance from JSON data
     * @param {Object} jsonData - Plain object data
     * @returns {DecksCollection} New DecksCollection instance
     */
    static fromJSON(jsonData) {
        return new DecksCollection(jsonData);
    }
}

module.exports = DecksCollection;