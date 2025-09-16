import Card from './Card.js';

export default class SlotAreaManager {
  constructor(scene, gameStateManager) {
    this.scene = scene;
    this.gameStateManager = gameStateManager;
    
    // Slot area cards for both players - now supports unit and pilot cards
    this.playerSlotCards = {};  // slot1-slot6 -> { unit: Card, pilot: Card }
    this.opponentSlotCards = {}; // slot1-slot6 -> { unit: Card, pilot: Card }
    
    // Initialize empty slot objects with unit and pilot structure
    ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach(slot => {
      this.playerSlotCards[slot] = { unit: null, pilot: null };
      this.opponentSlotCards[slot] = { unit: null, pilot: null };
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

    console.log(`Updating ${playerType} ${slotName} slot:`, JSON.stringify(slotData));

    if (!slotPosition) {
      console.warn(`Slot position not found for ${playerType} ${slotName}`);
      return;
    }

    // Update unit card
    this.updateUnitCard(cardArray[slotName], slotData?.unit, slotPosition, playerType, slotName);
    
    // Update pilot card (positioned 25px below unit)
    this.updatePilotCard(cardArray[slotName], slotData?.pilot, slotPosition, playerType, slotName);
  }

  updateUnitCard(slotCards, unitData, slotPosition, playerType, slotName) {
    if (unitData) {
      // Slot has unit - create or update card
      if (!slotCards.unit) {
        console.log(`Creating ${playerType} ${slotName} unit card:`, unitData.cardId);
        const card = this.createSlotCard(unitData, slotPosition.x, slotPosition.y, slotName, 'unit', playerType);
        slotCards.unit = card;
      } else {
        console.log(`Updating existing ${playerType} ${slotName} unit card`);
        this.updateExistingSlotCard(slotCards.unit, unitData);
      }
    } else {
      // No unit - remove card if exists
      if (slotCards.unit) {
        console.log(`Removing ${playerType} ${slotName} unit card - slot now empty`);
        slotCards.unit.destroy();
        slotCards.unit = null;
      }
    }
  }

  updatePilotCard(slotCards, pilotData, slotPosition, playerType, slotName) {
    if (pilotData) {
      // Slot has pilot - create or update card (positioned 25px below unit)
      const pilotY = slotPosition.y + 42; // Position pilot 25px below unit
      console.log("pilotData ", JSON.stringify(pilotData))
      if (!slotCards.pilot) {
        console.log(`Creating ${playerType} ${slotName} pilot card:`, pilotData.cardId);
        const card = this.createSlotCard(pilotData, slotPosition.x, pilotY, slotName, 'pilot', playerType);
        slotCards.pilot = card;
      } else {
        console.log(`Updating existing ${playerType} ${slotName} pilot card`);
        this.updateExistingSlotCard(slotCards.pilot, pilotData);
      }
    } else {
      // No pilot - remove card if exists
      if (slotCards.pilot) {
        console.log(`Removing ${playerType} ${slotName} pilot card - no pilot data`);
        slotCards.pilot.destroy();
        slotCards.pilot = null;
      }
    }
  }

  createSlotCard(cardData, x, y, slotName, cardType = 'unit', playerType = 'player') {
    try {
      // Create card using the existing Card component with preview images for better performance
      const card = new Card(this.scene, x, y, cardData, { usePreview: true });
      
      // CRITICAL: Set card as interactive to enable hover events
      card.setInteractive(true);
      
      // CRITICAL: Set zone placement properties for hover detection
      const isPlayerZone = playerType === 'player'; // True for player slots, false for opponent slots
      card.isInZone = true;  // Mark card as placed in zone (enables zone-card-hover events)
      card.setZonePlacement(true, slotName, isPlayerZone); // inZone=true, zoneType=slotName, isPlayerZone based on playerType
      card.zonePlacement = {
        isPlayerZone: isPlayerZone,  // Correctly set based on playerType
        zoneType: slotName,  // slot1, slot2, etc.
        isPlaced: true
      };
      
      // Add card type information for identification
      card.cardTypeInSlot = cardType;
      
      // Set appropriate depth for layering (pilots above units)
      if (cardType === 'pilot') {
        card.setDepth(200); // Pilots render above units
      } else {
        card.setDepth(210); // Units at base depth
      }
      
      // Add rested visual state if needed
      if (cardData.isRested) {
        card.setRested(true);
      }
      
      // Card creation successful
      console.log(`✅ Created ${cardType} slot card for ${slotName}:`, cardData.cardId || cardData.id);
      
      return card;
      
    } catch (error) {
      console.error(`Failed to create ${cardType} slot card for ${slotName}:`, error);
      return null;
    }
  }

  updateExistingSlotCard(card, cardData) {
    // Update rested state
    if (card.setRested) {
      card.setRested(cardData.isRested || false);
    }
    
    // Update card data with new stats (AP/HP changes, etc.)
    if (card.fullCardData && cardData) {
      // Store previous values for comparison
      const previousAP = card.fullCardData.currentAP;
      const previousHP = card.fullCardData.currentHP;
      
      // Update the card's full data with new information
      card.fullCardData = { ...card.fullCardData, ...cardData };
      
      // Also update the nested cardData if it exists
      if (card.cardData && cardData.cardData) {
        card.cardData = { ...card.cardData, ...cardData.cardData };
      }
      
      // Check if AP/HP values have changed
      const newAP = card.fullCardData.currentAP;
      const newHP = card.fullCardData.currentHP;
      
      const statsChanged = (previousAP !== newAP) || (previousHP !== newHP);
      
      if (statsChanged) {
        console.log(`[SlotAreaManager] Stats changed for card ${card.cardData?.id}: AP ${previousAP} → ${newAP}, HP ${previousHP} → ${newHP}`);
        
        // Update power overlay if the card has one
        if (card.powerOverlay && card.updatePowerOverlay) {
          try {
            card.updatePowerOverlay();
            console.log(`[SlotAreaManager] Power overlay updated for card ${card.cardData?.id}`);
          } catch (error) {
            console.error(`[SlotAreaManager] Failed to update power overlay for card ${card.cardData?.id}:`, error);
          }
        }
      }
    }
  }

  // ============ UTILITY METHODS ============

  getSlotCard(playerType, slotName, cardType = 'unit') {
    const cardArray = playerType === 'player' ? this.playerSlotCards : this.opponentSlotCards;
    return cardArray[slotName] ? cardArray[slotName][cardType] : null;
  }

  getSlotCards(playerType, slotName) {
    const cardArray = playerType === 'player' ? this.playerSlotCards : this.opponentSlotCards;
    return cardArray[slotName] || { unit: null, pilot: null };
  }

  hasCardInSlot(playerType, slotName, cardType = null) {
    const slotCards = this.getSlotCards(playerType, slotName);
    if (cardType) {
      return slotCards[cardType] !== null;
    }
    // Return true if slot has any card (unit or pilot)
    return slotCards.unit !== null || slotCards.pilot !== null;
  }

  hasUnitInSlot(playerType, slotName) {
    return this.hasCardInSlot(playerType, slotName, 'unit');
  }

  hasPilotInSlot(playerType, slotName) {
    return this.hasCardInSlot(playerType, slotName, 'pilot');
  }

  getAllPlayerSlotCards() {
    const allCards = [];
    Object.values(this.playerSlotCards).forEach(slotCards => {
      if (slotCards.unit) allCards.push(slotCards.unit);
      if (slotCards.pilot) allCards.push(slotCards.pilot);
    });
    return allCards;
  }

  getAllOpponentSlotCards() {
    const allCards = [];
    Object.values(this.opponentSlotCards).forEach(slotCards => {
      if (slotCards.unit) allCards.push(slotCards.unit);
      if (slotCards.pilot) allCards.push(slotCards.pilot);
    });
    return allCards;
  }

  getAllSlotCards() {
    return [...this.getAllPlayerSlotCards(), ...this.getAllOpponentSlotCards()];
  }

  // ============ SELECTION MANAGEMENT ============

  /**
   * Deselect all cards in slots (both unit and pilot cards) silently without animations
   */
  deselectAllSlotCards() {
    // Deselect all player slot cards
    Object.entries(this.playerSlotCards).forEach(([slotName, slotCards]) => {
      // Check unit card
      if (slotCards.unit && slotCards.unit.isSelected) {
        console.log(`Deselecting player ${slotName} unit card ${slotCards.unit.cardData?.id}`);
        slotCards.unit.deselectSilently();
      }
      
      // Check pilot card
      if (slotCards.pilot && slotCards.pilot.isSelected) {
        console.log(`Deselecting player ${slotName} pilot card ${slotCards.pilot.cardData?.id}`);
        slotCards.pilot.deselectSilently();
      }
    });
    
    // Deselect all opponent slot cards
    Object.entries(this.opponentSlotCards).forEach(([slotName, slotCards]) => {
      // Check unit card
      if (slotCards.unit && slotCards.unit.isSelected) {
        console.log(`Deselecting opponent ${slotName} unit card ${slotCards.unit.cardData?.id}`);
        slotCards.unit.deselectSilently();
      }
      
      // Check pilot card
      if (slotCards.pilot && slotCards.pilot.isSelected) {
        console.log(`Deselecting opponent ${slotName} pilot card ${slotCards.pilot.cardData?.id}`);
        slotCards.pilot.deselectSilently();
      }
    });
  }

  // ============ CLEANUP ============

  destroy() {
    // Destroy all slot cards (both unit and pilot)
    Object.values(this.playerSlotCards).forEach(slotCards => {
      if (slotCards.unit) slotCards.unit.destroy();
      if (slotCards.pilot) slotCards.pilot.destroy();
    });
    
    Object.values(this.opponentSlotCards).forEach(slotCards => {
      if (slotCards.unit) slotCards.unit.destroy();
      if (slotCards.pilot) slotCards.pilot.destroy();
    });
    
    // Clear references
    this.playerSlotCards = {};
    this.opponentSlotCards = {};
    
    console.log('SlotAreaManager destroyed');
  }
}