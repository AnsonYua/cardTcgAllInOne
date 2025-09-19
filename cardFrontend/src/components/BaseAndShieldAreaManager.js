import Card from './Card.js';

export default class BaseAndShieldAreaManager {
  constructor(scene, gameStateManager) {
    this.scene = scene;
    this.gameStateManager = gameStateManager;
    
    // Shield area cards
    this.playerShieldCards = [];
    this.opponentShieldCards = [];
    
    // Base area cards
    this.playerBaseCards = [];
    this.opponentBaseCards = [];
  }

  // ============ SHIELD AREA MANAGEMENT ============

  updateShieldAreas() {
    this.updatePlayerShields();
    this.updateOpponentShields();
  }

  updatePlayerShields() {
    const shieldData = this.gameStateManager.getMyShieldAreaCard();
    const zones = this.scene.playerZones;
    this.updateShieldArea('player', shieldData, zones.leaderDeck, this.playerShieldCards, 50);
  }

  updateOpponentShields() {
    const shieldData = this.gameStateManager.getOpponentShieldAreaCard();
    const zones = this.scene.opponentZones;
    this.updateShieldArea('opponent', shieldData, zones.leaderDeck, this.opponentShieldCards, -50);
  }

  updateShieldArea(playerType, shieldData, deckZone, cardArray, offsetY) {
    if (shieldData.length !== cardArray.length) {
      // Clear existing cards
      cardArray.forEach(card => card.destroy());
      cardArray.length = 0;

      // Create new cards
      const baseY = deckZone.y + offsetY;
      const yDirection = playerType === 'opponent' ? 1 : -1;
      
      shieldData.forEach((cardData, i) => {
        console.log(`${playerType} shield card information:`, JSON.stringify(cardData));
        
        const card = this.createShieldCard(cardData, deckZone.x, baseY- yDirection*100 + (20 * i * yDirection), i);
        cardArray.push(card);
      });
    }
    cardArray.forEach(card => card.active = false);
  }

  createShieldCard(cardData, x, y, index) {
    const card = new Card(this.scene, x, y, cardData, {
      scale: 0.85,
      gameStateManager: this.gameStateManager,
      usePreview: true
    });
    
    card.rotation = Math.PI / 2;
    card.setDepth(1000 + index);
    
    
    return card;
  }

  // ============ BASE AREA MANAGEMENT ============

  updateBaseAreas() {
    this.updatePlayerBase();
    this.updateOpponentBase();
  }

  updatePlayerBase() {
    const baseData = this.gameStateManager.getMyBaseAreaCard();
    this.updateBaseArea('player', baseData, this.playerBaseCards, this.playerShieldCards);
  }

  updateOpponentBase() {
    const baseData = this.gameStateManager.getOpponentBaseAreaCard();
    this.updateBaseArea('opponent', baseData, this.opponentBaseCards, this.opponentShieldCards);
  }

  updateBaseArea(playerType, baseData, cardArray, shieldCardArray) {
    // Check if we need to update existing base card or create new one
    if (baseData && baseData.length > 0 && cardArray.length > 0) {
      // Update existing base card
      const existingCard = cardArray[0];
      const newCardData = baseData[0];
      
      console.log("Updating existing base card:", JSON.stringify(newCardData));
      this.updateExistingBaseCard(existingCard, newCardData);
      return;
    }
    
    // Create new base card or remove existing ones
    cardArray.forEach(card => card.destroy());
    cardArray.length = 0;
    console.log("data base "+JSON.stringify(baseData))
    if(baseData && baseData.length>0){
      console.log("data base111 "+JSON.stringify(baseData[0]))
      
      // Position base card on top of shield card[0] if it exists
      let x, y;
      if (shieldCardArray.length > 0) {
        // Use first shield card position
        x = shieldCardArray[shieldCardArray.length-1].x;
        y = shieldCardArray[shieldCardArray.length-1].y;
        if(playerType ==='player'){
          y = y - 80
        }else{
          y = y + 80
        }
      } else {
        // Fallback to deck position if no shield cards
        const deckZone = playerType === 'player' ? this.scene.playerZones.leaderDeck : this.scene.opponentZones.leaderDeck;
        x = deckZone.x;
        y = deckZone.y;
      }
      
      const card = this.createBaseCard(baseData[0], x, y, 0);
      cardArray.push(card);
    }
    cardArray.forEach(card => card.active = false);
  }

  createBaseCard(cardData, x, y, index) {
    const card = new Card(this.scene, x, y, cardData, {
      scale:0.9,
      gameStateManager: this.gameStateManager,
      usePreview: true
    });
    
    card.setDepth(1100); // Higher depth than shields (1000) to appear on top
    console.log("adsfasdfsda ",JSON.stringify(cardData))
    
    // Set zone placement for base cards to enable total labels
    card.setZonePlacement(true, 'base', true); // inZone=true, zoneType='base', isPlayerZone=true
    card.zonePlacement = {
      isPlayerZone: true,
      zoneType: 'base',
      isPlaced: true
    };
    
    // Add hover preview functionality
    card.on('pointerover', () => {
      if (this.scene.showCardPreview) {
        this.scene.showCardPreview(cardData);
      }
    });
    
    card.on('pointerout', () => {
      if (this.scene.hideCardPreview) {
        this.scene.hideCardPreview();
      }
    });
    
    // Update total labels for base cards
    this.updateBaseCardTotalLabels(card);
    
    return card;
  }

  /**
   * Update existing base card with new data (similar to SlotAreaManager.updateExistingSlotCard)
   * @param {Card} card - Existing base card to update
   * @param {Object} cardData - New card data
   */
  updateExistingBaseCard(card, cardData) {
    if (!card || !cardData) {
      console.warn('[BaseAndShieldAreaManager] updateExistingBaseCard called with invalid parameters');
      return;
    }
    
    // Calculate previous total AP/HP values including modifications
    const previousTotalAP = this.calculateBaseTotalAP(card.fullCardData);
    const previousTotalHP = this.calculateBaseTotalHP(card.fullCardData);
    
    // Update the card's full data with new information
    card.fullCardData = { ...card.fullCardData, ...cardData };
    
    // Also update the nested cardData if it exists
    if (card.cardData && cardData.cardData) {
      card.cardData = { ...card.cardData, ...cardData.cardData };
    }
    
    // Calculate new total AP/HP values including modifications
    const newTotalAP = this.calculateBaseTotalAP(card.fullCardData);
    const newTotalHP = this.calculateBaseTotalHP(card.fullCardData);
    
    const statsChanged = (previousTotalAP !== newTotalAP) || (previousTotalHP !== newTotalHP);
    
    if (statsChanged) {
      console.log(`[BaseAndShieldAreaManager] Total stats changed for base card ${card.cardData?.id}: Total AP ${previousTotalAP} → ${newTotalAP}, Total HP ${previousTotalHP} → ${newTotalHP}`);
      
      // Update power overlay if the card has one
      if (card.powerOverlay && card.updatePowerOverlay) {
        try {
          card.updatePowerOverlay();
          console.log(`[BaseAndShieldAreaManager] Power overlay updated for base card ${card.cardData?.id}`);
        } catch (error) {
          console.error(`[BaseAndShieldAreaManager] Failed to update power overlay for base card ${card.cardData?.id}:`, error);
        }
      }
      
      // Update total labels with new calculated values
      this.updateBaseCardTotalLabels(card);
    }
  }

  /**
   * Calculate total AP for base card including modifications
   * @param {Object} fullCardData - The full card data object
   * @returns {number} Total AP value including modifications
   */
  calculateBaseTotalAP(fullCardData) {
    if (!fullCardData) return 0;
    
    const cardData = fullCardData.cardData || fullCardData;
    
    if (fullCardData.currentAP != null) {
      // Use currentAP as base and add modifications
      const baseAP = fullCardData.currentAP || 0;
      const modifyAP = fullCardData.modifyAP || 0;
      return baseAP + modifyAP;
    } else {
      // Use original AP from cardData and add modifications
      const baseAP = cardData.ap || 0;
      const modifyAP = fullCardData.modifyAP || 0;
      return baseAP + modifyAP;
    }
  }

  /**
   * Calculate total HP for base card including modifications
   * @param {Object} fullCardData - The full card data object
   * @returns {number} Total HP value including modifications
   */
  calculateBaseTotalHP(fullCardData) {
    if (!fullCardData) return 0;
    
    const cardData = fullCardData.cardData || fullCardData;
    
    if (fullCardData.currentHP != null) {
      // Use currentHP as base and add modifications
      const baseHP = fullCardData.currentHP || 0;
      const modifyHP = fullCardData.modifyHP || 0;
      return baseHP + modifyHP;
    } else {
      // Use original HP from cardData and add modifications
      const baseHP = cardData.hp || 0;
      const modifyHP = fullCardData.modifyHP || 0;
      return baseHP + modifyHP;
    }
  }

  /**
   * Update total AP and HP labels for base cards
   * Base cards should show total labels since they are in the 'base' zone
   * @param {Card} card - Base card to update
   */
  updateBaseCardTotalLabels(card) {
    if (!card || !card.fullCardData) {
      console.warn('[BaseAndShieldAreaManager] updateBaseCardTotalLabels called with invalid card');
      return;
    }
    
    // Calculate total AP and HP for base card using the same methods as update logic
    const totalAP = this.calculateBaseTotalAP(card.fullCardData);
    const totalHP = this.calculateBaseTotalHP(card.fullCardData);
    
    console.log(`[BaseAndShieldAreaManager] Updating base card total labels: AP=${totalAP}, HP=${totalHP} for card:`, card.cardData?.id);
    
    // Update total labels using the Card's updateTotalLabels method
    if (card.updateTotalLabels) {
      card.updateTotalLabels(totalAP, totalHP);
    } else {
      console.warn('[BaseAndShieldAreaManager] Card does not have updateTotalLabels method:', card.cardData?.id);
    }
    
    // Ensure total labels are visible for base cards (they should be in 'base' zone)
    if (card.powerOverlay && card.powerOverlay.setTotalLabelsVisibility) {
      card.powerOverlay.setTotalLabelsVisibility('base');
      console.log(`[BaseAndShieldAreaManager] Set total labels visibility for base card:`, card.cardData?.id);
    }
  }

  /**
   * Force update all base card total labels (useful for fixing sync issues)
   * Similar to SlotAreaManager.updateAllSlotTotalLabels but for base cards
   * @param {string} playerType - 'player', 'opponent', or 'all' for both
   */
  updateAllBaseCardTotalLabels(playerType = 'all') {
    console.log(`[BaseAndShieldAreaManager] Force updating all base card total labels for: ${playerType}`);
    
    const updateCards = (cards, type) => {
      cards.forEach(card => {
        if (card && card.fullCardData) {
          this.updateBaseCardTotalLabels(card);
          console.log(`[BaseAndShieldAreaManager] Force updated ${type} base card total labels:`, card.cardData?.id);
        }
      });
    };
    
    if (playerType === 'all' || playerType === 'player') {
      updateCards(this.playerBaseCards, 'player');
    }
    
    if (playerType === 'all' || playerType === 'opponent') {
      updateCards(this.opponentBaseCards, 'opponent');
    }
  }

  // ============ COMBINED UPDATE METHOD ============

  updateAll() {
    this.updateShieldAreas();
    this.updateBaseAreas();
  }

  // ============ CLEANUP ============

  destroy() {
    // Clean up all cards
    [...this.playerShieldCards, ...this.opponentShieldCards, 
     ...this.playerBaseCards, ...this.opponentBaseCards].forEach(card => {
      if (card && card.destroy) {
        card.destroy();
      }
    });
    
    // Clear arrays
    this.playerShieldCards.length = 0;
    this.opponentShieldCards.length = 0;
    this.playerBaseCards.length = 0;
    this.opponentBaseCards.length = 0;
  }

  // ============ UTILITY METHODS ============

  getShieldCardCount(isOpponent = false) {
    return isOpponent ? this.opponentShieldCards.length : this.playerShieldCards.length;
  }

  getBaseCardCount(isOpponent = false) {
    return isOpponent ? this.opponentBaseCards.length : this.playerBaseCards.length;
  }

  getAllCards() {
    return [
      ...this.playerShieldCards,
      ...this.opponentShieldCards,
      ...this.playerBaseCards,
      ...this.opponentBaseCards
    ];
  }
}