import Card from './Card.js';
import CardStatCalculator from '../utils/CardStatCalculator.js';
import CardFactory from '../utils/CardFactory.js';
import { applySlotOverlaySet, applySlotTotalsVisibility } from '../utils/PowerOverlayCoordinator.js';

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
    const slotPosition = this.getSlotPosition(playerType, slotName);
    
    console.log(`Updating ${playerType} ${slotName} slot:`, JSON.stringify(slotData));

    if (!slotPosition) {
      console.warn(`Slot position not found for ${playerType} ${slotName}`);
      return;
    }

    // ✅ OPTIMIZED: Single comprehensive slot update
    this.updateSlotComprehensive(playerType, slotName, slotData, slotPosition);
  }

  // ✅ OPTIMIZED: Comprehensive slot update (replaces updateUnitCard + updatePilotCard + updateSlotTotalLabels)
  updateSlotComprehensive(playerType, slotName, slotData, slotPosition) {
    const cardArray = playerType === 'player' ? this.playerSlotCards : this.opponentSlotCards;
    const slotCards = cardArray[slotName];
    const slotFieldValue = slotData?.fieldCardValue || null;

    const unitCard = this.syncSlotCard({
      slotCards,
      cardData: slotData?.unit,
      cardType: 'unit',
      playerType,
      slotName,
      x: slotPosition.x,
      y: slotPosition.y,
      slotFieldValue
    });

    const pilotCard = this.syncSlotCard({
      slotCards,
      cardData: slotData?.pilot,
      cardType: 'pilot',
      playerType,
      slotName,
      x: slotPosition.x,
      y: slotPosition.y + 42,
      slotFieldValue
    });

    this.updateSlotPowerOverlays({
      slotCards,
      slotFieldValue,
      unitData: slotData?.unit,
      pilotData: slotData?.pilot,
      slotName,
      playerType
    });

    console.log(`[SlotAreaManager] ✅ Comprehensive slot update completed for ${playerType} ${slotName}`);
  }

  getSlotPosition(playerType, slotName) {
    const zones = playerType === 'player' ? this.scene.playerZones : this.scene.opponentZones;
    return zones ? zones[slotName] : null;
  }

  syncSlotCard({ slotCards, cardData, cardType, playerType, slotName, x, y, slotFieldValue }) {
    const existing = slotCards[cardType];

    if (!cardData) {
      if (existing) {
        existing.destroy();
        slotCards[cardType] = null;
      }
      return null;
    }

    if (!existing) {
      console.log(`Creating ${playerType} ${slotName} ${cardType} card:`, cardData.cardId || cardData.id);
      const created = this.createSlotCard(cardData, x, y, slotName, cardType, playerType, slotFieldValue);
      slotCards[cardType] = created;
      return created;
    }

    this.hydrateSlotCard(existing, cardData);
    return existing;
  }

  hydrateSlotCard(card, cardData) {
    if (!card || !cardData) {
      return;
    }

    card.fullCardData = { ...card.fullCardData, ...cardData };

    if (card.cardData && cardData.cardData) {
      card.cardData = { ...card.cardData, ...cardData.cardData };
    }

    if (card.setRested) {
      card.setRested(cardData.isRested || false);
    }
  }

  updateSlotPowerOverlays({ slotCards, slotFieldValue, unitData, pilotData, slotName, playerType }) {
    const unitCard = slotCards.unit;
    const pilotCard = slotCards.pilot;

    if (!unitCard && !pilotCard) {
      this.updateSlotTotalLabelsVisibility(playerType, slotName, { unit: false, pilot: false });
      return;
    }

    if (unitCard && unitData) {
      this.hydrateSlotCard(unitCard, unitData);
    }

    if (pilotCard && pilotData) {
      this.hydrateSlotCard(pilotCard, pilotData);
    }

    const overlayState = applySlotOverlaySet({
      unitCard: unitCard && unitData ? unitCard : null,
      pilotCard: pilotCard && pilotData ? pilotCard : null,
      unitData,
      pilotData,
      slotFieldValue
    });

    this.updateSlotTotalLabelsVisibility(playerType, slotName, {
      unit: overlayState.unitShowsTotals,
      pilot: overlayState.pilotShowsTotals
    });
  }



  createSlotCard(cardData, x, y, slotName, cardType = 'unit', playerType = 'player', slotFieldValue = null) {
    try {
      const card = CardFactory.createSlotCard(this.scene, cardData, x, y, {
        slotName,
        cardType,
        playerType,
        gameStateManager: this.gameStateManager,
        fieldCardValue: slotFieldValue || cardData?.fieldCardValue || null
      });
      
      console.log(`✅ Created ${cardType} slot card for ${slotName}:`, cardData.cardId || cardData.id);
      return card;
      
    } catch (error) {
      console.error(`Failed to create ${cardType} slot card for ${slotName}:`, error);
      return null;
    }
  }



  // ============ TOTAL LABELS MANAGEMENT ============

  /**
   * Update slot total AP and HP labels (both values and visibility)
   * Comprehensive function that handles all slot scenarios and card data updates
   * @param {string} playerType - 'player' or 'opponent'
   * @param {string} slotName - slot1, slot2, etc.
   * @param {Object} unitData - Optional unit card data to update
   * @param {Object} pilotData - Optional pilot card data to update
   */
  updateSlotTotalLabels(playerType, slotName, unitData = null, pilotData = null, slotFieldValue = null) {
    const slotCards = this.getSlotCards(playerType, slotName);

    if (slotCards.unit && unitData) {
      this.hydrateSlotCard(slotCards.unit, unitData);
    }
    if (slotCards.pilot && pilotData) {
      this.hydrateSlotCard(slotCards.pilot, pilotData);
    }

    this.updateSlotPowerOverlays({
      slotCards,
      slotFieldValue,
      unitData,
      pilotData,
      slotName,
      playerType
    });
  }

  /**
   * Update total labels visibility for all cards in a slot
   * Rule: If both unit and pilot are present, only pilot shows total labels
   * @param {string} playerType - 'player' or 'opponent'
   * @param {string} slotName - slot1, slot2, etc.
   */
  updateSlotTotalLabelsVisibility(playerType, slotName, visibilityOverrides = null) {
    const slotCards = this.getSlotCards(playerType, slotName);
    applySlotTotalsVisibility(slotCards.unit, slotCards.pilot, {
      unitShowsTotals: visibilityOverrides?.unit,
      pilotShowsTotals: visibilityOverrides?.pilot,
      zone: slotName
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
        fieldCardValue: slotCards.unit.fullCardData?.fieldCardValue
      });
    }

    if (hasPilot) {
      console.log('Pilot card data:', {
        cardId: slotCards.pilot.cardData?.id,
        fullCardData: slotCards.pilot.fullCardData,
        fieldCardValue: slotCards.pilot.fullCardData?.fieldCardValue
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
