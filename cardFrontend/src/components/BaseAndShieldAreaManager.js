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
      const yDirection = playerType === 'opponent' ? -1 : 1;
      
      shieldData.forEach((cardData, i) => {
        console.log(`${playerType} shield card information:`, JSON.stringify(cardData));
        
        const card = this.createShieldCard(cardData, deckZone.x, baseY + (20 * i * yDirection), i);
        cardArray.push(card);
      });
    }
  }

  createShieldCard(cardData, x, y, index) {
    const card = new Card(this.scene, x, y, cardData, {
      interactive: true,
      draggable: false,
      scale: 0.85,
      gameStateManager: this.gameStateManager,
      usePreview: true
    });
    
    card.rotation = Math.PI / 2;
    card.setDepth(1000 - index);
    
    return card;
  }

  // ============ BASE AREA MANAGEMENT ============

  updateBaseAreas() {
    this.updatePlayerBase();
    this.updateOpponentBase();
  }

  updatePlayerBase() {
    const baseData = this.gameStateManager.getMyBaseAreaCard();
    const zones = this.scene.playerZones;
    this.updateBaseArea('player', baseData, zones.base, this.playerBaseCards);
  }

  updateOpponentBase() {
    const baseData = this.gameStateManager.getOpponentBaseAreaCard();
    const zones = this.scene.opponentZones;
    this.updateBaseArea('opponent', baseData, zones.base, this.opponentBaseCards);
  }

  updateBaseArea(playerType, baseData, baseZone, cardArray) {
    if (baseData.length !== cardArray.length) {
      // Clear existing cards
      cardArray.forEach(card => card.destroy());
      cardArray.length = 0;

      // Create new cards
      baseData.forEach((cardData, i) => {
        console.log(`${playerType} base card information:`, JSON.stringify(cardData));
        
        const card = this.createBaseCard(cardData, baseZone.x, baseZone.y + (15 * i), i);
        cardArray.push(card);
      });
    }
  }

  createBaseCard(cardData, x, y, index) {
    const card = new Card(this.scene, x, y, cardData, {
      interactive: true,
      draggable: false,
      scale: 0.8,
      gameStateManager: this.gameStateManager,
      usePreview: true
    });
    
    card.setDepth(900 - index); // Lower depth than shields
    
    return card;
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