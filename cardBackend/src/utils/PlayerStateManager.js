/**
 * PlayerStateManager - Centralized player data access and manipulation
 * Extracts repeated player state patterns from mozGamePlay.js
 */

class PlayerStateManager {
    /**
     * Get player hand with validation
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID  
     * @returns {Array} Player hand cards
     */
    static getPlayerHand(gameEnv, playerId) {
        if (!gameEnv.players || !gameEnv.players[playerId]) {
            return [];
        }
        return gameEnv.players[playerId].deck?.hand || [];
    }

    /**
     * Get player main deck with validation
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {Array} Player main deck cards
     */
    static getPlayerMainDeck(gameEnv, playerId) {
        if (!gameEnv.players || !gameEnv.players[playerId]) {
            return [];
        }
        return gameEnv.players[playerId].deck?.mainDeck || [];
    }

    /**
     * Get complete player deck structure
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {Object} Player deck object
     */
    static getPlayerDeck(gameEnv, playerId) {
        if (!gameEnv.players || !gameEnv.players[playerId]) {
            return null;
        }
        return gameEnv.players[playerId].deck || null;
    }

    /**
     * Set player hand with validation
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {Array} hand - New hand cards
     */
    static setPlayerHand(gameEnv, playerId, hand) {
        if (!gameEnv.players || !gameEnv.players[playerId]) {
            return;
        }
        if (!gameEnv.players[playerId].deck) {
            gameEnv.players[playerId].deck = {};
        }
        gameEnv.players[playerId].deck.hand = hand;
    }

    /**
     * Set player main deck with validation
     * @param {Object} gameEnv - Game environment  
     * @param {string} playerId - Player ID
     * @param {Array} mainDeck - New main deck cards
     */
    static setPlayerMainDeck(gameEnv, playerId, mainDeck) {
        if (!gameEnv.players || !gameEnv.players[playerId]) {
            return;
        }
        if (!gameEnv.players[playerId].deck) {
            gameEnv.players[playerId].deck = {};
        }
        gameEnv.players[playerId].deck.mainDeck = mainDeck;
    }

    /**
     * Get player field zones with validation
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {Object} Player field zones
     */
    static getPlayerField(gameEnv, playerId) {
        if (!gameEnv.zones || !gameEnv.zones[playerId]) {
            return {};
        }
        return gameEnv.zones[playerId];
    }

    /**
     * Get specific player zone with validation
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {string} zone - Zone name
     * @returns {Array} Zone cards
     */
    static getPlayerZone(gameEnv, playerId, zone) {
        const playerField = this.getPlayerField(gameEnv, playerId);
        return playerField[zone] || [];
    }

    /**
     * Get complete player data with validation
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {Object} Player data object
     */
    static getPlayerData(gameEnv, playerId) {
        if (!gameEnv.players || !gameEnv.players[playerId]) {
            return null;
        }
        return gameEnv.players[playerId];
    }

    /**
     * Check if zone has cards with safe validation
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID  
     * @param {string} zone - Zone name
     * @returns {boolean} True if zone has cards
     */
    static hasCardsInZone(gameEnv, playerId, zone) {
        const playerField = this.getPlayerField(gameEnv, playerId);
        return playerField[zone] && playerField[zone].length > 0;
    }

    /**
     * Get field effects with validation
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {Object} Field effects object
     */
    static getFieldEffects(gameEnv, playerId) {
        const playerData = this.getPlayerData(gameEnv, playerId);
        return playerData?.fieldEffects || {};
    }

    /**
     * Check for zone placement freedom
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {boolean} True if player has zone placement freedom
     */
    static hasZonePlacementFreedom(gameEnv, playerId) {
        const fieldEffects = this.getFieldEffects(gameEnv, playerId);
        return fieldEffects.specialEffects?.zonePlacementFreedom || false;
    }

    /**
     * Get all player IDs from game environment
     * @param {Object} gameEnv - Game environment
     * @returns {Array} Array of player IDs
     */
    static getAllPlayerIds(gameEnv) {
        if (!gameEnv.players) {
            return [];
        }
        return Object.keys(gameEnv.players);
    }
}

module.exports = PlayerStateManager;