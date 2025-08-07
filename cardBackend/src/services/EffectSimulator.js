"use strict";
// src/services/EffectSimulator.ts
/**
 * ENHANCED TYPESCRIPT EFFECT SIMULATOR (January 2025)
 * ==================================================
 *
 * 🎯 COMPLETE TYPESCRIPT CLASS INTEGRATION
 *
 * This TypeScript version provides complete integration with the GameEnvironment class,
 * offering type safety, direct method access, and eliminating JSON conversion overhead.
 *
 * KEY IMPROVEMENTS OVER JAVASCRIPT VERSION:
 * ----------------------------------------
 * ✅ Type Safety: Full TypeScript interfaces and type checking
 * ✅ Direct Class Integration: Works directly with GameEnvironment instances
 * ✅ Performance: No toJSON() overhead when working with class instances
 * ✅ Better IDE Support: IntelliSense, auto-completion, and refactoring
 * ✅ Maintainability: Cleaner code with proper typing and interfaces
 *
 * CORE FUNCTIONALITY:
 * ------------------
 * - Works directly with GameEnvironment class instances
 * - Processes play sequences using class methods
 * - Applies effects directly to player.fieldEffects
 * - Maintains single source of truth architecture
 * - Provides legacy compatibility for JSON-based operations
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.effectSimulator = exports.EffectSimulator = void 0;
// Remove local FieldEffect interface - use the one from GameEnvironment
class EffectSimulator {
    constructor() {
        this.cardInfoUtils = null;
        this.calculatePlayerPointFunc = null;
    }
    /**
     * Set CardInfoUtils dependency
     * @param cardInfoUtils - CardInfoUtils instance
     */
    setCardInfoUtils(cardInfoUtils) {
        this.cardInfoUtils = cardInfoUtils;
    }
    /**
     * Set calculatePlayerPoint function dependency to avoid circular imports
     * @param calculatePlayerPointFunc - Function reference from mozGamePlay
     */
    setCalculatePlayerPointFunction(calculatePlayerPointFunc) {
        this.calculatePlayerPointFunc = calculatePlayerPointFunc;
    }
    /**
     * MAIN METHOD: Enhanced Effect Simulation with GameEnvironment Class
     * ================================================================
     *
     * Works directly with GameEnvironment class instances, providing better type safety,
     * direct access to class methods, and eliminating toJSON() conversion overhead.
     *
     * @param gameEnvClass - GameEnvironment class instance
     */
    simulateCardPlaySequenceWithClass(gameEnvClass) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🎬 Starting enhanced TypeScript class-based effect simulation...');
            try {
                // 1. Initialize/Reset fieldEffects using class methods
                this.initializeFieldEffectsWithClass(gameEnvClass);
                // 2. Get sorted play sequence using class method
                const sortedPlays = gameEnvClass.playSequenceManager.getPlays();
                console.log(`📋 Replaying ${sortedPlays.length} plays directly on GameEnvironment class...`);
                // 3. Replay each action in sequence using class methods
                for (const play of sortedPlays) {
                    console.log(`▶️ Executing play ${play.sequenceId}: ${play.action} ${play.cardId} by ${play.playerId}`);
                    // STEP 1: Execute core play action using class methods
                    yield this.executePlayWithClass(gameEnvClass, play);
                    // STEP 2: Process ALL card effects using class methods
                    yield this.processAllCardEffectsWithClass(gameEnvClass, play);
                }
                // 4. Calculate final power values using class methods
                yield this.calculateFinalPowersWithClass(gameEnvClass);
                // 5. Calculate player points using class methods
                yield this.calculatePlayerPointsWithClass(gameEnvClass);
                console.log('✅ Enhanced TypeScript class-based simulation completed');
            }
            catch (error) {
                console.error('❌ Error in TypeScript EffectSimulator:', error);
                throw error;
            }
        });
    }
    /**
     * Initialize field effects using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     */
    initializeFieldEffectsWithClass(gameEnvClass) {
        console.log('🔧 Initializing field effects using TypeScript class methods...');
        // Get all player IDs from the class
        const playerIds = [gameEnvClass.playerId_1, gameEnvClass.playerId_2].filter(id => id);
        for (const playerId of playerIds) {
            const player = gameEnvClass.getPlayer(playerId);
            if (player) {
                // Initialize player field effects using class method
                player.initializeFieldEffects();
                console.log(`   ✅ Initialized field effects for ${playerId}`);
            }
        }
    }
    /**
     * Execute play action using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param play - Play sequence entry
     */
    executePlayWithClass(gameEnvClass, play) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (play.action) {
                case 'PLAY_LEADER':
                    yield this.executeLeaderPlayWithClass(gameEnvClass, play);
                    break;
                case 'PLAY_CARD':
                    yield this.executeCardPlayWithClass(gameEnvClass, play);
                    break;
                case 'APPLY_SET_POWER':
                case 'APPLY_NEUTRALIZATION':
                    yield this.executeEffectApplicationWithClass(gameEnvClass, play);
                    break;
                default:
                    console.warn(`Unknown play action: ${play.action}`);
            }
        });
    }
    /**
     * Execute leader play using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param play - Play sequence entry
     */
    executeLeaderPlayWithClass(gameEnvClass, play) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            console.log(`   🏛️ Processing PLAY_LEADER: ${play.cardId} for ${play.playerId}`);
            const player = gameEnvClass.getPlayer(play.playerId);
            const leaderCard = (_a = this.cardInfoUtils) === null || _a === void 0 ? void 0 : _a.getCardDetails(play.cardId);
            if (!player || !leaderCard) {
                console.warn(`Cannot process leader play - missing player or leader data`);
                return;
            }
            // Process leader zone restrictions
            if (leaderCard.zoneCompatibility && player.fieldEffects) {
                const restrictions = {
                    top: leaderCard.zoneCompatibility.top || ['ALL'],
                    left: leaderCard.zoneCompatibility.left || ['ALL'],
                    right: leaderCard.zoneCompatibility.right || ['ALL'],
                    help: ['ALL'],
                    sp: ['ALL']
                };
                player.fieldEffects.zoneRestrictions = restrictions;
                console.log(`     ✅ Applied zone restrictions for ${play.playerId}`);
            }
            // Process leader effects
            if ((_b = leaderCard.effects) === null || _b === void 0 ? void 0 : _b.rules) {
                for (const rule of leaderCard.effects.rules) {
                    yield this.processLeaderEffectRuleWithClass(gameEnvClass, rule, play.playerId, play.cardId);
                }
            }
        });
    }
    /**
     * Execute card play using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param play - Play sequence entry
     */
    executeCardPlayWithClass(gameEnvClass, play) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`   🃏 Processing PLAY_CARD: ${play.cardId} for ${play.playerId}`);
            // Card placement is already handled by the zones system
            // This method is for any additional card play processing
        });
    }
    /**
     * Execute effect application using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param play - Play sequence entry
     */
    executeEffectApplicationWithClass(gameEnvClass, play) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            console.log(`   ⚡ Processing ${play.action}: ${play.cardId} for ${play.playerId}`);
            if (play.action === 'APPLY_SET_POWER' && ((_a = play.data) === null || _a === void 0 ? void 0 : _a.targetCards)) {
                for (const targetInfo of play.data.targetCards) {
                    yield this.applySetPowerEffectWithClass(gameEnvClass, targetInfo, play.data.value);
                }
            }
            // Add other effect applications as needed
        });
    }
    /**
     * Process all card effects using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param play - Play sequence entry
     */
    processAllCardEffectsWithClass(gameEnvClass, play) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            // Process immediate effects from the played card
            if (play.cardId && play.playerId) {
                const player = gameEnvClass.getPlayer(play.playerId);
                const cardDetails = (_a = this.cardInfoUtils) === null || _a === void 0 ? void 0 : _a.getCardDetails(play.cardId);
                if (player && cardDetails && ((_b = cardDetails.effects) === null || _b === void 0 ? void 0 : _b.rules)) {
                    for (const rule of cardDetails.effects.rules) {
                        yield this.processCardEffectRuleWithClass(gameEnvClass, rule, play.playerId, play.cardId);
                    }
                }
            }
        });
    }
    /**
     * Process leader effect rule using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param rule - Effect rule
     * @param playerId - Player ID
     * @param cardId - Card ID
     */
    processLeaderEffectRuleWithClass(gameEnvClass, rule, playerId, cardId) {
        return __awaiter(this, void 0, void 0, function* () {
            const player = gameEnvClass.getPlayer(playerId);
            if (!player)
                return;
            // Create effect object
            const effect = {
                effectId: `${cardId}_${rule.id}`,
                source: cardId,
                sourcePlayerId: playerId,
                type: rule.effect.type,
                target: this.convertRuleTargetToEffectTarget(rule.target, playerId),
                value: rule.effect.value,
                priority: 0,
                unremovable: false,
                isEnabled: true,
                createdAt: Date.now(),
                effectData: {}
            };
            // Add to player's active effects
            if (player.fieldEffects && player.fieldEffects.activeEffects) {
                player.fieldEffects.activeEffects.push(effect);
                console.log(`     ✅ Added leader effect: ${effect.effectId}`);
            }
        });
    }
    /**
     * Process card effect rule using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param rule - Effect rule
     * @param playerId - Player ID
     * @param cardId - Card ID
     */
    processCardEffectRuleWithClass(gameEnvClass, rule, playerId, cardId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Similar to processLeaderEffectRuleWithClass but for regular cards
            yield this.processLeaderEffectRuleWithClass(gameEnvClass, rule, playerId, cardId);
        });
    }
    /**
     * Calculate final powers using GameEnvironment class methods
     * Updated for unified GameEnvironment structure with proper card lookup
     * @param gameEnvClass - GameEnvironment class instance
     */
    calculateFinalPowersWithClass(gameEnvClass) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            console.log('⚡ Calculating final powers using TypeScript class methods...');
            const playerIds = [gameEnvClass.playerId_1, gameEnvClass.playerId_2].filter(id => id);
            // Collect ALL active effects from ALL players (including cross-player effects)
            const allActiveEffects = [];
            for (const playerId of playerIds) {
                const player = gameEnvClass.getPlayer(playerId);
                if ((_a = player === null || player === void 0 ? void 0 : player.fieldEffects) === null || _a === void 0 ? void 0 : _a.activeEffects) {
                    allActiveEffects.push(...player.fieldEffects.activeEffects);
                }
            }
            console.log(`   🌐 Collected ${allActiveEffects.length} total active effects from all players`);
            for (const playerId of playerIds) {
                const player = gameEnvClass.getPlayer(playerId);
                if (!player || !player.fieldEffects) {
                    console.log(`   ⚠️ No player or fieldEffects found for ${playerId}`);
                    continue;
                }
                // Initialize calculatedPowers if not present
                if (!player.fieldEffects.calculatedPowers) {
                    player.fieldEffects.calculatedPowers = {};
                }
                console.log(`   🔍 Processing cards for player ${playerId}`);
                // Get player zones from unified structure
                const zones = gameEnvClass.zones.getPlayerZones(playerId);
                // Process only CHARACTER ZONES (top, left, right) - leader, help, sp zones don't contribute to power
                const characterZones = ['top', 'left', 'right'];
                for (const [zoneName, zoneCards] of Object.entries(zones)) {
                    // Skip non-character zones (leader, help, sp don't have power)
                    if (!characterZones.includes(zoneName)) {
                        console.log(`     ⏭️ Skipping zone ${zoneName} (no power contribution)`);
                        continue;
                    }
                    //zone dont have cards
                    if (!Array.isArray(zoneCards) || zoneCards.length === 0)
                        continue;
                    console.log(`     📋 Processing CHARACTER zone ${zoneName} with ${zoneCards.length} cards`);
                    for (const zoneCard of zoneCards) {
                        // Extract data from unified ZoneCard structure
                        const unifiedCard = zoneCard; // ZoneCard (unified structure)
                        // Check for new unified structure first
                        if (unifiedCard.cardUid && unifiedCard.cardId && unifiedCard.cardData) {
                            // New unified structure
                            const cardUid = unifiedCard.cardUid;
                            const cardId = unifiedCard.cardId;
                            const cardDetails = unifiedCard.cardData;
                            console.log(`       🎴 Processing unified card: ${cardUid} (${cardId}) - ${cardDetails.name || 'Unknown'}`);
                            // Use the embedded card data directly
                            this.processCardPowerCalculation(cardUid, cardId, cardDetails, allActiveEffects, player);
                        }
                        else if (unifiedCard.card && unifiedCard.card.length > 0) {
                            // Legacy structure - convert to new format
                            const cardUid = unifiedCard.card[0];
                            const cardId = cardUid.split("_")[0];
                            console.log(`       🎴 Processing legacy card: ${cardUid} → ${cardId} (converting to unified format)`);
                            // Look up card details using CardInfoUtils for legacy data
                            let cardDetails = null;
                            if (this.cardInfoUtils) {
                                try {
                                    cardDetails = yield this.cardInfoUtils.getCardDetails(cardId);
                                }
                                catch (error) {
                                    console.error(`     ❌ Error getting card details for cardId ${cardId} (from uid ${cardUid}):`, error);
                                    continue;
                                }
                            }
                            else {
                                console.warn(`     ⚠️ CardInfoUtils not available for card lookup: ${cardId}`);
                                continue;
                            }
                            if (!cardDetails) {
                                console.log(`     ⚠️ No card details found for cardId ${cardId} (from uid ${cardUid})`);
                                continue;
                            }
                            this.processCardPowerCalculation(cardUid, cardId, cardDetails, allActiveEffects, player);
                        }
                        else {
                            console.log(`     ⚠️ Skipping invalid card structure in zone ${zoneName}`);
                            continue;
                        }
                    }
                }
                console.log(`   ✅ Completed power calculation for player ${playerId}`);
                console.log(`      📊 Calculated powers:`, player.fieldEffects.calculatedPowers);
            }
            console.log('✅ Final power calculation completed for all players');
        });
    }
    /**
     * Helper method to process power calculation for a single card
     */
    processCardPowerCalculation(cardUid, cardId, cardDetails, allActiveEffects, player) {
        // Calculate final power for this card using ALL active effects
        const basePower = cardDetails.power || cardDetails.initialPoint || 0;
        let finalPower = basePower;
        console.log(`         🔧 Applying ${allActiveEffects.length} total active effects (including cross-player)`);
        // Apply all effects in priority order (setPower effects first, then boosts)
        const setPowerEffects = allActiveEffects.filter(e => e.type === 'setPower' || e.type === 'POWER_NULLIFICATION');
        const boostEffects = allActiveEffects.filter(e => e.type === 'powerBoost');
        const otherEffects = allActiveEffects.filter(e => e.type !== 'setPower' && e.type !== 'POWER_NULLIFICATION' && e.type !== 'powerBoost');
        // Apply setPower/nullification effects first (they override base power)
        for (const effect of setPowerEffects) {
            if (this.isCardTargetedByEffect(cardDetails, effect)) {
                finalPower = effect.value || 0;
                console.log(`           🚫 Applied ${effect.type} ${effect.value} from ${effect.source} (${effect.sourcePlayerId || 'unknown'})`);
            }
        }
        // Then apply power boost effects (additive)
        for (const effect of boostEffects) {
            if (this.isCardTargetedByEffect(cardDetails, effect)) {
                finalPower += effect.value || 0;
                console.log(`           ⚡ Applied powerBoost +${effect.value} from ${effect.source} (${effect.sourcePlayerId || 'unknown'})`);
            }
        }
        // Apply other effect types (special effects, immunities, etc.)
        for (const effect of otherEffects) {
            if (this.isCardTargetedByEffect(cardDetails, effect)) {
                console.log(`           ✨ Applied special effect ${effect.type} from ${effect.source} (${effect.sourcePlayerId || 'unknown'})`);
                // Handle special effects like immunity, zone freedom, etc.
                // These typically don't modify power directly but could affect other calculations
            }
        }
        // Store calculated power in fieldEffects
        player.fieldEffects.calculatedPowers[cardUid] = finalPower;
        console.log(`         💫 Final power for ${cardUid}: ${basePower} → ${finalPower}`);
    }
    /**
     * Calculate player points using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     */
    calculatePlayerPointsWithClass(gameEnvClass) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('📊 Calculating player points using TypeScript class methods...');
            const playerIds = [gameEnvClass.playerId_1, gameEnvClass.playerId_2].filter(id => id);
            for (const playerId of playerIds) {
                const player = gameEnvClass.getPlayer(playerId);
                if (player) {
                    // Use existing mozGamePlay logic for point calculation
                    const oldPlayerPoint = player.playerPoint || 0;
                    // Calculate new player point using injected function to avoid circular dependency
                    if (this.calculatePlayerPointFunc) {
                        const gameEnvJSON = gameEnvClass.toJSON();
                        const newPlayerPoint = yield this.calculatePlayerPointFunc(gameEnvJSON, playerId);
                        player.playerPoint = newPlayerPoint;
                        console.log(`   📊 Player ${playerId}: ${oldPlayerPoint} → ${newPlayerPoint} points`);
                    }
                    else {
                        console.warn('⚠️ calculatePlayerPointFunc not set - skipping point calculation');
                        player.playerPoint = oldPlayerPoint; // Keep existing points
                    }
                }
            }
        });
    }
    /**
     * Apply set power effect using GameEnvironment class methods
     * @param gameEnvClass - GameEnvironment class instance
     * @param targetInfo - Target card information
     * @param value - Power value to set
     */
    applySetPowerEffectWithClass(gameEnvClass, targetInfo, value) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const targetPlayer = gameEnvClass.getPlayer(targetInfo.playerId);
            if ((_a = targetPlayer === null || targetPlayer === void 0 ? void 0 : targetPlayer.fieldEffects) === null || _a === void 0 ? void 0 : _a.calculatedPowers) {
                targetPlayer.fieldEffects.calculatedPowers[targetInfo.cardId] = value;
                console.log(`     ✅ Set power for ${targetInfo.cardId} to ${value}`);
            }
        });
    }
    /**
     * Convert rule target to effect target
     * @param ruleTarget - Rule target object
     * @param playerId - Player ID
     * @returns Effect target object
     */
    convertRuleTargetToEffectTarget(ruleTarget, playerId) {
        var _a, _b;
        return {
            scope: ruleTarget.owner === 'self' ? 'SELF' : 'OPPONENT',
            playerId: playerId,
            zones: ruleTarget.zones || ['top', 'left', 'right'],
            gameTypes: ((_b = (_a = ruleTarget.filters) === null || _a === void 0 ? void 0 : _a.find((f) => f.type === 'gameTypeOr')) === null || _b === void 0 ? void 0 : _b.values) || []
        };
    }
    /**
     * Check if card is targeted by effect
     * @param card - Card object
     * @param effect - Effect object
     * @returns Whether card is targeted
     */
    isCardTargetedByEffect(card, effect) {
        // Check if effect targets this card based on gameType and other criteria
        if (effect.target.gameTypes && effect.target.gameTypes.length > 0) {
            return effect.target.gameTypes.includes(card.gameType);
        }
        return true; // Default to true if no specific targeting
    }
    // LEGACY COMPATIBILITY: Support for JSON-based operations
    /**
     * Legacy JSON-based simulation for backward compatibility
     * @param gameEnv - Game environment JSON object
     */
    simulateCardPlaySequence(gameEnv) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('⚠️ Using legacy JSON-based simulation - consider upgrading to class-based method');
            // Import GameEnvironmentAdapter for conversion
            const { GameEnvironmentAdapter } = require('../utils/GameEnvironmentAdapter');
            // Convert to class, process, then update original object
            const gameEnvClass = GameEnvironmentAdapter.fromLegacyJSON(gameEnv);
            yield this.simulateCardPlaySequenceWithClass(gameEnvClass);
            // Update original gameEnv object with results
            const updatedGameEnv = GameEnvironmentAdapter.toLegacyJSON(gameEnvClass);
            Object.assign(gameEnv, updatedGameEnv);
        });
    }
}
exports.EffectSimulator = EffectSimulator;
// Export singleton instance for backward compatibility
exports.effectSimulator = new EffectSimulator();
exports.default = exports.effectSimulator;
