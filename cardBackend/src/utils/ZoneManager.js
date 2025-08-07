/**
 * ZoneManager - Centralized zone and field operations
 * Handles all zone-related logic extracted from mozGamePlay.js
 */

const PlayerStateManager = require('./PlayerStateManager');
const CardDataValidator = require('./CardDataValidator');

class ZoneManager {
    /**
     * Zone type constants
     */
    static ZONES = {
        TOP: 'top',
        LEFT: 'left', 
        RIGHT: 'right',
        HELP: 'help',
        SP: 'sp',
        LEADER: 'leader',
        DECK: 'deck'
    };

    /**
     * Character zones that need to be filled in main phase
     */
    static CHARACTER_ZONES = [ZoneManager.ZONES.TOP, ZoneManager.ZONES.LEFT, ZoneManager.ZONES.RIGHT];

    /**
     * Utility zones (help and SP)
     */
    static UTILITY_ZONES = [ZoneManager.ZONES.HELP, ZoneManager.ZONES.SP];

    /**
     * Get all character cards from player's field
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {Array} Array of character card objects
     */
    static getCharacterCards(gameEnv, playerId) {
        const playerField = PlayerStateManager.getPlayerField(gameEnv, playerId);
        const characterCards = [];

        for (const zone of this.CHARACTER_ZONES) {
            if (CardDataValidator.zoneHasCards(playerField[zone])) {
                characterCards.push(...playerField[zone]);
            }
        }

        return characterCards;
    }

    /**
     * Get all utility cards (help + SP) from player's field  
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {Array} Array of utility card objects
     */
    static getUtilityCards(gameEnv, playerId) {
        const playerField = PlayerStateManager.getPlayerField(gameEnv, playerId);
        const utilityCards = [];

        for (const zone of this.UTILITY_ZONES) {
            if (CardDataValidator.zoneHasCards(playerField[zone])) {
                utilityCards.push(...playerField[zone]);
            }
        }

        return utilityCards;
    }

    /**
     * Check if all character zones are filled for player
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {boolean} True if all character zones filled
     */
    static areAllCharacterZonesFilled(gameEnv, playerId) {
        for (const zone of this.CHARACTER_ZONES) {
            if (!PlayerStateManager.hasCardsInZone(gameEnv, playerId, zone)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Check if help zone is filled for player
     * @param {Object} gameEnv - Game environment  
     * @param {string} playerId - Player ID
     * @returns {boolean} True if help zone filled
     */
    static isHelpZoneFilled(gameEnv, playerId) {
        return PlayerStateManager.hasCardsInZone(gameEnv, playerId, ZoneManager.ZONES.HELP);
    }

    /**
     * Check if SP zone is filled for player
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID  
     * @returns {boolean} True if SP zone filled
     */
    static isSpZoneFilled(gameEnv, playerId) {
        return PlayerStateManager.hasCardsInZone(gameEnv, playerId, ZoneManager.ZONES.SP);
    }

    /**
     * Check if all main phase zones (character + help) are complete
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {boolean} True if main phase zones complete
     */
    static areMainPhaseZonesComplete(gameEnv, playerId) {
        return this.areAllCharacterZonesFilled(gameEnv, playerId) && 
               this.isHelpZoneFilled(gameEnv, playerId);
    }

    /**
     * Check if all SP zones are filled for all players  
     * @param {Object} gameEnv - Game environment
     * @returns {boolean} True if all players have SP zones filled
     */
    static areAllSpZonesFilled(gameEnv) {
        const playerIds = PlayerStateManager.getAllPlayerIds(gameEnv);
        for (const playerId of playerIds) {
            if (!this.isSpZoneFilled(gameEnv, playerId)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get cards from specific zone with validation
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {string} zone - Zone name
     * @returns {Array} Array of card objects in zone
     */
    static getCardsInZone(gameEnv, playerId, zone) {
        return PlayerStateManager.getPlayerZone(gameEnv, playerId, zone);
    }

    /**
     * Check if zone is valid for card type
     * @param {string} zone - Zone name
     * @param {string} cardType - Card type (character, help, sp)
     * @returns {boolean} True if zone is valid for card type
     */
    static isValidZoneForCardType(zone, cardType) {
        switch (cardType) {
            case 'character':
                return this.CHARACTER_ZONES.includes(zone);
            case 'help':
                return zone === ZoneManager.ZONES.HELP;
            case 'sp':  
                return zone === ZoneManager.ZONES.SP;
            default:
                return false;
        }
    }

    /**
     * Get zone position mapping for field indices
     * @returns {Object} Zone to field index mapping
     */
    static getZoneFieldMapping() {
        return {
            [ZoneManager.ZONES.TOP]: 0,
            [ZoneManager.ZONES.LEFT]: 1,
            [ZoneManager.ZONES.RIGHT]: 2,
            [ZoneManager.ZONES.HELP]: 3,
            [ZoneManager.ZONES.SP]: 4
        };
    }

    /**
     * Get field index from zone name
     * @param {string} zone - Zone name
     * @returns {number} Field index or -1 if invalid
     */
    static getFieldIndexFromZone(zone) {
        const mapping = this.getZoneFieldMapping();
        return mapping[zone] !== undefined ? mapping[zone] : -1;
    }

    /**
     * Get zone name from field index
     * @param {number} fieldIndex - Field index
     * @returns {string|null} Zone name or null if invalid
     */
    static getZoneFromFieldIndex(fieldIndex) {
        const zones = Object.keys(this.getZoneFieldMapping());
        for (const zone of zones) {
            if (this.getZoneFieldMapping()[zone] === fieldIndex) {
                return zone;
            }
        }
        return null;
    }

    /**
     * Count total cards in all zones for player
     * @param {Object} gameEnv - Game environment  
     * @param {string} playerId - Player ID
     * @returns {number} Total card count
     */
    static getTotalCardCount(gameEnv, playerId) {
        const playerField = PlayerStateManager.getPlayerField(gameEnv, playerId);
        let total = 0;

        const allZones = [...this.CHARACTER_ZONES, ...this.UTILITY_ZONES];
        for (const zone of allZones) {
            if (CardDataValidator.zoneHasCards(playerField[zone])) {
                total += playerField[zone].length;
            }
        }

        return total;
    }

    /**
     * Get summary of all zones for player
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {Object} Zone summary object
     */
    static getZoneSummary(gameEnv, playerId) {
        return {
            characterZones: {
                top: this.getCardsInZone(gameEnv, playerId, ZoneManager.ZONES.TOP).length,
                left: this.getCardsInZone(gameEnv, playerId, ZoneManager.ZONES.LEFT).length,
                right: this.getCardsInZone(gameEnv, playerId, ZoneManager.ZONES.RIGHT).length,
                allFilled: this.areAllCharacterZonesFilled(gameEnv, playerId)
            },
            utilityZones: {
                help: this.getCardsInZone(gameEnv, playerId, ZoneManager.ZONES.HELP).length,
                sp: this.getCardsInZone(gameEnv, playerId, ZoneManager.ZONES.SP).length,
                helpFilled: this.isHelpZoneFilled(gameEnv, playerId),
                spFilled: this.isSpZoneFilled(gameEnv, playerId)
            },
            totals: {
                characterCards: this.getCharacterCards(gameEnv, playerId).length,
                utilityCards: this.getUtilityCards(gameEnv, playerId).length,
                allCards: this.getTotalCardCount(gameEnv, playerId)
            },
            phaseStatus: {
                mainPhaseComplete: this.areMainPhaseZonesComplete(gameEnv, playerId)
            }
        };
    }
}

module.exports = ZoneManager;