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
     * Processes leader field effects when a leader is set
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {Object} leader - Leader card data
     */
    async processLeaderFieldEffects(gameEnv, playerId, leader) {
        console.log(`🎯 Processing leader field effects for ${playerId}: ${leader.name}`);
        
        // Clear existing effects from this player's leader
        await this.clearPlayerLeaderEffects(gameEnv, playerId);
        
        // Get leader card data
        const leaderCards = require('../data/leaderCards.json');
        const leaderData = leaderCards.leaders[leader.id];
        
        if (!leaderData) {
            console.log(`⚠️  No leader data found for ${leader.id}`);
            return;
        }
        
        // Convert zoneCompatibility to field effects
        if (leaderData.zoneCompatibility) {
            const zoneRestrictionEffect = {
                type: "ZONE_RESTRICTION",
                target: {
                    scope: "SELF",
                    zones: ["TOP", "LEFT", "RIGHT"]
                },
                restriction: {
                    TOP: leaderData.zoneCompatibility.top || "ALL",
                    LEFT: leaderData.zoneCompatibility.left || "ALL",
                    RIGHT: leaderData.zoneCompatibility.right || "ALL"
                }
            };
            
            await this.applyFieldEffect(gameEnv, playerId, leader.id, zoneRestrictionEffect);
        }
        
        // Process power modification effects from leader.effects.rules
        if (leaderData.effects && leaderData.effects.rules) {
            for (const rule of leaderData.effects.rules) {
                if (rule.type === 'continuous') {
                    // Check conditions before applying effect
                    const shouldApply = await this.checkEffectConditions(gameEnv, playerId, rule);
                    if (shouldApply) {
                        // Convert existing effect rules to field effects
                        const fieldEffect = await this.convertEffectRuleToFieldEffect(rule);
                        if (fieldEffect) {
                            await this.applyFieldEffect(gameEnv, playerId, leader.id, fieldEffect);
                        }
                    }
                }
            }
        }
        
        // Special handling for cross-player effects
        await this.processCrossPlayerEffects(gameEnv, playerId, leaderData);
        
        console.log(`✅ Processed field effects for ${playerId}`);
    }

    /**
     * Processes cross-player effects (effects that target opponent)
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {Object} leaderData - Leader card data
     */
    async processCrossPlayerEffects(gameEnv, playerId, leaderData) {
        // Powell's effect: nullifies opponent's economic cards
        if (leaderData.name === '鮑威爾') {
            const powerNullificationEffect = {
                type: "POWER_NULLIFICATION",
                target: {
                    scope: "OPPONENT",
                    zones: "ALL",
                    traits: ["經濟"]
                },
                value: 0
            };
            
            await this.applyFieldEffect(gameEnv, playerId, leaderData.id, powerNullificationEffect);
        }
    }

    /**
     * Checks if effect conditions are met
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {Object} rule - Effect rule
     * @returns {boolean} True if conditions are met
     */
    async checkEffectConditions(gameEnv, playerId, rule) {
        if (!rule.trigger || !rule.trigger.conditions) {
            return true; // No conditions means always apply
        }
        
        for (const condition of rule.trigger.conditions) {
            if (condition.type === 'opponentLeader') {
                // Check if opponent has specific leader
                const playerList = getPlayerFromGameEnv(gameEnv);
                const opponentId = playerList.find(id => id !== playerId);
                
                if (opponentId) {
                    const opponentLeader = this.cardInfoUtils.getCurrentLeader(gameEnv, opponentId);
                    if (opponentLeader && opponentLeader.name !== condition.value) {
                        return false; // Condition not met
                    }
                }
            }
        }
        
        return true;
    }

    /**
     * Converts existing effect rules to field effects
     * @param {Object} rule - Effect rule from leader card
     * @returns {Object|null} Field effect object or null if not convertible
     */
    async convertEffectRuleToFieldEffect(rule) {
        if (!rule.effect) return null;
        
        // Convert power boost effects
        if (rule.effect.type === 'powerBoost') {
            const fieldEffect = {
                type: "powerBoost",
                target: {
                    scope: "SELF",
                    zones: "ALL"
                },
                value: rule.effect.value
            };
            
            // Add targeting based on filters
            if (rule.target && rule.target.filters) {
                for (const filter of rule.target.filters) {
                    if (filter.type === 'gameType') {
                        fieldEffect.target.gameTypes = [filter.value];
                    } else if (filter.type === 'gameTypeOr') {
                        fieldEffect.target.gameTypes = filter.values;
                    } else if (filter.type === 'trait') {
                        fieldEffect.target.traits = [filter.value];
                    }
                }
            }
            
            // If no filters, affect all cards
            if (!fieldEffect.target.gameTypes && !fieldEffect.target.traits) {
                fieldEffect.target.gameTypes = "ALL";
            }
            
            return fieldEffect;
        }
        
        // Convert power nullification effects
        if (rule.effect.type === 'setPower' && rule.effect.value === 0) {
            const fieldEffect = {
                type: "POWER_NULLIFICATION",
                target: {
                    scope: "SELF",
                    zones: "ALL"
                },
                value: 0
            };
            
            // Add targeting based on filters
            if (rule.target && rule.target.filters) {
                for (const filter of rule.target.filters) {
                    if (filter.type === 'gameType') {
                        fieldEffect.target.gameTypes = [filter.value];
                    } else if (filter.type === 'trait') {
                        fieldEffect.target.traits = [filter.value];
                    }
                }
            }
            
            return fieldEffect;
        }
        
        return null;
    }

    /**
     * Applies a single field effect to the game environment
     * @param {Object} gameEnv - Game environment
     * @param {string} sourcePlayerId - Player who owns the card creating the effect
     * @param {string} sourceCardId - Card ID creating the effect
     * @param {Object} effect - Effect definition
     */
    async applyFieldEffect(gameEnv, sourcePlayerId, sourceCardId, effect) {
        const effectId = `${sourceCardId}_${effect.type}_${Date.now()}`;
        
        // Determine target players
        const targetPlayers = this.getTargetPlayers(gameEnv, sourcePlayerId, effect.target.scope);
        
        for (const targetPlayerId of targetPlayers) {
            // Ensure target player has field effects initialized
            let targetPlayerFieldEffects = getPlayerFieldEffects(gameEnv, targetPlayerId);
            if (!targetPlayerFieldEffects) {
                this.initializePlayerFieldEffects(gameEnv, targetPlayerId);
            }
            
            // Add effect to target player's active effects
            const activeEffect = {
                effectId: effectId,
                source: sourceCardId,
                sourcePlayerId: sourcePlayerId,
                type: effect.type,
                target: effect.target,
                value: effect.value,
                restriction: effect.restriction
            };
            
            targetPlayerFieldEffects = getPlayerFieldEffects(gameEnv, targetPlayerId);
            targetPlayerFieldEffects.activeEffects.push(activeEffect);
            
            // Apply specific effect type
            if (effect.type === "ZONE_RESTRICTION") {
                await this.applyZoneRestriction(gameEnv, targetPlayerId, effect);
            } else if (effect.type === "POWER_MODIFICATION") {
                // Power modifications are applied on-demand during calculation
                console.log(`📊 Power modification effect registered for ${targetPlayerId}`);
            }
        }
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
     * Validates if a card can be placed in a zone considering field effects
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {Object} cardDetails - Card to be placed
     * @param {string} zone - Target zone
     * @returns {Object} Validation result with canPlace and reason
     */
    async validateCardPlacementWithFieldEffects(gameEnv, playerId, cardDetails, zone) {
        // Initialize field effects if not present
        const { getPlayerFieldEffects } = require('../utils/gameUtils');
        let playerFieldEffects = getPlayerFieldEffects(gameEnv, playerId);
        if (!playerFieldEffects) {
            this.initializePlayerFieldEffects(gameEnv, playerId);
            playerFieldEffects = getPlayerFieldEffects(gameEnv, playerId);
        }
        
        const zoneRestrictions = playerFieldEffects.zoneRestrictions[zone.toUpperCase()];
        
        // If no restrictions, allow placement
        if (zoneRestrictions === "ALL") {
            return { canPlace: true, reason: "No restrictions" };
        }
        
        // Check if card's gameType is allowed
        if (Array.isArray(zoneRestrictions) && !zoneRestrictions.includes(cardDetails.gameType)) {
            return { 
                canPlace: false, 
                reason: `Card type '${cardDetails.gameType}' not allowed in ${zone}. Allowed types: ${zoneRestrictions.join(', ')}` 
            };
        }
        
        return { canPlace: true, reason: "Field effect validation passed" };
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
        
        // Apply power modification effects
        for (const effect of effects) {
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

    /**
     * Processes all field effects in the game
     * Called when the game state changes significantly
     * @param {Object} gameEnv - Game environment
     */
    async processAllFieldEffects(gameEnv) {
        console.log("🔄 Processing all field effects...");
        
        const playerList = getPlayerFromGameEnv(gameEnv);
        
        // Initialize field effects for all players
        for (const playerId of playerList) {
            this.initializePlayerFieldEffects(gameEnv, playerId);
        }
        
        // Process leader effects for all players
        for (const playerId of playerList) {
            const leader = this.cardInfoUtils.getCurrentLeader(gameEnv, playerId);
            if (leader) {
                await this.processLeaderFieldEffects(gameEnv, playerId, leader);
            }
        }
        
        console.log("✅ All field effects processed");
    }
}

module.exports = new FieldEffectProcessor();