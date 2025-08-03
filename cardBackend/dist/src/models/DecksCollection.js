"use strict";
// src/models/DecksCollection.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecksCollection = void 0;
const PlayerDeck_1 = require("./PlayerDeck");
/**
 * Represents the player deck collection with TypeScript type safety
 */
class DecksCollection {
    constructor(data = {}) {
        this.metadata = data.metadata || {
            version: '1.1',
            lastUpdated: new Date().toISOString().split('T')[0],
            description: 'Player deck configurations'
        };
        // Player deck collections (TypeScript typed)
        this.playerDecks = {};
        // Initialize from data
        this.initializeFromData(data);
    }
    /**
     * Initialize collection from JSON data
     * @param data - Raw JSON data
     */
    initializeFromData(data) {
        // Load player decks
        if (data.playerDecks && typeof data.playerDecks === 'object') {
            Object.entries(data.playerDecks).forEach(([playerId, playerData]) => {
                this.playerDecks[playerId] = PlayerDeck_1.PlayerDeck.fromJSON(playerId, playerData);
            });
        }
    }
    /**
     * Get player deck collection
     * @param playerId - Player ID
     * @returns Player deck collection or null
     */
    getPlayerDecks(playerId) {
        return this.playerDecks[playerId] || null;
    }
    /**
     * Create or update player deck collection
     * @param playerId - Player ID
     * @param playerDeck - Player deck collection
     */
    setPlayerDecks(playerId, playerDeck) {
        if (!(playerDeck instanceof PlayerDeck_1.PlayerDeck)) {
            throw new Error('Expected PlayerDeck instance');
        }
        this.playerDecks[playerId] = playerDeck;
    }
    /**
     * Get all player IDs
     * @returns Array of player IDs
     */
    getAllPlayerIds() {
        return Object.keys(this.playerDecks);
    }
    /**
     * Check if player exists
     * @param playerId - Player ID to check
     * @returns True if player exists
     */
    hasPlayer(playerId) {
        return !!this.playerDecks[playerId];
    }
    /**
     * Remove player and their decks
     * @param playerId - Player ID to remove
     * @returns True if player was removed
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
     * @returns Statistics about the entire collection
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
     * @returns Validation result with isValid boolean and errors array
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
     * @returns Plain object representation
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
     * @param jsonData - Plain object data
     * @returns New DecksCollection instance
     */
    static fromJSON(jsonData) {
        return new DecksCollection(jsonData);
    }
}
exports.DecksCollection = DecksCollection;
exports.default = DecksCollection;
//# sourceMappingURL=DecksCollection.js.map