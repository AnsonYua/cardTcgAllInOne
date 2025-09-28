// ItemDataResolver.js
// Resolves simplified item references to full card objects for dialog display
// Replaces complex eligibleCards construction with simple item specifications

import { normalizeFieldCardValue, getTotalsFromCardData } from './FieldValueUtils.js';

/**
 * ItemDataResolver - Converts simplified item references to dialog-ready card objects
 * 
 * Supported Item Types:
 * - slot: { dialogDisplayType: 'slot', playerId, zone, carduid? }
 * - carduid: { dialogDisplayType: 'carduid', carduid, preSelected? }
 * 
 * Slot Flexibility:
 * - Returns any slot with cards (unit only, pilot only, or both)
 * - No constraint filtering - all occupied slots are valid
 * - Optional carduid filtering for specific card targeting
 * 
 * Output Card Types:
 * - Slot cards: { type: "slot", cardId, carduid, displayName, cardData, zone, playerId, isSlotTarget, unit, pilot, totalAP, totalHP, selectionIndex }
 * - Carduid cards: { type: "carduid", cardId, carduid, displayName, cardData, selectionIndex, preSelected? }
 */
export default class ItemDataResolver {
  
  /**
   * Resolve array of items to eligibleCards format
   * @param {Array} items - Array of item specifications
   * @param {Object} gameState - Current game state from gameStateManager
   * @returns {Array} Array of card objects for dialog display
   */
  static resolveItems(items, gameState) {
    if (!Array.isArray(items)) {
      console.warn('ItemDataResolver: items must be an array');
      return [];
    }
    
    console.log('🔍 ItemDataResolver: Resolving', items.length, 'items');
    
    const resolved = [];
    
    items.forEach((item, index) => {
      try {
        // Resolve single-card items
        const result = this._resolveItem(item, gameState, index);
        if (result) {
          resolved.push(result);
          console.log(`✅ Resolved item ${index}:`, item.dialogDisplayType, result.displayName || result.cardData?.name || 'Unknown');
        }
      } catch (error) {
        console.error(`❌ Failed to resolve item ${index}:`, item, error);
      }
    });
    
    console.log(`📊 ItemDataResolver: Resolved ${resolved.length} total cards from ${items.length} items`);
    return resolved;
  }
  
  /**
   * Resolve single item to card object
   * @private
   */
  static _resolveItem(item, gameState, index) {
    if (!item || !item.dialogDisplayType) {
      console.warn('ItemDataResolver: Invalid item - missing dialogDisplayType');
      return null;
    }
    
    switch (item.dialogDisplayType) {
      case 'slot':
        return this._resolveSlot(item, gameState, index);
      case 'carduid':
        return this._resolveCarduid(item, gameState, index);
      default:
        console.warn(`ItemDataResolver: Unknown item dialogDisplayType: ${item.dialogDisplayType}`);
        return null;
    }
  }
  
  /**
   * Resolve slot item (player/opponent zones)
   * @private
   */
  static _resolveSlot(item, gameState, index) {
    const { playerId, zone, carduid } = item;
    
    if (!playerId || !zone) {
      console.warn('ItemDataResolver: Slot item missing playerId or zone');
      return null;
    }
    
    // Get player data
    const player = gameState.gameEnv?.players?.[playerId];
    if (!player || !player.zones) {
      console.warn(`ItemDataResolver: Player ${playerId} not found or missing zones`);
      return null;
    }
    
    // Get slot data
    const slot = player.zones[zone];
    if (!slot) {
      console.log(`ItemDataResolver: Empty slot ${playerId}/${zone}`);
      return null;
    }
    
    // Optional specific card filter (only if carduid specified)
    if (carduid && slot.unit?.carduid !== carduid) {
      console.log(`ItemDataResolver: Slot ${zone} unit carduid ${slot.unit?.carduid} != ${carduid}`);
      return null;
    }
    
    // Allow slots with unit only, pilot only, or both unit and pilot
    if (!slot.unit && !slot.pilot) {
      console.log(`ItemDataResolver: Slot ${zone} is completely empty`);
      return null;
    }
    
    // Build card object for dialog display
    return this._buildSlotCard(slot, { zone, playerId, carduid, index });
  }
  
  /**
   * Build slot card object with unit+pilot data
   * @private
   */
  static _buildSlotCard(slot, metadata) {
    const { zone, playerId, carduid, index } = metadata;
    const unit = slot.unit;
    const pilot = slot.pilot;
    
    // Calculate slot-level totals (unit + pilot combined)
    const slotFieldValue = normalizeFieldCardValue(slot.fieldCardValue);
    const unitTotals = getTotalsFromCardData(unit);
    const pilotTotals = getTotalsFromCardData(pilot);
    const totalAP = slotFieldValue?.totalAP ?? (unitTotals.totalAP ?? 0) + (pilotTotals.totalAP ?? 0);
    const totalHP = slotFieldValue?.totalHP ?? (unitTotals.totalHP ?? 0) + (pilotTotals.totalHP ?? 0);
    
    // Determine primary card for display (unit if present, otherwise pilot)
    const primaryCard = unit || pilot;
    
    // Create display name
    let displayName;
    if (unit && pilot) {
      // Both unit and pilot present
      displayName = `${unit.cardData?.name || 'Unknown Unit'} + ${pilot.cardData?.name || 'Unknown Pilot'}`;
    } else if (unit) {
      // Unit only
      displayName = unit.cardData?.name || 'Unknown Unit';
    } else if (pilot) {
      // Pilot only
      displayName = pilot.cardData?.name || 'Unknown Pilot';
    } else {
      // Fallback (should not occur due to empty slot filtering)
      displayName = 'Empty Slot';
    }
    displayName += ` (${zone.replace('slot', 'Slot ')})`;
    
    // Create minimized card object for slot selection
    const cardObject = {
      // Essential identifiers - use primary card data
      cardId: primaryCard?.cardData?.id || primaryCard?.carduid || 'unknown',
      carduid: primaryCard?.carduid || 'unknown',
      type : "slot",
      // Display data
      displayName: displayName,
      cardData: primaryCard?.cardData || primaryCard, // For Card component rendering
      
      // Slot context (minimized)
      zone: zone,
      playerId: playerId,
      isSlotTarget: !!(unit && pilot), // True when both unit and pilot present
      
      // Slot data for rendering
      unit: unit || null,
      pilot: pilot || null,
      
      // Stats for display
      totalAP: totalAP,
      totalHP: totalHP,
      
      // Selection metadata
      selectionIndex: index
    };
    
    console.log(`🎯 Built slot card: ${displayName} (AP: ${totalAP}, HP: ${totalHP})`);
    return cardObject;
  }
  
  /**
   * Resolve carduid item (specific card references)
   * @private
   */
  static _resolveCarduid(item, gameState, index) {
    const { carduid, preSelected = false } = item;
    
    if (!carduid) {
      console.warn('ItemDataResolver: Carduid item missing carduid');
      return null;
    }
    
    // Find card in game state - check multiple locations
    let cardData = null;
    let foundLocation = null;
    
    // Check all players' hands, slots, etc.
    for (const playerId in gameState.gameEnv?.players || {}) {
      const player = gameState.gameEnv.players[playerId];
      
      // Check hand
      if (player.deck?.hand) {
        const handCard = player.deck.hand.find(card => card.carduid === carduid);
        if (handCard) {
          cardData = handCard.cardData;
          foundLocation = `${playerId}/hand`;
          break;
        }
      }
      
      // Check slots
      if (player.zones) {
        for (const zoneName in player.zones) {
          const zone = player.zones[zoneName];
          if (zone.unit?.carduid === carduid) {
            cardData = zone.unit.cardData;
            foundLocation = `${playerId}/${zoneName}/unit`;
            break;
          }
          if (zone.pilot?.carduid === carduid) {
            cardData = zone.pilot.cardData;
            foundLocation = `${playerId}/${zoneName}/pilot`;
            break;
          }
        }
        if (cardData) break;
      }
      
      // Check trash
      if (player.trashArea) {
        const trashCard = player.trashArea.find(card => card.carduid === carduid);
        if (trashCard) {
          cardData = trashCard.cardData;
          foundLocation = `${playerId}/trash`;
          break;
        }
      }
    }
    
    if (!cardData) {
      console.warn(`ItemDataResolver: Card ${carduid} not found in game state`);
      return null;
    }
    
    console.log(`🎴 Found card ${carduid} in ${foundLocation}: ${cardData.name}`);
    
    // Create minimized card object for carduid selection
    return {
      cardId: cardData.id || carduid,
      carduid: carduid,
      type: "carduid",
      displayName: cardData.name || 'Unknown Card',
      cardData: cardData, // For Card component rendering
      selectionIndex: index,
      preSelected: preSelected
    };
  }
  
  
  
  /**
   * Utility: Get all occupied slots for a player
   * @param {string} playerId - Player ID
   * @param {Object} gameState - Game state
   * @returns {Array} Array of slot items with cards
   */
  static getPlayerSlots(playerId, gameState) {
    const items = [];
    for (let i = 1; i <= 6; i++) {
      items.push({
        dialogDisplayType: 'slot',
        playerId: playerId,
        zone: `slot${i}`
      });
    }
    return this.resolveItems(items, gameState);
  }
  
  /**
   * Utility: Get opponent slots for targeting (all occupied slots)
   * @param {string} opponentId - Opponent player ID
   * @param {Object} gameState - Game state
   * @returns {Array} Array of targetable opponent slots
   */
  static getOpponentTargets(opponentId, gameState) {
    return this.getPlayerSlots(opponentId, gameState);
  }

  /**
   * Utility: Check if a card is of a specific type
   * @param {Object} card - Card object from ItemDataResolver
   * @param {string} expectedType - Expected type ("slot", "carduid", "trash")
   * @returns {boolean} True if card matches the expected type
   */
  static isCardType(card, expectedType) {
    return card && card.type === expectedType;
  }

  /**
   * Utility: Check if a card is a slot target (unit + pilot combination)
   * @param {Object} card - Card object from ItemDataResolver
   * @returns {boolean} True if card is a slot target with both unit and pilot
   */
  static isSlotTarget(card) {
    return this.isCardType(card, "slot") && card.isSlotTarget === true;
  }
}
