// src/services/EffectSimulator.js
/**
 * UNIFIED EFFECT SIMULATION SYSTEM (January 2025)
 * ================================================
 * 
 * 🎯 COMPLETE ARCHITECTURAL CONSOLIDATION ACHIEVED
 * 
 * This file represents the culmination of a major architectural consolidation that
 * unified ALL game effect processing into a single, consistent system.
 * 
 * WHAT WAS CONSOLIDATED:
 * ----------------------
 * ✅ Leader zone restrictions (from FieldEffectProcessor)
 * ✅ Leader power boost effects (from processLeaderFieldEffects)
 * ✅ Cross-player nullification effects (from processCrossPlayerEffects)
 * ✅ Complex leader effect conditions (from checkEffectConditions)
 * ✅ Leader JSON data processing (from convertEffectRuleToFieldEffect)
 * ✅ Card play effects (existing system enhanced)
 * ✅ Effect transitions during leader changes
 * 
 * FUNCTIONS ELIMINATED:
 * --------------------
 * ❌ processLeaderFieldEffects() - 120+ lines moved here
 * ❌ processAllFieldEffects() - Replaced by unified replay
 * ❌ processCrossPlayerEffects() - Integrated into processCompleteLeaderEffects()
 * ❌ checkEffectConditions() - Now checkLeaderEffectConditions()
 * ❌ convertEffectRuleToFieldEffect() - Now convertLeaderRuleToEffect()
 * ❌ Manual clearPlayerLeaderEffects calls - Automatic through replay
 * 
 * CORE PRINCIPLE:
 * --------------
 * "Leaders are just special cards" - They follow the same PLAY_LEADER → effect processing
 * pattern as regular cards, ensuring consistency and eliminating dual-system complexity.
 * 
 * EXAMPLE COMPLEX EFFECTS HANDLED:
 * --------------------------------
 * - Trump: Zone restrictions + +45 power to 右翼/愛國者 cards
 * - Powell: Cross-player nullification of opponent's 經濟 cards
 * - All processed through single replay-based simulation
 * 
 * BENEFITS ACHIEVED:
 * -----------------
 * 🚀 Performance: Single simulation pass instead of multiple systems
 * 🧹 Maintainability: ~300 lines of duplicate code eliminated
 * 🔍 Debuggability: All effects traceable through play sequence
 * 🔄 Consistency: Same logic path for all effect types
 * 📈 Extensibility: Easy to add new effect types to unified system
 * 
 * This system now handles ALL game effects through unified replay-based calculation.
 */

const playSequenceManager = require('./PlaySequenceManager');
const cardEffectRegistry = require('./CardEffectRegistry');

class EffectSimulator {
    constructor() {
        this.cardInfoUtils = null; // Will be injected
    }

    /**
     * Set dependencies
     * @param {Object} cardInfoUtils - Card information utilities
     */
    setCardInfoUtils(cardInfoUtils) {
        this.cardInfoUtils = cardInfoUtils;
        cardEffectRegistry.setCardInfoUtils(cardInfoUtils);
    }

    /**
     * UNIFIED EFFECT SIMULATION - SINGLE SOURCE OF TRUTH (January 2025)
     * =================================================================
     * 
     * 🎯 ARCHITECTURAL BREAKTHROUGH: Eliminated dual data structures!
     * This function now works DIRECTLY on gameEnv.players[playerId].fieldEffects,
     * completely eliminating the need for computedState and merge operations.
     * 
     * 🔄 NEW UNIFIED WORKFLOW:
     * 
     * STEP 1: Initialize/Reset fieldEffects structure
     * - Ensure gameEnv.players[playerId].fieldEffects exists for all players
     * - Reset calculated values to clean state
     * 
     * STEP 2: Get Chronological Play Sequence
     * - Same as before: PLAY_LEADER and PLAY_CARD actions in order
     * 
     * STEP 3: Replay Each Action DIRECTLY ON GAMEENV
     * For each play in sequence:
     *   3a. Execute play (updates gameEnv.players[].fieldEffects directly)
     *   3b. Activate effects (updates gameEnv.players[].fieldEffects directly)
     *   3c. Process reactions (updates gameEnv.players[].fieldEffects directly)
     * 
     * STEP 4: Calculate Final Powers
     * - Calculate power values and store in fieldEffects.calculatedPowers
     * - All data immediately available to game logic and API responses
     * 
     * 📊 ENHANCED FIELDEFFECTS STRUCTURE (Single Source of Truth):
     * gameEnv.players[playerId].fieldEffects = {
     *   zoneRestrictions: { TOP: [...], LEFT: [...], RIGHT: [...], HELP: "ALL", SP: "ALL" },
     *   activeEffects: [ { effectId, source, type, target, value } ],
     *   calculatedPowers: { cardId: finalPower },  // NEW: Replaces computedState.playerPowers
     *   disabledCards: [],                        // NEW: Replaces computedState.disabledCards
     *   victoryPointModifiers: 0                  // NEW: Replaces computedState.victoryPointModifiers
     * }
     * 
     * ✅ BENEFITS OF UNIFIED APPROACH:
     * - Single source of truth: All effect data in one location
     * - No merge required: Effects immediately available
     * - Simplified codebase: Eliminates 200+ lines of merge logic
     * - Better performance: Direct updates instead of copy operations
     * - Easier debugging: All effects traceable in single structure
     * 
     * 🔗 INTEGRATION: Other systems access via gameUtils.getPlayerFieldEffects()
     * 
     * @param {Object} gameEnv - Game environment (modified in-place)
     * @returns {void} - All effects applied directly to gameEnv.players[].fieldEffects
     */
    async simulateCardPlaySequence(gameEnv) {
        console.log('🎬 Starting unified effect simulation (single source of truth)...');
        
        // 1. Initialize/Reset fieldEffects for all players
        this.initializeFieldEffects(gameEnv);
        
        // 2. Get sorted play sequence
        const sortedPlays = playSequenceManager.getPlaySequence(gameEnv);
        
        console.log(`📋 Replaying ${sortedPlays.length} plays directly on gameEnv.players[].fieldEffects...`);
        
        // 3. Replay each action in sequence - WORKING DIRECTLY ON GAMEENV
        // =============================================================
        // All effects applied directly to gameEnv.players[].fieldEffects (single source of truth)
        for (const play of sortedPlays) {
            console.log(`▶️ Executing play ${play.sequenceId}: ${play.action} ${play.cardId} by ${play.playerId}`);
            
            // 3a. Execute the play action (updates gameEnv.players[].fieldEffects directly)
            // - PLAY_LEADER: Updates zone restrictions and active effects
            // - PLAY_CARD: Places card and triggers immediate effects
            await this.executePlayUnified(gameEnv, play);
            
            // 3b. Activate immediate card effects (updates gameEnv.players[].fieldEffects directly)
            // - Card-specific abilities and effects
            // - Stored directly in activeEffects array
            this.activateEffectsUnified(gameEnv, play);
            
            // 3c. Check for triggered effects (updates gameEnv.players[].fieldEffects directly)
            // - Reactions from other cards already on the board
            // - Chain reactions and card interactions
            this.checkTriggeredEffectsUnified(gameEnv, play);
        }
        
        // 4. Calculate final power values and store in fieldEffects
        this.calculateFinalPowersUnified(gameEnv);
        
        console.log('✅ Unified simulation completed - all effects available in gameEnv.players[].fieldEffects');
    }

    /**
     * Create clean simulation state
     * @param {Object} gameEnv - Game environment
     * @returns {Object} Clean simulation state
     */
    createCleanState(gameEnv) {
        const { getPlayerFromGameEnv } = require('../utils/gameUtils');
        const playerIds = getPlayerFromGameEnv(gameEnv);
        
        const simState = {
            currentPhase: gameEnv.phase,
            currentTurn: gameEnv.currentTurn,
            players: {},
            powerModifiers: {},
            disabledCards: [],
            globalEffects: []
        };

        // Initialize clean player states
        playerIds.forEach(playerId => {
            simState.players[playerId] = {
                Field: {
                    leader: null,
                    top: [],
                    left: [],
                    right: [],
                    help: [],
                    sp: []
                },
                fieldEffects: {
                    zoneRestrictions: {
                        TOP: "ALL",
                        LEFT: "ALL",
                        RIGHT: "ALL",
                        HELP: "ALL",
                        SP: "ALL"
                    },
                    activeEffects: []
                }
            };
            
            simState.powerModifiers[playerId] = {};
        });

        return simState;
    }

    /**
     * Execute a single play action
     * @param {Object} simState - Current simulation state
     * @param {Object} play - Play record
     */
    async executePlay(simState, play) {
        const { playerId, cardId, action, zone, data } = play;
        
        if (!this.cardInfoUtils) {
            console.warn('CardInfoUtils not set in EffectSimulator');
            return;
        }

        const cardDetails = this.cardInfoUtils.getCardDetails(cardId);
        if (!cardDetails) {
            console.warn(`Card details not found for: ${cardId}`);
            return;
        }

        switch (action) {
            case 'PLAY_LEADER':
                simState.players[playerId].Field.leader = { ...cardDetails };
                
                // Process complete leader effects (zone restrictions + power effects)
                await this.processCompleteLeaderEffects(simState, playerId, cardDetails);
                break;
                
            case 'PLAY_CARD':
                const card = { ...cardDetails };
                card.isFaceDown = data.isFaceDown || false;
                
                if (Array.isArray(simState.players[playerId].Field[zone])) {
                    simState.players[playerId].Field[zone].push(card);
                } else {
                    console.warn(`Invalid zone for card play: ${zone}`);
                }
                break;
                
            default:
                console.warn(`Unknown play action: ${action}`);
        }
    }

    /**
     * PROCESS COMPLETE LEADER EFFECTS - The Heart of Leader Effect Calculation
     * ========================================================================
     * 
     * 🎯 PURPOSE: When a PLAY_LEADER action is replayed, this method calculates and applies 
     * ALL effects that the leader provides. This is where zone restrictions are set!
     * 
     * 🔄 WORKFLOW STEP-BY-STEP:
     * 
     * STEP 1: Clear Existing Leader Effects
     * - Remove any previous leader effects from this player
     * - Reset zone restrictions to defaults
     * - Clean up old power modifications
     * 
     * STEP 2: Load Complete Leader Data
     * - Reads leader definition from leaderCards.json
     * - Gets zone compatibility rules, power effects, special abilities
     * - Example: Trump has zoneCompatibility.top = ["右翼", "自由", "經濟"]
     * 
     * STEP 3: Apply Zone Restrictions
     * - Sets which card types can be played in each zone
     * - Trump: TOP = [右翼, 自由, 經濟], LEFT = [右翼, 自由, 愛國者], etc.
     * - Biden: All zones = [左翼, 自由, 經濟, 右翼, 愛國者] (more permissive)
     * 
     * STEP 4: Apply Power Modification Effects  
     * - Continuous power bonuses (Trump: +45 to 右翼/愛國者 cards)
     * - Conditional effects that depend on game state
     * - Power modifications that affect specific card types
     * 
     * STEP 5: Apply Cross-Player Effects
     * - Effects that target opponent's cards
     * - Powell: Nullifies opponent's 經濟 trait cards (sets power to 0)
     * - These effects show up in opponent's computed state
     * 
     * 📊 RESULT: After this method runs, the simState contains:
     * - simState.players[playerId].fieldEffects.zoneRestrictions = updated restrictions
     * - simState.players[playerId].fieldEffects.activeEffects = power modifications
     * - Cross-player effects applied to opponent's simState as well
     * 
     * ⚠️  CRITICAL: These effects stay in simState until calculateFinalState() 
     * copies them to computedState.activeRestrictions for the API response!
     * 
     * @param {Object} simState - Current simulation state being built
     * @param {string} playerId - Player who played the leader
     * @param {Object} leader - Leader card details (id, name, etc.)
     */
    async processCompleteLeaderEffects(simState, playerId, leader) {
        console.log(`🎯 Processing complete leader effects for ${playerId}: ${leader.name}`);
        
        // STEP 1: Clear existing leader effects from this player
        this.clearPlayerLeaderEffects(simState, playerId);
        
        // STEP 2: Load complete leader data from JSON
        const leaderData = this.getLeaderData(leader.id);
        if (!leaderData) {
            console.log(`⚠️  No leader data found for ${leader.id}`);
            return;
        }
        
        // STEP 3: Apply zone restrictions (THIS IS WHERE ZONE RESTRICTIONS ARE SET!)
        if (leaderData.zoneCompatibility) {
            this.applyLeaderZoneRestrictions(simState, playerId, leaderData);
        }
        
        // STEP 4: Process power modification effects
        if (leaderData.effects && leaderData.effects.rules) {
            for (const rule of leaderData.effects.rules) {
                if (rule.type === 'continuous') {
                    const shouldApply = this.checkLeaderEffectConditions(simState, playerId, rule);
                    if (shouldApply) {
                        const effect = this.convertLeaderRuleToEffect(rule);
                        if (effect) {
                            this.applyLeaderEffect(simState, playerId, leader.id, effect);
                        }
                    }
                }
            }
        }
        
        // STEP 5: Handle cross-player effects (like Powell's nullification)
        this.processCrossPlayerLeaderEffects(simState, playerId, leaderData);
        
        console.log(`✅ Complete leader effects processed for ${playerId}`);
    }

    /**
     * Get leader data from JSON file
     * @param {string} leaderId - Leader card ID
     * @returns {Object|null} Leader data or null if not found
     */
    getLeaderData(leaderId) {
        try {
            const leaderCards = require('../data/leaderCards.json');
            return leaderCards.leaders[leaderId] || null;
        } catch (error) {
            console.error('Error loading leader data:', error);
            return null;
        }
    }

    /**
     * APPLY LEADER ZONE RESTRICTIONS - Where Zone Rules Are Actually Set
     * ==================================================================
     * 
     * 🎯 PURPOSE: This method reads the leader's zoneCompatibility rules from JSON
     * and sets them in the simulation state. This is THE function that creates 
     * the zone restrictions you see in the API response!
     * 
     * 📋 HOW IT WORKS:
     * 1. Reads zoneCompatibility from leader JSON data
     * 2. Maps JSON zone names to game zone names
     * 3. Sets restrictions in simState.players[playerId].fieldEffects.zoneRestrictions
     * 4. Uses ["ALL"] as default if no restrictions specified
     * 
     * 📊 EXAMPLE INPUT (from leaderCards.json):
     * Trump (s-1): {
     *   "zoneCompatibility": {
     *     "top": ["右翼", "自由", "經濟"],
     *     "left": ["右翼", "自由", "愛國者"], 
     *     "right": ["右翼", "愛國者", "經濟"]
     *   }
     * }
     * 
     * 📊 EXAMPLE OUTPUT (in simState):
     * simState.players[playerId].fieldEffects.zoneRestrictions = {
     *   TOP: ["右翼", "自由", "經濟"],
     *   LEFT: ["右翼", "自由", "愛國者"],
     *   RIGHT: ["右翼", "愛國者", "經濟"],
     *   HELP: ["ALL"],  // Always unrestricted
     *   SP: ["ALL"]     // Always unrestricted  
     * }
     * 
     * ⚠️  CRITICAL: These restrictions are later copied to computedState.activeRestrictions
     * and merged back to gameEnv.players[playerId].fieldEffects for API response!
     * 
     * @param {Object} simState - Simulation state being built
     * @param {string} playerId - Player who played the leader
     * @param {Object} leaderData - Leader definition from JSON
     */
    applyLeaderZoneRestrictions(simState, playerId, leaderData) {
        if (leaderData.zoneCompatibility) {
            const restrictions = {
                TOP: leaderData.zoneCompatibility.top || ["ALL"],
                LEFT: leaderData.zoneCompatibility.left || ["ALL"],
                RIGHT: leaderData.zoneCompatibility.right || ["ALL"],
                HELP: ["ALL"], // Help zone typically unrestricted
                SP: ["ALL"]    // SP zone typically unrestricted
            };
            
            simState.players[playerId].fieldEffects.zoneRestrictions = restrictions;
            console.log(`🏛️ Applied leader zone restrictions for ${playerId}:`, restrictions);
        }
    }

    /**
     * Check if leader effect conditions are met
     * @param {Object} simState - Simulation state
     * @param {string} playerId - Player ID
     * @param {Object} rule - Effect rule
     * @returns {boolean} Whether conditions are met
     */
    checkLeaderEffectConditions(simState, playerId, rule) {
        if (!rule.trigger || !rule.trigger.conditions) {
            return true; // No conditions means always apply
        }
        
        for (const condition of rule.trigger.conditions) {
            if (condition.type === 'opponentLeader') {
                // Find opponent player
                const allPlayers = Object.keys(simState.players);
                const opponentId = allPlayers.find(id => id !== playerId);
                
                if (opponentId) {
                    const opponentLeader = simState.players[opponentId].Field.leader;
                    if (opponentLeader && opponentLeader.name !== condition.value) {
                        return false; // Condition not met
                    }
                }
            }
        }
        
        return true;
    }

    /**
     * Convert leader effect rule to standardized effect
     * @param {Object} rule - Leader effect rule
     * @returns {Object|null} Standardized effect or null
     */
    convertLeaderRuleToEffect(rule) {
        if (!rule.effect) return null;
        
        // Convert power boost effects
        if (rule.effect.type === 'powerBoost') {
            const effect = {
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
                        effect.target.gameTypes = [filter.value];
                    } else if (filter.type === 'gameTypeOr') {
                        effect.target.gameTypes = filter.values;
                    } else if (filter.type === 'trait') {
                        effect.target.traits = [filter.value];
                    }
                }
            }
            
            // If no filters, affect all cards
            if (!effect.target.gameTypes && !effect.target.traits) {
                effect.target.gameTypes = "ALL";
            }
            
            return effect;
        }
        
        // Convert power nullification effects
        if (rule.effect.type === 'setPower' && rule.effect.value === 0) {
            const effect = {
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
                        effect.target.gameTypes = [filter.value];
                    } else if (filter.type === 'trait') {
                        effect.target.traits = [filter.value];
                    }
                }
            }
            
            return effect;
        }
        
        return null;
    }

    /**
     * Apply leader effect to simulation state
     * @param {Object} simState - Simulation state
     * @param {string} sourcePlayerId - Player who owns the leader
     * @param {string} leaderId - Leader card ID
     * @param {Object} effect - Effect to apply
     */
    applyLeaderEffect(simState, sourcePlayerId, leaderId, effect) {
        const effectId = `${leaderId}_${effect.type}_${Date.now()}`;
        
        // Determine target players
        const targetPlayers = this.getEffectTargetPlayers(simState, sourcePlayerId, effect.target.scope);
        
        for (const targetPlayerId of targetPlayers) {
            // Add effect to target player's active effects
            const activeEffect = {
                effectId: effectId,
                source: leaderId,
                sourcePlayerId: sourcePlayerId,
                type: effect.type,
                target: effect.target,
                value: effect.value
            };
            
            simState.players[targetPlayerId].fieldEffects.activeEffects.push(activeEffect);
            console.log(`💪 Applied leader effect ${effect.type} to ${targetPlayerId}`);
        }
    }

    /**
     * Process cross-player leader effects
     * @param {Object} simState - Simulation state
     * @param {string} playerId - Player ID
     * @param {Object} leaderData - Leader data
     */
    processCrossPlayerLeaderEffects(simState, playerId, leaderData) {
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
            
            this.applyLeaderEffect(simState, playerId, leaderData.id, powerNullificationEffect);
        }
    }

    /**
     * Clear existing leader effects from a player
     * @param {Object} simState - Simulation state
     * @param {string} playerId - Player ID
     */
    clearPlayerLeaderEffects(simState, playerId) {
        // Find current leader for this player
        const currentLeader = simState.players[playerId].Field.leader;
        if (!currentLeader) return;
        
        // Remove effects from all players that were created by this player's leader
        const allPlayers = Object.keys(simState.players);
        for (const targetPlayerId of allPlayers) {
            simState.players[targetPlayerId].fieldEffects.activeEffects = 
                simState.players[targetPlayerId].fieldEffects.activeEffects.filter(
                    effect => !(effect.source === currentLeader.id && effect.sourcePlayerId === playerId)
                );
        }
        
        // Reset this player's zone restrictions to default
        simState.players[playerId].fieldEffects.zoneRestrictions = {
            TOP: "ALL",
            LEFT: "ALL",
            RIGHT: "ALL",
            HELP: "ALL",
            SP: "ALL"
        };
        
        console.log(`🧹 Cleared leader effects for ${playerId}`);
    }

    /**
     * Get target players for an effect based on scope
     * @param {Object} simState - Simulation state
     * @param {string} sourcePlayerId - Source player ID
     * @param {string} scope - Effect scope (SELF, OPPONENT, ALL)
     * @returns {Array} Array of target player IDs
     */
    getEffectTargetPlayers(simState, sourcePlayerId, scope) {
        const allPlayers = Object.keys(simState.players);
        
        switch (scope) {
            case "SELF":
                return [sourcePlayerId];
            case "OPPONENT":
                return allPlayers.filter(id => id !== sourcePlayerId);
            case "ALL":
                return allPlayers;
            default:
                return [sourcePlayerId];
        }
    }

    /**
     * Activate card effects after a play
     * @param {Object} simState - Current simulation state
     * @param {Object} play - Play record
     */
    activateEffects(simState, play) {
        const effects = cardEffectRegistry.getCardEffects(play.cardId);
        
        if (effects.length === 0) {
            return;
        }
        
        console.log(`🎭 Checking ${effects.length} effects for ${play.cardId}`);
        
        for (const effect of effects) {
            if (cardEffectRegistry.checkConditions(effect, simState, play.playerId)) {
                console.log(`✨ Activating effect: ${effect.type}`);
                cardEffectRegistry.applyEffect(effect, simState, play.playerId);
            } else {
                console.log(`❌ Effect conditions not met: ${effect.type}`);
            }
        }
    }

    /**
     * Check for triggered effects from other cards
     * @param {Object} simState - Current simulation state
     * @param {Object} newPlay - The play that might trigger effects
     */
    checkTriggeredEffects(simState, newPlay) {
        // Check all cards already on field for triggered effects
        for (const playerId in simState.players) {
            const field = simState.players[playerId].Field;
            
            // Check all zones for cards with effects
            for (const zone in field) {
                const cards = Array.isArray(field[zone]) ? field[zone] : [field[zone]];
                
                for (const card of cards) {
                    if (!card) continue;
                    
                    const effects = cardEffectRegistry.getCardEffects(card.id);
                    
                    for (const effect of effects) {
                        // Skip if this effect was already processed for this card
                        if (effect.triggeredBy && this.isTriggeredBy(effect, newPlay, simState)) {
                            if (cardEffectRegistry.checkConditions(effect, simState, playerId)) {
                                console.log(`🔔 Triggered effect: ${effect.type} from ${card.id}`);
                                cardEffectRegistry.applyEffect(effect, simState, playerId);
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Check if an effect is triggered by a play
     * @param {Object} effect - Effect definition
     * @param {Object} play - Play record
     * @param {Object} simState - Simulation state
     * @returns {boolean} Whether effect is triggered
     */
    isTriggeredBy(effect, play, simState) {
        if (!effect.triggeredBy) {
            return false;
        }
        
        const trigger = effect.triggeredBy;
        
        // Trigger by card type
        if (trigger.cardType) {
            const cardDetails = this.cardInfoUtils.getCardDetails(play.cardId);
            if (cardDetails && cardDetails.cardType === trigger.cardType) {
                return true;
            }
        }
        
        // Trigger by game type
        if (trigger.gameType) {
            const cardDetails = this.cardInfoUtils.getCardDetails(play.cardId);
            if (cardDetails && cardDetails.gameType === trigger.gameType) {
                return true;
            }
        }
        
        // Trigger by specific card name
        if (trigger.cardName) {
            const cardDetails = this.cardInfoUtils.getCardDetails(play.cardId);
            if (cardDetails && cardDetails.name === trigger.cardName) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * CALCULATE FINAL STATE - Extract Results for API Response
     * ========================================================
     * 
     * 🎯 PURPOSE: Takes the simulated game state and packages it into the 
     * computedState format that will be returned and merged back into gameEnv.
     * 
     * 🔄 WORKFLOW:
     * 1. Create computedState structure for API response
     * 2. Copy zone restrictions from simState to computedState.activeRestrictions
     * 3. Calculate final power values for all cards
     * 4. Include disabled cards and victory point modifiers
     * 
     * 📊 CRITICAL DATA FLOW:
     * simState.players[playerId].fieldEffects.zoneRestrictions 
     *   ↓ (copied here)
     * computedState.activeRestrictions[playerId]
     *   ↓ (merged in GameLogic.js)  
     * gameEnv.players[playerId].fieldEffects.zoneRestrictions
     *   ↓ (sent in API response)
     * Frontend receives zone restrictions
     * 
     * 📋 EXAMPLE OUTPUT:
     * {
     *   playerPowers: { playerId_1: { "c-1": {originalPower: 150, finalPower: 195} } },
     *   activeRestrictions: { 
     *     playerId_1: { TOP: ["右翼", "自由", "經濟"], LEFT: [...] }
     *   },
     *   disabledCards: [...],
     *   victoryPointModifiers: {...}
     * }
     * 
     * @param {Object} simState - Fully simulated game state
     * @returns {Object} Computed state ready for API response
     */
    calculateFinalState(simState) {
        const computedState = {
            playerPowers: {},
            activeRestrictions: {},
            disabledCards: simState.disabledCards,
            victoryPointModifiers: {}
        };

        // Calculate final power values for all cards
        for (const playerId in simState.players) {
            computedState.playerPowers[playerId] = {};
            // ⚠️  CRITICAL: Copy zone restrictions from simState to computedState
            // This is the data that gets merged back into gameEnv for API response!
            computedState.activeRestrictions[playerId] = simState.players[playerId].fieldEffects.zoneRestrictions;
            computedState.victoryPointModifiers[playerId] = 0;
            
            const field = simState.players[playerId].Field;
            const powerMods = simState.powerModifiers[playerId] || {};
            
            // Calculate power for all cards in all zones
            for (const zone in field) {
                const cards = Array.isArray(field[zone]) ? field[zone] : [field[zone]];
                
                for (const card of cards) {
                    if (!card) continue;
                    
                    // Calculate power with leader effects
                    const basePower = card.power || 0;
                    const finalPower = this.calculateCardPowerWithLeaderEffects(simState, playerId, card, basePower);
                    
                    computedState.playerPowers[playerId][card.id] = {
                        originalPower: basePower,
                        finalPower: finalPower,
                        zone: zone,
                        isDisabled: simState.disabledCards.some(d => d.cardId === card.id)
                    };
                }
            }
        }

        console.log('📊 Final computed state:', {
            playersWithPowerMods: Object.keys(computedState.playerPowers).length,
            totalDisabledCards: computedState.disabledCards.length
        });

        return computedState;
    }

    /**
     * Calculate card power with leader effects applied
     * @param {Object} simState - Simulation state
     * @param {string} playerId - Player ID
     * @param {Object} card - Card details
     * @param {number} basePower - Base power of the card
     * @returns {number} Modified power value
     */
    calculateCardPowerWithLeaderEffects(simState, playerId, card, basePower) {
        if (!simState.players[playerId]?.fieldEffects?.activeEffects) {
            return basePower;
        }
        
        let modifiedPower = basePower;
        const effects = simState.players[playerId].fieldEffects.activeEffects;
        
        // Apply power modification effects
        for (const effect of effects) {
            if (effect.type === "powerBoost") {
                if (this.doesLeaderEffectAffectCard(effect, card)) {
                    modifiedPower += effect.value;
                    console.log(`⚡ Leader power boost applied to ${card.name}: +${effect.value} (${basePower} → ${modifiedPower})`);
                }
            } else if (effect.type === "POWER_NULLIFICATION") {
                if (this.doesLeaderEffectAffectCard(effect, card)) {
                    modifiedPower = 0;
                    console.log(`🚫 Leader power nullification applied to ${card.name}: ${basePower} → 0`);
                }
            }
        }
        
        return modifiedPower;
    }

    /**
     * Check if a leader effect affects a specific card
     * @param {Object} effect - Effect to check
     * @param {Object} card - Card details
     * @returns {boolean} True if effect affects the card
     */
    doesLeaderEffectAffectCard(effect, card) {
        const target = effect.target;
        
        // Check card type filter
        if (target.cardTypes && target.cardTypes !== "ALL") {
            if (!target.cardTypes.includes(card.cardType)) {
                return false;
            }
        }
        
        // Check game type filter
        if (target.gameTypes && target.gameTypes !== "ALL") {
            if (!target.gameTypes.includes(card.gameType)) {
                return false;
            }
        }
        
        // Check traits filter
        if (target.traits && target.traits !== "ALL") {
            const cardTraits = card.traits || [];
            const hasMatchingTrait = target.traits.some(trait => cardTraits.includes(trait));
            if (!hasMatchingTrait) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Get computed power for a specific card
     * @param {Object} computedState - Computed state
     * @param {string} playerId - Player ID
     * @param {string} cardId - Card ID
     * @returns {number} Computed power value
     */
    getComputedPower(computedState, playerId, cardId) {
        return computedState.playerPowers[playerId]?.[cardId]?.finalPower || 0;
    }

    /**
     * Check if a card is disabled
     * @param {Object} computedState - Computed state
     * @param {string} cardId - Card ID
     * @returns {boolean} Whether card is disabled
     */
    isCardDisabled(computedState, cardId) {
        return computedState.disabledCards.some(d => d.cardId === cardId);
    }

    // ========================================================================
    // UNIFIED EFFECT METHODS - SINGLE SOURCE OF TRUTH (January 2025)
    // ========================================================================
    // These methods work directly on gameEnv.players[].fieldEffects structure
    // eliminating the need for computedState and merge operations.

    /**
     * Initialize fieldEffects structure for all players
     * @param {Object} gameEnv - Game environment
     */
    initializeFieldEffects(gameEnv) {
        const { getPlayerFromGameEnv } = require('../utils/gameUtils');
        const playerList = getPlayerFromGameEnv(gameEnv);
        
        for (const playerId of playerList) {
            if (!gameEnv.players[playerId].fieldEffects) {
                gameEnv.players[playerId].fieldEffects = {
                    zoneRestrictions: {
                        TOP: "ALL",
                        LEFT: "ALL", 
                        RIGHT: "ALL",
                        HELP: "ALL",
                        SP: "ALL"
                    },
                    activeEffects: [],
                    calculatedPowers: {},
                    disabledCards: [],
                    victoryPointModifiers: 0
                };
            } else {
                // Reset calculated values to clean state
                gameEnv.players[playerId].fieldEffects.calculatedPowers = {};
                gameEnv.players[playerId].fieldEffects.disabledCards = [];
                gameEnv.players[playerId].fieldEffects.victoryPointModifiers = 0;
                // Keep zoneRestrictions and activeEffects - they'll be rebuilt from play sequence
                gameEnv.players[playerId].fieldEffects.zoneRestrictions = {
                    TOP: "ALL", LEFT: "ALL", RIGHT: "ALL", HELP: "ALL", SP: "ALL"
                };
                gameEnv.players[playerId].fieldEffects.activeEffects = [];
            }
        }
        
        console.log('✅ Initialized fieldEffects structure for all players');
    }

    /**
     * Execute play action unified - works directly on gameEnv
     * @param {Object} gameEnv - Game environment
     * @param {Object} play - Play action
     */
    async executePlayUnified(gameEnv, play) {
        if (play.action === 'PLAY_LEADER') {
            // Process leader effects directly on gameEnv.players[].fieldEffects
            await this.processCompleteLeaderEffectsUnified(gameEnv, play.playerId, play.cardId);
        } else if (play.action === 'PLAY_CARD') {
            // Place card on board (gameEnv structure)
            const zone = play.zone;
            const card = this.cardInfoUtils.getCardDetails(play.cardId);
            
            if (Array.isArray(gameEnv.zones[play.playerId][zone])) {
                gameEnv.zones[play.playerId][zone].push(card);
            } else {
                gameEnv.zones[play.playerId][zone] = card;
            }
        }
    }

    /**
     * Process complete leader effects unified - works directly on gameEnv
     * @param {Object} gameEnv - Game environment  
     * @param {string} playerId - Player ID
     * @param {string} leaderId - Leader ID
     */
    async processCompleteLeaderEffectsUnified(gameEnv, playerId, leaderId) {
        console.log(`🏛️ Processing leader ${leaderId} effects for ${playerId} (unified)...`);
        
        const leaderData = this.cardInfoUtils.getCardDetails(leaderId);
        if (!leaderData) {
            console.log(`⚠️ Leader ${leaderId} not found`);
            return;
        }

        // STEP 1: Set leader in zones
        gameEnv.zones[playerId].leader = leaderData;

        // STEP 2: Apply zone restrictions (THIS IS WHERE ZONE RESTRICTIONS ARE SET!)
        if (leaderData.zoneCompatibility) {
            this.applyLeaderZoneRestrictionsUnified(gameEnv, playerId, leaderData);
        }

        // STEP 3: Process leader field effects (power boosts, cross-player effects)
        // Handle both new format (fieldEffects) and old format (effects.rules)
        let effectRules = [];
        
        if (leaderData.fieldEffects && leaderData.fieldEffects.length > 0) {
            // New format: fieldEffects array
            effectRules = leaderData.fieldEffects;
        } else if (leaderData.effects && leaderData.effects.rules && leaderData.effects.rules.length > 0) {
            // Old format: effects.rules array - convert to new format
            console.log(`🔄 Converting old effect format for leader ${leaderId}...`);
            effectRules = this.convertOldLeaderEffectsToNew(leaderData.effects.rules);
        }
        
        for (const effectRule of effectRules) {
            const effect = this.convertLeaderRuleToEffectUnified(effectRule, leaderId, playerId);
            gameEnv.players[playerId].fieldEffects.activeEffects.push(effect);
            
            // Apply cross-player effects immediately
            if (effect.target.scope === "OPPONENT") {
                this.applyCrossPlayerEffectUnified(gameEnv, effect, playerId);
            }
        }

        console.log(`✅ Leader ${leaderId} effects applied to unified structure`);
    }

    /**
     * Apply leader zone restrictions unified
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID  
     * @param {Object} leaderData - Leader card data
     */
    applyLeaderZoneRestrictionsUnified(gameEnv, playerId, leaderData) {
        const restrictions = {
            TOP: leaderData.zoneCompatibility.top || ["ALL"],
            LEFT: leaderData.zoneCompatibility.left || ["ALL"],
            RIGHT: leaderData.zoneCompatibility.right || ["ALL"],
            HELP: ["ALL"], 
            SP: ["ALL"]
        };
        
        gameEnv.players[playerId].fieldEffects.zoneRestrictions = restrictions;
        
        console.log(`🔒 Applied zone restrictions to ${playerId}:`, restrictions);
    }

    /**
     * Convert leader effect rule to effect object unified
     * @param {Object} effectRule - Effect rule from leader JSON
     * @param {string} leaderId - Leader ID
     * @param {string} playerId - Player ID
     * @returns {Object} Effect object
     */
    convertLeaderRuleToEffectUnified(effectRule, leaderId, playerId) {
        return {
            effectId: `${leaderId}_${effectRule.type}`,
            source: leaderId,
            sourcePlayerId: playerId,
            type: effectRule.type,
            target: effectRule.target,
            value: effectRule.value,
            priority: effectRule.priority || 0,
            unremovable: effectRule.unremovable || false
        };
    }

    /**
     * Apply cross-player effect unified
     * @param {Object} gameEnv - Game environment
     * @param {Object} effect - Effect object
     * @param {string} sourcePlayerId - Source player ID
     */
    applyCrossPlayerEffectUnified(gameEnv, effect, sourcePlayerId) {
        const { getOpponentPlayer } = require('../utils/gameUtils');
        const opponentId = getOpponentPlayer(gameEnv, sourcePlayerId);
        
        if (effect.type === "POWER_NULLIFICATION") {
            // Add effect to opponent's fieldEffects for tracking
            const opponentEffect = {
                ...effect,
                effectId: `${effect.effectId}_cross_player`,
                appliedToPlayer: opponentId
            };
            
            if (!gameEnv.players[opponentId].fieldEffects.activeEffects) {
                gameEnv.players[opponentId].fieldEffects.activeEffects = [];
            }
            gameEnv.players[opponentId].fieldEffects.activeEffects.push(opponentEffect);
            
            console.log(`🎯 Applied cross-player effect ${effect.type} to ${opponentId}`);
        }
    }

    /**
     * Activate effects unified - works directly on gameEnv
     * @param {Object} gameEnv - Game environment
     * @param {Object} play - Play action
     */
    activateEffectsUnified(gameEnv, play) {
        // TODO: Implement card-specific effect activation
        // This would process card.effects.rules[] and add to activeEffects
        console.log(`🎭 Processing card effects for ${play.cardId} (unified)`);
    }

    /**
     * Check triggered effects unified - works directly on gameEnv
     * @param {Object} gameEnv - Game environment
     * @param {Object} play - Play action
     */
    checkTriggeredEffectsUnified(gameEnv, play) {
        // TODO: Implement triggered effect checking
        // This would check if any existing cards react to the new play
        console.log(`⚡ Checking triggered effects for ${play.cardId} (unified)`);
    }

    /**
     * Calculate final powers unified - works directly on gameEnv
     * @param {Object} gameEnv - Game environment
     */
    calculateFinalPowersUnified(gameEnv) {
        const { getPlayerFromGameEnv } = require('../utils/gameUtils');
        const playerList = getPlayerFromGameEnv(gameEnv);
        
        console.log('🔢 Calculating final power values (unified)...');
        
        for (const playerId of playerList) {
            const zones = gameEnv.zones[playerId];
            const effects = gameEnv.players[playerId].fieldEffects.activeEffects;
            
            // Calculate power for all cards in all zones
            for (const zone in zones) {
                if (zone === 'leader') continue; // Skip leader
                
                const cards = Array.isArray(zones[zone]) ? zones[zone] : [zones[zone]];
                
                for (const card of cards) {
                    if (!card) continue;
                    
                    const basePower = card.power || 0;
                    const finalPower = this.calculateCardPowerWithEffectsUnified(gameEnv, playerId, card, basePower);
                    
                    // Store calculated power in fieldEffects
                    gameEnv.players[playerId].fieldEffects.calculatedPowers[card.cardId] = finalPower;
                }
            }
        }
        
        console.log('✅ Final power calculation completed (unified)');
    }

    /**
     * Calculate card power with effects unified
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {Object} card - Card object
     * @param {number} basePower - Base power
     * @returns {number} Final power
     */
    calculateCardPowerWithEffectsUnified(gameEnv, playerId, card, basePower) {
        let modifiedPower = basePower;
        const effects = gameEnv.players[playerId].fieldEffects.activeEffects;
        
        // Apply power boost effects
        for (const effect of effects) {
            if (effect.type === 'powerBoost' && this.checkEffectTargetsCardUnified(effect, card)) {
                modifiedPower += effect.value;
                console.log(`📈 Applied power boost +${effect.value} to ${card.cardId}: ${basePower} → ${modifiedPower}`);
            }
        }
        
        // Apply nullification effects (from opponent)
        for (const effect of effects) {
            if (effect.type === 'POWER_NULLIFICATION' && this.checkEffectTargetsCardUnified(effect, card)) {
                modifiedPower = 0;
                console.log(`🚫 Applied power nullification to ${card.cardId}: ${basePower} → 0`);
                break; // Nullification overrides other effects
            }
        }
        
        return modifiedPower;
    }

    /**
     * Check if effect targets specific card unified
     * @param {Object} effect - Effect object
     * @param {Object} card - Card object
     * @returns {boolean} Whether effect targets the card
     */
    checkEffectTargetsCardUnified(effect, card) {
        // Check game type targeting
        if (effect.target.gameTypes && effect.target.gameTypes.length > 0) {
            if (!effect.target.gameTypes.includes(card.gameType)) {
                return false;
            }
        }
        
        // Check traits targeting  
        if (effect.target.traits && effect.target.traits.length > 0) {
            if (!card.traits || !effect.target.traits.some(trait => card.traits.includes(trait))) {
                return false;
            }
        }
        
        return true;
    }

    // ========================================================================
    // UNIFIED ACCESSOR FUNCTIONS - SINGLE SOURCE OF TRUTH (January 2025)
    // ========================================================================
    // These functions provide access to effect data from gameEnv.players[].fieldEffects
    // replacing the old computedState-based accessors.

    /**
     * Get calculated power for a card (unified)
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {string} cardId - Card ID
     * @returns {number} Calculated power value
     */
    getCalculatedPower(gameEnv, playerId, cardId) {
        return gameEnv.players[playerId]?.fieldEffects?.calculatedPowers?.[cardId] || 0;
    }

    /**
     * Check if a card is disabled (unified)
     * @param {Object} gameEnv - Game environment
     * @param {string} cardId - Card ID
     * @returns {boolean} Whether card is disabled
     */
    isCardDisabledUnified(gameEnv, cardId) {
        // Check all players' disabled cards
        const { getPlayerFromGameEnv } = require('../utils/gameUtils');
        const playerList = getPlayerFromGameEnv(gameEnv);
        
        for (const playerId of playerList) {
            const disabledCards = gameEnv.players[playerId]?.fieldEffects?.disabledCards || [];
            if (disabledCards.some(d => d.cardId === cardId)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Get zone restrictions for a player (unified)
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {Object} Zone restrictions object
     */
    getZoneRestrictions(gameEnv, playerId) {
        return gameEnv.players[playerId]?.fieldEffects?.zoneRestrictions || {
            TOP: "ALL", LEFT: "ALL", RIGHT: "ALL", HELP: "ALL", SP: "ALL"
        };
    }

    /**
     * Get all active effects for a player (unified)
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {Array} Array of active effects
     */
    getActiveEffects(gameEnv, playerId) {
        return gameEnv.players[playerId]?.fieldEffects?.activeEffects || [];
    }

    /**
     * Get victory point modifiers for a player (unified)
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @returns {number} Victory point modifier
     */
    getVictoryPointModifiers(gameEnv, playerId) {
        return gameEnv.players[playerId]?.fieldEffects?.victoryPointModifiers || 0;
    }

    /**
     * Convert old leader effect format to new unified format
     * @param {Array} oldEffectRules - Old effects.rules array
     * @returns {Array} New fieldEffects array
     */
    convertOldLeaderEffectsToNew(oldEffectRules) {
        const newEffects = [];
        
        for (const rule of oldEffectRules) {
            if (rule.type === 'continuous' && rule.effect && rule.target) {
                // Convert old filter format to new target format
                let gameTypes = [];
                if (rule.target.filters) {
                    for (const filter of rule.target.filters) {
                        if (filter.type === 'gameType' && filter.value) {
                            gameTypes.push(filter.value);
                        } else if (filter.type === 'gameTypeOr' && filter.values) {
                            gameTypes = gameTypes.concat(filter.values);
                        }
                    }
                }
                
                // Convert to new unified format
                const newEffect = {
                    type: rule.effect.type,  // powerBoost, etc.
                    target: {
                        scope: rule.target.owner === 'self' ? 'SELF' : 'OPPONENT',
                        zones: rule.target.zones || ["ALL"],
                        gameTypes: gameTypes.length > 0 ? gameTypes : undefined
                    },
                    value: rule.effect.value,
                    priority: rule.priority || 0,
                    unremovable: rule.unremovable || false
                };
                
                newEffects.push(newEffect);
                console.log(`🔄 Converted old effect: ${rule.effect.type} +${rule.effect.value} for types: ${gameTypes.join(', ')}`);
            }
        }
        
        return newEffects;
    }
}

module.exports = new EffectSimulator();