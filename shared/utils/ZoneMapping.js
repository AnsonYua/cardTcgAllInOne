// =======================================================================================
// 🎯 ZONE MAPPING UTILITIES - Consistent Zone Name Handling
// =======================================================================================
//
// This module provides consistent zone name mapping and validation for both 
// frontend and backend components to ensure API compatibility.
//
// Key Features:
// - Standardized zone names across frontend and backend
// - Index-to-zone and zone-to-index mapping
// - Zone validation utilities
// - Support for both legacy index format and new zone name format
//
// Standard Zone Names:
// - "top", "left", "right" - Character placement zones
// - "help" - Utility card zone
// - "sp" - Special Power card zone
//
// =======================================================================================

/**
 * Standard zone names used throughout the application
 */
const STANDARD_ZONES = ['top', 'left', 'right', 'help', 'sp'];

/**
 * Zone index mapping for backward compatibility with legacy format
 */
const ZONE_INDEX_MAP = {
    0: 'top',
    1: 'left', 
    2: 'right',
    3: 'help',
    4: 'sp'
};

/**
 * Reverse mapping from zone names to indices
 */
const INDEX_ZONE_MAP = {
    'top': 0,
    'left': 1,
    'right': 2,
    'help': 3,
    'sp': 4
};

/**
 * Character placement zones (excludes help and sp)
 */
const CHARACTER_ZONES = ['top', 'left', 'right'];

/**
 * Utility zones (help and sp)
 */
const UTILITY_ZONES = ['help', 'sp'];

class ZoneMapping {
    /**
     * Convert field index to zone name
     * @param {number} fieldIndex - Field index (0-4)
     * @returns {string|null} Zone name or null if invalid
     */
    static getZoneFromIndex(fieldIndex) {
        if (typeof fieldIndex !== 'number' || fieldIndex < 0 || fieldIndex >= STANDARD_ZONES.length) {
            console.warn(`Invalid field index: ${fieldIndex}`);
            return null;
        }
        return ZONE_INDEX_MAP[fieldIndex];
    }

    /**
     * Convert zone name to field index
     * @param {string} zoneName - Zone name
     * @returns {number} Field index or -1 if invalid
     */
    static getIndexFromZone(zoneName) {
        if (typeof zoneName !== 'string') {
            console.warn(`Invalid zone name type: ${typeof zoneName}`);
            return -1;
        }
        
        const normalizedZone = zoneName.toLowerCase();
        if (!STANDARD_ZONES.includes(normalizedZone)) {
            console.warn(`Invalid zone name: ${zoneName}`);
            return -1;
        }
        
        return INDEX_ZONE_MAP[normalizedZone];
    }

    /**
     * Validate zone name
     * @param {string} zoneName - Zone name to validate
     * @returns {boolean} True if valid zone name
     */
    static isValidZone(zoneName) {
        if (typeof zoneName !== 'string') return false;
        return STANDARD_ZONES.includes(zoneName.toLowerCase());
    }

    /**
     * Normalize zone name to lowercase standard format
     * @param {string} zoneName - Zone name to normalize
     * @returns {string|null} Normalized zone name or null if invalid
     */
    static normalizeZone(zoneName) {
        if (typeof zoneName !== 'string') return null;
        const normalized = zoneName.toLowerCase();
        return STANDARD_ZONES.includes(normalized) ? normalized : null;
    }

    /**
     * Check if zone is for character placement
     * @param {string} zoneName - Zone name to check
     * @returns {boolean} True if character zone
     */
    static isCharacterZone(zoneName) {
        if (typeof zoneName !== 'string') return false;
        return CHARACTER_ZONES.includes(zoneName.toLowerCase());
    }

    /**
     * Check if zone is for utility cards (help/sp)
     * @param {string} zoneName - Zone name to check
     * @returns {boolean} True if utility zone
     */
    static isUtilityZone(zoneName) {
        if (typeof zoneName !== 'string') return false;
        return UTILITY_ZONES.includes(zoneName.toLowerCase());
    }

    /**
     * Get all valid zone names
     * @returns {string[]} Array of valid zone names
     */
    static getAllZones() {
        return [...STANDARD_ZONES];
    }

    /**
     * Get character zones only
     * @returns {string[]} Array of character zone names
     */
    static getCharacterZones() {
        return [...CHARACTER_ZONES];
    }

    /**
     * Get utility zones only
     * @returns {string[]} Array of utility zone names
     */
    static getUtilityZones() {
        return [...UTILITY_ZONES];
    }

    /**
     * Convert legacy action format to new format
     * @param {Object} legacyAction - Legacy action with card_idx and field_idx
     * @param {string[]} playerHand - Player's hand (array of UIDs)
     * @returns {Object|null} New format action or null if conversion fails
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
     * @param {Object} newAction - New action with cardUID and zone
     * @param {string[]} playerHand - Player's hand (array of UIDs)
     * @returns {Object|null} Legacy format action or null if conversion fails
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

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ZoneMapping,
        STANDARD_ZONES,
        CHARACTER_ZONES,
        UTILITY_ZONES,
        ZONE_INDEX_MAP,
        INDEX_ZONE_MAP
    };
} else if (typeof window !== 'undefined') {
    window.ZoneMapping = ZoneMapping;
    window.STANDARD_ZONES = STANDARD_ZONES;
    window.CHARACTER_ZONES = CHARACTER_ZONES;
    window.UTILITY_ZONES = UTILITY_ZONES;
}