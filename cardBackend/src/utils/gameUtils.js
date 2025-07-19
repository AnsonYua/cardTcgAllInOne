/**
 * Utility functions for game-related operations
 */

/**
 * Get list of player IDs from game environment
 * @param {Object} gameEnv - Current game environment
 * @returns {Array} - Array of player IDs
 */
function getPlayerFromGameEnv(gameEnv) {
    if (!gameEnv.players) {
        throw new Error('Game environment must have unified structure with gameEnv.players');
    }
    return Object.keys(gameEnv.players);
}

function getOpponentPlayer(gameEnv) {
    const currentPlayer = gameEnv["currentPlayer"];
    const playerIds = getPlayerFromGameEnv(gameEnv).filter(playerId => playerId !== currentPlayer);
    return playerIds[0];
}


function isConditionMatch(condition, gameEnv, 
                        currentPlayerId, opponentPlayerId) {
    if (condition.type === "opponentLeaderHasLevel" && condition.value === "7") {
        return true;
    }
    return false;
}

/**
 * Get player data from unified structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @returns {Object} - Player data object
 */
function getPlayerData(gameEnv, playerId) {
    if (!gameEnv.players) {
        throw new Error('Game environment must have unified structure with gameEnv.players');
    }
    return gameEnv.players[playerId] || null;
}

/**
 * Get player field data from unified structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @returns {Object} - Player field data object
 */
function getPlayerField(gameEnv, playerId) {
    if (!gameEnv.zones) {
        throw new Error('Game environment must have unified structure with gameEnv.zones');
    }
    return gameEnv.zones[playerId] || null;
}

/**
 * Get player field effects from unified structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @returns {Object} - Player field effects object
 */
function getPlayerFieldEffects(gameEnv, playerId) {
    if (!gameEnv.players) {
        throw new Error('Game environment must have unified structure with gameEnv.players');
    }
    return gameEnv.players[playerId]?.fieldEffects || null;
}

/**
 * Set player data in unified structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @param {Object} playerData - Player data to set
 */
function setPlayerData(gameEnv, playerId, playerData) {
    if (!gameEnv.players) {
        throw new Error('Game environment must have unified structure with gameEnv.players');
    }
    gameEnv.players[playerId] = playerData;
}

/**
 * Set player field data in unified structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @param {Object} fieldData - Field data to set
 */
function setPlayerField(gameEnv, playerId, fieldData) {
    if (!gameEnv.zones) {
        throw new Error('Game environment must have unified structure with gameEnv.zones');
    }
    gameEnv.zones[playerId] = fieldData;
}

/**
 * Set player field effects in unified structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @param {Object} fieldEffects - Field effects to set
 */
function setPlayerFieldEffects(gameEnv, playerId, fieldEffects) {
    if (!gameEnv.players) {
        throw new Error('Game environment must have unified structure with gameEnv.players');
    }
    if (!gameEnv.players[playerId]) {
        throw new Error(`Player ${playerId} not found in game environment`);
    }
    gameEnv.players[playerId].fieldEffects = fieldEffects;
}

module.exports = {
    getPlayerFromGameEnv,
    getOpponentPlayer,
    isConditionMatch,
    getPlayerData,
    getPlayerField,
    getPlayerFieldEffects,
    setPlayerData,
    setPlayerField,
    setPlayerFieldEffects
}; 