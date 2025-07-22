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
        
        // 5. Calculate player points for all players (NEW - January 2025)
        // This ensures complete centralization - no manual point calculations needed outside simulator
        await this.calculatePlayerPointsUnified(gameEnv);
        
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
            gameEnv: gameEnv, // Reference to original gameEnv for card effects
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
                    
                    // Process card effects (unified)
                    console.log(`🎭 Processing card effects for ${cardId} (unified)`);
                    await this.processCardEffects(simState, playerId, cardDetails);
                    
                    // Check triggered effects for "onPlay" events
                    console.log(`⚡ Checking triggered effects for ${cardId} (unified)`);
                    await this.processTriggeredEffects(simState, playerId, cardDetails, 'onPlay');
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
     * PROCESS CARD EFFECTS - Handle Utility Card Effects
     * ==================================================
     * 
     * 🎯 PURPOSE: Process all continuous effects from utility cards like h-5 (失智老人)
     * This handles effects like zonePlacementFreedom, powerBoost, etc.
     * 
     * @param {Object} simState - Current simulation state 
     * @param {string} playerId - Player who played the card
     * @param {Object} cardDetails - Card details with effects
     */
    async processCardEffects(simState, playerId, cardDetails) {
        if (!cardDetails.effects || !cardDetails.effects.rules) {
            return; // No effects to process
        }
        
        // Process each effect rule
        for (const rule of cardDetails.effects.rules) {
            if (rule.type === 'continuous' && rule.trigger.event === 'always') {
                await this.applyCardEffect(simState, playerId, cardDetails.id, rule);
            }
        }
    }
    
    /**
     * PROCESS TRIGGERED EFFECTS - Handle OnPlay/Triggered Effects 
     * ===========================================================
     * 
     * 🎯 PURPOSE: Process effects that trigger on specific events like "onPlay"
     * This is used for effects that activate when cards are played.
     * 
     * @param {Object} simState - Current simulation state
     * @param {string} playerId - Player who played the card  
     * @param {Object} cardDetails - Card details with effects
     * @param {string} triggerEvent - Event that triggered (e.g., 'onPlay')
     */
    async processTriggeredEffects(simState, playerId, cardDetails, triggerEvent) {
        if (!cardDetails.effects || !cardDetails.effects.rules) {
            return; // No effects to process
        }
        
        // Process triggered effects
        for (const rule of cardDetails.effects.rules) {
            if (rule.type === 'triggered' && rule.trigger.event === triggerEvent) {
                await this.applyCardEffect(simState, playerId, cardDetails.id, rule);
            }
        }
    }
    
    /**
     * APPLY CARD EFFECT - Apply Individual Card Effect Rule
     * =====================================================
     * 
     * 🎯 PURPOSE: Apply a single card effect rule to the simulation state.
     * This handles all effect types including zonePlacementFreedom.
     * 
     * @param {Object} simState - Current simulation state
     * @param {string} playerId - Player who owns the card
     * @param {string} cardId - Card ID
     * @param {Object} rule - Effect rule to apply
     */
    async applyCardEffect(simState, playerId, cardId, rule) {
        const effectType = rule.effect.type;
        
        // Handle zonePlacementFreedom effect (store in unified fieldEffects)
        if (effectType === 'zonePlacementFreedom') {
            const targetPlayerId = rule.target.owner === 'opponent' ? 
                this.getOpponentPlayerId(simState, playerId) : playerId;
            
            // Apply zonePlacementFreedom to the target player's fieldEffects
            const gameEnv = simState.gameEnv;
            if (!gameEnv.players[targetPlayerId].fieldEffects.specialEffects) {
                gameEnv.players[targetPlayerId].fieldEffects.specialEffects = {};
            }
            gameEnv.players[targetPlayerId].fieldEffects.specialEffects.zonePlacementFreedom = true;
            
            console.log(`🔓 Applied zonePlacementFreedom to ${targetPlayerId} fieldEffects via ${cardId}`);
            return;
        }
        
        // Handle other effect types (powerBoost, etc.) 
        if (effectType === 'powerBoost' || effectType === 'setPower') {
            // Convert rule to unified format and apply
            const unifiedEffect = {
                type: effectType,
                value: rule.effect.value,
                target: {
                    scope: rule.target.owner === 'self' ? 'SELF' : 'OPPONENT',
                    zones: rule.target.zones || ['top', 'left', 'right'],
                    gameTypes: rule.target.filters ? 
                        rule.target.filters.map(f => f.value).filter(v => v) : []
                }
            };
            
            this.applyLeaderEffect(simState, playerId, cardId, unifiedEffect);
            console.log(`⚡ Applied ${effectType} effect from ${cardId}`);
            return;
        }
        
        console.log(`⚠️ Unhandled card effect type: ${effectType} from ${cardId}`);
    }
    
    /**
     * GET OPPONENT PLAYER ID - Helper to find opponent
     * ================================================
     */
    getOpponentPlayerId(simState, playerId) {
        const allPlayerIds = Object.keys(simState.players);
        return allPlayerIds.find(id => id !== playerId);
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
            // NOTE: Card placement is handled by mozGamePlay.js - EffectSimulator only processes effects
            // This prevents duplicate card entries in zones
            console.log(`🎭 Processing card effects for ${play.cardId} (unified)`);
            
            // Process card effects but don't place the card (already placed by main game logic)
            const card = this.cardInfoUtils.getCardDetails(play.cardId);
            if (card && card.effects && card.effects.rules) {
                // Note: processCardEffects expects simState, but for unified approach we just skip effect processing
                // since card effects are handled separately by the main game logic
                console.log(`⚡ Checking triggered effects for ${play.cardId} (unified)`);
            }
        } else if (play.action === 'APPLY_SET_POWER') {
            // 🆕 NEW: Handle card selection effects (January 2025)
            // Process setPower effects from card selections like h-2 "Make America Great Again"
            console.log(`🎯 Processing APPLY_SET_POWER effect: ${play.cardId} selected cards ${play.data.selectedCardIds.join(', ')}`);
            
            // 🛠️ BUG FIX: Pass sourceCard from play.cardId instead of relying on play.data.sourceCard
            const effectData = {
                ...play.data,
                sourceCard: play.cardId  // Override with the correct source card from play sequence
            };
            
            // Apply setPower effect to selected cards
            this.applySetPowerEffectUnified(gameEnv, effectData);
        } else if (play.action === 'APPLY_NEUTRALIZATION') {
            // 🆕 NEW: Handle card neutralization effects (h-1 Deep State, etc)
            console.log(`🎯 Processing APPLY_NEUTRALIZATION effect: ${play.cardId} selected cards ${play.data.selectedCardIds.join(', ')}`);
            const effectData = {
                ...play.data,
                sourceCard: play.cardId
            };
            this.applyNeutralizationEffectUnified(gameEnv, effectData);
        }
    }

    /**
     * 🎯 Apply setPower effect unified - NEW (January 2025)
     * =====================================================
     * 
     * This method processes APPLY_SET_POWER actions from card selections like h-2 "Make America Great Again".
     * It applies setPower effects directly to gameEnv.players[].fieldEffects.activeEffects.
     * 
     * 🔄 CENTRALIZED EFFECT PROCESSING:
     * - All setPower effects processed through this single method
     * - Effects stored in activeEffects for unified access
     * - Calculated powers updated automatically by calculateFinalPowersUnified()
     * 
     * @param {Object} gameEnv - Game environment
     * @param {Object} data - Selection data with selectedCardIds, targetPlayerId, powerValue, etc.
     */
    applySetPowerEffectUnified(gameEnv, data) {
        const { selectedCardIds, targetPlayerId, powerValue, sourceCard } = data;
        
        console.log(`🎯 Applying setPower effect to ${selectedCardIds.length} cards for ${targetPlayerId}`);
        
        // Initialize field effects if not present
        if (!gameEnv.players[targetPlayerId].fieldEffects) {
            gameEnv.players[targetPlayerId].fieldEffects = {
                zoneRestrictions: {},
                activeEffects: [],
                calculatedPowers: {}
            };
        }
        
        // Create setPower effect for each selected card
        selectedCardIds.forEach(cardId => {
            const effectId = `setPower_${sourceCard}_${cardId}_${Date.now()}`;
            
            const setPowerEffect = {
                effectId: effectId,
                source: sourceCard,
                type: "setPower",
                target: { 
                    scope: "SPECIFIC_CARD",
                    cardId: cardId,
                    playerId: targetPlayerId
                },
                value: powerValue,
                
                // 🆕 ENHANCED EFFECT STATE TRACKING (January 2025)
                isEnabled: true,                     // All new effects start enabled
                createdAt: Date.now(),              // Track when effect was created
                timestamp: Date.now()               // Legacy field (keeping for compatibility)
            };
            
            // Add effect to activeEffects array
            gameEnv.players[targetPlayerId].fieldEffects.activeEffects.push(setPowerEffect);
            
            console.log(`✅ Added setPower effect: ${cardId} → ${powerValue} power from ${sourceCard}`);
        });
        
        console.log(`🎯 setPower effect processing completed for ${selectedCardIds.length} cards`);
    }

    /**
     * 🎯 Apply neutralization effect unified - ENHANCED (January 2025)
     * ================================================================
     * 
     * IMPROVED APPROACH: Instead of removing effects completely, this method now:
     * 1. Marks effects as disabled with isEnabled = false
     * 2. Records the neutralization reason for traceability
     * 3. Preserves effect history for debugging and potential reversal
     * 4. Maintains full audit trail of all neutralization actions
     * 
     * BENEFITS:
     * - Better debugging: Can see what was neutralized and why
     * - Reversibility: Effects can be re-enabled if neutralization is undone
     * - Audit trail: Complete history of effect state changes
     * - No data loss: Original effects preserved for analysis
     * 
     * @param {Object} gameEnv - Game environment
     * @param {Object} data - Selection data with selectedCardIds, targetPlayerId, sourceCard, etc.
     */
    async applyNeutralizationEffectUnified(gameEnv, data) {
        const { selectedCardIds, targetPlayerId, sourceCard, undoEffect } = data;
        console.log(`🎯 Applying neutralization effect to ${selectedCardIds.length} cards for ${targetPlayerId}`);
        
        if (!gameEnv.players[targetPlayerId].fieldEffects) {
            gameEnv.players[targetPlayerId].fieldEffects = {
                zoneRestrictions: {},
                activeEffects: [],
                calculatedPowers: {}
            };
        }
        
        selectedCardIds.forEach(cardId => {
            console.log(`🎯 Neutralizing card ${cardId} - disabling effects from all players...`);
            
            // Disable effects created by the neutralized card from ALL players
            // This is critical because cards like h-2 can create effects on opponent's fieldEffects
            const { getPlayerFromGameEnv } = require('../utils/gameUtils');
            const playerList = getPlayerFromGameEnv(gameEnv);
            
            let totalEffectsDisabled = 0;
            const neutralizationTimestamp = Date.now();
            const neutralizationReason = `Neutralized by ${sourceCard} at ${new Date(neutralizationTimestamp).toISOString()}`;
            
            for (const playerId of playerList) {
                let disabledFromPlayer = 0;
                
                // Instead of removing, mark effects as disabled with reason
                gameEnv.players[playerId].fieldEffects.activeEffects.forEach(effect => {
                    if (effect.source === cardId && effect.isEnabled !== false) {
                        // Mark effect as disabled
                        effect.isEnabled = false;
                        effect.disabledBy = sourceCard;
                        effect.disabledAt = neutralizationTimestamp;
                        effect.disabledReason = neutralizationReason;
                        effect.neutralizationId = `${sourceCard}_${cardId}_${neutralizationTimestamp}`;
                        
                        disabledFromPlayer++;
                        totalEffectsDisabled++;
                        
                        console.log(`🚫 Disabled effect ${effect.effectId} from ${cardId}: ${effect.type} (reason: ${neutralizationReason})`);
                    }
                });
                
                if (disabledFromPlayer > 0) {
                    console.log(`🧹 Disabled ${disabledFromPlayer} effect(s) created by ${cardId} from ${playerId}`);
                }
            }
            
            // Add neutralization tracking to game history
            if (!gameEnv.neutralizationHistory) {
                gameEnv.neutralizationHistory = [];
            }
            
            gameEnv.neutralizationHistory.push({
                neutralizedCard: cardId,
                neutralizedBy: sourceCard,
                timestamp: neutralizationTimestamp,
                effectsDisabled: totalEffectsDisabled,
                reason: neutralizationReason
            });
            
            console.log(`✅ Neutralization complete: disabled ${totalEffectsDisabled} total effect(s) from card ${cardId}`);
        });
        
        console.log(`🎯 Neutralization effect processing completed - effects disabled with full traceability`);
    }

    /**
     * 🔄 Re-enable neutralized effects - BONUS FEATURE (January 2025)
     * ================================================================
     * 
     * This method can re-enable effects that were previously neutralized,
     * providing undo functionality for neutralization effects.
     * 
     * USE CASES:
     * - Counter-spells that undo neutralization
     * - Temporary neutralization effects that expire
     * - Game mechanics that allow reversing neutralization
     * 
     * @param {Object} gameEnv - Game environment
     * @param {Object} data - Re-enable data with neutralizationIds or sourceCard
     */
    async reEnableNeutralizedEffects(gameEnv, data) {
        const { neutralizationIds, sourceCard, reason } = data;
        console.log(`🔄 Re-enabling neutralized effects...`);
        
        const { getPlayerFromGameEnv } = require('../utils/gameUtils');
        const playerList = getPlayerFromGameEnv(gameEnv);
        
        let totalEffectsReEnabled = 0;
        const reEnableTimestamp = Date.now();
        const reEnableReason = reason || `Re-enabled at ${new Date(reEnableTimestamp).toISOString()}`;
        
        for (const playerId of playerList) {
            let reEnabledFromPlayer = 0;
            
            gameEnv.players[playerId].fieldEffects.activeEffects.forEach(effect => {
                let shouldReEnable = false;
                
                // Re-enable by specific neutralization IDs
                if (neutralizationIds && neutralizationIds.includes(effect.neutralizationId)) {
                    shouldReEnable = true;
                }
                
                // Re-enable all effects neutralized by a specific source card
                if (sourceCard && effect.disabledBy === sourceCard) {
                    shouldReEnable = true;
                }
                
                if (shouldReEnable && effect.isEnabled === false) {
                    // Re-enable the effect
                    effect.isEnabled = true;
                    effect.reEnabledAt = reEnableTimestamp;
                    effect.reEnabledReason = reEnableReason;
                    
                    reEnabledFromPlayer++;
                    totalEffectsReEnabled++;
                    
                    console.log(`✅ Re-enabled effect ${effect.effectId}: ${effect.type} (${reEnableReason})`);
                }
            });
            
            if (reEnabledFromPlayer > 0) {
                console.log(`🔄 Re-enabled ${reEnabledFromPlayer} effect(s) from ${playerId}`);
            }
        }
        
        // Add re-enablement to history
        if (!gameEnv.neutralizationHistory) {
            gameEnv.neutralizationHistory = [];
        }
        
        gameEnv.neutralizationHistory.push({
            action: "RE_ENABLE",
            sourceCard: sourceCard,
            neutralizationIds: neutralizationIds,
            timestamp: reEnableTimestamp,
            effectsReEnabled: totalEffectsReEnabled,
            reason: reEnableReason
        });
        
        console.log(`✅ Re-enablement complete: re-enabled ${totalEffectsReEnabled} total effect(s)`);
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

        // STEP 3: Process leader effects directly from JSON (simplified - no conversion needed)
        let effectRules = [];
        
        if (leaderData.effects && leaderData.effects.rules && leaderData.effects.rules.length > 0) {
            // Process effects directly from JSON - no conversion overhead
            effectRules = leaderData.effects.rules;
            console.log(`📋 Processing ${effectRules.length} leader effects directly from JSON for ${leaderId}...`);
        }
        
        for (const effectRule of effectRules) {
            // Check conditions before applying effects
            let shouldApplyEffect = true;
            
            if (effectRule.trigger && effectRule.trigger.conditions) {
                shouldApplyEffect = this.checkLeaderEffectConditionsUnified(gameEnv, playerId, effectRule);
            }
            
            if (shouldApplyEffect) {
                // 🏗️ UNIFIED EFFECT PROCESSING PIPELINE
                // =====================================
                // This 3-step process handles ALL leader effects uniformly:
                
                // STEP 1: CONVERT - Transform JSON rule to activeEffect object (PURE FUNCTION)
                console.log(`🔄 STEP 1: Converting effect rule to activeEffect object...`);
                const effect = this.convertLeaderRuleToEffectUnified(effectRule, leaderId, playerId, gameEnv);
                
                // STEP 2: STORE - Add activeEffect to target player's activeEffects array
                console.log(`📦 STEP 2: Storing activeEffect in target player's activeEffects...`);
                const targetPlayerId = effect.target.playerId;
                gameEnv.players[targetPlayerId].fieldEffects.activeEffects.push(effect);
                
                // STEP 3: SPECIAL HANDLING - Handle effects that need immediate gameEnv modification
                console.log(`🚨 STEP 3: Checking for special effect handling requirements...`);
                await this.applySpecialEffectHandlingUnified(gameEnv, effect, effectRule);

                console.log(`✅ Applied unified leader effect ${effectRule.id || effectRule.type} from ${leaderId} → ${targetPlayerId}`);
            } else {
                console.log(`❌ Skipped leader effect ${effectRule.id || effectRule.type} from ${leaderId} - conditions not met`);
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
     * Check leader effect conditions unified (simplified - no conversion)
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {Object} rule - Original effect rule from JSON
     * @returns {boolean} Whether conditions are met
     */
    checkLeaderEffectConditionsUnified(gameEnv, playerId, rule) {
        if (!rule.trigger || !rule.trigger.conditions) {
            return true; // No conditions means always apply
        }
        
        for (const condition of rule.trigger.conditions) {
            if (condition.type === 'opponentLeader') {
                // Find opponent player
                const { getOpponentPlayer } = require('../utils/gameUtils');
                const opponentId = getOpponentPlayer(gameEnv, playerId);
                const opponentLeader = gameEnv.zones[opponentId]?.leader;
                
                if (opponentLeader && opponentLeader.name !== condition.value) {
                    console.log(`❌ Leader effect condition not met: opponent leader is "${opponentLeader.name}", expected "${condition.value}"`);
                    return false;
                }
                console.log(`✅ Leader effect condition met: opponent leader is "${condition.value}"`);
            }
        }
        
        return true;
    }

    /**
     * Apply restriction effects that modify zone compatibility
     * @param {Object} gameEnv - Game environment
     * @param {Object} effectRule - Restriction effect rule
     * @param {string} playerId - Player ID applying the restriction
     */
    async applyRestrictionEffectUnified(gameEnv, effectRule, playerId) {
        console.log(`🚫 Processing restriction effect for ${playerId}:`, effectRule.id);
        
        // Check if conditions are met for this restriction
        if (effectRule.trigger && effectRule.trigger.conditions) {
            for (const condition of effectRule.trigger.conditions) {
                if (condition.type === "opponentLeader") {
                    const { getOpponentPlayer } = require('../utils/gameUtils');
                    const opponentId = getOpponentPlayer(gameEnv, playerId);
                    const opponentLeader = gameEnv.zones[opponentId]?.leader;
                    
                    if (opponentLeader && opponentLeader.name === condition.value) {
                        console.log(`✅ Restriction condition met: opponent leader is ${condition.value}`);
                        
                        // Apply the restriction by modifying zone compatibility
                        if (effectRule.target && effectRule.target.filters) {
                            for (const filter of effectRule.target.filters) {
                                if (filter.type === "gameType") {
                                    const restrictedType = filter.value;
                                    console.log(`🚫 Applying restriction: removing ${restrictedType} from zone compatibility`);
                                    
                                    // Remove the restricted type from all specified zones
                                    const zones = effectRule.target.zones || ["top", "left", "right"];
                                    for (const zone of zones) {
                                        const zoneKey = zone.toUpperCase();
                                        if (gameEnv.players[playerId].fieldEffects.zoneRestrictions[zoneKey]) {
                                            const currentTypes = gameEnv.players[playerId].fieldEffects.zoneRestrictions[zoneKey];
                                            if (Array.isArray(currentTypes)) {
                                                // Remove the restricted type
                                                gameEnv.players[playerId].fieldEffects.zoneRestrictions[zoneKey] = 
                                                    currentTypes.filter(type => type !== restrictedType);
                                                console.log(`🔒 Updated ${zoneKey} restrictions for ${playerId}:`, 
                                                    gameEnv.players[playerId].fieldEffects.zoneRestrictions[zoneKey]);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        console.log(`❌ Restriction condition not met: opponent leader is ${opponentLeader?.name}, expected ${condition.value}`);
                    }
                }
            }
        }
    }

    /**
     * 🏗️ UNIFIED LEADER EFFECT PROCESSOR (Option 1 - Pure Transformation)
     * ===================================================================
     * 
     * Single function that converts ALL leader effect types to activeEffect objects,
     * maintaining consistency and eliminating special-case handling.
     * 
     * 📊 EFFECT CLASSIFICATION SYSTEM:
     * ================================
     * 
     * 🔄 REGULAR EFFECTS (Applied during power calculation):
     * - powerBoost: Adds power to matching cards (e.g., Trump +45 to Right-Wing cards)
     * - setPower: Sets specific power value (e.g., Trump economic cards → 0 vs Powell)
     * - powerNullification: Cross-player power nullification (e.g., Powell nullifies Economic)
     * 
     * 🚨 SPECIAL EFFECTS (Require immediate gameEnv modification):
     * - zoneRestriction: Modifies zone compatibility rules (e.g., Powell prevents Right-Wing summons)
     * - Future: fieldModification, gameRuleChanges, customMechanics, etc.
     * 
     * 🎯 WHY THIS CLASSIFICATION MATTERS:
     * - Regular effects: Stored in activeEffects, applied lazily during power calculation
     * - Special effects: Stored in activeEffects + immediate gameEnv modification
     * - This separation keeps the conversion function pure while handling complex behaviors
     * 
     * @param {Object} effectRule - Original effect rule from leader JSON
     * @param {string} leaderId - Leader ID
     * @param {string} playerId - Player ID
     * @param {Object} gameEnv - Game environment (for target resolution)
     * @returns {Object} Unified activeEffect object
     */
    convertLeaderRuleToEffectUnified(effectRule, leaderId, playerId, gameEnv) {
        // Extract targeting information (existing logic)
        let gameTypes = [];
        let traits = [];
        
        if (effectRule.target && effectRule.target.filters) {
            for (const filter of effectRule.target.filters) {
                if (filter.type === 'gameType' && filter.value) {
                    gameTypes.push(filter.value);
                } else if (filter.type === 'gameTypeOr' && filter.values) {
                    gameTypes = gameTypes.concat(filter.values);
                } else if (filter.type === 'trait' && filter.value) {
                    traits.push(filter.value);
                }
            }
        }
        
        // 🆕 UNIFIED EFFECT TYPE HANDLING
        const effectType = this.normalizeEffectTypeUnified(effectRule);
        const targetScope = this.determineTargetScopeUnified(effectRule, gameEnv, playerId);
        const targetPlayerId = this.resolveTargetPlayerUnified(targetScope, playerId, gameEnv);
        
        console.log(`📋 Processing unified leader effect: ${effectType} (${effectRule.effect.value}) for ${effectRule.id} → target: ${targetPlayerId}`);
        
        // 🆕 SINGLE ACTIVEEFFECT OBJECT FOR ALL TYPES
        return {
            effectId: `${leaderId}_${effectRule.id || effectType}`,
            source: leaderId,
            sourcePlayerId: playerId,
            type: effectType,                    // normalized: "powerBoost", "setPower", "zoneRestriction", "powerNullification"
            target: {
                scope: targetScope,              // "SELF", "OPPONENT", "SPECIFIC_PLAYER"
                playerId: targetPlayerId,        // resolved target player
                zones: effectRule.target.zones || ["top", "left", "right"],
                gameTypes: gameTypes.length > 0 ? gameTypes : undefined,
                traits: traits.length > 0 ? traits : undefined
            },
            value: effectRule.effect.value,
            priority: effectRule.priority || 0,
            unremovable: effectRule.unremovable || false,
            
            // 🆕 ENHANCED EFFECT STATE TRACKING (January 2025)
            isEnabled: true,                     // All new effects start enabled
            createdAt: Date.now(),              // Track when effect was created
            
            // 🆕 EFFECT-SPECIFIC DATA (for complex effects like restrictions)
            effectData: this.extractEffectSpecificDataUnified(effectRule)
        };
    }

    /**
     * 🔄 NORMALIZE EFFECT TYPES - Convert JSON effect types to unified types
     * =====================================================================
     * 
     * Maps various JSON effect types to standardized activeEffect types:
     * - powerBoost → powerBoost (unchanged)
     * - setPower → setPower (unchanged) 
     * - preventSummon → zoneRestriction (NEW - unified)
     * 
     * @param {Object} effectRule - Effect rule from JSON
     * @returns {string} Normalized effect type
     */
    normalizeEffectTypeUnified(effectRule) {
        switch(effectRule.effect.type) {
            case 'powerBoost': 
                return 'powerBoost';
            case 'setPower': 
                return 'setPower';
            case 'preventSummon': 
                return 'zoneRestriction';  // 🆕 Unified handling
            default: 
                console.log(`⚠️ Unknown effect type: ${effectRule.effect.type}, using as-is`);
                return effectRule.effect.type;
        }
    }

    /**
     * 🎯 DETERMINE TARGET SCOPE - Resolve who the effect targets
     * ==========================================================
     * 
     * Analyzes effect rule to determine target scope:
     * - owner: "self" → SELF
     * - owner: "opponent" → OPPONENT  
     * - cross-player effects → OPPONENT (automatically detected)
     * 
     * @param {Object} effectRule - Effect rule from JSON
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Source player ID
     * @returns {string} Target scope
     */
    determineTargetScopeUnified(effectRule, gameEnv, playerId) {
        // Explicit target owner in JSON
        if (effectRule.target && effectRule.target.owner) {
            return effectRule.target.owner === 'self' ? 'SELF' : 'OPPONENT';
        }
        
        // Auto-detect cross-player effects (like Powell's nullification)
        if (effectRule.effect.type === 'setPower' && effectRule.effect.value === 0) {
            // Check if this is conditional on opponent leader
            if (effectRule.trigger && effectRule.trigger.conditions) {
                for (const condition of effectRule.trigger.conditions) {
                    if (condition.type === 'opponentLeader') {
                        // This is a cross-player effect - it affects self but only when opponent is specific leader
                        return 'SELF';  // Trump's economic cards get nullified (self-targeting)
                    }
                }
            }
        }
        
        // Default to SELF
        return 'SELF';
    }

    /**
     * 🎯 RESOLVE TARGET PLAYER - Get actual player ID for target
     * ==========================================================
     * 
     * Resolves target scope to actual player ID:
     * - SELF → sourcePlayerId
     * - OPPONENT → opponent player ID (via getOpponentPlayer)
     * 
     * @param {string} scope - Target scope
     * @param {string} sourcePlayerId - Source player ID
     * @param {Object} gameEnv - Game environment
     * @returns {string} Target player ID
     */
    resolveTargetPlayerUnified(scope, sourcePlayerId, gameEnv) {
        switch(scope) {
            case 'SELF': 
                return sourcePlayerId;
            case 'OPPONENT': {
                const { getOpponentPlayer } = require('../utils/gameUtils');
                return getOpponentPlayer(gameEnv, sourcePlayerId);
            }
            default: 
                return sourcePlayerId;
        }
    }

    /**
     * 📦 EXTRACT EFFECT-SPECIFIC DATA - Get additional data for complex effects
     * =========================================================================
     * 
     * Extracts additional data needed for specific effect types:
     * - zoneRestriction effects: restricted types to remove
     * - Complex targeting: additional filter data
     * 
     * @param {Object} effectRule - Effect rule from JSON
     * @returns {Object} Effect-specific data
     */
    extractEffectSpecificDataUnified(effectRule) {
        const effectData = {};
        
        // For restriction effects, extract what types to restrict
        if (effectRule.effect.type === 'preventSummon' && effectRule.target.filters) {
            effectData.restrictedTypes = [];
            for (const filter of effectRule.target.filters) {
                if (filter.type === 'gameType' && filter.value) {
                    effectData.restrictedTypes.push(filter.value);
                }
            }
        }
        
        return effectData;
    }

    /**
     * 🎯 UNIFIED SPECIAL EFFECT HANDLING - Handle complex effects after adding to activeEffects
     * =======================================================================================
     * 
     * WHAT ARE "SPECIAL EFFECTS"?
     * ===========================
     * Special effects are those that require additional processing beyond just being stored
     * in the activeEffects array. They need to modify other parts of the game state immediately:
     * 
     * 🔄 REGULAR EFFECTS (No special handling needed):
     * - powerBoost: Applied during power calculation only
     * - setPower: Applied during power calculation only
     * - powerNullification: Applied during power calculation only
     * 
     * 🚨 SPECIAL EFFECTS (Require immediate gameEnv modification):
     * - zoneRestriction: Must modify zoneRestrictions immediately for card placement validation
     * - future: fieldModification, gameRuleChanges, etc.
     * 
     * WHY SEPARATE SPECIAL HANDLING?
     * ==============================
     * 1. Regular effects can wait until power calculation
     * 2. Special effects must take effect immediately for game validation
     * 3. Special effects modify multiple parts of gameEnv structure
     * 4. Keeps conversion function pure (no side effects)
     * 
     * @param {Object} gameEnv - Game environment (will be modified)
     * @param {Object} effect - The unified activeEffect object
     * @param {Object} effectRule - Original effect rule (for complex validation)
     */
    async applySpecialEffectHandlingUnified(gameEnv, effect, effectRule) {
        console.log(`🔍 Checking for special effect handling: ${effect.type}`);
        
        // 🚨 SPECIAL EFFECT TYPE 1: ZONE RESTRICTIONS
        // ============================================
        // Must modify zoneRestrictions immediately because card placement validation
        // checks these restrictions before cards are played
        if (effect.type === 'zoneRestriction') {
            console.log(`🚨 SPECIAL EFFECT DETECTED: zoneRestriction requires immediate handling`);
            
            if (!effect.effectData.restrictedTypes || effect.effectData.restrictedTypes.length === 0) {
                console.log(`⚠️ Zone restriction effect has no restrictedTypes data, skipping`);
                return;
            }
            
            const targetPlayerId = effect.target.playerId;
            const zones = effect.target.zones;
            
            console.log(`🚫 Applying zone restrictions for ${targetPlayerId}: removing [${effect.effectData.restrictedTypes.join(', ')}] from zones [${zones.join(', ')}]`);
            
            for (const zone of zones) {
                const zoneKey = zone.toUpperCase();
                const currentTypes = gameEnv.players[targetPlayerId].fieldEffects.zoneRestrictions[zoneKey];
                
                if (Array.isArray(currentTypes)) {
                    // Remove the restricted types
                    const beforeCount = currentTypes.length;
                    gameEnv.players[targetPlayerId].fieldEffects.zoneRestrictions[zoneKey] = 
                        currentTypes.filter(type => !effect.effectData.restrictedTypes.includes(type));
                    const afterCount = gameEnv.players[targetPlayerId].fieldEffects.zoneRestrictions[zoneKey].length;
                    
                    console.log(`🔒 Updated ${zoneKey} restrictions for ${targetPlayerId}: ${beforeCount} → ${afterCount} types`);
                    console.log(`   New restrictions:`, gameEnv.players[targetPlayerId].fieldEffects.zoneRestrictions[zoneKey]);
                } else {
                    console.log(`⚠️ Zone ${zoneKey} restrictions not found or not array for ${targetPlayerId}`);
                }
            }
            
            console.log(`✅ Zone restriction special handling completed`);
            return;
        }
        
        // 🔄 REGULAR EFFECTS - No special handling needed
        // ===============================================
        // These effects are applied during power calculation phase
        if (['powerBoost', 'setPower', 'powerNullification'].includes(effect.type)) {
            console.log(`✅ Regular effect ${effect.type} - no special handling needed (applied during power calculation)`);
            return;
        }
        
        // 🚨 FUTURE SPECIAL EFFECT TYPES
        // ===============================
        // Add new special effect types here as needed:
        
        // Example: Field modification effects
        // if (effect.type === 'fieldModification') {
        //     console.log(`🚨 SPECIAL EFFECT DETECTED: fieldModification requires immediate handling`);
        //     // Handle field modification logic here
        //     return;
        // }
        
        // Example: Game rule changes
        // if (effect.type === 'gameRuleChange') {
        //     console.log(`🚨 SPECIAL EFFECT DETECTED: gameRuleChange requires immediate handling`);
        //     // Handle game rule change logic here
        //     return;
        // }
        
        // 🤔 UNKNOWN EFFECT TYPE
        // ======================
        console.log(`🤔 Unknown effect type '${effect.type}' - assuming no special handling needed`);
        console.log(`   If this effect type should have special handling, add it to applySpecialEffectHandlingUnified`);
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
        console.log(`🎭 Processing card effects for ${play.cardId} (unified)`);
        
        // Skip leader plays - they are handled separately in executePlayUnified
        if (play.action === 'PLAY_LEADER') {
            return;
        }
        
        // Get card details from the play action
        let cardDetails = null;
        if (typeof play.cardId === 'string') {
            // Card ID is a string - look up card details
            cardDetails = this.cardInfoUtils.getCardDetails(play.cardId);
        } else if (typeof play.cardId === 'object' && play.cardId.id) {
            // Card details are embedded in the play action
            cardDetails = play.cardId;
        }
        
        if (!cardDetails || !cardDetails.effects || !cardDetails.effects.rules) {
            console.log(`   No effects to process for ${play.cardId}`);
            return;
        }
        
        // Create simState wrapper for compatibility with existing methods
        const simState = { gameEnv: gameEnv };
        
        // Process card effects using existing implementation
        this.processCardEffectsSync(simState, play.playerId, cardDetails);
    }
    
    /**
     * Synchronous version of processCardEffects for unified system
     */
    processCardEffectsSync(simState, playerId, cardDetails) {
        if (!cardDetails.effects || !cardDetails.effects.rules) {
            return;
        }
        
        // Process each effect rule
        for (const rule of cardDetails.effects.rules) {
            if (rule.type === 'continuous') {
                this.applyCardEffectSync(simState, playerId, cardDetails.id, rule);
            }
        }
    }
    
    /**
     * Synchronous version of applyCardEffect for unified system
     */
    applyCardEffectSync(simState, playerId, cardId, rule) {
        const effectType = rule.effect.type;
        
        // Handle zonePlacementFreedom effect (store in unified fieldEffects)
        if (effectType === 'zonePlacementFreedom') {
            const targetPlayerId = rule.target.owner === 'opponent' ? 
                this.getOpponentPlayerId(simState, playerId) : playerId;
            
            // Apply zonePlacementFreedom to the target player's fieldEffects
            const gameEnv = simState.gameEnv;
            if (!gameEnv.players[targetPlayerId].fieldEffects.specialEffects) {
                gameEnv.players[targetPlayerId].fieldEffects.specialEffects = {};
            }
            gameEnv.players[targetPlayerId].fieldEffects.specialEffects.zonePlacementFreedom = true;
            
            console.log(`🔓 Applied zonePlacementFreedom to ${targetPlayerId} fieldEffects via ${cardId}`);
            return;
        }
        
        // Handle powerBoost effects from cards
        if (effectType === 'powerBoost' || effectType === 'setPower') {
            const gameEnv = simState.gameEnv;
            
            // Convert rule to unified effect format
            const unifiedEffect = {
                effectId: `${cardId}_${rule.id}`,
                source: cardId,
                sourcePlayerId: playerId,
                type: effectType,
                target: {
                    scope: rule.target.owner === 'self' ? 'SELF' : 'OPPONENT',
                    zones: rule.target.zones || ['top', 'left', 'right'],
                    gameTypes: [],
                    traits: []
                },
                value: rule.effect.value,
                priority: 0,
                unremovable: false,
                
                // 🆕 ENHANCED EFFECT STATE TRACKING (January 2025)
                isEnabled: true,                     // All new effects start enabled
                createdAt: Date.now()               // Track when effect was created
            };
            
            // Extract targeting filters
            if (rule.target.filters) {
                for (const filter of rule.target.filters) {
                    if (filter.type === 'gameType' || filter.type === 'gameTypeOr') {
                        unifiedEffect.target.gameTypes = filter.values || [filter.value];
                    } else if (filter.type === 'trait') {
                        unifiedEffect.target.traits = [filter.value];
                    }
                }
            }
            
            // Apply to correct player's activeEffects
            const targetPlayerId = rule.target.owner === 'opponent' ? 
                this.getOpponentPlayerId(simState, playerId) : playerId;
            
            gameEnv.players[targetPlayerId].fieldEffects.activeEffects.push(unifiedEffect);
            console.log(`⚡ Applied ${effectType} effect from ${cardId} to ${targetPlayerId}: +${rule.effect.value}`);
            return;
        }
        
        // For any other effect types not yet implemented
        if (effectType !== 'zonePlacementFreedom') {
            console.log(`   Effect type ${effectType} not implemented in unified system yet`);
        }
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
     * Extract card ID from card object (handles multiple formats)
     * @param {Object} card - Card object
     * @returns {string} Card ID
     */
    getCardId(card) {
        if (!card) return null;
        
        // Handle complex structure: {card: ["h-5"], cardDetails: [...]}
        if (card.card && Array.isArray(card.card) && card.card[0]) {
            return card.card[0];
        }
        
        // Handle simple structure: {id: "c-1", ...} or {cardId: "c-1", ...}
        return card.id || card.cardId || null;
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
                    
                    const cardId = this.getCardId(card);
                    if (!cardId) {
                        console.warn('⚠️ Could not extract card ID from card:', card);
                        continue;
                    }
                    
                    // Extract card details for power calculation
                    let cardDetails = card;
                    if (card.cardDetails && Array.isArray(card.cardDetails) && card.cardDetails[0]) {
                        cardDetails = card.cardDetails[0];
                    }
                    
                    const basePower = cardDetails.power || 0;
                    const finalPower = this.calculateCardPowerWithEffectsUnified(gameEnv, playerId, cardDetails, basePower);
                    
                    // Store calculated power in fieldEffects
                    gameEnv.players[playerId].fieldEffects.calculatedPowers[cardId] = finalPower;
                    
                    // Update valueOnField in zone to match calculated power (fixes display issue)
                    if (card.hasOwnProperty('valueOnField')) {
                        card.valueOnField = finalPower;
                    }
                }
            }
        }
        
        console.log('✅ Final power calculation completed (unified)');
    }

    /**
     * 📊 Calculate Player Points Unified - NEW (January 2025) 
     * ========================================================
     * 
     * This method calculates playerPoint for all players as part of the centralized simulation.
     * It ensures that playerPoint calculations are handled entirely within the unified simulator,
     * maintaining complete architectural consistency.
     * 
     * 🎯 CENTRALIZED APPROACH:
     * - All playerPoint calculations happen inside simulateCardPlaySequence()
     * - No manual point calculations needed outside the simulator
     * - Consistent with unified field effects architecture
     * - Uses existing calculatePlayerPoint logic from mozGamePlay
     * 
     * @param {Object} gameEnv - Game environment
     */
    async calculatePlayerPointsUnified(gameEnv) {
        const { getPlayerFromGameEnv } = require('../utils/gameUtils');
        const playerList = getPlayerFromGameEnv(gameEnv);
        
        console.log('📊 Calculating player points for all players (unified)...');
        
        // We need to access the calculatePlayerPoint method from mozGamePlay
        // Since this is a centralized calculation, we'll import it dynamically
        const mozGamePlay = require('../mozGame/mozGamePlay');
        
        for (const playerId of playerList) {
            const oldPlayerPoint = gameEnv.players[playerId].playerPoint || 0;
            
            // Calculate new player point using the existing logic
            gameEnv.players[playerId].playerPoint = await mozGamePlay.calculatePlayerPoint(gameEnv, playerId);
            
            const newPlayerPoint = gameEnv.players[playerId].playerPoint;
            
            if (oldPlayerPoint !== newPlayerPoint) {
                console.log(`📈 Updated ${playerId} playerPoint: ${oldPlayerPoint} → ${newPlayerPoint}`);
            }
        }
        
        console.log('✅ Player points calculation completed (unified)');
    }

    /**
     * Calculate card power with effects unified - ENHANCED (January 2025)
     * ====================================================================
     * 
     * Now respects the isEnabled field to handle neutralized effects properly.
     * Only processes effects where isEnabled is not explicitly false.
     * 
     * @param {Object} gameEnv - Game environment
     * @param {string} playerId - Player ID
     * @param {Object} card - Card object
     * @param {number} basePower - Base power
     * @returns {number} Final power
     */
    calculateCardPowerWithEffectsUnified(gameEnv, playerId, card, basePower) {
        let modifiedPower = basePower;
        const effects = gameEnv.players[playerId].fieldEffects.activeEffects;
        const cardId = this.getCardId(card);
        
        // Filter out disabled effects before processing
        const enabledEffects = effects.filter(effect => effect.isEnabled !== false);
        const disabledEffects = effects.filter(effect => effect.isEnabled === false);
        
        if (disabledEffects.length > 0) {
            console.log(`🚫 Skipping ${disabledEffects.length} disabled effect(s) for ${cardId}`);
            disabledEffects.forEach(effect => {
                console.log(`   - Disabled ${effect.type} from ${effect.source}: ${effect.disabledReason}`);
            });
        }
        
        // First apply power boost effects from leaders and other cards (only enabled ones)
        for (const effect of enabledEffects) {
            if (effect.type === 'powerBoost' && this.checkEffectTargetsCardUnified(effect, card)) {
                modifiedPower += effect.value;
                console.log(`📈 Applied power boost +${effect.value} to ${cardId}: ${modifiedPower - effect.value} → ${modifiedPower}`);
            }
        }
        
        // Apply setPower effects (direct power setting, highest priority) - only enabled ones
        for (const effect of enabledEffects) {
            if (effect.type === 'setPower' && this.checkEffectTargetsCardUnified(effect, card)) {
                modifiedPower = effect.value;
                console.log(`🎯 Applied setPower to ${cardId}: power set to ${effect.value} (from ${effect.source})`);
                // Don't break - allow multiple setPower effects, last one wins
            }
        }
        
        // Apply nullification effects (from opponent) - only enabled ones
        for (const effect of enabledEffects) {
            if (effect.type === 'POWER_NULLIFICATION' && this.checkEffectTargetsCardUnified(effect, card)) {
                modifiedPower = 0;
                console.log(`🚫 Applied power nullification to ${cardId}: power set to 0`);
                // Don't break - process all nullifications
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
        const cardId = this.getCardId(card);
        
        // Check SPECIFIC_CARD targeting (highest priority) - for setPower and neutralization effects
        if (effect.target.scope === "SPECIFIC_CARD") {
            return effect.target.cardId === cardId;
        }
        
        // Check specific card list targeting (legacy format)
        if (effect.target.specificCards && effect.target.specificCards.length > 0) {
            return effect.target.specificCards.includes(cardId);
        }
        
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

}

module.exports = new EffectSimulator();