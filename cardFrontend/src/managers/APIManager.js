import { GAME_CONFIG } from '../config/gameConfig.js';

export default class APIManager {
  constructor() {
    this.baseUrl = GAME_CONFIG.apiBaseUrl;
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

  // Gameplay Actions
  async playerAction(playerId, gameId, action) {
    return this.request('/player/playerAction', {
      method: 'POST',
      body: JSON.stringify({
        playerId,
        gameId,
        action
      })
    });
  }

  async selectCard(selectionId, selectedCardIds, playerId, gameId) {
    return this.request('/player/selectCard', {
      method: 'POST',
      body: JSON.stringify({
        selectionId,
        selectedCardIds,
        playerId,
        gameId
      })
    });
  }

  async acknowledgeEvents(gameId, eventIds) {
    return this.request('/player/acknowledgeEvents', {
      method: 'POST',
      body: JSON.stringify({ gameId, eventIds })
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


  async requestTestScenario(scenarioPath) {
    return this.request(`/test/getTestScenario?scenarioPath=${encodeURIComponent(scenarioPath)}`, {
      method: 'GET'
    });
  }

  async requestSetTestScenario(gameEnv) {
    return this.request('/test/injectGameState', {
      method: 'POST',
      body: JSON.stringify(gameEnv)
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
        gameEvents: [],
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

  async testConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(this.baseUrl + '/health', {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn('API connection test failed:', error);
      return false;
    }
  }
}