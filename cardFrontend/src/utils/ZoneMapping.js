/**
 * Frontend ZoneMapping Wrapper
 * Provides ES6 module interface for the shared ZoneMapping utility
 */

// Load the shared ZoneMapping utility and make it available as ES6 exports
// This is a lightweight wrapper to convert CommonJS to ES6 modules

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

/**
 * Frontend-compatible ZoneMapping class
 */
export class ZoneMapping {
  
  /**
   * Convert field index to zone name
   */
  static getZoneFromIndex(fieldIndex) {
    const zones = [ZONE_NAMES.TOP, ZONE_NAMES.LEFT, ZONE_NAMES.RIGHT, ZONE_NAMES.HELP, ZONE_NAMES.SP];
    if (typeof fieldIndex !== 'number' || fieldIndex < 0 || fieldIndex >= zones.length) {
      console.warn(`Invalid field index: ${fieldIndex}`);
      return null;
    }
    return zones[fieldIndex];
  }
  
  /**
   * Convert zone name to field index
   */
  static getIndexFromZone(zoneName) {
    if (typeof zoneName !== 'string') {
      console.warn(`Invalid zone name type: ${typeof zoneName}`);
      return -1;
    }
    
    const normalizedZone = zoneName.toLowerCase();
    return ZONE_INDICES[normalizedZone] ?? -1;
  }
  
  /**
   * Validate zone name
   */
  static isValidZone(zoneName) {
    if (typeof zoneName !== 'string') return false;
    return Object.values(ZONE_NAMES).includes(zoneName.toLowerCase());
  }
  
  /**
   * Normalize zone name to lowercase standard format
   */
  static normalizeZone(zoneName) {
    if (typeof zoneName !== 'string') return null;
    const normalized = zoneName.toLowerCase();
    return Object.values(ZONE_NAMES).includes(normalized) ? normalized : null;
  }
  
  /**
   * Check if zone is for character placement
   */
  static isCharacterZone(zoneName) {
    if (typeof zoneName !== 'string') return false;
    const characterZones = [ZONE_NAMES.TOP, ZONE_NAMES.LEFT, ZONE_NAMES.RIGHT];
    return characterZones.includes(zoneName.toLowerCase());
  }
  
  /**
   * Check if zone is for utility cards (help/sp)
   */
  static isUtilityZone(zoneName) {
    if (typeof zoneName !== 'string') return false;
    const utilityZones = [ZONE_NAMES.HELP, ZONE_NAMES.SP];
    return utilityZones.includes(zoneName.toLowerCase());
  }
  
  /**
   * Get all valid zone names
   */
  static getAllZones() {
    return Object.values(ZONE_NAMES);
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
   * Convert legacy action format to new format
   */
  static convertLegacyAction(legacyAction, playerHand) {
    if (!legacyAction || typeof legacyAction.card_idx !== 'number' || typeof legacyAction.field_idx !== 'number') {
      console.warn('Invalid legacy action format');
      return null;
    }

    if (!Array.isArray(playerHand) || legacyAction.card_idx >= playerHand.length) {
      console.warn('Invalid player hand or card index out of range');
      return null;
    }

    const zoneName = this.getZoneFromIndex(legacyAction.field_idx);
    if (!zoneName) {
      console.warn(`Invalid field index: ${legacyAction.field_idx}`);
      return null;
    }

    const cardUID = playerHand[legacyAction.card_idx];
    if (!cardUID) {
      console.warn(`Card not found at index: ${legacyAction.card_idx}`);
      return null;
    }

    return {
      type: legacyAction.type,
      cardUID: cardUID,
      zone: zoneName
    };
  }
  
  /**
   * Convert new action format to legacy format for backward compatibility
   */
  static convertToLegacyAction(newAction, playerHand) {
    if (!newAction || !newAction.cardUID || !newAction.zone) {
      console.warn('Invalid new action format');
      return null;
    }

    if (!Array.isArray(playerHand)) {
      console.warn('Invalid player hand');
      return null;
    }

    const cardIndex = playerHand.findIndex(handCardUID => handCardUID === newAction.cardUID);
    if (cardIndex === -1) {
      console.warn(`Card UID not found in hand: ${newAction.cardUID}`);
      return null;
    }

    const fieldIndex = this.getIndexFromZone(newAction.zone);
    if (fieldIndex === -1) {
      console.warn(`Invalid zone name: ${newAction.zone}`);
      return null;
    }

    return {
      type: newAction.type,
      card_idx: cardIndex,
      field_idx: fieldIndex
    };
  }
}

// Export zone constants for easy access
export const ZONES = ZONE_NAMES;
export default ZoneMapping;