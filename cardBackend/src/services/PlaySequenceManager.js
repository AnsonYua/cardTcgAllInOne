// src/services/PlaySequenceManager.js
/**
 * Manages the sequence of card plays for replay-based simulation
 * Tracks all card plays including leaders from game start
 */

class PlaySequenceManager {
    constructor() {
        // No persistent state needed - all data stored in gameEnv
    }

    /**
     * Initialize play sequence in gameEnv
     * @param {Object} gameEnv - Game environment
     */
    initializePlaySequence(gameEnv) {
        if (!gameEnv.playSequence) {
            gameEnv.playSequence = {
                globalSequence: 0,
                plays: []
            };
        }
    }

    /**
     * Record a card play action
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player who played the card
     * @param {string} cardId - ID of the card played
     * @param {string} action - Type of action (PLAY_LEADER, PLAY_CARD)
     * @param {string} zone - Zone where card was played
     * @param {Object} data - Additional play data
     */
    recordCardPlay(gameEnv, playerId, cardId, action, zone, data = {}) {
        this.initializePlaySequence(gameEnv);
        
        gameEnv.playSequence.globalSequence++;
        
        const playRecord = {
            sequenceId: gameEnv.playSequence.globalSequence,
            playerId: playerId,
            cardId: cardId,
            action: action,
            zone: zone,
            data: data,
            timestamp: new Date().toISOString(),
            turnNumber: gameEnv.currentTurn || 0,
            phaseWhenPlayed: gameEnv.phase || 'SETUP'
        };

        gameEnv.playSequence.plays.push(playRecord);
        
        console.log(`🎯 Recorded ${action}: ${cardId} by ${playerId} in ${zone} (sequence: ${playRecord.sequenceId})`);
        
        return playRecord;
    }

    /**
     * Get sorted play sequence for simulation
     * @param {Object} gameEnv - Game environment
     * @returns {Array} Sorted array of plays
     */
    getPlaySequence(gameEnv) {
        this.initializePlaySequence(gameEnv);
        return gameEnv.playSequence.plays
            .slice() // Create copy to avoid mutation
            .sort((a, b) => a.sequenceId - b.sequenceId);
    }

    /**
     * Clear play sequence (for new game/round reset)
     * @param {Object} gameEnv - Game environment
     * @param {boolean} keepLeaders - Whether to keep leader plays
     */
    clearSequence(gameEnv, keepLeaders = false) {
        this.initializePlaySequence(gameEnv);
        
        if (keepLeaders) {
            // Keep only leader plays for round transitions
            gameEnv.playSequence.plays = gameEnv.playSequence.plays
                .filter(play => play.action === 'PLAY_LEADER');
        } else {
            // Complete reset
            gameEnv.playSequence.plays = [];
            gameEnv.playSequence.globalSequence = 0;
        }
        
        console.log(`🔄 Play sequence ${keepLeaders ? 'filtered to leaders only' : 'cleared completely'}`);
    }

    /**
     * Get plays by specific player
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID to filter by
     * @returns {Array} Plays by the specified player
     */
    getPlaysByPlayer(gameEnv, playerId) {
        this.initializePlaySequence(gameEnv);
        return gameEnv.playSequence.plays
            .filter(play => play.playerId === playerId)
            .sort((a, b) => a.sequenceId - b.sequenceId);
    }

    /**
     * Get plays by specific phase
     * @param {Object} gameEnv - Game environment
     * @param {string} phase - Phase to filter by
     * @returns {Array} Plays from the specified phase
     */
    getPlaysByPhase(gameEnv, phase) {
        this.initializePlaySequence(gameEnv);
        return gameEnv.playSequence.plays
            .filter(play => play.phaseWhenPlayed === phase)
            .sort((a, b) => a.sequenceId - b.sequenceId);
    }

    /**
     * Get plays by turn number
     * @param {Object} gameEnv - Game environment
     * @param {number} turnNumber - Turn to filter by
     * @returns {Array} Plays from the specified turn
     */
    getPlaysByTurn(gameEnv, turnNumber) {
        this.initializePlaySequence(gameEnv);
        return gameEnv.playSequence.plays
            .filter(play => play.turnNumber === turnNumber)
            .sort((a, b) => a.sequenceId - b.sequenceId);
    }

    /**
     * Get the last play by a specific player
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {Object|null} Last play by the player
     */
    getLastPlayByPlayer(gameEnv, playerId) {
        const playerPlays = this.getPlaysByPlayer(gameEnv, playerId);
        return playerPlays.length > 0 ? playerPlays[playerPlays.length - 1] : null;
    }

    /**
     * Get statistics about the play sequence
     * @param {Object} gameEnv - Game environment
     * @returns {Object} Statistics about plays
     */
    getPlayStatistics(gameEnv) {
        this.initializePlaySequence(gameEnv);
        const plays = gameEnv.playSequence.plays;
        
        const stats = {
            totalPlays: plays.length,
            leaderPlays: plays.filter(p => p.action === 'PLAY_LEADER').length,
            cardPlays: plays.filter(p => p.action === 'PLAY_CARD').length,
            playsByPlayer: {},
            playsByPhase: {},
            playsByTurn: {}
        };

        // Count plays by player
        plays.forEach(play => {
            stats.playsByPlayer[play.playerId] = (stats.playsByPlayer[play.playerId] || 0) + 1;
            stats.playsByPhase[play.phaseWhenPlayed] = (stats.playsByPhase[play.phaseWhenPlayed] || 0) + 1;
            stats.playsByTurn[play.turnNumber] = (stats.playsByTurn[play.turnNumber] || 0) + 1;
        });

        return stats;
    }

    /**
     * Validate play sequence integrity
     * @param {Object} gameEnv - Game environment
     * @returns {Object} Validation result
     */
    validatePlaySequence(gameEnv) {
        this.initializePlaySequence(gameEnv);
        const plays = gameEnv.playSequence.plays;
        
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // Check sequence ID continuity
        for (let i = 0; i < plays.length - 1; i++) {
            if (plays[i + 1].sequenceId !== plays[i].sequenceId + 1) {
                validation.errors.push(`Sequence gap between ${plays[i].sequenceId} and ${plays[i + 1].sequenceId}`);
                validation.isValid = false;
            }
        }

        // Check for duplicate sequence IDs
        const sequenceIds = plays.map(p => p.sequenceId);
        const uniqueIds = [...new Set(sequenceIds)];
        if (sequenceIds.length !== uniqueIds.length) {
            validation.errors.push('Duplicate sequence IDs found');
            validation.isValid = false;
        }

        // Check for required fields
        plays.forEach((play, index) => {
            const requiredFields = ['sequenceId', 'playerId', 'cardId', 'action', 'zone'];
            requiredFields.forEach(field => {
                if (!play[field]) {
                    validation.errors.push(`Missing ${field} in play ${index}`);
                    validation.isValid = false;
                }
            });
        });

        return validation;
    }
}

module.exports = new PlaySequenceManager();