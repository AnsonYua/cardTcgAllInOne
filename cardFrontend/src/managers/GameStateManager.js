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
        round: 1,
        // NEW: Card Effect System data
        playSequence: { globalSequence: 0, plays: [] },
        computedState: {
          playerPowers: {},
          activeRestrictions: {},
          disabledCards: [],
          victoryPointModifiers: {}
        }
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

  // Field Effects Methods
  getPlayerFieldEffects(playerId = null) {
    const player = this.getPlayer(playerId);
    return player ? player.fieldEffects : null;
  }

  getZoneRestrictions(playerId = null, zone = null) {
    const fieldEffects = this.getPlayerFieldEffects(playerId);
    if (!fieldEffects) return "ALL";
    
    if (zone) {
      return fieldEffects.zoneRestrictions[zone.toUpperCase()] || "ALL";
    }
    return fieldEffects.zoneRestrictions;
  }

  getActiveEffects(playerId = null) {
    const fieldEffects = this.getPlayerFieldEffects(playerId);
    return fieldEffects ? fieldEffects.activeEffects : [];
  }

  canPlayCardInZone(card, zone, playerId = null) {
    const restrictions = this.getZoneRestrictions(playerId, zone);
    if (restrictions === "ALL") return true;
    
    return Array.isArray(restrictions) ? restrictions.includes(card.gameType) : false;
  }

  getModifiedCardPower(card, playerId = null) {
    const fieldEffects = this.getPlayerFieldEffects(playerId);
    if (!fieldEffects) return card.power;
    
    let modifiedPower = card.power;
    
    for (const effect of fieldEffects.activeEffects) {
      if (effect.type === "powerBoost") {
        // Check if effect affects this card
        if (this.doesEffectAffectCard(effect, card)) {
          modifiedPower += effect.value;
        }
      } else if (effect.type === "POWER_NULLIFICATION") {
        // Check if effect affects this card
        if (this.doesEffectAffectCard(effect, card)) {
          modifiedPower = 0;
        }
      }
    }
    
    return modifiedPower;
  }

  doesEffectAffectCard(effect, card) {
    const target = effect.target;
    
    // Check card type filter
    if (target.cardTypes && target.cardTypes !== "ALL") {
      if (!target.cardTypes.includes(card.cardType)) {
        return false;
      }
    }
    
    // Check game type filter
    if (target.gameTypes && target.gameTypes !== "ALL") {
      if (!target.gameTypes.includes(card.gameType)) {
        return false;
      }
    }
    
    // Check traits filter
    if (target.traits && target.traits !== "ALL") {
      const cardTraits = card.traits || [];
      const hasMatchingTrait = target.traits.some(trait => cardTraits.includes(trait));
      if (!hasMatchingTrait) {
        return false;
      }
    }
    
    return true;
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
        round: 1,
        // NEW: Card Effect System data
        playSequence: { globalSequence: 0, plays: [] },
        computedState: {
          playerPowers: {},
          activeRestrictions: {},
          disabledCards: [],
          victoryPointModifiers: {}
        }
      },
      uiState: {
        selectedCard: null,
        hoveredZone: null,
        showingCardDetails: false,
        pendingAction: null
      }
    };
  }
  
  getCurrentPlayerId() {
    return this.gameState.playerId;
  }
  
  // NEW: Card Effect System Methods
  
  /**
   * Get computed power for a card (includes effect modifications)
   * @param {Object} card - Card object
   * @param {string} playerId - Player ID (defaults to current player)
   * @returns {number} Computed power value
   */
  getComputedCardPower(card, playerId = null) {
    const id = playerId || this.gameState.playerId;
    const computedState = this.gameState.gameEnv.computedState;
    
    if (computedState && computedState.playerPowers && computedState.playerPowers[id]) {
      const cardPower = computedState.playerPowers[id][card.id];
      if (cardPower) {
        return cardPower.finalPower;
      }
    }
    
    return card.power || 0;
  }
  
  /**
   * Check if a card is disabled by effects
   * @param {Object} card - Card object
   * @returns {boolean} Whether card is disabled
   */
  isCardDisabled(card) {
    const computedState = this.gameState.gameEnv.computedState;
    
    if (computedState && computedState.disabledCards) {
      return computedState.disabledCards.some(d => d.cardId === card.id);
    }
    
    return false;
  }
  
  /**
   * Get active zone restrictions (from computed state)
   * @param {string} playerId - Player ID (defaults to current player)
   * @param {string} zone - Specific zone to check
   * @returns {string|Array} Zone restrictions
   */
  getComputedZoneRestrictions(playerId = null, zone = null) {
    const id = playerId || this.gameState.playerId;
    const computedState = this.gameState.gameEnv.computedState;
    
    if (computedState && computedState.activeRestrictions && computedState.activeRestrictions[id]) {
      const restrictions = computedState.activeRestrictions[id];
      
      if (zone) {
        return restrictions[zone.toUpperCase()] || "ALL";
      }
      return restrictions;
    }
    
    // Fallback to original field effects
    return this.getZoneRestrictions(playerId, zone);
  }
  
  /**
   * Check if card can be played in zone (using computed restrictions)
   * @param {Object} card - Card object
   * @param {string} zone - Zone name
   * @param {string} playerId - Player ID (defaults to current player)
   * @returns {boolean} Whether card can be played
   */
  canPlayCardInZoneComputed(card, zone, playerId = null) {
    const restrictions = this.getComputedZoneRestrictions(playerId, zone);
    if (restrictions === "ALL") return true;
    
    return Array.isArray(restrictions) ? restrictions.includes(card.gameType) : false;
  }
  
  /**
   * Get play sequence statistics
   * @returns {Object} Play sequence statistics
   */
  getPlaySequenceStats() {
    const playSequence = this.gameState.gameEnv.playSequence;
    
    if (!playSequence || !playSequence.plays) {
      return {
        totalPlays: 0,
        leaderPlays: 0,
        cardPlays: 0,
        myPlays: 0,
        opponentPlays: 0
      };
    }
    
    const plays = playSequence.plays;
    const myId = this.gameState.playerId;
    
    return {
      totalPlays: plays.length,
      leaderPlays: plays.filter(p => p.action === 'PLAY_LEADER').length,
      cardPlays: plays.filter(p => p.action === 'PLAY_CARD').length,
      myPlays: plays.filter(p => p.playerId === myId).length,
      opponentPlays: plays.filter(p => p.playerId !== myId).length
    };
  }
  
  /**
   * Get disabled cards for a player
   * @param {string} playerId - Player ID (defaults to current player)
   * @returns {Array} Array of disabled card objects
   */
  getDisabledCards(playerId = null) {
    const id = playerId || this.gameState.playerId;
    const computedState = this.gameState.gameEnv.computedState;
    
    if (computedState && computedState.disabledCards) {
      return computedState.disabledCards.filter(d => d.playerId === id);
    }
    
    return [];
  }
  
  /**
   * Get victory point modifiers for a player
   * @param {string} playerId - Player ID (defaults to current player)
   * @returns {number} Victory point modifier
   */
  getVictoryPointModifier(playerId = null) {
    const id = playerId || this.gameState.playerId;
    const computedState = this.gameState.gameEnv.computedState;
    
    if (computedState && computedState.victoryPointModifiers) {
      return computedState.victoryPointModifiers[id] || 0;
    }
    
    return 0;
  }
}