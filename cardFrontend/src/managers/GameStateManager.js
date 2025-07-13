import { GAME_CONFIG } from '../config/gameConfig.js';

export default class GameStateManager {
  constructor() {
    this.gameState = {
      gameId: null,
      playerId: null,
      playerName: null,
      gameEnv: {
        phase: GAME_CONFIG.phases.SETUP,
        currentPlayer: null,
        players: {},
        zones: {},
        gameEvents: [],
        pendingCardSelections: {},
        victoryPoints: {},
        round: 1
      },
      uiState: {
        selectedCard: null,
        hoveredZone: null,
        showingCardDetails: false,
        pendingAction: null
      }
    };
    
    this.eventHandlers = new Map();
    this.pollTimer = null;
  }

  initializeGame(gameId, playerId, playerName) {
    this.gameState.gameId = gameId;
    this.gameState.playerId = playerId; 
    this.gameState.playerName = playerName;
  }

  updateGameEnv(gameEnv) {
    this.gameState.gameEnv = { ...this.gameState.gameEnv, ...gameEnv };
  }

  updateUIState(uiState) {
    this.gameState.uiState = { ...this.gameState.uiState, ...uiState };
  }

  getGameState() {
    return this.gameState;
  }

  getPlayer(playerId = null) {
    const id = playerId || this.gameState.playerId;
    return this.gameState.gameEnv.players[id];
  }

  getOpponent() {
    const players = Object.keys(this.gameState.gameEnv.players);
    return players.find(id => id !== this.gameState.playerId);
  }

  isCurrentPlayer() {
    return this.gameState.gameEnv.currentPlayer === this.gameState.playerId;
  }

  getPlayerZones(playerId = null) {
    const id = playerId || this.gameState.playerId;
    return this.gameState.gameEnv.zones[id] || {};
  }

  getPlayerHand(playerId = null) {
    const player = this.getPlayer(playerId);
    return player ? player.hand : [];
  }

  getVictoryPoints(playerId = null) {
    const id = playerId || this.gameState.playerId;
    return this.gameState.gameEnv.victoryPoints[id] || 0;
  }

  getCurrentPhase() {
    return this.gameState.gameEnv.phase;
  }

  getCurrentRound() {
    return this.gameState.gameEnv.round;
  }

  addEventListener(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
  }

  removeEventListener(eventType, handler) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  processGameEvents() {
    const events = this.gameState.gameEnv.gameEvents || [];
    
    events.forEach(event => {
      const handlers = this.eventHandlers.get(event.type) || [];
      handlers.forEach(handler => handler(event));
    });

    if (events.length > 0) {
      this.acknowledgeEvents(this.apiManager);
    }
  }

  async acknowledgeEvents(apiManager) {
    const events = this.gameState.gameEnv.gameEvents || [];
    const unprocessedEvents = events.filter(event => !event.frontendProcessed);
    
    if (unprocessedEvents.length > 0 && apiManager) {
      try {
        const eventIds = unprocessedEvents.map(e => e.id);
        await apiManager.acknowledgeEvents(this.gameState.gameId, eventIds);
        console.log(`Acknowledged ${eventIds.length} events`);
      } catch (error) {
        console.error('Failed to acknowledge events:', error);
      }
    }
  }

  startPolling(apiManager) {
    this.apiManager = apiManager; // Store reference for event acknowledgment
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(async () => {
      try {
        if (this.gameState.gameId && this.gameState.playerId) {
          const playerData = await apiManager.getPlayer(this.gameState.playerId, this.gameState.gameId);
          this.updateGameEnv(playerData.gameEnv);
          this.processGameEvents();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, GAME_CONFIG.pollInterval);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  reset() {
    this.stopPolling();
    this.gameState = {
      gameId: null,
      playerId: null,
      playerName: null,
      gameEnv: {
        phase: GAME_CONFIG.phases.SETUP,
        currentPlayer: null,
        players: {},
        zones: {},
        gameEvents: [],
        pendingCardSelections: {},
        victoryPoints: {},
        round: 1
      },
      uiState: {
        selectedCard: null,
        hoveredZone: null,
        showingCardDetails: false,
        pendingAction: null
      }
    };
  }
}