/**
 * CardInteractionManager - Centralized card interaction state management
 * 
 * Handles all card interaction states, turn-based activation/deactivation,
 * and provides a unified interface for managing card interactivity across
 * different zones and game states.
 */
export default class CardInteractionManager {
  constructor(scene, gameStateManager) {
    this.scene = scene;
    this.gameStateManager = gameStateManager;
    
    // Configuration for interaction states
    this.config = {
      // Log interaction state changes for debugging
      enableLogging: true,
      
      // Default interaction states
      defaultActiveState: true,
      
      // Zone-specific interaction rules
      zoneRules: {
        hand: { turnBased: true },
        slots: { turnBased: true },
        base: { turnBased: true },
        shield: { turnBased: true },
        energy: { turnBased: true }
      }
    };
    
    // Statistics for monitoring
    this.stats = {
      lastUpdateTime: null,
      handCardsUpdated: 0,
      zoneCardsUpdated: 0,
      totalUpdates: 0
    };
  }

  /**
   * Main method to update all card interaction states based on current turn
   * Sets card.active = true when it's the player's turn, false during opponent's turn
   */
  updateAllCardInteractionStates() {
    const isCurrentPlayer = this.gameStateManager.isCurrentPlayer();
    const startTime = Date.now();
    
    this.log(`Updating all card interaction states - isCurrentPlayer: ${isCurrentPlayer}`);
    
    // Reset statistics
    this.stats.handCardsUpdated = 0;
    this.stats.zoneCardsUpdated = 0;
    
    // Update different card areas
    this.updateHandCardStates(isCurrentPlayer);
    this.updateZoneCardStates(isCurrentPlayer);
    
    // Update statistics
    this.stats.lastUpdateTime = Date.now();
    this.stats.totalUpdates++;
    
    const duration = Date.now() - startTime;
    this.log(`Card interaction states updated: ${this.stats.handCardsUpdated} hand cards, ${this.stats.zoneCardsUpdated} zone cards (${duration}ms)`);
  }

  /**
   * Update interaction states for cards in player's hand
   * @param {boolean} isCurrentPlayer - Whether it's currently the player's turn
   */
  updateHandCardStates(isCurrentPlayer) {
    if (!this.scene.playerHand || !Array.isArray(this.scene.playerHand)) {
      this.log('No player hand found or invalid hand structure');
      return;
    }

    this.scene.playerHand.forEach((card, index) => {
      if (card && this.isValidCard(card)) {
        const previousState = card.active;
        card.active = isCurrentPlayer;
        
        if (this.config.enableLogging && previousState !== card.active) {
          this.log(`Hand card [${index}] ${card.cardData?.id || 'unknown'} active: ${previousState} → ${card.active}`);
        }
        
        this.stats.handCardsUpdated++;
      }
    });
  }

  /**
   * Update interaction states for cards in all zones (slots, base, shield, energy areas)
   * @param {boolean} isCurrentPlayer - Whether it's currently the player's turn
   */
  updateZoneCardStates(isCurrentPlayer) {
    // Update slot area cards
    this.updateSlotAreaCards(isCurrentPlayer);
    
    // Update base and shield area cards
    this.updateBaseAndShieldCards(isCurrentPlayer);
    
    // Update energy area cards
    this.updateEnergyAreaCards(isCurrentPlayer);
    
    // Update any additional zone cards
    this.updateAdditionalZoneCards(isCurrentPlayer);
  }

  /**
   * Update slot area cards (units and pilots)
   * @param {boolean} isCurrentPlayer - Whether it's currently the player's turn
   */
  updateSlotAreaCards(isCurrentPlayer) {
    if (!this.scene.slotAreaManager?.playerSlotCards) {
      this.log('No slot area manager or player slot cards found');
      return;
    }

    Object.entries(this.scene.slotAreaManager.playerSlotCards).forEach(([slotName, slot]) => {
      // Update unit card in slot
      if (slot.unit && this.isValidCard(slot.unit)) {
        const previousState = slot.unit.active;
        slot.unit.active = isCurrentPlayer;
        
        if (this.config.enableLogging && previousState !== slot.unit.active) {
          this.log(`${slotName} unit card active: ${previousState} → ${slot.unit.active}`);
        }
        
        this.stats.zoneCardsUpdated++;
      }
      
      // Update pilot card in slot
      if (slot.pilot && this.isValidCard(slot.pilot)) {
        const previousState = slot.pilot.active;
        slot.pilot.active = isCurrentPlayer;
        
        if (this.config.enableLogging && previousState !== slot.pilot.active) {
          this.log(`${slotName} pilot card active: ${previousState} → ${slot.pilot.active}`);
        }
        
        this.stats.zoneCardsUpdated++;
      }
    });
  }

  /**
   * Update base and shield area cards
   * @param {boolean} isCurrentPlayer - Whether it's currently the player's turn
   */
  updateBaseAndShieldCards(isCurrentPlayer) {
    if (!this.scene.baseAndShieldManager) {
      return;
    }

    // Update player base cards
    if (this.scene.baseAndShieldManager.playerBaseCards) {
      this.scene.baseAndShieldManager.playerBaseCards.forEach((card, index) => {
        if (card && this.isValidCard(card)) {
          const previousState = card.active;
          card.active = isCurrentPlayer;
          
          if (this.config.enableLogging && previousState !== card.active) {
            this.log(`Base card [${index}] active: ${previousState} → ${card.active}`);
          }
          
          this.stats.zoneCardsUpdated++;
        }
      });
    }

    // Update player shield cards
    if (this.scene.baseAndShieldManager.playerShieldCards) {
      this.scene.baseAndShieldManager.playerShieldCards.forEach((card, index) => {
        if (card && this.isValidCard(card)) {
          const previousState = card.active;
          card.active = isCurrentPlayer;
          
          if (this.config.enableLogging && previousState !== card.active) {
            this.log(`Shield card [${index}] active: ${previousState} → ${card.active}`);
          }
          
          this.stats.zoneCardsUpdated++;
        }
      });
    }
  }

  /**
   * Update energy area cards
   * @param {boolean} isCurrentPlayer - Whether it's currently the player's turn
   */
  updateEnergyAreaCards(isCurrentPlayer) {
    if (!this.scene.energyAreaManager?.playerEnergyCards) {
      return;
    }

    this.scene.energyAreaManager.playerEnergyCards.forEach((card, index) => {
      if (card && this.isValidCard(card)) {
        const previousState = card.active;
        card.active = isCurrentPlayer;
        
        if (this.config.enableLogging && previousState !== card.active) {
          this.log(`Energy card [${index}] active: ${previousState} → ${card.active}`);
        }
        
        this.stats.zoneCardsUpdated++;
      }
    });
  }

  /**
   * Update additional zone cards that might be managed elsewhere
   * @param {boolean} isCurrentPlayer - Whether it's currently the player's turn
   */
  updateAdditionalZoneCards(isCurrentPlayer) {
    // Update any cards in player zones managed by ZoneManager
    if (this.scene.playerZones) {
      Object.entries(this.scene.playerZones).forEach(([zoneName, zone]) => {
        if (zone && zone.card && this.isValidCard(zone.card)) {
          const previousState = zone.card.active;
          zone.card.active = isCurrentPlayer;
          
          if (this.config.enableLogging && previousState !== zone.card.active) {
            this.log(`${zoneName} zone card active: ${previousState} → ${zone.card.active}`);
          }
          
          this.stats.zoneCardsUpdated++;
        }
      });
    }
  }

  /**
   * Update interaction state for a specific card
   * @param {Object} card - Card object to update
   * @param {boolean} active - New active state
   * @param {string} context - Context for logging (optional)
   */
  updateCardState(card, active, context = '') {
    if (!this.isValidCard(card)) {
      this.log(`Invalid card provided for state update${context ? ` (${context})` : ''}`);
      return false;
    }

    const previousState = card.active;
    card.active = active;
    
    if (this.config.enableLogging && previousState !== card.active) {
      this.log(`Card ${card.cardData?.id || 'unknown'}${context ? ` (${context})` : ''} active: ${previousState} → ${card.active}`);
    }
    
    return true;
  }

  /**
   * Batch update multiple cards with the same state
   * @param {Array} cards - Array of card objects
   * @param {boolean} active - New active state
   * @param {string} context - Context for logging (optional)
   */
  batchUpdateCards(cards, active, context = '') {
    if (!Array.isArray(cards)) {
      this.log(`Invalid cards array provided for batch update${context ? ` (${context})` : ''}`);
      return 0;
    }

    let updatedCount = 0;
    cards.forEach((card, index) => {
      if (this.updateCardState(card, active, `${context}[${index}]`)) {
        updatedCount++;
      }
    });

    this.log(`Batch updated ${updatedCount}/${cards.length} cards${context ? ` (${context})` : ''}`);
    return updatedCount;
  }

  /**
   * Get interaction statistics
   * @returns {Object} Current interaction statistics
   */
  getStats() {
    return {
      ...this.stats,
      isCurrentPlayer: this.gameStateManager.isCurrentPlayer(),
      timestamp: Date.now()
    };
  }

  /**
   * Validate if an object is a valid card for interaction management
   * @param {Object} card - Card object to validate
   * @returns {boolean} Whether the card is valid
   */
  isValidCard(card) {
    return card && 
           typeof card === 'object' && 
           card.hasOwnProperty('active');
  }

  /**
   * Update configuration settings
   * @param {Object} newConfig - Configuration updates
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.log('Configuration updated', newConfig);
  }

  /**
   * Enable or disable interaction state logging
   * @param {boolean} enabled - Whether to enable logging
   */
  setLogging(enabled) {
    this.config.enableLogging = enabled;
    this.log(`Interaction logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Reset all interaction statistics
   */
  resetStats() {
    this.stats = {
      lastUpdateTime: null,
      handCardsUpdated: 0,
      zoneCardsUpdated: 0,
      totalUpdates: 0
    };
    this.log('Statistics reset');
  }

  /**
   * Log messages with consistent formatting
   * @param {string} message - Log message
   * @param {*} data - Additional data to log (optional)
   */
  log(message, data = null) {
    if (this.config.enableLogging) {
      const prefix = '[CardInteractionManager]';
      if (data) {
        console.log(`${prefix} ${message}`, data);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

  /**
   * Cleanup when manager is no longer needed
   */
  destroy() {
    this.scene = null;
    this.gameStateManager = null;
    this.resetStats();
    this.log('CardInteractionManager destroyed');
  }
}