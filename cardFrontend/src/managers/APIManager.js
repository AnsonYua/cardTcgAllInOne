import { GAME_CONFIG } from '../config/gameConfig.js';

export default class APIManager {
  constructor() {
    this.baseUrl = GAME_CONFIG.api.baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Game Management
  async createGame(playerName, gameConfig = {}) {
    return this.request('/player/startGame', {
      method: 'POST',
      body: JSON.stringify({ 
        playerId: 'playerId_1',  // First player is always playerId_1
        gameConfig: {
          playerName,
          ...gameConfig
        }
      })
    });
  }

  async joinRoom(gameId, playerName) {
    return this.request('/player/joinRoom', {
      method: 'POST',
      body: JSON.stringify({ 
        playerId: 'playerId_2',  // Second player is always playerId_2
        gameId: gameId,
        playerName: playerName
      })
    });
  }

  // Legacy method for compatibility - now redirects to joinRoom
  async joinGame(playerId, gameId) {
    return this.joinRoom(gameId, 'Player 2');
  }

  async startReady(playerId, gameId, isRedraw = false) {
    return this.request('/player/startReady', {
      method: 'POST',
      body: JSON.stringify({ playerId, gameId, isRedraw })
    });
  }

  // Gameplay Actions - Structured action API
  async playCard(playerId, gameId, action) {
    return this.request('/player/playCard', {
      method: 'POST',
      body: JSON.stringify({
        playerId,
        gameId,
        action
      })
    });
  }

  // Legacy: Simplified player action API - now converts to structured action
  async playCardLegacy(playerId, gameId, carduid) {
    // Convert legacy playCard to structured action
    const action = {
      type: 'PlayCard',
      carduid: carduid,
      playAs: 'unit'  // Default to unit for legacy calls
    };
    
    return this.playCard(playerId, gameId, action);
  }

  async selectCard(selectionId, selectedCardIdentifiers, playerId, gameId) {
    return this.request('/player/selectCard', {
      method: 'POST',
      body: JSON.stringify({
        selectionId,
        selectedCardUIds: selectedCardIdentifiers,
        playerId,
        gameId
      })
    });
  }

  // Card Selection - New unified approach using playCard endpoint
  async submitCardSelection(selectionId, selectedCardIdentifiers) {
    // Get current player and game info from game state
    const gameState = this.getGameState();
    if (!gameState || !gameState.playerId || !gameState.gameId) {
      throw new Error('Game state not available for card selection');
    }

    const action = {
      type: 'SelectCard',
      selectionId: selectionId,
      selectedCardUIds: selectedCardIdentifiers
    };

    return this.playCard(gameState.playerId, gameState.gameId, action);
  }

  // Helper method to get current game state (should be set by GameStateManager)
  getGameState() {
    // This will need to be set by the scene or passed in
    return this.currentGameState || null;
  }

  // Method to set game state (called by scenes)
  setGameState(gameState) {
    this.currentGameState = gameState;
  }

  async acknowledgeEvents(gameId, playerId, eventIds) {
    console.log("das ",JSON.stringify({ gameId, playerId, eventIds }))
    return this.request('/player/acknowledgeEvents', {
      method: 'POST',
      body: JSON.stringify({ gameId, playerId, eventIds })
    });
  }

  /**
   * Confirm or decline a burst effect choice
   * @param {string} gameId - Game ID
   * @param {string} playerId - Player ID
   * @param {string} eventId - Event ID from processingQueue
   * @param {boolean} confirmed - Whether the user confirmed the burst effect
   * @returns {Promise<Object>} API response
   */
  async confirmBurstChoice(gameId, playerId, eventId, confirmed) {
    console.log('APIManager: Confirming burst choice:', { gameId, playerId, eventId, confirmed });
    
    return this.request('/player/confirmBurstChoice', {
      method: 'POST',
      body: JSON.stringify({ gameId, playerId, eventId, confirmed })
    });
  }


  /**
   * Confirm target choice for unified TARGET_CHOICE events
   * @param {string} gameId - Game ID
   * @param {string} playerId - Player ID
   * @param {string} eventId - Event ID from processingQueue
   * @param {Object} selectedTarget - Selected target object with carduid, zone, playerId
   * @returns {Promise<Object>} API response
   */
  async confirmTargetChoice(gameId, playerId, eventId, selectedTargets) {
    console.log('APIManager: Confirming target choice:', { gameId, playerId, eventId, selectedTargets });
    
    return this.request('/player/confirmTargetChoice', {
      method: 'POST',
      body: JSON.stringify({ gameId, playerId, eventId, selectedTargets })
    });
  }

  async endTurn(gameId, playerId) {
    return this.request('/player/endTurn', {
      method: 'POST',
      body: JSON.stringify({ gameId, playerId })
    });
  }

  async getPlayer(playerId, gameId) {
    const params = gameId ? `?gameId=${gameId}` : '';
    return this.request(`/player/${playerId}${params}`);
  }

  // Battle Progression
  async nextRound(gameId) {
    return this.request('/player/nextRound', {
      method: 'POST',
      body: JSON.stringify({ gameId })
    });
  }

  // AI Actions (placeholder for future implementation)
  async playerAIAction(playerId, gameId) {
    return this.request('/player/playerAiAction', {
      method: 'POST',
      body: JSON.stringify({ playerId, gameId })
    });
  }

  /**
   * Send player action (attacks, abilities, etc.)
   * @param {string} playerId - Player ID
   * @param {string} gameId - Game ID
   * @param {Object} actionData - Action data containing action type and details
   * @returns {Promise<Object>} API response
   */
  async playerAction(playerId, gameId, actionData) {
    console.log('APIManager: Sending playerAction:', { playerId, gameId, actionData });
    
    return this.request('/player/playerAction', {
      method: 'POST',
      body: JSON.stringify({
        playerId,
        gameId,
        ...actionData
      })
    });
  }


  async requestTestScenario(scenarioPath) {
    return this.request(`/test/getTestScenario?scenarioPath=${encodeURIComponent(scenarioPath)}`, {
      method: 'GET'
    });
  }

  // Demo/Mock API methods for development
  async createMockGame(playerName) {
    // Simulate API delay
    await this.delay(500);
    
    return {
      gameId: 'mock_' + Date.now(),
      playerId: 'player_' + Date.now(),
      status: 'created'
    };
  }

  async getMockPlayer(playerId, gameId) {
    // Simulate API delay
    await this.delay(100);
    
    // Return mock player data
    return {
      playerId,
      gameEnv: {
        phase: GAME_CONFIG.phases.MAIN,
        currentPlayer: playerId,
        notificationQueue: [],
        // ... other mock data
      }
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test scenario management
  async getTestScenario(scenarioPath) {
    return this.request(`/api/game/test/getTestScenario?scenarioPath=${encodeURIComponent(scenarioPath)}`, {
      method: 'GET'
    });
  }

  // Game state injection for testing
  async injectGameState(gameId, gameEnv) {
    return this.request('/test/injectGameState', {
      method: 'POST',
      body: JSON.stringify({ gameId, gameEnv })
    });
  }

  // Utility methods for API interaction
  isOnline() {
    return navigator.onLine;
  }

}