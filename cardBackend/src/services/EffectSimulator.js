// src/services/EffectSimulator.js
/**
 * Simulates card effects by replaying the entire play sequence
 * Provides replay-based calculation for consistent game state
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
     * Main simulation function - replay entire card play sequence
     * @param {Object} gameEnv - Game environment
     * @returns {Object} Computed game state after simulation
     */
    simulateCardPlaySequence(gameEnv) {
        console.log('🎬 Starting card play sequence simulation...');
        
        // 1. Create clean simulation state
        const simState = this.createCleanState(gameEnv);
        
        // 2. Get sorted play sequence
        const sortedPlays = playSequenceManager.getPlaySequence(gameEnv);
        
        console.log(`📋 Replaying ${sortedPlays.length} plays...`);
        
        // 3. Replay each action in sequence
        for (const play of sortedPlays) {
            console.log(`▶️ Executing play ${play.sequenceId}: ${play.action} ${play.cardId} by ${play.playerId}`);
            
            // Execute the play action
            this.executePlay(simState, play);
            
            // Activate card effects after play
            this.activateEffects(simState, play);
            
            // Check for triggered effects from other cards
            this.checkTriggeredEffects(simState, play);
        }
        
        // 4. Calculate final computed state
        const computedState = this.calculateFinalState(simState);
        
        console.log('✅ Simulation completed');
        return computedState;
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
    executePlay(simState, play) {
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
                
                // Apply leader zone restrictions immediately
                if (cardDetails.zoneCompatibility) {
                    this.applyLeaderZoneRestrictions(simState, playerId, cardDetails);
                }
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
     * Apply leader zone restrictions
     * @param {Object} simState - Simulation state
     * @param {string} playerId - Player ID
     * @param {Object} leader - Leader card details
     */
    applyLeaderZoneRestrictions(simState, playerId, leader) {
        if (leader.zoneCompatibility) {
            const restrictions = {
                TOP: leader.zoneCompatibility.top || ["ALL"],
                LEFT: leader.zoneCompatibility.left || ["ALL"],
                RIGHT: leader.zoneCompatibility.right || ["ALL"],
                HELP: ["ALL"], // Help zone typically unrestricted
                SP: ["ALL"]    // SP zone typically unrestricted
            };
            
            simState.players[playerId].fieldEffects.zoneRestrictions = restrictions;
            console.log(`🏛️ Applied leader zone restrictions for ${playerId}:`, restrictions);
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
     * Calculate final computed state
     * @param {Object} simState - Simulation state
     * @returns {Object} Final computed state
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
            computedState.activeRestrictions[playerId] = simState.players[playerId].fieldEffects.zoneRestrictions;
            computedState.victoryPointModifiers[playerId] = 0;
            
            const field = simState.players[playerId].Field;
            const powerMods = simState.powerModifiers[playerId] || {};
            
            // Calculate power for all cards in all zones
            for (const zone in field) {
                const cards = Array.isArray(field[zone]) ? field[zone] : [field[zone]];
                
                for (const card of cards) {
                    if (!card) continue;
                    
                    const finalPower = powerMods[card.id] ? 
                        powerMods[card.id].modifiedPower : 
                        (card.power || 0);
                    
                    computedState.playerPowers[playerId][card.id] = {
                        originalPower: card.power || 0,
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
}

module.exports = new EffectSimulator();