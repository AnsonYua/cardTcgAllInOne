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
        
        // Update total labels visibility for the entire slot
        this.updateSlotTotalLabelsVisibility(playerType, slotName);
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
        
        // Update total labels visibility for the entire slot after removal
        this.updateSlotTotalLabelsVisibility(playerType, slotName);
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
        
        // Update total labels visibility for the entire slot
        this.updateSlotTotalLabelsVisibility(playerType, slotName);
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
        
        // Update total labels visibility for the entire slot after removal
        this.updateSlotTotalLabelsVisibility(playerType, slotName);
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
      // Calculate previous total AP/HP values including modifications
      const previousTotalAP = this.calculateTotalAP(card.fullCardData);
      const previousTotalHP = this.calculateTotalHP(card.fullCardData);
      
      // Update the card's full data with new information
      card.fullCardData = { ...card.fullCardData, ...cardData };
      
      // Also update the nested cardData if it exists
      if (card.cardData && cardData.cardData) {
        card.cardData = { ...card.cardData, ...cardData.cardData };
      }
      
      // Calculate new total AP/HP values including modifications
      const newTotalAP = this.calculateTotalAP(card.fullCardData);
      const newTotalHP = this.calculateTotalHP(card.fullCardData);
      
      const statsChanged = (previousTotalAP !== newTotalAP) || (previousTotalHP !== newTotalHP);
      
      if (statsChanged) {
        console.log(`[SlotAreaManager] Total stats changed for card ${card.cardData?.id}: Total AP ${previousTotalAP} → ${newTotalAP}, Total HP ${previousTotalHP} → ${newTotalHP}`);
        
        // Update power overlay if the card has one
        if (card.powerOverlay && card.updatePowerOverlay) {
          try {
            card.updatePowerOverlay();
            console.log(`[SlotAreaManager] Power overlay updated for card ${card.cardData?.id}`);
          } catch (error) {
            console.error(`[SlotAreaManager] Failed to update power overlay for card ${card.cardData?.id}:`, error);
          }
        }
        
        // Update total labels with new calculated values
        if (card.powerOverlay && card.powerOverlay.updateTotalStats) {
          try {
            card.powerOverlay.updateTotalStats(newTotalAP, newTotalHP);
            console.log(`[SlotAreaManager] Total stats updated: AP=${newTotalAP}, HP=${newTotalHP} for card ${card.cardData?.id}`);
          } catch (error) {
            console.error(`[SlotAreaManager] Failed to update total stats for card ${card.cardData?.id}:`, error);
          }
        }
      }
    }
  }


  /**
   * Calculate combined total AP and HP for unit and pilot cards in a slot
   * @param {Object} unitCard - Unit card data (can be null)
   * @param {Object} pilotCard - Pilot card data (optional, can be null)
   * @returns {Object} Combined totals: { totalAP: number, totalHP: number }
   */
  calculateTotalInSlot(unitCard, pilotCard) {
    let totalAP = 0;
    let totalHP = 0;
    
    // Add unit card stats if unit exists
    if (unitCard && unitCard.fullCardData) {
      const unitCurrentAP = unitCard.fullCardData.currentAP || 0;
      const unitModifyAP = unitCard.fullCardData.modifyAP || 0;
      const unitCurrentHP = unitCard.fullCardData.currentHP || 0;
      const unitModifyHP = unitCard.fullCardData.modifyHP || 0;
      
      totalAP += unitCurrentAP + unitModifyAP;
      totalHP += unitCurrentHP + unitModifyHP;
      
      console.log(`[SlotAreaManager] Unit contribution: AP=${unitCurrentAP + unitModifyAP} (${unitCurrentAP}+${unitModifyAP}), HP=${unitCurrentHP + unitModifyHP} (${unitCurrentHP}+${unitModifyHP})`);
    }
    
    // Add pilot card stats if pilot exists
    if (pilotCard && pilotCard.fullCardData) {
      const pilotCurrentAP = pilotCard.fullCardData.currentAP || 0;
      const pilotModifyAP = pilotCard.fullCardData.modifyAP || 0;
      const pilotCurrentHP = pilotCard.fullCardData.currentHP || 0;
      const pilotModifyHP = pilotCard.fullCardData.modifyHP || 0;
      
      totalAP += pilotCurrentAP + pilotModifyAP;
      totalHP += pilotCurrentHP + pilotModifyHP;
      
      console.log(`[SlotAreaManager] Pilot contribution: AP=${pilotCurrentAP + pilotModifyAP} (${pilotCurrentAP}+${pilotModifyAP}), HP=${pilotCurrentHP + pilotModifyHP} (${pilotCurrentHP}+${pilotModifyHP})`);
    }
    
    console.log(`[SlotAreaManager] Slot total: AP=${totalAP}, HP=${totalHP}`);
    
    return { totalAP, totalHP };
  }

  /**
   * Calculate total AP including modifications (matches Card.js getAPandHPFromCardData logic)
   * @param {Object} fullCardData - The full card data object
   * @returns {number} Total AP value including modifications
   */
  calculateTotalAP(fullCardData) {
    if (!fullCardData) return 0;
    
    const cardData = fullCardData.cardData || fullCardData;
    
    // For regular cards (unit, pilot, base)
    if (cardData.cardType === 'unit' || cardData.cardType === 'pilot' || cardData.cardType === 'base') {
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
    
    // For command cards with pilot_designation effect
    if (cardData.cardType === 'command') {
      const pilotEffect = cardData.effects?.rules?.find(rule => rule.effectId === 'pilot_designation');
      if (pilotEffect && pilotEffect.effect?.parameters) {
        const originalAP = pilotEffect.effect.parameters.AP || 0;
        const baseAP = fullCardData.currentAP || originalAP;
        const modifyAP = fullCardData.modifyAP || 0;
        return baseAP + modifyAP;
      }
    }
    
    return 0;
  }

  /**
   * Calculate total HP including modifications (matches Card.js getAPandHPFromCardData logic)
   * @param {Object} fullCardData - The full card data object
   * @returns {number} Total HP value including modifications
   */
  calculateTotalHP(fullCardData) {
    if (!fullCardData) return 0;
    
    const cardData = fullCardData.cardData || fullCardData;
    
    // For regular cards (unit, pilot, base)
    if (cardData.cardType === 'unit' || cardData.cardType === 'pilot' || cardData.cardType === 'base') {
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
    
    // For command cards with pilot_designation effect
    if (cardData.cardType === 'command') {
      const pilotEffect = cardData.effects?.rules?.find(rule => rule.effectId === 'pilot_designation');
      if (pilotEffect && pilotEffect.effect?.parameters) {
        const originalHP = pilotEffect.effect.parameters.HP || 0;
        const baseHP = fullCardData.currentHP || originalHP;
        const modifyHP = fullCardData.modifyHP || 0;
        return baseHP + modifyHP;
      }
    }
    
    return 0;
  }

  // ============ TOTAL LABELS MANAGEMENT ============

  /**
   * Update total labels visibility for all cards in a slot
   * Rule: If both unit and pilot are present, only pilot shows total labels
   * @param {string} playerType - 'player' or 'opponent'
   * @param {string} slotName - slot1, slot2, etc.
   */
  updateSlotTotalLabelsVisibility(playerType, slotName) {
    const slotCards = this.getSlotCards(playerType, slotName);
    const hasUnit = slotCards.unit !== null;
    const hasPilot = slotCards.pilot !== null;
    
    // Determine visibility rules
    let unitShouldShowTotals = false;
    let pilotShouldShowTotals = false;
    
    if (hasUnit && hasPilot) {
      // Both unit and pilot present - only pilot shows totals
      unitShouldShowTotals = false;
      pilotShouldShowTotals = true;
    } else if (hasUnit && !hasPilot) {
      // Only unit present - unit shows totals
      unitShouldShowTotals = true;
      pilotShouldShowTotals = false;
    } else if (!hasUnit && hasPilot) {
      // Only pilot present - pilot shows totals
      unitShouldShowTotals = false;
      pilotShouldShowTotals = true;
    }
    
    // Apply visibility to unit card
    if (slotCards.unit && slotCards.unit.powerOverlay && slotCards.unit.powerOverlay.setTotalLabelsVisibility) {
      const unitZone = unitShouldShowTotals ? slotName : 'hand';
      slotCards.unit.powerOverlay.setTotalLabelsVisibility(unitZone);
      console.log(`[SlotAreaManager] Unit in ${slotName}: total labels ${unitShouldShowTotals ? 'visible' : 'hidden'}`);
    }
    
    // Apply visibility to pilot card
    if (slotCards.pilot && slotCards.pilot.powerOverlay && slotCards.pilot.powerOverlay.setTotalLabelsVisibility) {
      const pilotZone = pilotShouldShowTotals ? slotName : 'hand';
      slotCards.pilot.powerOverlay.setTotalLabelsVisibility(pilotZone);
      console.log(`[SlotAreaManager] Pilot in ${slotName}: total labels ${pilotShouldShowTotals ? 'visible' : 'hidden'}`);
    }

    /*
         const { totalAP, totalHP } = this.slotAreaManager ? 
          this.slotAreaManager.calculateTotalInSlot(unitCard, pilotCard) : 
          { totalAP: 0, totalHP: 0 };
        this.previewPilotCard.powerOverlay.updateTotalStats(totalAP, totalHP);
        or
          // Calculate total stats (unit only, no pilot)
          const { totalAP, totalHP } = this.slotAreaManager ? 
            this.slotAreaManager.calculateTotalInSlot(mockUnitCard, null) : 
            { totalAP: 0, totalHP: 0 };
          
          this.previewCard.updateTotalLabels(totalAP, totalHP);
    
    */
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