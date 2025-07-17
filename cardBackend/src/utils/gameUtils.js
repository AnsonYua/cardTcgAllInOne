/**
 * Utility functions for game-related operations
 */

/**
 * Get list of player IDs from game environment
 * @param {Object} gameEnv - Current game environment
 * @returns {Array} - Array of player IDs
 */
function getPlayerFromGameEnv(gameEnv) {
    // NEW: Support unified structure with gameEnv.players
    if (gameEnv.players) {
        return Object.keys(gameEnv.players);
    }
    
    // LEGACY: Support old structure for backward compatibility
    const playerArr = [];   
    for (let playerId in gameEnv) {
        if (playerId.includes("playerId_")) {
            playerArr.push(playerId);
        }
    }
    return playerArr;
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
 * Get player data from unified or legacy structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @returns {Object} - Player data object
 */
function getPlayerData(gameEnv, playerId) {
    // NEW: Support unified structure
    if (gameEnv.players && gameEnv.players[playerId]) {
        return gameEnv.players[playerId];
    }
    
    // LEGACY: Support old structure
    if (gameEnv[playerId]) {
        return gameEnv[playerId];
    }
    
    return null;
}

/**
 * Get player field data from unified or legacy structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @returns {Object} - Player field data object
 */
function getPlayerField(gameEnv, playerId) {
    // NEW: Support unified structure
    if (gameEnv.zones && gameEnv.zones[playerId]) {
        return gameEnv.zones[playerId];
    }
    
    // LEGACY: Support old structure
    if (gameEnv[playerId] && gameEnv[playerId].Field) {
        return gameEnv[playerId].Field;
    }
    
    return null;
}

/**
 * Get player field effects from unified or legacy structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @returns {Object} - Player field effects object
 */
function getPlayerFieldEffects(gameEnv, playerId) {
    // NEW: Support unified structure
    if (gameEnv.fieldEffects && gameEnv.fieldEffects[playerId]) {
        return gameEnv.fieldEffects[playerId];
    }
    
    // LEGACY: Support old structure
    if (gameEnv[playerId] && gameEnv[playerId].fieldEffects) {
        return gameEnv[playerId].fieldEffects;
    }
    
    return null;
}

/**
 * Set player data in unified or legacy structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @param {Object} playerData - Player data to set
 */
function setPlayerData(gameEnv, playerId, playerData) {
    // NEW: Support unified structure
    if (gameEnv.players) {
        gameEnv.players[playerId] = playerData;
        return;
    }
    
    // LEGACY: Support old structure
    gameEnv[playerId] = playerData;
}

/**
 * Set player field data in unified or legacy structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @param {Object} fieldData - Field data to set
 */
function setPlayerField(gameEnv, playerId, fieldData) {
    // NEW: Support unified structure
    if (gameEnv.zones) {
        gameEnv.zones[playerId] = fieldData;
        return;
    }
    
    // LEGACY: Support old structure
    if (!gameEnv[playerId]) {
        gameEnv[playerId] = {};
    }
    gameEnv[playerId].Field = fieldData;
}

/**
 * Set player field effects in unified or legacy structure
 * @param {Object} gameEnv - Current game environment
 * @param {string} playerId - Player ID
 * @param {Object} fieldEffects - Field effects to set
 */
function setPlayerFieldEffects(gameEnv, playerId, fieldEffects) {
    // NEW: Support unified structure
    if (gameEnv.fieldEffects) {
        gameEnv.fieldEffects[playerId] = fieldEffects;
        return;
    }
    
    // LEGACY: Support old structure
    if (!gameEnv[playerId]) {
        gameEnv[playerId] = {};
    }
    gameEnv[playerId].fieldEffects = fieldEffects;
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