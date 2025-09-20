// ItemDataResolver.js
// Resolves simplified item references to full card objects for dialog display
// Replaces complex eligibleCards construction with simple item specifications

import CardStatCalculator from './CardStatCalculator.js';

/**
 * ItemDataResolver - Converts simplified item references to dialog-ready card objects
 * 
 * Supported Item Types:
 * - slot: { type: 'slot', playerId, zone, constraints?, cardUid? }
 * - carduid: { type: 'carduid', cardUid, preSelected? }
 * - trash: { type: 'trash', playerId, directCards? }
 * 
 * Output Card Types:
 * - Slot cards: { type: "slot", cardId, cardUid, displayName, cardData, zone, playerId, isSlotTarget, unit, pilot, totalAP, totalHP, selectionIndex }
 * - CardUID cards: { type: "carduid", cardId, cardUid, displayName, cardData, selectionIndex, preSelected? }
 * - Trash cards: { type: "trash", cardId, cardUid, displayName, cardData, selectionIndex, inTrash }
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
        // Special handling for trash items that return multiple cards
        if (item.type === 'trash') {
          const trashCards = this._resolveTrash(item, gameState, index);
          if (trashCards && Array.isArray(trashCards)) {
            resolved.push(...trashCards);
            console.log(`✅ Resolved trash item ${index}: ${trashCards.length} cards`);
          }
        } else {
          // Regular single-card items
          const result = this._resolveItem(item, gameState, index);
          if (result) {
            resolved.push(result);
            console.log(`✅ Resolved item ${index}:`, item.type, result.displayName || result.cardData?.name || 'Unknown');
          }
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
    if (!item || !item.type) {
      console.warn('ItemDataResolver: Invalid item - missing type');
      return null;
    }
    
    switch (item.type) {
      case 'slot':
        return this._resolveSlot(item, gameState, index);
      case 'carduid':
        return this._resolveCardUID(item, gameState, index);
      case 'trash':
        return this._resolveTrash(item, gameState, index);
      default:
        console.warn(`ItemDataResolver: Unknown item type: ${item.type}`);
        return null;
    }
  }
  
  /**
   * Resolve slot item (player/opponent zones)
   * @private
   */
  static _resolveSlot(item, gameState, index) {
    const { playerId, zone, constraints = [], cardUid } = item;
    
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
    
    // Apply constraints
    if (constraints.includes('has-unit') && !slot.unit) {
      console.log(`ItemDataResolver: Slot ${zone} has no unit (constraint: has-unit)`);
      return null;
    }
    
    if (constraints.includes('no-pilot') && slot.pilot) {
      console.log(`ItemDataResolver: Slot ${zone} has pilot (constraint: no-pilot)`);
      return null;
    }
    
    if (constraints.includes('has-pilot') && !slot.pilot) {
      console.log(`ItemDataResolver: Slot ${zone} has no pilot (constraint: has-pilot)`);
      return null;
    }
    
    // Specific card constraint
    if (cardUid && slot.unit?.cardUid !== cardUid) {
      console.log(`ItemDataResolver: Slot ${zone} unit cardUid ${slot.unit?.cardUid} != ${cardUid}`);
      return null;
    }
    
    // Must have at least a unit
    if (!slot.unit) {
      console.log(`ItemDataResolver: Slot ${zone} has no unit`);
      return null;
    }
    
    // Build card object for dialog display
    return this._buildSlotCard(slot, { zone, playerId, cardUid, index });
  }
  
  /**
   * Build slot card object with unit+pilot data
   * @private
   */
  static _buildSlotCard(slot, metadata) {
    const { zone, playerId, cardUid, index } = metadata;
    const unit = slot.unit;
    const pilot = slot.pilot;
    
    // Calculate slot-level totals (unit + pilot combined)
    const { totalAP, totalHP } = CardStatCalculator.calculateSlotDataTotals(slot);
    
    // Create display name
    let displayName = unit.cardData?.name || 'Unknown Unit';
    if (pilot && pilot.cardData?.name) {
      displayName += ` + ${pilot.cardData.name}`;
    }
    displayName += ` (${zone.replace('slot', 'Slot ')})`;
    
    // Create minimized card object for slot selection
    const cardObject = {
      // Essential identifiers
      cardId: unit.cardData?.id || unit.cardUid,
      cardUid: unit.cardUid,
      type : "slot",
      // Display data
      displayName: displayName,
      cardData: unit.cardData || unit, // For Card component rendering
      
      // Slot context (minimized)
      zone: zone,
      playerId: playerId,
      isSlotTarget: !!pilot,
      
      // Slot data for rendering
      unit: unit,
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
   * Resolve cardUID item (specific card references)
   * @private
   */
  static _resolveCardUID(item, gameState, index) {
    const { cardUid, preSelected = false } = item;
    
    if (!cardUid) {
      console.warn('ItemDataResolver: CardUID item missing cardUid');
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
        const handCard = player.deck.hand.find(card => card.cardUid === cardUid);
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
          if (zone.unit?.cardUid === cardUid) {
            cardData = zone.unit.cardData;
            foundLocation = `${playerId}/${zoneName}/unit`;
            break;
          }
          if (zone.pilot?.cardUid === cardUid) {
            cardData = zone.pilot.cardData;
            foundLocation = `${playerId}/${zoneName}/pilot`;
            break;
          }
        }
        if (cardData) break;
      }
      
      // Check trash
      if (player.trashArea) {
        const trashCard = player.trashArea.find(card => card.cardUid === cardUid);
        if (trashCard) {
          cardData = trashCard.cardData;
          foundLocation = `${playerId}/trash`;
          break;
        }
      }
    }
    
    if (!cardData) {
      console.warn(`ItemDataResolver: Card ${cardUid} not found in game state`);
      return null;
    }
    
    console.log(`🎴 Found card ${cardUid} in ${foundLocation}: ${cardData.name}`);
    
    // Create minimized card object for cardUID selection
    return {
      cardId: cardData.id || cardUid,
      cardUid: cardUid,
      type: "carduid",
      displayName: cardData.name || 'Unknown Card',
      cardData: cardData, // For Card component rendering
      selectionIndex: index,
      preSelected: preSelected
    };
  }
  
  /**
   * Resolve trash item (direct card arrays)
   * @private
   */
  static _resolveTrash(item, gameState, index) {
    const { playerId, directCards } = item;
    
    if (!playerId) {
      console.warn('ItemDataResolver: Trash item missing playerId');
      return null;
    }
    
    // If directCards is provided, use it directly (for GameScene trash viewing)
    if (directCards && Array.isArray(directCards)) {
      console.log(`ItemDataResolver: Using direct trash cards (${directCards.length} cards)`);
      return directCards.map((card, trashIndex) => ({
        cardId: card.cardData?.id || card.id,
        cardUid: card.cardUid || `trash_${trashIndex}`,
        type: "trash",
        displayName: card.cardData?.name || card.name || 'Unknown Card',
        cardData: card.cardData || card, // For Card component rendering
        selectionIndex: trashIndex,
        inTrash: true
      }));
    }
    
    // Otherwise, get trash from game state
    const player = gameState.gameEnv?.players?.[playerId];
    if (!player || !player.zones || !player.zones.trashArea) {
      console.warn(`ItemDataResolver: Player ${playerId} trash area not found`);
      return null;
    }
    
    const trashArea = player.zones.trashArea;
    console.log(`ItemDataResolver: Resolving trash area for ${playerId} (${trashArea.length} cards)`);
    
    return trashArea.map((card, trashIndex) => ({
      cardId: card.cardData?.id || card.id,
      cardUid: card.cardUid || `trash_${trashIndex}`,
      type: "trash",
      displayName: card.cardData?.name || card.name || 'Unknown Card',
      cardData: card.cardData || card, // For Card component rendering
      selectionIndex: trashIndex,
      inTrash: true
    }));
  }
  
  
  /**
   * Utility: Get all valid slots for a player with optional constraints
   * @param {string} playerId - Player ID
   * @param {Array} constraints - Array of constraint strings
   * @param {Object} gameState - Game state
   * @returns {Array} Array of slot items
   */
  static getPlayerSlots(playerId, constraints = [], gameState) {
    const items = [];
    for (let i = 1; i <= 6; i++) {
      items.push({
        type: 'slot',
        playerId: playerId,
        zone: `slot${i}`,
        constraints: constraints
      });
    }
    return this.resolveItems(items, gameState);
  }
  
  /**
   * Utility: Get opponent slots for targeting
   * @param {string} opponentId - Opponent player ID
   * @param {Object} gameState - Game state
   * @returns {Array} Array of targetable opponent slots
   */
  static getOpponentTargets(opponentId, gameState) {
    return this.getPlayerSlots(opponentId, ['has-unit'], gameState);
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