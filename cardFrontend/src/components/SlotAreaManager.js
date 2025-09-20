import Card from './Card.js';
import CardStatCalculator from '../utils/CardStatCalculator.js';

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

    // Update slot total labels (both values and visibility)
    this.updateSlotTotalLabels(playerType, slotName);
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
      const previousTotalAP = CardStatCalculator.calculateTotalAP(card.fullCardData);
      const previousTotalHP = CardStatCalculator.calculateTotalHP(card.fullCardData);
      
      // Update the card's full data with new information
      card.fullCardData = { ...card.fullCardData, ...cardData };
      
      // Also update the nested cardData if it exists
      if (card.cardData && cardData.cardData) {
        card.cardData = { ...card.cardData, ...cardData.cardData };
      }
      
      // Calculate new total AP/HP values including modifications
      const newTotalAP = CardStatCalculator.calculateTotalAP(card.fullCardData);
      const newTotalHP = CardStatCalculator.calculateTotalHP(card.fullCardData);
      
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


  // ============ TOTAL LABELS MANAGEMENT ============

  /**
   * Update slot total AP and HP labels (both values and visibility)
   * Comprehensive function that handles all slot scenarios
   * @param {string} playerType - 'player' or 'opponent'
   * @param {string} slotName - slot1, slot2, etc.
   */
  updateSlotTotalLabels(playerType, slotName) {
    const slotCards = this.getSlotCards(playerType, slotName);
    const hasUnit = slotCards.unit !== null;
    const hasPilot = slotCards.pilot !== null;
    
    // Update total label values based on slot contents
    if (hasUnit && hasPilot) {
      // Both unit and pilot present - pilot shows combined totals
      const { totalAP, totalHP } = CardStatCalculator.calculateTotalInSlot(slotCards.unit, slotCards.pilot);
      if (slotCards.pilot.updateTotalLabels) {
        slotCards.pilot.updateTotalLabels(totalAP, totalHP);
        console.log(`[SlotAreaManager] Updated pilot total labels (combined): AP=${totalAP}, HP=${totalHP}`);
      }
    } else if (hasUnit && !hasPilot) {
      // Unit only - unit shows its own totals
      const { totalAP, totalHP } = CardStatCalculator.calculateTotalInSlot(slotCards.unit, null);
      if (slotCards.unit.updateTotalLabels) {
        slotCards.unit.updateTotalLabels(totalAP, totalHP);
        console.log(`[SlotAreaManager] Updated unit total labels (unit only): AP=${totalAP}, HP=${totalHP}`);
      }
    } else if (!hasUnit && hasPilot) {
      // Pilot only - pilot shows its own totals
      const { totalAP, totalHP } = CardStatCalculator.calculateTotalInSlot(null, slotCards.pilot);
      if (slotCards.pilot.updateTotalLabels) {
        slotCards.pilot.updateTotalLabels(totalAP, totalHP);
        console.log(`[SlotAreaManager] Updated pilot total labels (pilot only): AP=${totalAP}, HP=${totalHP}`);
      }
    }
    
    // Update total labels visibility for the slot
    this.updateSlotTotalLabelsVisibility(playerType, slotName);
  }

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


  }

  // ============ TOTAL LABELS MANAGEMENT ============

  /**
   * Force update all total labels for all slots (useful for fixing sync issues)
   * @param {string} playerType - 'player', 'opponent', or 'all' for both
   */
  updateAllSlotTotalLabels(playerType = 'all') {
    console.log(`[SlotAreaManager] Force updating all slot total labels for: ${playerType}`);
    
    const playerTypes = playerType === 'all' ? ['player', 'opponent'] : [playerType];
    
    playerTypes.forEach(pType => {
      ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach(slotName => {
        // Use the unified updateSlotTotalLabels method
        this.updateSlotTotalLabels(pType, slotName);
        console.log(`[SlotAreaManager] Force updated ${pType} ${slotName} total labels`);
      });
    });
  }

  // ============ DEBUGGING METHODS ============

  /**
   * Debug function to trace total label calculations for a specific slot
   * @param {string} playerType - 'player' or 'opponent'
   * @param {string} slotName - slot1, slot2, etc.
   */
  debugSlotTotals(playerType, slotName) {
    console.log(`\n=== DEBUGGING SLOT TOTALS: ${playerType} ${slotName} ===`);
    
    const slotCards = this.getSlotCards(playerType, slotName);
    const hasUnit = slotCards.unit !== null;
    const hasPilot = slotCards.pilot !== null;
    
    console.log(`Has unit: ${hasUnit}, Has pilot: ${hasPilot}`);
    
    if (hasUnit) {
      console.log('Unit card data:', {
        cardId: slotCards.unit.cardData?.id,
        fullCardData: slotCards.unit.fullCardData,
        currentAP: slotCards.unit.fullCardData?.currentAP,
        currentHP: slotCards.unit.fullCardData?.currentHP,
        modifyAP: slotCards.unit.fullCardData?.modifyAP,
        modifyHP: slotCards.unit.fullCardData?.modifyHP
      });
    }
    
    if (hasPilot) {
      console.log('Pilot card data:', {
        cardId: slotCards.pilot.cardData?.id,
        fullCardData: slotCards.pilot.fullCardData,
        currentAP: slotCards.pilot.fullCardData?.currentAP,
        currentHP: slotCards.pilot.fullCardData?.currentHP,
        modifyAP: slotCards.pilot.fullCardData?.modifyAP,
        modifyHP: slotCards.pilot.fullCardData?.modifyHP
      });
    }
    
    // Calculate totals for debugging
    if (hasUnit || hasPilot) {
      const { totalAP, totalHP } = CardStatCalculator.calculateTotalInSlot(slotCards.unit, slotCards.pilot);
      console.log(`Calculated totals: AP=${totalAP}, HP=${totalHP}`);
      
      // Check current displayed values
      if (hasUnit && slotCards.unit.powerOverlay) {
        console.log('Unit total labels visible:', slotCards.unit.powerOverlay.totalApText?.visible, slotCards.unit.powerOverlay.totalHpText?.visible);
        console.log('Unit total labels text:', slotCards.unit.powerOverlay.totalApText?.text, slotCards.unit.powerOverlay.totalHpText?.text);
      }
      
      if (hasPilot && slotCards.pilot.powerOverlay) {
        console.log('Pilot total labels visible:', slotCards.pilot.powerOverlay.totalApText?.visible, slotCards.pilot.powerOverlay.totalHpText?.visible);
        console.log('Pilot total labels text:', slotCards.pilot.powerOverlay.totalApText?.text, slotCards.pilot.powerOverlay.totalHpText?.text);
      }
    }
    
    console.log('=== END DEBUG ===\n');
  }

  /**
   * Configure total labels for unit+pilot card pair with given total values
   * @param {Card} unitCard - Unit card component
   * @param {Card} pilotCard - Pilot card component (can be null)
   * @param {number} totalAP - Total AP value to display
   * @param {number} totalHP - Total HP value to display
   */
  static configureSlotTotalLabels(unitCard, pilotCard, totalAP, totalHP) {
    const hasUnit = unitCard !== null;
    const hasPilot = pilotCard !== null;
    
    // Apply SlotAreaManager total label visibility rules
    if (hasUnit && hasPilot) {
      // Both unit and pilot present - pilot shows combined totals, unit hides totals
      if (pilotCard.configureTotalLabelsToShow) {
        pilotCard.configureTotalLabelsToShow(totalAP, totalHP);
      }
      if (unitCard.powerOverlay && unitCard.powerOverlay.setTotalLabelsVisibility) {
        unitCard.powerOverlay.setTotalLabelsVisibility('hand'); // Hide total labels
      }
      console.log(`[SlotAreaManager] Configured slot totals: pilot shows AP=${totalAP}, HP=${totalHP}, unit hidden`);
    } else if (hasUnit && !hasPilot) {
      // Unit only - unit shows its total labels
      if (unitCard.configureTotalLabelsToShow) {
        unitCard.configureTotalLabelsToShow(totalAP, totalHP);
      }
      console.log(`[SlotAreaManager] Configured slot totals: unit shows AP=${totalAP}, HP=${totalHP}`);
    } else if (!hasUnit && hasPilot) {
      // Pilot only - pilot shows its total labels
      if (pilotCard.configureTotalLabelsToShow) {
        pilotCard.configureTotalLabelsToShow(totalAP, totalHP);
      }
      console.log(`[SlotAreaManager] Configured slot totals: pilot shows AP=${totalAP}, HP=${totalHP}`);
    }
  }

  // ============ UTILITY METHODS ============

  /**
   * Get slot information for a given card instance
   * @param {Card} card - Card instance to find
   * @returns {Object|null} Slot info with playerType, slotName, cardType or null if not found
   */
  getSlotInfoFromCard(card) {
    if (!card) return null;
    
    // Search through player slots
    for (const slotName of ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']) {
      const playerSlot = this.playerSlotCards[slotName];
      if (playerSlot.unit === card) {
        return { playerType: 'player', slotName: slotName, cardType: 'unit' };
      }
      if (playerSlot.pilot === card) {
        return { playerType: 'player', slotName: slotName, cardType: 'pilot' };
      }
    }
    
    // Search through opponent slots
    for (const slotName of ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']) {
      const opponentSlot = this.opponentSlotCards[slotName];
      if (opponentSlot.unit === card) {
        return { playerType: 'opponent', slotName: slotName, cardType: 'unit' };
      }
      if (opponentSlot.pilot === card) {
        return { playerType: 'opponent', slotName: slotName, cardType: 'pilot' };
      }
    }
    
    // Card not found in any slot
    return null;
  }

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