import Card from './Card.js';
import CardStatCalculator from '../utils/CardStatCalculator.js';
import CardFactory from '../utils/CardFactory.js';
import { applySlotOverlaySet, applySlotTotalsVisibility, finalizeSlotOverlayState } from '../utils/PowerOverlayCoordinator.js';

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

    const unitCard = this.prepareSlotCardInstance({
      slotCards,
      cardData: slotData?.unit,
      cardType: 'unit',
      playerType,
      slotName,
      x: slotPosition.x,
      y: slotPosition.y
    });

    const pilotCard = this.prepareSlotCardInstance({
      slotCards,
      cardData: slotData?.pilot,
      cardType: 'pilot',
      playerType,
      slotName,
      x: slotPosition.x,
      y: slotPosition.y + 42
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

  prepareSlotCardInstance({ slotCards, cardData, cardType, playerType, slotName, x, y }) {
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
      const created = this.createSlotCard(cardData, x, y, slotName, cardType, playerType);
      slotCards[cardType] = created;
      return created;
    }

    this.updateZoneCardData(existing, cardData);
    return existing;
  }

  updateZoneCardData(card, cardData) {
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

    // Step 1: align card data + base stats without committing totals yet
    const overlayState = applySlotOverlaySet({
      unitCard: unitCard && unitData ? unitCard : null,
      pilotCard: pilotCard && pilotData ? pilotCard : null,
      unitData,
      pilotData,
      slotFieldValue
    });

    // Step 2: decide which card should display combined totals for the slot
    applySlotTotalsVisibility(unitCard, pilotCard, {
      unitShowsTotals: overlayState.unitShowsTotals,
      pilotShowsTotals: overlayState.pilotShowsTotals,
      zone: slotName
    });

    // Step 3: push total AP/HP and rested status into the overlays
    finalizeSlotOverlayState(overlayState);
  }



  createSlotCard(cardData, x, y, slotName, cardType = 'unit', playerType = 'player') {
    try {
      const card = CardFactory.createSlotCard(this.scene, cardData, x, y, {
        slotName,
        cardType,
        playerType,
        gameStateManager: this.gameStateManager,
        fieldCardValue: cardData?.fieldCardValue || null
      });
      
      console.log(`✅ Created ${cardType} slot card for ${slotName}:`, cardData.cardId || cardData.id);
      return card;
      
    } catch (error) {
      console.error(`Failed to create ${cardType} slot card for ${slotName}:`, error);
      return null;
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
