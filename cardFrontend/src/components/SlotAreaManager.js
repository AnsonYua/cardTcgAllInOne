import Card from './Card.js';
import CardStatCalculator from '../utils/CardStatCalculator.js';
import CardFactory from '../utils/CardFactory.js';
import { normalizeFieldCardValue } from '../utils/FieldValueUtils.js';

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

    // ✅ OPTIMIZED: Single comprehensive slot update
    this.updateSlotComprehensive(playerType, slotName, slotData, slotPosition);
  }

  // ✅ OPTIMIZED: Comprehensive slot update (replaces updateUnitCard + updatePilotCard + updateSlotTotalLabels)
  updateSlotComprehensive(playerType, slotName, slotData, slotPosition) {
    const cardArray = playerType === 'player' ? this.playerSlotCards : this.opponentSlotCards;
    const slotCards = cardArray[slotName];
    const slotFieldValue = slotData?.fieldCardValue || null;
    
    // ===== UNIT CARD MANAGEMENT =====
    if (slotData?.unit) {
      // Slot has unit - create or update card
      if (!slotCards.unit) {
        console.log(`Creating ${playerType} ${slotName} unit card:`, slotData.unit.cardId);
        const card = this.createSlotCard(slotData.unit, slotPosition.x, slotPosition.y, slotName, 'unit', playerType, slotFieldValue);
        slotCards.unit = card;
      } else {
        console.log(`Updating existing ${playerType} ${slotName} unit card`);
        // Data update will be handled by updateSlotTotalLabels()
      }
    } else {
      // No unit - remove card if exists
      if (slotCards.unit) {
        console.log(`Removing ${playerType} ${slotName} unit card - slot now empty`);
        slotCards.unit.destroy();
        slotCards.unit = null;
      }
    }
    
    // ===== PILOT CARD MANAGEMENT =====
    if (slotData?.pilot) {
      // Slot has pilot - create or update card (positioned 25px below unit)
      const pilotY = slotPosition.y + 42; // Position pilot 25px below unit
      console.log("pilotData ", JSON.stringify(slotData.pilot))
      if (!slotCards.pilot) {
        console.log(`Creating ${playerType} ${slotName} pilot card:`, slotData.pilot.cardId);
        const card = this.createSlotCard(slotData.pilot, slotPosition.x, pilotY, slotName, 'pilot', playerType, slotFieldValue);
        slotCards.pilot = card;
      } else {
        console.log(`Updating existing ${playerType} ${slotName} pilot card`);
        // Data update will be handled by updateSlotTotalLabels()
      }
    } else {
      // No pilot - remove card if exists
      if (slotCards.pilot) {
        console.log(`Removing ${playerType} ${slotName} pilot card - no pilot data`);
        slotCards.pilot.destroy();
        slotCards.pilot = null;
      }
    }
    
    // ===== UNIFIED TOTAL LABELS AND DATA UPDATE (Always runs for consistency) =====
    this.updateSlotTotalLabels(playerType, slotName, slotData?.unit, slotData?.pilot, slotFieldValue);
    console.log(`[SlotAreaManager] ✅ Comprehensive slot update completed for ${playerType} ${slotName}`);
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
    const hasUnit = slotCards.unit !== null;
    const hasPilot = slotCards.pilot !== null;

    // ===== UPDATE CARD DATA FIRST (merged from updateExistingSlotCard) =====
    if (hasUnit && unitData) {
      this.updateCardData(slotCards.unit, unitData);
    }
    if (hasPilot && pilotData) {
      this.updateCardData(slotCards.pilot, pilotData);
    }
    
    // ===== UNIFIED TOTAL LABELS UPDATE =====
    this.applySlotFieldValue(slotCards, slotFieldValue, unitData, pilotData);

    if (hasUnit) {
      slotCards.unit.updatePowerOverlay();
    }
    if (hasPilot) {
      slotCards.pilot.updatePowerOverlay();
    }

    const effectiveFieldValue = normalizeFieldCardValue(slotFieldValue
      || unitData?.fieldCardValue
      || pilotData?.fieldCardValue
      || slotCards.unit?.slotFieldCardValue
      || slotCards.pilot?.slotFieldCardValue
      || slotCards.unit?.fieldCardValue
      || slotCards.pilot?.fieldCardValue);

    let totalAP;
    let totalHP;
    if (effectiveFieldValue) {
      totalAP = effectiveFieldValue.totalAP;
      totalHP = effectiveFieldValue.totalHP;
    } else {
      const totals = CardStatCalculator.calculateTotalInSlot(slotCards.unit, slotCards.pilot);
      totalAP = totals.totalAP;
      totalHP = totals.totalHP;
    }

    SlotAreaManager.configureSlotTotalLabels(slotCards.unit, slotCards.pilot, totalAP, totalHP);

    this.updateSlotTotalLabelsVisibility(playerType, slotName);
  }

  /**
   * Update total labels for slot cards with unified logic
   * @param {Object} slotCards - Object containing unit and pilot cards
   * @param {boolean} hasUnit - Whether unit exists
   * @param {boolean} hasPilot - Whether pilot exists
   * @param {Object} unitData - Unit card data (for rested state)
   * @param {Object} pilotData - Pilot card data (for rested state)
   */
  updateSlotTotalLabelsValue(slotCards, hasUnit, hasPilot, unitData, pilotData, slotName) {
    if (hasUnit && hasPilot) {
      // Both unit and pilot present - pilot shows combined totals
      if (slotCards.pilot.updateCalculatedTotalLabels) {
        const isRested = unitData?.isRested || slotCards.unit.fullCardData?.isRested || false;
        const { totalAP, totalHP } = slotCards.pilot.updateCalculatedTotalLabels(slotCards.unit, isRested);
        console.log(`[SlotAreaManager] Updated pilot total labels (combined): AP=${totalAP}, HP=${totalHP}, rested=${isRested}`);
      }
    } else if (hasUnit && !hasPilot) {
      // Unit only - unit shows its own totals
      if (slotCards.unit.updateCalculatedTotalLabels) {
        const isRested = unitData?.isRested || slotCards.unit.fullCardData?.isRested || false;
        const { totalAP, totalHP } = slotCards.unit.updateCalculatedTotalLabels(null, isRested);
        console.log(`[SlotAreaManager] Updated unit total labels (unit only): AP=${totalAP}, HP=${totalHP}, rested=${isRested}`);
      }
    }
  }

  applySlotFieldValue(slotCards, slotFieldValue, unitData, pilotData) {
    if (slotCards.unit?.setFieldCardValue) {
      slotCards.unit.setFieldCardValue(unitData?.fieldCardValue ?? slotFieldValue ?? null, {
        source: 'slot',
        updateOverlay: false
      });
    }
    if (slotCards.pilot?.setFieldCardValue) {
      slotCards.pilot.setFieldCardValue(pilotData?.fieldCardValue ?? slotFieldValue ?? null, {
        source: 'slot',
        updateOverlay: false
      });
    }
  }

  /**
   * Update individual card data (extracted from updateExistingSlotCard)
   * @param {Card} card - Card component to update
   * @param {Object} cardData - New card data
   */
  updateCardData(card, cardData) {
    // Update rested state
    if (card.setRested) {
      card.setRested(cardData.isRested || false);
    }
    
    // Update card data with new stats (AP/HP changes, etc.)
    if (card.fullCardData && cardData) {
      // Update the card's full data with new information
      card.fullCardData = { ...card.fullCardData, ...cardData };
      
      // Also update the nested cardData if it exists
      if (card.cardData && cardData.cardData) {
        card.cardData = { ...card.cardData, ...cardData.cardData };
      }

      if (card.setFieldCardValue) {
        card.setFieldCardValue(cardData.fieldCardValue, {
          source: 'slot',
          updateOverlay: false
        });
      }

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
    if (slotCards.unit?.clearOverlayOverrides && slotCards.unit?.setOverlayOverrides) {
      slotCards.unit.clearOverlayOverrides(false);
      if (unitShouldShowTotals) {
        slotCards.unit.setOverlayOverrides({
          totalsVisible: true,
          totalsZoneOverride: slotName
        }, { apply: false });
      } else {
        slotCards.unit.setOverlayOverrides({ totalsVisible: false, totalsZoneOverride: null }, { apply: false });
      }
      slotCards.unit.applyZoneOverlayRules();
      console.log(`[SlotAreaManager] Unit in ${slotName}: total labels ${unitShouldShowTotals ? 'visible' : 'hidden'}`);
    }
    
    // Apply visibility to pilot card
    if (slotCards.pilot?.clearOverlayOverrides && slotCards.pilot?.setOverlayOverrides) {
      slotCards.pilot.clearOverlayOverrides(false);
      if (pilotShouldShowTotals) {
        slotCards.pilot.setOverlayOverrides({
          totalsVisible: true,
          totalsZoneOverride: slotName
        }, { apply: false });
      } else {
        slotCards.pilot.setOverlayOverrides({ totalsVisible: false, totalsZoneOverride: null }, { apply: false });
      }
      slotCards.pilot.applyZoneOverlayRules();
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
    const zoneForTotals = unitCard?.zoneContext?.zoneType || pilotCard?.zoneContext?.zoneType || 'slot1';

    if (hasUnit && hasPilot) {
      // Both unit and pilot present - pilot shows combined totals, unit hides totals
      if (pilotCard.configureTotalLabelsToShow) {
        pilotCard.configureTotalLabelsToShow(totalAP, totalHP, { zone: zoneForTotals });
      }
      if (unitCard?.setOverlayOverrides) {
        unitCard.setOverlayOverrides({ totalsVisible: false, totalsZoneOverride: null });
        unitCard.applyZoneOverlayRules();
      }
      pilotCard?.applyZoneOverlayRules?.();
      console.log(`[SlotAreaManager] Configured slot totals: pilot shows AP=${totalAP}, HP=${totalHP}, unit hidden`);
    } else if (hasUnit && !hasPilot) {
      // Unit only - unit shows its total labels
      if (unitCard.configureTotalLabelsToShow) {
        unitCard.configureTotalLabelsToShow(totalAP, totalHP, { zone: zoneForTotals });
        unitCard.applyZoneOverlayRules?.();
      }
      console.log(`[SlotAreaManager] Configured slot totals: unit shows AP=${totalAP}, HP=${totalHP}`);
    } else if (!hasUnit && hasPilot) {
      // Pilot only - pilot shows its total labels
      if (pilotCard.configureTotalLabelsToShow) {
        pilotCard.configureTotalLabelsToShow(totalAP, totalHP, { zone: zoneForTotals });
        pilotCard.applyZoneOverlayRules?.();
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
