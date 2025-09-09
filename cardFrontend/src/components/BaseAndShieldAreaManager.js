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
    this.updateBaseArea('player', baseData, this.playerBaseCards, this.playerShieldCards);
  }

  updateOpponentBase() {
    const baseData = this.gameStateManager.getOpponentBaseAreaCard();
    this.updateBaseArea('opponent', baseData, this.opponentBaseCards, this.opponentShieldCards);
  }

  updateBaseArea(playerType, baseData, cardArray, shieldCardArray) {
    cardArray.forEach(card => card.destroy());
    cardArray.length = 0;
    console.log("data base "+JSON.stringify(baseData))
    if(baseData && baseData.length>0){
      console.log("data base111 "+JSON.stringify(baseData[0]))
      
      // Position base card on top of shield card[0] if it exists
      let x, y;
      if (shieldCardArray.length > 0) {
        // Use first shield card position
        x = shieldCardArray[0].x;
        y = shieldCardArray[0].y;
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
  }

  createBaseCard(cardData, x, y, index) {
    const card = new Card(this.scene, x, y, cardData, {
      scale:0.9,
      gameStateManager: this.gameStateManager,
      usePreview: true
    });
    
    card.setDepth(1100); // Higher depth than shields (1000) to appear on top
    console.log("adsfasdfsda ",JSON.stringify(cardData))
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