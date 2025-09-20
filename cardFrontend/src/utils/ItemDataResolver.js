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
 * 
 * Note: Trash items are handled directly in GameScene.js (no conversion needed)
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
    
    const resolved = items.map((item, index) => {
      try {
        const result = this._resolveItem(item, gameState, index);
        if (result) {
          console.log(`✅ Resolved item ${index}:`, item.type, result.displayName || result.cardData?.name || 'Unknown');
        }
        return result;
      } catch (error) {
        console.error(`❌ Failed to resolve item ${index}:`, item, error);
        return null;
      }
    }).filter(Boolean);
    
    console.log(`📊 ItemDataResolver: Resolved ${resolved.length}/${items.length} items successfully`);
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
    
    // Create card object in current dialog format
    const cardObject = {
      // Core identifiers
      cardId: unit.cardData?.id || unit.cardUid,
      cardUid: unit.cardUid || cardUid,
      zone: zone,
      playerId: playerId,
      
      // Slot-level totals (unit + pilot combined)
      totalAP: totalAP,
      totalHP: totalHP,
      
      // Selection metadata
      selectionIndex: index,
      displayName: displayName,
      
      // Slot target display format (for _createSlotTargetDisplay compatibility)
      isSlotTarget: !!pilot,
      unit: {
        cardId: unit.cardData?.id || unit.cardUid,
        cardData: unit.cardData || { name: 'Unknown Unit', hp: 0, ap: 0 },
        originalAP: CardStatCalculator.getOriginalAP(unit),
        originalHP: CardStatCalculator.getOriginalHP(unit),
        damageReceived: unit.damageReceived || 0
      },
      pilot: pilot ? {
        cardId: pilot.cardData?.id || `${unit.cardUid}_pilot`,
        cardData: pilot.cardData,
        name: pilot.cardData?.name || 'Pilot',
        originalAP: CardStatCalculator.getOriginalAP(pilot),
        originalHP: CardStatCalculator.getOriginalHP(pilot)
      } : null,
      
      // Legacy compatibility fields
      slot: zone,
      slotName: zone
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
    
    // Create card object for dialog display
    return {
      cardData: cardData,
      cardId: cardData.id || cardUid,
      cardUid: cardUid,
      preSelected: preSelected,
      selectionIndex: index,
      displayName: cardData.name || 'Unknown Card'
    };
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
}