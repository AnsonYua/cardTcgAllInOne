/**
 * Zone Mapping Utility
 * Provides consistent zone name handling between frontend and backend
 */

// Standard zone names used throughout the system
export const ZONE_NAMES = {
  TOP: 'top',
  LEFT: 'left', 
  RIGHT: 'right',
  HELP: 'help',
  SP: 'sp',
  LEADER: 'leader'
};

// Zone types for validation
export const ZONE_TYPES = {
  CHARACTER: 'character',  // top, left, right
  UTILITY: 'utility',     // help, sp
  LEADER: 'leader'        // leader
};

// Zone indices mapping (for backward compatibility)
export const ZONE_INDICES = {
  [ZONE_NAMES.TOP]: 0,
  [ZONE_NAMES.LEFT]: 1, 
  [ZONE_NAMES.RIGHT]: 2,
  [ZONE_NAMES.HELP]: 3,
  [ZONE_NAMES.SP]: 4
};

export class ZoneMapping {
  
  /**
   * Convert zone index to zone name
   */
  static indexToZone(index) {
    const zones = [ZONE_NAMES.TOP, ZONE_NAMES.LEFT, ZONE_NAMES.RIGHT, ZONE_NAMES.HELP, ZONE_NAMES.SP];
    return zones[index] || null;
  }
  
  /**
   * Convert zone name to zone index
   */
  static zoneToIndex(zoneName) {
    return ZONE_INDICES[zoneName] ?? -1;
  }
  
  /**
   * Validate zone name
   */
  static isValidZone(zoneName) {
    return Object.values(ZONE_NAMES).includes(zoneName);
  }
  
  /**
   * Get zone type (character/utility/leader)
   */
  static getZoneType(zoneName) {
    if ([ZONE_NAMES.TOP, ZONE_NAMES.LEFT, ZONE_NAMES.RIGHT].includes(zoneName)) {
      return ZONE_TYPES.CHARACTER;
    }
    if ([ZONE_NAMES.HELP, ZONE_NAMES.SP].includes(zoneName)) {
      return ZONE_TYPES.UTILITY;
    }
    if (zoneName === ZONE_NAMES.LEADER) {
      return ZONE_TYPES.LEADER;
    }
    return null;
  }
  
  /**
   * Get character zones only
   */
  static getCharacterZones() {
    return [ZONE_NAMES.TOP, ZONE_NAMES.LEFT, ZONE_NAMES.RIGHT];
  }
  
  /**
   * Get utility zones only
   */
  static getUtilityZones() {
    return [ZONE_NAMES.HELP, ZONE_NAMES.SP];
  }
  
  /**
   * Convert legacy field_idx to zone name
   */
  static fieldIndexToZone(fieldIdx) {
    return this.indexToZone(fieldIdx);
  }
  
  /**
   * Convert zone name to legacy field_idx
   */
  static zoneToFieldIndex(zoneName) {
    return this.zoneToIndex(zoneName);
  }
  
  /**
   * Normalize zone name (handle case variations)
   */
  static normalizeZone(zoneName) {
    if (!zoneName) return null;
    const normalized = zoneName.toLowerCase().trim();
    return Object.values(ZONE_NAMES).find(zone => zone === normalized) || null;
  }
  
  /**
   * Convert action from old format to new format
   */
  static convertLegacyAction(legacyAction, hand) {
    if (legacyAction.cardUID && legacyAction.zone) {
      return legacyAction; // Already new format
    }
    
    if (legacyAction.card_idx !== undefined && legacyAction.field_idx !== undefined) {
      // Convert from legacy format
      const cardUID = hand[legacyAction.card_idx];
      const zone = this.indexToZone(legacyAction.field_idx);
      
      return {
        ...legacyAction,
        cardUID,
        zone,
        // Keep legacy fields for backward compatibility
        card_idx: legacyAction.card_idx,
        field_idx: legacyAction.field_idx
      };
    }
    
    return legacyAction;
  }
  
  /**
   * Convert action from new format to old format
   */
  static convertToLegacyAction(newAction, hand) {
    if (newAction.card_idx !== undefined && newAction.field_idx !== undefined) {
      return newAction; // Already legacy format
    }
    
    if (newAction.cardUID && newAction.zone) {
      // Convert to legacy format
      const card_idx = hand.findIndex(cardUID => cardUID === newAction.cardUID);
      const field_idx = this.zoneToIndex(newAction.zone);
      
      return {
        ...newAction,
        card_idx,
        field_idx,
        // Keep new fields for forward compatibility
        cardUID: newAction.cardUID,
        zone: newAction.zone
      };
    }
    
    return newAction;
  }
}

// Export zone constants for easy access
export { ZONE_NAMES as ZONES };
export default ZoneMapping;