// PlayerHelper.js - Utility class for player/opponent operations
export default class PlayerHelper {
  constructor(gameStateManager) {
    this.gameStateManager = gameStateManager;
  }

  /**
   * Gets zones for specified player type
   * @param {string} playerType - 'player' or 'opponent'
   * @param {Object} playerZones - Player zones object
   * @param {Object} opponentZones - Opponent zones object
   * @returns {Object} Zones for the specified player type
   */
  getZonesForPlayer(playerType, playerZones, opponentZones) {
    return playerType === 'player' ? playerZones : opponentZones;
  }

  /**
   * Gets player data for specified type
   * @param {string} playerType - 'player' or 'opponent'
   * @returns {Object} Player data
   */
  getPlayerData(playerType) {
    if (playerType === 'player') {
      return this.gameStateManager.getPlayer();
    } else {
      const opponentId = this.gameStateManager.getOpponent();
      return this.gameStateManager.getPlayer(opponentId);
    }
  }

  /**
   * Gets player hand for specified type
   * @param {string} playerType - 'player' or 'opponent'
   * @returns {Array} Player hand cards
   */
  getPlayerHand(playerType) {
    if (playerType === 'player') {
      return this.gameStateManager.getPlayerHand();
    } else {
      const opponentId = this.gameStateManager.getOpponent();
      return this.gameStateManager.getPlayerHand(opponentId);
    }
  }

  /**
   * Gets victory points for specified player type
   * @param {string} playerType - 'player' or 'opponent'
   * @returns {number} Victory points
   */
  getVictoryPoints(playerType) {
    if (playerType === 'player') {
      return this.gameStateManager.getVictoryPoints();
    } else {
      const opponentId = this.gameStateManager.getOpponent();
      return this.gameStateManager.getVictoryPoints(opponentId);
    }
  }

  /**
   * Performs action on both players with different logic
   * @param {Function} playerAction - Action to perform on player
   * @param {Function} opponentAction - Action to perform on opponent
   * @param {any} playerArgs - Arguments for player action
   * @param {any} opponentArgs - Arguments for opponent action
   */
  performOnBothPlayers(playerAction, opponentAction, playerArgs, opponentArgs) {
    if (playerAction) {
      playerAction(playerArgs);
    }
    if (opponentAction) {
      opponentAction(opponentArgs);
    }
  }

  /**
   * Performs the same action on both players
   * @param {Function} action - Action to perform
   * @param {any} playerArgs - Arguments for player
   * @param {any} opponentArgs - Arguments for opponent
   */
  performSameActionOnBothPlayers(action, playerArgs, opponentArgs) {
    action('player', playerArgs);
    action('opponent', opponentArgs);
  }

  /**
   * Updates game state for specified player
   * @param {string} playerType - 'player' or 'opponent'
   * @param {Object} updateData - Data to update
   */
  updatePlayerState(playerType, updateData) {
    const gameState = this.gameStateManager.getGameState();
    const playerId = playerType === 'player' ? 
      gameState.playerId : 
      this.gameStateManager.getOpponent();
    
    const currentPlayerData = this.gameStateManager.getPlayer(playerId);
    
    this.gameStateManager.updateGameEnv({
      players: {
        ...gameState.gameEnv.players,
        [playerId]: {
          ...currentPlayerData,
          ...updateData
        }
      }
    });
  }

  /**
   * Gets the appropriate array based on player type
   * @param {string} playerType - 'player' or 'opponent'
   * @param {Array} playerArray - Array for player
   * @param {Array} opponentArray - Array for opponent
   * @returns {Array} Appropriate array for player type
   */
  getArrayForPlayer(playerType, playerArray, opponentArray) {
    return playerType === 'player' ? playerArray : opponentArray;
  }

  /**
   * Gets offset direction for card stacking (up for opponent, down for player)
   * @param {string} playerType - 'player' or 'opponent'
   * @returns {number} -1 for opponent (up), 1 for player (down)
   */
  getStackOffsetDirection(playerType) {
    return playerType === 'opponent' ? -1 : 1;
  }

  /**
   * Gets position configuration for player type
   * @param {string} playerType - 'player' or 'opponent'
   * @param {Object} playerConfig - Configuration for player
   * @param {Object} opponentConfig - Configuration for opponent
   * @returns {Object} Configuration for specified player type
   */
  getConfigForPlayer(playerType, playerConfig, opponentConfig) {
    return playerType === 'player' ? playerConfig : opponentConfig;
  }
}