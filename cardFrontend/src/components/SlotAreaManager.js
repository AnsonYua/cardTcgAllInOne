import Card from './Card.js';

export default class SlotAreaManager {
  constructor(scene, gameStateManager) {
    this.scene = scene;
    this.gameStateManager = gameStateManager;
    
    // Slot area cards for both players
    this.playerSlotCards = {};  // slot1-slot6
    this.opponentSlotCards = {}; // slot1-slot6
    
    // Initialize empty slot objects
    ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach(slot => {
      this.playerSlotCards[slot] = null;
      this.opponentSlotCards[slot] = null;
    });
  }

  // ============ SLOT AREA MANAGEMENT ============

  updateSlotAreas() {
    this.updatePlayerSlots();
    this.updateOpponentSlots();
  }

  updatePlayerSlots() {
    const playerId = this.gameStateManager.getCurrentPlayerId();
    const playerData = this.gameStateManager.getPlayer(playerId);
    
    if (playerData && playerData.zones) {
      ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach(slotName => {
        this.updateSlot('player', slotName, playerData.zones[slotName]);
      });
    }
  }

  updateOpponentSlots() {
    const opponentId = this.gameStateManager.getOpponent();
    const opponentData = this.gameStateManager.getPlayer(opponentId);
    
    if (opponentData && opponentData.zones) {
      ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach(slotName => {
        this.updateSlot('opponent', slotName, opponentData.zones[slotName]);
      });
    }
  }

  updateSlot(playerType, slotName, slotData) {
    const cardArray = playerType === 'player' ? this.playerSlotCards : this.opponentSlotCards;
    const zones = playerType === 'player' ? this.scene.playerZones : this.scene.opponentZones;
    
    // Get slot position from scene zones
    const slotPosition = zones[slotName];
    if (!slotPosition) {
      console.warn(`Slot position not found for ${playerType} ${slotName}`);
      return;
    }

    // Check if slot has unit data
    if (slotData && slotData.unit) {
      // Slot has unit - create or update card
      if (!cardArray[slotName]) {
        console.log(`Creating ${playerType} ${slotName} unit card:`, slotData.unit.cardId);
        const card = this.createSlotCard(slotData.unit, slotPosition.x, slotPosition.y, slotName);
        cardArray[slotName] = card;
      } else {
        console.log(`Updating existing ${playerType} ${slotName} unit card`);
        // Update existing card if needed (handle card changes)
        this.updateExistingSlotCard(cardArray[slotName], slotData.unit);
      }
    } else {
      // Slot is empty - remove card if exists
      if (cardArray[slotName]) {
        console.log(`Removing ${playerType} ${slotName} unit card - slot now empty`);
        cardArray[slotName].destroy();
        cardArray[slotName] = null;
      }
    }
  }

  createSlotCard(unitData, x, y, slotName) {
    try {
      // Create card using the existing Card component
      const cardData = {
        id: unitData.cardId,
        cardUid: unitData.cardUid,
        name: unitData.cardId, // Use cardId as name for now
        type: 'unit',
        cardType: unitData.cardData?.cardType || 'unit',
        power: unitData.cardData?.power || 0,
        isRested: unitData.isRested || false,
        placedAt: unitData.placedAt,
        placedBy: unitData.placedBy
      };

      const card = new Card(this.scene, x, y, cardData);
      
      // Set card as non-interactive (it's placed in zone)
      card.setInteractive(false);
      
      // Show face-up
      card.setFaceUp(true);
      
      // Set depth for proper layering
      card.setDepth(200);
      
      // Add rested visual state if needed
      if (unitData.isRested) {
        card.setRested(true);
      }
      
      console.log(`✅ Created slot card for ${slotName}:`, cardData.id);
      return card;
      
    } catch (error) {
      console.error(`Failed to create slot card for ${slotName}:`, error);
      return null;
    }
  }

  updateExistingSlotCard(card, unitData) {
    // Update rested state
    if (card.setRested) {
      card.setRested(unitData.isRested || false);
    }
    
    // Update any other dynamic properties as needed
    // This method can be expanded for more complex card state updates
  }

  // ============ UTILITY METHODS ============

  getSlotCard(playerType, slotName) {
    const cardArray = playerType === 'player' ? this.playerSlotCards : this.opponentSlotCards;
    return cardArray[slotName];
  }

  hasCardInSlot(playerType, slotName) {
    return this.getSlotCard(playerType, slotName) !== null;
  }

  getAllPlayerSlotCards() {
    return Object.values(this.playerSlotCards).filter(card => card !== null);
  }

  getAllOpponentSlotCards() {
    return Object.values(this.opponentSlotCards).filter(card => card !== null);
  }

  getAllSlotCards() {
    return [...this.getAllPlayerSlotCards(), ...this.getAllOpponentSlotCards()];
  }

  // ============ CLEANUP ============

  destroy() {
    // Destroy all slot cards
    Object.values(this.playerSlotCards).forEach(card => {
      if (card) card.destroy();
    });
    
    Object.values(this.opponentSlotCards).forEach(card => {
      if (card) card.destroy();
    });
    
    // Clear references
    this.playerSlotCards = {};
    this.opponentSlotCards = {};
    
    console.log('SlotAreaManager destroyed');
  }
}