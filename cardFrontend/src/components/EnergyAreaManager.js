import Card from './Card.js';

export default class EnergyAreaManager {
  constructor(scene, gameStateManager) {
    this.scene = scene;
    this.gameStateManager = gameStateManager;
    
    // Energy area cards for both players
    this.playerEnergyCards = [];
    this.opponentEnergyCards = [];
  }

  // ============ ENERGY AREA MANAGEMENT ============

  updateEnergyAreas() {
    this.updatePlayerEnergy();
    this.updateOpponentEnergy();
  }

  updatePlayerEnergy() {
    const energyData = this.gameStateManager.getMyEnergyAreaCard();
    this.updateEnergyArea('player', energyData, this.playerEnergyCards);
  }

  updateOpponentEnergy() {
    const energyData = this.gameStateManager.getOpponentEnergyAreaCard();
    this.updateEnergyArea('opponent', energyData, this.opponentEnergyCards);
  }

  updateEnergyArea(playerType, energyData, cardArray) {
    // Clear existing cards
    cardArray.forEach(card => card.destroy());
    cardArray.length = 0;
    
    console.log(`${playerType} energy data:`, JSON.stringify(energyData));
    
    if (energyData && energyData.length > 0) {
      energyData.forEach((energyCard, i) => {
        // Get row2 slot position based on energy card index
        // Player: left to right (normal), Opponent: also left to right (align under slot 1)
        const slotIndex = i;
        const slotPosition = this.getRow2SlotPosition(playerType, slotIndex);
        
        if (slotPosition) {
          const card = this.createEnergyCard(playerType, energyCard, slotPosition.x, slotPosition.y + 5, i);
          cardArray.push(card);
        }
      });
    }
    cardArray.forEach(card => card.active = false);

  }

  getRow2SlotPosition(playerType, slotIndex) {
    const zones = playerType === 'player' ? this.scene.playerZones : this.scene.opponentZones;
    
    // Access row2 slots (should be an array of 10 slots)
    if (zones.row2 && Array.isArray(zones.row2) && zones.row2[slotIndex]) {
      return {
        x: zones.row2[slotIndex].x,
        y: zones.row2[slotIndex].y
      };
    }
    
    console.warn(`Row2 slot ${slotIndex} not found for ${playerType}`);
    return null;
  }

  createEnergyCard(playerType, energyCard, x, y, index) {
    const card = new Card(this.scene, x, y, energyCard, {
      scale: 0.72, // Smaller scale for energy cards in row2
      gameStateManager: this.gameStateManager,
      usePreview: true
    });

    // Set depth to appear above zones but below other cards
    card.setDepth(500 + index);

    card.setZoneContext('energy', {
      isInZone: true,
      isPlayerZone: playerType === 'player'
    });

    // Add visual indicator for energy card state
    if (energyCard.isRested) {
      card.rotation = Math.PI / 2; // Rotate rested energy cards
    }
    
   
    return card;
  }

  // ============ UTILITY METHODS ============

  getEnergyCardCount(isOpponent = false) {
    return isOpponent ? this.opponentEnergyCards.length : this.playerEnergyCards.length;
  }

  getAllEnergyCards() {
    return [
      ...this.playerEnergyCards,
      ...this.opponentEnergyCards
    ];
  }

  // ============ CLEANUP ============

  destroy() {
    // Clean up all energy cards
    [...this.playerEnergyCards, ...this.opponentEnergyCards].forEach(card => {
      if (card && card.destroy) {
        card.destroy();
      }
    });
    
    // Clear arrays
    this.playerEnergyCards.length = 0;
    this.opponentEnergyCards.length = 0;
  }
}
