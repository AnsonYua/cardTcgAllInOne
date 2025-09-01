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
        fieldEffects: {},
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

  setApiManager(apiManager) {
    this.apiManager = apiManager;
    // Set initial game state in API manager
    if (apiManager) {
      apiManager.setGameState(this.gameState);
    }
  }

  updateGameEnv(gameEnv) {
    this.gameState.gameEnv = { ...this.gameState.gameEnv, ...gameEnv };
    
    // Update API manager with new game state for card selection
    if (this.apiManager) {
      this.apiManager.setGameState(this.gameState);
    }
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

  getPlayerLeader(isOpponent = false) {
    const crtPlayer = isOpponent ? this.getOpponent() : this.gameState.playerId;
    const leaderCard = this.gameState.gameEnv.zones[crtPlayer].leader[0];
    console.log("da22ssd",this.gameState.gameEnv.zones[crtPlayer].leader[0])
    const leaderCardData = {
      id: leaderCard.cardId,
      name: leaderCard.cardId,
      type: leaderCard.cardData.cardType,
      cardType: leaderCard.cardData.cardType,
    }
    return leaderCardData;
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
    const currentPlayerId = this.getCurrentPlayerId();
    if(playerId == null) {
      playerId = currentPlayerId;
    }
    
    const player = this.getPlayer(playerId);
    return player ? player.deck.hand : [];
  }

  getPlayerHandDetails(playerId = null) {
    const currentPlayerId = this.getCurrentPlayerId();
    if(playerId == null) {
      playerId = currentPlayerId;
    }
    
    const player = this.getPlayer(playerId);
    return player ? player.deck.hand : [];
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
    const id = playerId;
    // Access fieldEffects from player structure (single source of truth)
    console.log("fieldEffects " ,playerId)
    const player = this.gameState.gameEnv.players[id];
    if (player && player.fieldEffects) {
      return player.fieldEffects;
    }
    return null;
  }

  getZoneRestrictions(playerId = null, zone = null) {
    const fieldEffects = this.getPlayerFieldEffects(playerId);
    console.log("fieldEffects " ,JSON.stringify(fieldEffects))
    
    // Use activeZoneRestrictions if available (computed with preventSummon effects)
    const restrictions = fieldEffects?.activeZoneRestrictions || fieldEffects?.zoneRestrictions;
    
    if (zone) {
      return restrictions?.[zone.toLowerCase()];
    }
    return restrictions;
  }

  getActiveEffects(playerId = null) {
    const fieldEffects = this.getPlayerFieldEffects(playerId);
    return fieldEffects ? fieldEffects.activeEffects : [];
  }

  canPlayCardInZone(card, zone, playerId = null) {
    // Use computed restrictions (includes preventSummon effects)
    const restrictions = this.getComputedZoneRestrictions(playerId, zone);
    console.log("restrictions (with preventSummon effects): " , JSON.stringify(restrictions))
    
    // Handle 'ALL' string case
    if (restrictions === "ALL") return true;
    
    // Handle array with 'ALL' element
    if (Array.isArray(restrictions) && restrictions.includes("ALL")) return true;
    
    // Handle card with 'ALL' gameType
    if (card.cardDetails.gameType === "ALL") return true;
    
    // Check if card's gameType is in the allowed list
    return Array.isArray(restrictions) ? restrictions.includes(card.cardDetails.gameType) : false;
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

  getUnprocessGameEvents(){
    const events = this.gameState.gameEnv.gameEvents || [];
    console.log("events "+JSON.stringify(events))
    const unprocessedEvents = events.filter(event => 
      event.metadata?.requiresAcknowledgment === true && 
      event.metadata?.frontendProcessed === false
    );
    return unprocessedEvents
  }


  processGameEvents() {
    const events = this.gameState.gameEnv.gameEvents || [];
    console.log("events "+JSON.stringify(events))
    const unprocessedEvents = events.filter(event => 
      event.metadata?.requiresAcknowledgment === true && 
      event.metadata?.frontendProcessed === false
    );
    console.log("events filter "+JSON.stringify(unprocessedEvents))
    unprocessedEvents.forEach(event => {
      const handlers = this.eventHandlers.get(event.type) || [];
      console.log('Processing event:', event.type);
      handlers.forEach(handler => handler(event));
    });

    if(unprocessedEvents.length > 0) {
      return true;
    } else {
      return false;
    }
    /*
    if (events.length > 0) {
      this.acknowledgeEvents(this.apiManager);
    }*/
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
        fieldEffects: {},
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
    // For character cards, try to find the card in zones and get currentPower
    if (card.type === 'character') {
      const currentPower = this.getCardCurrentPowerFromZones(card.id, playerId);
      if (currentPower !== null) {
        return currentPower;
      }
    }
    
    return card.power || 0;
  }

  /**
   * Find a card in zones and get its currentPower value
   * @param {string} cardId - Card ID to search for
   * @param {string} playerId - Player ID (defaults to current player)
   * @returns {number|null} Current power or null if not found
   */
  getCardCurrentPowerFromZones(cardId, playerId = null) {
    const id = playerId || this.gameState.playerId;
    const zones = this.gameState.gameEnv.zones?.[id];
    
    if (!zones) {
      return null;
    }
    
    // Search through all zones for the card
    const zoneNames = ['top', 'left', 'right', 'help', 'sp'];
    
    for (const zoneName of zoneNames) {
      const zone = zones[zoneName];
      if (zone && Array.isArray(zone)) {
        for (const zoneCard of zone) {
          // Check if this zone card contains our target card
          if (zoneCard.cardData && zoneCard.cardData.id === cardId) {
            // Return currentPower if available, otherwise fall back to base power
            return zoneCard.currentPower !== undefined ? zoneCard.currentPower : (zoneCard.cardData.power || 0);
          }
          // Also check the card array format (legacy)
          if (zoneCard.card && Array.isArray(zoneCard.card)) {
            const cardUid = zoneCard.card[0];
            // Extract cardId from UID (format: cardId_timestamp_number)
            const extractedCardId = cardUid ? cardUid.split('_')[0] : null;
            if (extractedCardId === cardId) {
              return zoneCard.currentPower !== undefined ? zoneCard.currentPower : null;
            }
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if a card is disabled by effects
   * @param {Object} card - Card object
   * @returns {boolean} Whether card is disabled
   */
  isCardDisabled(card) {
    // Check if current player has disabled cards in their fieldEffects
    const player = this.getPlayer();
    
    if (player && player.fieldEffects && player.fieldEffects.disabledCards) {
      return player.fieldEffects.disabledCards.includes(card.id);
    }
    
    return false;
  }
  
  /**
   * Get active zone restrictions (computed with preventSummon effects)
   * @param {string} playerId - Player ID (defaults to current player)
   * @param {string} zone - Specific zone to check
   * @returns {string|Array} Zone restrictions
   */
  getComputedZoneRestrictions(playerId = null, zone = null) {
    const id = playerId || this.gameState.playerId;
    const player = this.gameState.gameEnv.players?.[id];
    if (player && player.fieldEffects) {
      // Prioritize activeZoneRestrictions (computed with preventSummon effects)
      const restrictions = player.fieldEffects.activeZoneRestrictions || player.fieldEffects.zoneRestrictions;
      
      if (restrictions) {
        if (zone) {
          return restrictions[zone.toLowerCase()];
        }
        return restrictions;
      }
    }
    
    // Fallback to original field effects method
    return this.getZoneRestrictions(playerId, zone);
  }
  
  /**
   * Check if card can be played in zone (using computed restrictions with preventSummon effects)
   * @param {Object} card - Card object
   * @param {string} zone - Zone name
   * @param {string} playerId - Player ID (defaults to current player)
   * @returns {boolean} Whether card can be played
   */
  canPlayCardInZoneComputed(card, zone, playerId = null) {
    const restrictions = this.getComputedZoneRestrictions(playerId, zone);
    console.log("computed restrictions (with preventSummon effects): " , JSON.stringify(restrictions))
    
    // Handle 'ALL' string case
    if (restrictions === "ALL") return true;
    
    // Handle array cases
    if (Array.isArray(restrictions)) {
      // Check for 'ALL' in array
      if (restrictions.includes("ALL")) {
        return true;
      }
      // Check if card's gameType is allowed
      return restrictions.includes(card.cardDetails.gameType);
    }
    
    // Handle card with 'ALL' gameType
    if (card.cardDetails.gameType === "ALL") return true;
    
    return false;
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
    const player = this.gameState.gameEnv.players?.[id];
    
    if (player && player.fieldEffects && player.fieldEffects.disabledCards) {
      return player.fieldEffects.disabledCards;
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
    const player = this.gameState.gameEnv.players?.[id];
    
    if (player && player.fieldEffects && player.fieldEffects.victoryPointModifiers !== undefined) {
      return player.fieldEffects.victoryPointModifiers || 0;
    }
    
    return 0;
  }

  // NEW: Scenario Testing Methods
  
  /**
   * Load a complete test scenario into the game state
   * @param {string} scenarioId - Scenario identifier
   * @param {Object} FrontendScenarioLoader - Scenario loader class
   * @returns {Promise<void>}
   */
  async setCompleteGameEnvironment(scenarioId, FrontendScenarioLoader) {
    try {
      const scenario = await FrontendScenarioLoader.loadCompleteScenario(scenarioId);
      
      // Replace entire game state with scenario data
      this.gameState.gameEnv = scenario.gameEnv;
      this.currentScenario = scenario;
      
      // Set default player IDs if not set
      if (!this.gameState.playerId) {
        this.gameState.playerId = scenario.gameEnv.playerId_1;
      }
      
      // Stop polling when using test scenarios
      this.stopPolling();
      
      // Emit event for scene updates
      this.emitStateChange('scenario-loaded', {
        scenarioId: scenarioId,
        scenario: scenario
      });
      
      console.log(`🎯 Loaded complete scenario: ${scenarioId}`);
      console.log(`📊 Validation points: ${Object.keys(scenario.validationPoints || {}).length}`);
      
    } catch (error) {
      console.error(`Failed to load scenario ${scenarioId}:`, error);
      throw error;
    }
  }
  
  /**
   * Validate current scenario against expected results
   * @returns {Object|null} Validation results or null if no scenario loaded
   */
  validateCompleteScenario() {
    if (!this.currentScenario || !this.currentScenario.validationPoints) {
      console.warn('No validation points defined for current scenario');
      return null;
    }
    
    const validation = { 
      passed: true, 
      scenarioId: this.currentScenario.id,
      results: {} 
    };
    
    for (const [testId, testData] of Object.entries(this.currentScenario.validationPoints)) {
      validation.results[testId] = {
        description: testData.description,
        passed: true,
        cards: {}
      };
      
      for (const [cardId, expected] of Object.entries(testData.expected)) {
        const actualPower = this.getCardFinalPower(cardId);
        const passed = actualPower === expected.finalPower;
        
        validation.results[testId].cards[cardId] = {
          expected: expected.finalPower,
          actual: actualPower,
          boost: expected.boost || 0,
          passed: passed
        };
        
        if (!passed) {
          validation.passed = false;
          validation.results[testId].passed = false;
        }
      }
    }
    
    return validation;
  }
  
  /**
   * Get final power for a card (checks zone cards first, then original)
   * @param {string} cardId - Card ID to check
   * @returns {number} Final power value
   */
  getCardFinalPower(cardId) {
    // Check zone cards first for currentPower
    const playerIds = [this.gameState.playerId];
    if (this.gameState.gameEnv.players) {
      playerIds.push(...Object.keys(this.gameState.gameEnv.players).filter(id => id !== this.gameState.playerId));
    }
    
    for (const playerId of playerIds) {
      const currentPower = this.getCardCurrentPowerFromZones(cardId, playerId);
      if (currentPower !== null) {
        return currentPower;
      }
    }
    
    // Fallback to finding original power in field
    return this.getCardOriginalPower(cardId);
  }
  
  /**
   * Get original power for a card from the field
   * @param {string} cardId - Card ID to check
   * @returns {number} Original power value
   */
  getCardOriginalPower(cardId) {
    const zones = this.gameState.gameEnv.zones;
    
    if (!zones) return 0;
    
    // Search all players and zones for the card
    for (const [playerId, playerZones] of Object.entries(zones)) {
      for (const [zoneName, cards] of Object.entries(playerZones)) {
        if (Array.isArray(cards)) {
          for (const card of cards) {
            if (card.id === cardId) {
              return card.power || 0;
            }
          }
        } else if (cards && cards.id === cardId) {
          return cards.power || 0;
        }
      }
    }
    
    return 0;
  }
  
  /**
   * Export current game state as a scenario
   * @param {string} name - Scenario name
   * @param {string} description - Scenario description
   * @returns {Object} Exportable scenario object
   */
  exportCurrentState(name, description) {
    const scenarioId = `exported_${Date.now()}`;
    
    const scenario = {
      id: scenarioId,
      name: name || `Exported Scenario ${new Date().toISOString()}`,
      description: description || "Exported from frontend demo",
      gameEnv: JSON.parse(JSON.stringify(this.gameState.gameEnv)), // Deep copy
      validationPoints: {
        custom_validation: {
          description: "Custom validation point - define your expected results",
          expected: {}
        }
      }
    };
    
    return scenario;
  }
  
  /**
   * Get scenario validation statistics
   * @returns {Object} Validation statistics
   */
  getScenarioValidationStats() {
    if (!this.currentScenario) {
      return { hasScenario: false };
    }
    
    const validation = this.validateCompleteScenario();
    
    if (!validation) {
      return { hasScenario: true, hasValidation: false };
    }
    
    let totalTests = 0;
    let totalCards = 0;
    let passedTests = 0;
    let passedCards = 0;
    
    for (const [testId, testResult] of Object.entries(validation.results)) {
      totalTests++;
      if (testResult.passed) passedTests++;
      
      for (const [cardId, cardResult] of Object.entries(testResult.cards)) {
        totalCards++;
        if (cardResult.passed) passedCards++;
      }
    }
    
    return {
      hasScenario: true,
      hasValidation: true,
      scenarioId: this.currentScenario.id,
      scenarioName: this.currentScenario.name,
      totalTests: totalTests,
      passedTests: passedTests,
      totalCards: totalCards,
      passedCards: passedCards,
      overallPassed: validation.passed,
      successRate: totalCards > 0 ? (passedCards / totalCards) * 100 : 0
    };
  }
  
  /**
   * Emit state change event to registered listeners
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  emitStateChange(eventType, data) {
    if (this.eventHandlers.has(eventType)) {
      const handlers = this.eventHandlers.get(eventType);
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${eventType} handler:`, error);
        }
      });
    }
  }
  
  /**
   * Clear current scenario and return to normal game state
   */
  clearScenario() {
    this.currentScenario = null;
    this.emitStateChange('scenario-cleared', {});
    console.log('📋 Cleared current scenario');
  }
  
  /**
   * Get current scenario information
   * @returns {Object|null} Current scenario or null
   */
  getCurrentScenario() {
    return this.currentScenario;
  }
}