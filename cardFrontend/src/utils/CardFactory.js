import Card from '../components/Card.js';
/**
 * CardFactory - Centralized factory for creating cards with context-specific configurations
 * Eliminates duplication across SlotAreaManager, BaseAndShieldAreaManager, CardPreviewManager, etc.
 */
export default class CardFactory {
  
  /**
   * Create a slot card (unit or pilot) with proper zone placement and interaction setup
   * @param {Scene} scene - Phaser scene
   * @param {Object} cardData - Card data
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} options - Creation options
   * @param {string} options.slotName - Slot name (slot1, slot2, etc.)
   * @param {string} options.cardType - Card type ('unit' or 'pilot')
   * @param {string} options.playerType - Player type ('player' or 'opponent')
   * @param {Object} options.gameStateManager - Game state manager
   * @returns {Card} Created slot card
   */
  static createSlotCard(scene, cardData, x, y, options = {}) {
    const {
      slotName,
      cardType = 'unit',
      playerType = 'player',
      gameStateManager,
      fieldCardValue = cardData?.fieldCardValue || null
    } = options;
    
    const card = new Card(scene, x, y, cardData, {
      usePreview: true,
      gameStateManager
    });
    
    // Set up zone placement for slot cards
    this._setupZonePlacement(card, slotName, playerType === 'player');
    
    // Set up depth based on card type
    this._setupSlotDepth(card, cardType);
    
    // Set up interaction
    this._setupInteraction(card, true);
    
    // Set up card type identifier
    card.cardTypeInSlot = cardType;
    return card;
  }
  
  /**
   * Create a base card with zone placement and total labels setup
   * @param {Scene} scene - Phaser scene
   * @param {Object} cardData - Card data
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} options - Creation options
   * @param {Object} options.gameStateManager - Game state manager
   * @param {number} options.scale - Card scale (default: 0.9)
   * @returns {Card} Created base card
   */
  static createBaseCard(scene, cardData, x, y, options = {}) {
    const { gameStateManager, scale = 0.9, fieldCardValue = cardData?.fieldCardValue || null } = options;
    
    const card = new Card(scene, x, y, cardData, {
      scale,
      gameStateManager,
      usePreview: true
    });
    
    // Set up depth for base cards (above shields)
    card.setDepth(1100);
    
    // Set up zone placement for base cards
    this._setupZonePlacement(card, 'base', true);
    
    // Disable interaction for base cards
    this._setupInteraction(card, false);
    
    return card;
  }
  
  /**
   * Create a shield card with rotation and depth setup
   * @param {Scene} scene - Phaser scene
   * @param {Object} cardData - Card data
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} options - Creation options
   * @param {Object} options.gameStateManager - Game state manager
   * @param {number} options.index - Card index for depth calculation
   * @param {number} options.scale - Card scale (default: 0.85)
   * @returns {Card} Created shield card
   */
  static createShieldCard(scene, cardData, x, y, options = {}) {
    const { gameStateManager, index = 0, scale = 0.85 } = options;
    
    const card = new Card(scene, x, y, cardData, {
      scale,
      gameStateManager,
      usePreview: true
    });
    
    // Set rotation for shield cards
    card.rotation = Math.PI / 2;
    
    // Set depth based on index
    card.setDepth(1000 + index);
    
    // Disable interaction for shield cards
    this._setupInteraction(card, false);
    
    return card;
  }
  
  /**
   * Create a preview card with large scale and total labels visibility
   * @param {Scene} scene - Phaser scene
   * @param {Object} cardData - Card data
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} options - Creation options
   * @param {Object} options.gameStateManager - Game state manager
   * @param {number} options.scale - Card scale (default: 3.5)
   * @param {number} options.depth - Z depth (default: 2000)
   * @param {boolean} options.interactive - Interactive state (default: false)
   * @returns {Card} Created preview card
   */
  static createPreviewCard(scene, cardData, x, y, options = {}) {
    const { 
      gameStateManager, 
      scale = 3.5, 
      depth = 2000, 
      interactive = false,
      zone = '',
      fieldCardValue = cardData?.fieldCardValue || null
    } = options;
    
    const card = new Card(scene, x, y, cardData, {
      scale,
      gameStateManager,
      usePreview: false,
      interactive
    });
    
    card.setDepth(depth);

    card.setZoneContext(zone, {
      isInZone: zone !== 'hand',
      isPlayerZone: true
    });
    card.powerOverlay.setTotalLabelsVisibility("hand");

    return card;
  }
  
  /**
   * Create a dialog card with dynamic scaling and total labels configuration
   * @param {Scene} scene - Phaser scene
   * @param {Object} cardData - Card data
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} options - Creation options
   * @param {Object} options.gameStateManager - Game state manager
   * @param {number} options.dialogScale - Dynamic scale for dialog display
   * @param {number} options.totalAP - Total AP for labels (optional, only for slot cards)
   * @param {number} options.totalHP - Total HP for labels (optional, only for slot cards)
   * @param {boolean} options.interactive - Interactive state (default: true)
   * @returns {Card} Created dialog card
   */
  static createDialogCard(scene, cardData, x, y, options = {}) {
    const { gameStateManager, dialogScale, totalAP, totalHP, interactive = true, zone = 'hand', fieldCardValue = cardData?.fieldCardValue || null } = options;
    
    const card = new Card(scene, x, y, cardData, {
      usePreview: true,
      scale: dialogScale,
      interactive,
      showBackground: false,
      handleOutside: true,
      gameStateManager
    });
    
    card.setDepth(1504);

    card.setZoneContext(zone, {
      isInZone: zone !== 'hand',
      isPlayerZone: true
    });

    if (card.setFieldCardValue) {
      const source = zone === 'base' || zone.startsWith('slot') ? 'slot' : 'card';
      card.setFieldCardValue(fieldCardValue, { source });
    }
    
    const shouldShowTotals = totalAP !== undefined && totalHP !== undefined && typeof zone === 'string' && (zone === 'base' || zone.startsWith('slot'));
    if (shouldShowTotals) {
      card.configureTotalLabelsToShow(totalAP, totalHP, { zone });
    }
    
    // ✅ FIX: Update card status (Rested/Active) for dialog cards
    // Extract isRested status from various possible data structures
    const isRested = this._extractRestedStatus(cardData);
    if (card.powerOverlay && card.powerOverlay.updateCardStatus) {
      card.powerOverlay.updateCardStatus(isRested);
      console.log(`[CardFactory] Updated dialog card status: ${isRested ? 'Rested' : 'Active'} for card:`, cardData?.id || cardData?.cardData?.id);
    }
    
    return card;
  }
  
  /**
   * Create a hand card with standard hand configuration
   * @param {Scene} scene - Phaser scene
   * @param {Object} cardData - Card data
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} options - Creation options
   * @param {Object} options.gameStateManager - Game state manager
   * @param {number} options.scale - Card scale (default: 1.1)
   * @param {number} options.depth - Z depth (default: 0)
   * @returns {Card} Created hand card
   */
  static createHandCard(scene, cardData, x, y, options = {}) {
    const { gameStateManager, scale = 1.1, depth = 0} = options;
    
    const card = new Card(scene, x, y, cardData, {
      scale,
      gameStateManager,
      usePreview: true
    });
    
    card.setDepth(depth);

    card.setZoneContext('hand', {
      isInZone: false,
      isPlayerZone: true
    });


    return card;
  }
  
  /**
   * Create an energy card with energy-specific configuration
   * @param {Scene} scene - Phaser scene
   * @param {Object} cardData - Card data
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} options - Creation options
   * @param {Object} options.gameStateManager - Game state manager
   * @param {number} options.scale - Card scale (default: 0.6)
   * @returns {Card} Created energy card
   */
  static createEnergyCard(scene, cardData, x, y, options = {}) {
    const { gameStateManager, scale = 0.6 } = options;
    
    const card = new Card(scene, x, y, cardData, {
      scale,
      gameStateManager,
      usePreview: true
    });
    
    // Disable interaction for energy cards
    this._setupInteraction(card, false);
    
    return card;
  }
  
  // ============ PRIVATE HELPER METHODS ============
  
  /**
   * Set up zone placement properties for a card
   * @param {Card} card - Card to configure
   * @param {string} zoneName - Zone name
   * @param {boolean} isPlayerZone - Whether this is a player zone
   * @private
   */
  static _setupZonePlacement(card, zoneName, isPlayerZone) {
    card.isInZone = true;
    card.setZonePlacement(true, zoneName, isPlayerZone);
    card.zonePlacement = {
      isPlayerZone,
      zoneType: zoneName,
      isPlaced: true
    };
  }
  
  /**
   * Set up depth for slot cards based on type
   * @param {Card} card - Card to configure
   * @param {string} cardType - Card type ('unit' or 'pilot')
   * @private
   */
  static _setupSlotDepth(card, cardType) {
    const depth = cardType === 'pilot' ? 200 : 210;
    card.setDepth(depth);
  }
  
  /**
   * Set up card interaction state
   * @param {Card} card - Card to configure
   * @param {boolean} interactive - Whether card should be interactive
   * @private
   */
  static _setupInteraction(card, interactive) {
    card.setInteractive(interactive);
  }
  
  /**
   * Set up rest state if card data indicates it's rested
   * @param {Card} card - Card to configure
   * @param {Object} cardData - Card data to check for rest state
   * @private
   */
  static _setupRestState(card, cardData) {
    if (cardData.isRested) {
      card.setRested(true);
    }
  }
  
  /**
   * Extract isRested status from various card data structures
   * @param {Object} cardData - Card data in various formats
   * @returns {boolean} isRested status
   * @private
   */
  static _extractRestedStatus(cardData) {
    // Handle various data structure formats
    if (cardData?.isRested !== undefined) {
      return cardData.isRested;
    }
    if (cardData?.cardData?.isRested !== undefined) {
      return cardData.cardData.isRested;
    }
    if (cardData?.fullCardData?.isRested !== undefined) {
      return cardData.fullCardData.isRested;
    }
    
    // Default to false (Active) if no rested status found
    return false;
  }
}
