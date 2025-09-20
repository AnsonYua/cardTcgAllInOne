/**
 * GameApiService - Wrapper class for API calls with standardized response handling
 * Reduces code duplication in GameScene.js by centralizing API call patterns
 */
export default class GameApiService {
  constructor(apiManager, gameStateManager, uiMessageManager) {
    this.apiManager = apiManager;
    this.gameStateManager = gameStateManager;
    this.uiMessageManager = uiMessageManager;
  }

  /**
   * Standard response handler for API calls that return gameEnv
   * @param {Object} response - API response
   * @param {string} successMessage - Message to show on success
   * @param {string} errorMessage - Message to show on error
   * @param {boolean} updateHand - Whether to trigger hand update scenario
   */
  handleStandardResponse(response, successMessage, errorMessage, updateHand = false) {
    if (response && response.success) {
      console.log(`API call successful:`, response);
      if (successMessage) {
        this.uiMessageManager.showRoomStatus(successMessage);
      }

      // Standard gameEnv update pattern
      if (response.gameEnv) {
        if (updateHand) {
          this.gameStateManager.checkHandUIDChangesAndSetScenario(
            response.gameEnv, 
            '', 
            null, // handContainer will be handled by GameScene
            { value: true }
          );
        }
        this.gameStateManager.updateGameEnv(response.gameEnv);
        return { success: true, gameEnvUpdated: true };
      }
      
      return { success: true, gameEnvUpdated: false };
    } else {
      const error = response?.error || errorMessage || 'API call failed';
      console.error('API call failed:', error);
      if (this.uiMessageManager) {
        this.uiMessageManager.showRoomStatus(error);
      }
      throw new Error(error);
    }
  }

  /**
   * End turn API call with standardized handling
   */
  async endTurn() {
    const gameState = this.gameStateManager.getGameState();
    const gameId = gameState.gameId;
    const playerId = gameState.playerId;

    if (!gameId || !playerId) {
      throw new Error('Missing gameId or playerId');
    }

    console.log(`Ending turn for player: ${playerId}`);
    this.uiMessageManager.showRoomStatus('Ending turn...');

    const response = await this.apiManager.endTurn(gameId, playerId);
    return this.handleStandardResponse(response, 'Turn ended successfully', 'Failed to end turn');
  }

  /**
   * Join room API call with standardized handling
   */
  async joinRoom(gameId, playerName) {
    console.log(`Joining room ${gameId} as ${playerName}`);
    
    const response = await this.apiManager.joinRoom(gameId, playerName);
    return this.handleStandardResponse(response, null, 'Failed to join room');
  }

  /**
   * Start ready API call with standardized handling
   */
  async startReady(wantRedraw) {
    const gameState = this.gameStateManager.getGameState();
    
    await this.apiManager.startReady(gameState.playerId, gameState.gameId, wantRedraw);
    this.uiMessageManager.showRoomStatus(`Ready sent (redraw: ${wantRedraw}). Poll to see if both players ready.`);
    
    return { success: true };
  }

  /**
   * Confirm burst choice API call with standardized handling
   */
  async confirmBurstChoice(eventId, confirmed) {
    const gameState = this.gameStateManager.getGameState();
    
    const response = await this.apiManager.confirmBurstChoice(
      gameState.gameId, 
      gameState.playerId, 
      eventId, 
      confirmed
    );
    
    return this.handleStandardResponse(
      response, 
      `Burst effect ${confirmed ? 'activated' : 'skipped'} successfully!`,
      'Failed to process burst choice',
      true // updateHand = true for burst effects
    );
  }

  /**
   * Confirm deploy target choice API call with standardized handling
   * @param {string} eventId - The deploy target choice event ID
   * @param {Object} selectedTarget - Selected target object with cardUid, zone, playerId
   */
  async confirmDeployChoice(eventId, selectedTarget) {
    const gameState = this.gameStateManager.getGameState();
    
    const response = await this.apiManager.confirmDeployChoice(
      gameState.gameId, 
      gameState.playerId, 
      eventId, 
      selectedTarget
    );
    
    return this.handleStandardResponse(
      response, 
      'Deploy target selected successfully!',
      'Failed to confirm deploy target choice',
      true // updateHand = true for deploy effects
    );
  }

  /**
   * Generic API call wrapper with error handling
   * @param {Function} apiCall - The API call function
   * @param {string} loadingMessage - Message to show while loading
   * @param {string} successMessage - Message to show on success
   * @param {string} errorMessage - Message to show on error
   * @param {boolean} updateHand - Whether to trigger hand update scenario
   */
  async executeApiCall(apiCall, loadingMessage, successMessage, errorMessage, updateHand = false) {
    try {
      if (loadingMessage) {
        this.uiMessageManager.showRoomStatus(loadingMessage);
      }
      
      const response = await apiCall();
      return this.handleStandardResponse(response, successMessage, errorMessage, updateHand);
    } catch (error) {
      console.error('API call execution failed:', error);
      if (this.uiMessageManager) {
        this.uiMessageManager.showRoomStatus(`${errorMessage}: ${error.message}`);
      }
      throw error;
    }
  }
}