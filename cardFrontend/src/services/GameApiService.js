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
   * @param {Object} sceneContext - Scene context for scenario flag and updateGameState
   */
  handleStandardResponse(response, successMessage, errorMessage, updateHand = false, sceneContext = null) {
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
        
        // ✅ CENTRALIZED: Handle scenario flag and updateGameState if scene context provided
        if (sceneContext && updateHand) {
          console.log('GameApiService: Setting scenario flag and updating game state');
          sceneContext.isSetScenoria = true;
          if (typeof sceneContext.updateGameState === 'function') {
            sceneContext.updateGameState();
          }
        }
        
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
   * @param {Object} sceneContext - Optional scene context for automatic scenario flag handling
   */
  async endTurn(sceneContext = null) {
    const gameState = this.gameStateManager.getGameState();
    const gameId = gameState.gameId;
    const playerId = gameState.playerId;

    if (!gameId || !playerId) {
      throw new Error('Missing gameId or playerId');
    }

    console.log(`Ending turn for player: ${playerId}`);
    this.uiMessageManager.showRoomStatus('Ending turn...');

    const response = await this.apiManager.endTurn(gameId, playerId);
    return this.handleStandardResponse(
      response, 
      'Turn ended successfully', 
      'Failed to end turn',
      true, // updateHand = false for end turn
      sceneContext // Pass scene context for automatic handling
    );
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
   * @param {string} eventId - The burst effect event ID
   * @param {boolean} confirmed - Whether the burst effect was confirmed
   * @param {Object} sceneContext - Optional scene context for automatic scenario flag handling
   */
  async confirmBurstChoice(eventId, confirmed, sceneContext = null) {
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
      true, // updateHand = true for burst effects
      sceneContext // Pass scene context for automatic handling
    );
  }


  /**
   * Confirm target choice API call with standardized handling (unified TARGET_CHOICE)
   * @param {string} eventId - The target choice event ID
   * @param {Array} selectedTargets - Array of selected target objects with carduid, zone, playerId
   * @param {Object} sceneContext - Optional scene context for automatic scenario flag handling
   */
  async confirmTargetChoice(eventId, selectedTargets, sceneContext = null) {
    const gameState = this.gameStateManager.getGameState();
    
    const response = await this.apiManager.confirmTargetChoice(
      gameState.gameId, 
      gameState.playerId, 
      eventId, 
      selectedTargets
    );
    
    return this.handleStandardResponse(
      response, 
      'Target selected successfully!',
      'Failed to confirm target choice',
      true, // updateHand = true for target choice effects
      sceneContext // Pass scene context for automatic handling
    );
  }

  /**
   * Confirm blocker choice (BLOCKER_CHOICE events) with standardized handling
   * @param {string} eventId - The blocker choice event ID
   * @param {Object|null} selectedTarget - Selected blocker target reference or null to decline
   * @param {Object} sceneContext - Optional scene context for automatic scenario flag handling
   */
  async confirmBlockerChoice(eventId, selectedTargets, sceneContext = null) {
    const gameState = this.gameStateManager.getGameState();

    const response = await this.apiManager.confirmBlockerChoice(
      gameState.gameId,
      gameState.playerId,
      eventId,
      selectedTargets
    );

    const hasSelection = Array.isArray(selectedTargets) && selectedTargets.length > 0;
    const successMessage = hasSelection
      ? 'Blocker assigned successfully!'
      : 'Blocker choice declined.';

    return this.handleStandardResponse(
      response,
      successMessage,
      'Failed to resolve blocker choice',
      true,
      sceneContext
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
