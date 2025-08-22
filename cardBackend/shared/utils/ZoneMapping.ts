// =======================================================================================
// 🎯 ZONE MAPPING UTILITIES - Consistent Zone Name Handling (TypeScript)
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
// - Full TypeScript type safety
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
export const STANDARD_ZONES = ['top', 'left', 'right', 'help', 'sp'] as const;

/**
 * Character placement zones (excludes help and sp)
 */
export const CHARACTER_ZONES = ['top', 'left', 'right'] as const;

/**
 * Utility zones (help and sp)
 */
export const UTILITY_ZONES = ['help', 'sp'] as const;

/**
 * Type for valid zone names
 */
export type ZoneName = typeof STANDARD_ZONES[number];

/**
 * Type for character zone names
 */
export type CharacterZone = typeof CHARACTER_ZONES[number];

/**
 * Type for utility zone names
 */
export type UtilityZone = typeof UTILITY_ZONES[number];

/**
 * Zone index mapping for backward compatibility with legacy format
 */
export const ZONE_INDEX_MAP: Record<number, ZoneName> = {
    0: 'top',
    1: 'left', 
    2: 'right',
    3: 'help',
    4: 'sp'
};

/**
 * Reverse mapping from zone names to indices
 */
export const INDEX_ZONE_MAP: Record<ZoneName, number> = {
    'top': 0,
    'left': 1,
    'right': 2,
    'help': 3,
    'sp': 4
};

/**
 * Legacy action format interface
 */
export interface LegacyAction {
    type: string;
    card_idx: number;
    field_idx: number;
}

/**
 * New action format interface
 */
export interface NewAction {
    type: string;
    cardUID: string;
    zone: ZoneName;
}

/**
 * Zone mapping utility class with TypeScript support
 */
export class ZoneMapping {
    /**
     * Convert field index to zone name
     * @param fieldIndex - Field index (0-4)
     * @returns Zone name or null if invalid
     */
    static getZoneFromIndex(fieldIndex: number): ZoneName | null {
        if (typeof fieldIndex !== 'number' || fieldIndex < 0 || fieldIndex >= STANDARD_ZONES.length) {
            console.warn(`Invalid field index: ${fieldIndex}`);
            return null;
        }
        return ZONE_INDEX_MAP[fieldIndex];
    }

    /**
     * Convert zone name to field index
     * @param zoneName - Zone name
     * @returns Field index or -1 if invalid
     */
    static getIndexFromZone(zoneName: string): number {
        if (typeof zoneName !== 'string') {
            console.warn(`Invalid zone name type: ${typeof zoneName}`);
            return -1;
        }
        const normalizedZone = zoneName.toLowerCase() as ZoneName;
        if (!STANDARD_ZONES.includes(normalizedZone)) {
            console.warn(`Invalid zone name: ${zoneName}`);
            return -1;
        }
        return INDEX_ZONE_MAP[normalizedZone];
    }

    /**
     * Validate zone name
     * @param zoneName - Zone name to validate
     * @returns True if valid zone name
     */
    static isValidZone(zoneName: string): zoneName is ZoneName {
        if (typeof zoneName !== 'string') return false;
        return STANDARD_ZONES.includes(zoneName.toLowerCase() as ZoneName);
    }

    /**
     * Normalize zone name to lowercase standard format
     * @param zoneName - Zone name to normalize
     * @returns Normalized zone name or null if invalid
     */
    static normalizeZone(zoneName: string): ZoneName | null {
        if (!this.isValidZone(zoneName)) return null;
        return zoneName.toLowerCase() as ZoneName;
    }

    /**
     * Check if zone is for character placement
     * @param zoneName - Zone name to check
     * @returns True if character zone
     */
    static isCharacterZone(zoneName: string): zoneName is CharacterZone {
        if (typeof zoneName !== 'string') return false;
        return CHARACTER_ZONES.includes(zoneName.toLowerCase() as CharacterZone);
    }

    /**
     * Check if zone is for utility cards (help/sp)
     * @param zoneName - Zone name to check
     * @returns True if utility zone
     */
    static isUtilityZone(zoneName: string): zoneName is UtilityZone {
        if (typeof zoneName !== 'string') return false;
        return UTILITY_ZONES.includes(zoneName.toLowerCase() as UtilityZone);
    }

    /**
     * Get all valid zone names
     * @returns Array of valid zone names
     */
    static getAllZones(): readonly ZoneName[] {
        return STANDARD_ZONES;
    }

    /**
     * Get character zones only
     * @returns Array of character zone names
     */
    static getCharacterZones(): readonly CharacterZone[] {
        return CHARACTER_ZONES;
    }

    /**
     * Get utility zones only
     * @returns Array of utility zone names
     */
    static getUtilityZones(): readonly UtilityZone[] {
        return UTILITY_ZONES;
    }

    /**
     * Convert legacy action format to new format
     * @param legacyAction - Legacy action with card_idx and field_idx
     * @param playerHand - Player's hand (array of UIDs)
     * @returns New format action or null if conversion fails
     */
    static convertLegacyAction(legacyAction: LegacyAction, playerHand: string[]): NewAction | null {
        const { type, card_idx, field_idx } = legacyAction;
        
        if (card_idx < 0 || card_idx >= playerHand.length) {
            console.warn(`Invalid card_idx: ${card_idx}, hand size: ${playerHand.length}`);
            return null;
        }
        
        const zone = this.getZoneFromIndex(field_idx);
        if (!zone) {
            console.warn(`Invalid field_idx: ${field_idx}`);
            return null;
        }
        
        return {
            type,
            cardUID: playerHand[card_idx],
            zone
        };
    }

    /**
     * Convert new action format to legacy format for backward compatibility
     * @param newAction - New action with cardUID and zone
     * @param playerHand - Player's hand (array of UIDs)
     * @returns Legacy format action or null if conversion fails
     */
    static convertToLegacyAction(newAction: NewAction, playerHand: string[]): LegacyAction | null {
        const { type, cardUID, zone } = newAction;
        
        const card_idx = playerHand.indexOf(cardUID);
        if (card_idx === -1) {
            console.warn(`Card UID not found in hand: ${cardUID}`);
            return null;
        }
        
        const field_idx = this.getIndexFromZone(zone);
        if (field_idx === -1) {
            console.warn(`Invalid zone: ${zone}`);
            return null;
        }
        
        return {
            type,
            card_idx,
            field_idx
        };
    }
}

// CommonJS compatibility export
export default {
    ZoneMapping,
    STANDARD_ZONES,
    CHARACTER_ZONES,
    UTILITY_ZONES,
    ZONE_INDEX_MAP,
    INDEX_ZONE_MAP
};