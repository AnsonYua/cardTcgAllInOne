/**
 * Utility functions for game-related operations
 */

/**
 * Get list of player IDs from game environment
 * @param {Object} gameEnv - Current game environment
 * @returns {Array} - Array of player IDs
 */
function getPlayerFromGameEnv(gameEnv) {
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

module.exports = {
    getPlayerFromGameEnv,
    getOpponentPlayer,
    isConditionMatch
}; 