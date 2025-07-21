// src/services/PlaySequenceManager.js
/**
 * 🎬 PLAY SEQUENCE MANAGER - Replay System Foundation 
 * ===================================================
 * 
 * This class is THE FOUNDATION of the replay system. It tracks every action that happens
 * in a game so they can be replayed in the exact same order to reconstruct game state.
 * 
 * 🎯 CORE PURPOSE:
 * - Record ALL game actions in chronological order (leaders, cards, effects)  
 * - Provide sorted sequence for replay simulation
 * - Enable consistent game state reconstruction from scratch
 * - Support debugging by showing complete action history
 * 
 * 🔄 REPLAY INTEGRATION:
 * This data feeds directly into EffectSimulator.simulateCardPlaySequence() which replays
 * all actions to rebuild fieldEffects, zone restrictions, and calculated powers.
 * 
 * 📋 ACTION TYPES TRACKED:
 * - PLAY_LEADER: Leader placement during game setup
 * - PLAY_CARD: Regular card placement in zones
 * - APPLY_SET_POWER: Card selection effects (NEW - January 2025)
 * - APPLY_EFFECT: Other card effects (future enhancement)
 * 
 * 🆕 CARD SELECTION TRACKING (January 2025):
 * Now records card selection effects like h-2 "Make America Great Again" with complete
 * target information for replay consistency.
 * 
 * 📊 DATA STRUCTURE:
 * gameEnv.playSequence = {
 *   globalSequence: 5,
 *   plays: [
 *     {
 *       sequenceId: 1,
 *       playerId: "playerId_1", 
 *       cardId: "s-1",
 *       action: "PLAY_LEADER",
 *       zone: "leader",
 *       data: {...},
 *       timestamp: "2025-01-01T10:00:00Z",
 *       turnNumber: 0,
 *       phaseWhenPlayed: "SETUP"
 *     },
 *     {
 *       sequenceId: 5,
 *       playerId: "playerId_2",
 *       cardId: "h-2", 
 *       action: "APPLY_SET_POWER",
 *       zone: "effect",
 *       data: {
 *         selectedCardIds: ["c-1"],
 *         targetPlayerId: "playerId_1",
 *         effectType: "setPower",
 *         powerValue: 0
 *       }
 *     }
 *   ]
 * }
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
     * 📝 RECORD CARD PLAY - The Heart of Replay System
     * ================================================
     * 
     * This is THE FUNCTION that records every action in the game for replay.
     * Every leader placement, card play, and effect execution goes through here!
     * 
     * 🎯 WHAT IT RECORDS:
     * - PLAY_LEADER: s-1, s-2, etc. during game setup
     * - PLAY_CARD: c-1, h-2, etc. during gameplay  
     * - APPLY_SET_POWER: Card selection effects (NEW - h-2 targeting)
     * 
     * 🔄 REPLAY FLOW:
     * 1. This function records action → gameEnv.playSequence.plays
     * 2. EffectSimulator reads plays → replays them in order
     * 3. Each replay rebuilds fieldEffects step by step
     * 4. Final state matches what originally happened
     * 
     * 📊 EXAMPLE RECORDED PLAY:
     * {
     *   sequenceId: 4,
     *   playerId: "playerId_2",
     *   cardId: "h-2", 
     *   action: "PLAY_CARD",
     *   zone: "help",
     *   data: { isFaceDown: false },
     *   timestamp: "2025-01-21T10:05:00Z",
     *   turnNumber: 4,
     *   phaseWhenPlayed: "MAIN_PHASE"  
     * }
     * 
     * 🆕 NEW CARD SELECTION RECORDING (January 2025):
     * When h-2 card selection completes, mozGamePlay.js calls this with:
     * - action: "APPLY_SET_POWER"
     * - data: { selectedCardIds: ["c-1"], targetPlayerId: "playerId_1", ... }
     * 
     * @param {Object} gameEnv - Game environment (modified to add play record)
     * @param {string} playerId - Player who performed the action (e.g., "playerId_2")
     * @param {string} cardId - Card involved in action (e.g., "h-2", "c-1")
     * @param {string} action - Action type (PLAY_LEADER, PLAY_CARD, APPLY_SET_POWER)
     * @param {string} zone - Zone involved (leader, top, left, right, help, sp, effect)
     * @param {Object} data - Action-specific data (card placement info, selection details, etc.)
     * @param {Object} timing - Optional timing override {turnNumber, phaseWhenPlayed}
     * @returns {Object} The created play record
     */
    recordCardPlay(gameEnv, playerId, cardId, action, zone, data = {}, timing = null) {
        this.initializePlaySequence(gameEnv);
        
        gameEnv.playSequence.globalSequence++;
        
        // Use timing override if provided, otherwise use current game state
        const turnNumber = timing?.turnNumber ?? (gameEnv.currentTurn || 0);
        const phaseWhenPlayed = timing?.phaseWhenPlayed ?? (gameEnv.phase || 'SETUP');
        
        const playRecord = {
            sequenceId: gameEnv.playSequence.globalSequence,
            playerId: playerId,
            cardId: cardId,
            action: action,
            zone: zone,
            data: data,
            timestamp: new Date().toISOString(),
            turnNumber: turnNumber,
            phaseWhenPlayed: phaseWhenPlayed
        };

        gameEnv.playSequence.plays.push(playRecord);
        
        console.log(`🎯 Recorded ${action}: ${cardId} by ${playerId} in ${zone} (sequence: ${playRecord.sequenceId}) turn:${turnNumber} phase:${phaseWhenPlayed}`);
        
        return playRecord;
    }

    /**
     * 🔄 GET PLAY SEQUENCE - Feed for Replay Simulation
     * =================================================
     * 
     * This function provides the sorted action sequence to EffectSimulator for replay.
     * This is what gets replayed in chronological order to rebuild game state!
     * 
     * 🎯 PURPOSE: 
     * - Sort all recorded actions by sequenceId (chronological order)
     * - Return clean array for EffectSimulator.simulateCardPlaySequence()
     * - Ensure replay happens in exact same order as original game
     * 
     * 📋 TYPICAL SEQUENCE FOR h-2 EXAMPLE:
     * [
     *   {sequenceId: 1, action: "PLAY_LEADER", cardId: "s-1"},      // Player 1 leader
     *   {sequenceId: 2, action: "PLAY_LEADER", cardId: "s-2"},      // Player 2 leader  
     *   {sequenceId: 3, action: "PLAY_CARD", cardId: "c-1"},        // Player 1 plays c-1
     *   {sequenceId: 4, action: "PLAY_CARD", cardId: "h-2"},        // Player 2 plays h-2
     *   {sequenceId: 5, action: "APPLY_SET_POWER", cardId: "h-2"}   // h-2 selection effect
     * ]
     * 
     * 🔄 REPLAY INTEGRATION:
     * EffectSimulator iterates through this array and calls:
     * - executePlayUnified() for each action
     * - activateEffectsUnified() for card effects  
     * - checkTriggeredEffectsUnified() for reactions
     * 
     * @param {Object} gameEnv - Game environment
     * @returns {Array} Sorted array of play records for replay simulation
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