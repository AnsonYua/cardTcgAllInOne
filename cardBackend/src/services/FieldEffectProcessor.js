const { getPlayerFromGameEnv, getPlayerData, getPlayerField, getPlayerFieldEffects, setPlayerFieldEffects } = require('../utils/gameUtils');
const CardInfoUtils = require('./CardInfoUtils');
const DeckManager = require('./DeckManager');

/**
 * FieldEffectProcessor - Manages field effects from leader cards and continuous effects
 * 
 * Field effects include:
 * - Zone restrictions (what card types can be played in zones)
 * - Power modifications (bonuses/penalties to card power)
 * - Continuous effects from leaders and other cards
 */
class FieldEffectProcessor {
    constructor() {
        this.cardInfoUtils = CardInfoUtils;
        this.deckManager = DeckManager;
    }

    /**
     * Initializes field effects structure for a player
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     */
    initializePlayerFieldEffects(gameEnv, playerId) {
        const fieldEffects = {
            zoneRestrictions: {
                "TOP": "ALL",
                "LEFT": "ALL", 
                "RIGHT": "ALL",
                "HELP": "ALL",
                "SP": "ALL"
            },
            activeEffects: []
        };
        
        setPlayerFieldEffects(gameEnv, playerId, fieldEffects);
        console.log(`🔧 Initialized field effects for ${playerId}`);
    }


    /**
     * Applies zone restriction effect to a player
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Target player ID
     * @param {Object} effect - Zone restriction effect
     */
    async applyZoneRestriction(gameEnv, playerId, effect) {
        if (effect.restriction && typeof effect.restriction === 'object') {
            // Handle zone-specific restrictions
            const playerFieldEffects = getPlayerFieldEffects(gameEnv, playerId);
            for (const [zone, allowedTypes] of Object.entries(effect.restriction)) {
                if (Array.isArray(allowedTypes)) {
                    playerFieldEffects.zoneRestrictions[zone] = allowedTypes;
                    console.log(`🚫 Zone restriction applied to ${playerId} ${zone}: ${allowedTypes.join(', ')}`);
                }
            }
        } else if (effect.restriction && Array.isArray(effect.restriction)) {
            // Handle uniform restrictions across specified zones
            const zones = effect.target.zones === "ALL" ? ["TOP", "LEFT", "RIGHT", "HELP", "SP"] : effect.target.zones;
            const playerFieldEffects = getPlayerFieldEffects(gameEnv, playerId);
            for (const zone of zones) {
                playerFieldEffects.zoneRestrictions[zone] = effect.restriction;
                console.log(`🚫 Zone restriction applied to ${playerId} ${zone}: ${effect.restriction.join(', ')}`);
            }
        }
    }

    /**
     * Gets target players for an effect based on scope
     * @param {Object} gameEnv - Game environment
     * @param {string} sourcePlayerId - Source player ID
     * @param {string} scope - Effect scope (SELF, OPPONENT, ALL)
     * @returns {Array} Array of target player IDs
     */
    getTargetPlayers(gameEnv, sourcePlayerId, scope) {
        const playerList = getPlayerFromGameEnv(gameEnv);
        
        switch (scope) {
            case "SELF":
                return [sourcePlayerId];
            case "OPPONENT":
                return playerList.filter(id => id !== sourcePlayerId);
            case "ALL":
                return playerList;
            default:
                return [sourcePlayerId];
        }
    }

    /**
     * Clears all field effects from a player's leader
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     */
    async clearPlayerLeaderEffects(gameEnv, playerId) {
        const playerList = getPlayerFromGameEnv(gameEnv);
        
        // Remove effects from all players that were created by this player's leader
        for (const targetPlayerId of playerList) {
            const targetPlayerFieldEffects = getPlayerFieldEffects(gameEnv, targetPlayerId);
            if (targetPlayerFieldEffects) {
                const currentLeader = this.cardInfoUtils.getCurrentLeader(gameEnv, playerId);
                targetPlayerFieldEffects.activeEffects = 
                    targetPlayerFieldEffects.activeEffects.filter(
                        effect => !(effect.source === currentLeader.id && effect.sourcePlayerId === playerId)
                    );
            }
        }
        
        // Reset this player's zone restrictions to default
        const playerFieldEffects = getPlayerFieldEffects(gameEnv, playerId);
        if (playerFieldEffects) {
            playerFieldEffects.zoneRestrictions = {
                "TOP": "ALL",
                "LEFT": "ALL", 
                "RIGHT": "ALL",
                "HELP": "ALL",
                "SP": "ALL"
            };
        }
        
        console.log(`🧹 Cleared leader effects for ${playerId}`);
    }

    /**
     * @deprecated Use OptimizedGameEngine.validateCardPlacementWithFieldEffects() instead
     * This method is maintained for legacy compatibility only
     */
    async validateCardPlacementWithFieldEffects(gameEnv, playerId, cardDetails, zone) {
        console.warn('⚠️ DEPRECATED: FieldEffectProcessor.validateCardPlacementWithFieldEffects is deprecated. Use OptimizedGameEngine instead.');
        
        // Fallback to basic validation for legacy compatibility
        const { getPlayerFieldEffects } = require('../utils/gameUtils');
        let playerFieldEffects = getPlayerFieldEffects(gameEnv, playerId);
        if (!playerFieldEffects) {
            this.initializePlayerFieldEffects(gameEnv, playerId);
            playerFieldEffects = getPlayerFieldEffects(gameEnv, playerId);
        }
        
        // Basic zone restriction check
        const zoneRestrictions = playerFieldEffects.zoneRestrictions[zone.toUpperCase()];
        if (zoneRestrictions === "ALL" || (Array.isArray(zoneRestrictions) && zoneRestrictions.includes("ALL"))) {
            return { canPlace: true, reason: "No restrictions (legacy path)" };
        }
        
        return { canPlace: true, reason: "Legacy validation - use OptimizedGameEngine for full validation" };
    }

    /**
     * Calculates modified power for a card considering field effects
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {Object} cardDetails - Card details
     * @param {number} basePower - Base power of the card
     * @returns {number} Modified power value
     */
    async calculateModifiedPower(gameEnv, playerId, cardDetails, basePower) {
        const playerFieldEffects = getPlayerFieldEffects(gameEnv, playerId);
        if (!playerFieldEffects) {
            return basePower;
        }
        
        let modifiedPower = basePower;
        const effects = playerFieldEffects.activeEffects;
        
        // Apply power modification effects (only enabled ones - January 2025)
        const enabledEffects = effects.filter(effect => effect.isEnabled !== false);
        const disabledEffects = effects.filter(effect => effect.isEnabled === false);
        
        if (disabledEffects.length > 0) {
            console.log(`🚫 FieldEffectProcessor: Skipping ${disabledEffects.length} disabled effect(s) for ${cardDetails.name}`);
        }
        
        for (const effect of enabledEffects) {
            if (effect.type === "powerBoost") {
                if (await this.doesEffectAffectCard(effect, cardDetails)) {
                    modifiedPower += effect.value;
                    console.log(`⚡ Power boost applied to ${cardDetails.name}: ${effect.value} (${basePower} → ${modifiedPower})`);
                }
            } else if (effect.type === "POWER_NULLIFICATION") {
                if (await this.doesEffectAffectCard(effect, cardDetails)) {
                    modifiedPower = 0;
                    console.log(`🚫 Power nullification applied to ${cardDetails.name}: ${basePower} → 0`);
                }
            }
        }
        
        return modifiedPower;
    }

    /**
     * Checks if an effect affects a specific card
     * @param {Object} effect - Effect to check
     * @param {Object} cardDetails - Card details
     * @returns {boolean} True if effect affects the card
     */
    async doesEffectAffectCard(effect, cardDetails) {
        const target = effect.target;
        
        // Check card type filter
        if (target.cardTypes && target.cardTypes !== "ALL") {
            if (!target.cardTypes.includes(cardDetails.cardType)) {
                return false;
            }
        }
        
        // Check game type filter
        if (target.gameTypes && target.gameTypes !== "ALL") {
            if (!target.gameTypes.includes(cardDetails.gameType)) {
                return false;
            }
        }
        
        // Check traits filter
        if (target.traits && target.traits !== "ALL") {
            const cardTraits = cardDetails.traits || [];
            const hasMatchingTrait = target.traits.some(trait => cardTraits.includes(trait));
            if (!hasMatchingTrait) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Gets current zone restrictions for a player
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {string} zone - Zone name
     * @returns {Array|string} Allowed card types or "ALL"
     */
    getZoneRestrictions(gameEnv, playerId, zone) {
        const playerFieldEffects = getPlayerFieldEffects(gameEnv, playerId);
        if (!playerFieldEffects) {
            return "ALL";
        }
        
        return playerFieldEffects.zoneRestrictions[zone.toUpperCase()] || "ALL";
    }

}

module.exports = new FieldEffectProcessor();