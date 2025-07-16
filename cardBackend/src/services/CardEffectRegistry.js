// src/services/CardEffectRegistry.js
/**
 * Registry for card effects and effect processing logic
 * Handles effect definitions, condition checking, and effect application
 */

class CardEffectRegistry {
    constructor() {
        this.cardInfoUtils = null; // Will be injected
    }

    /**
     * Set card info utils dependency
     * @param {Object} cardInfoUtils - Card information utilities
     */
    setCardInfoUtils(cardInfoUtils) {
        this.cardInfoUtils = cardInfoUtils;
    }

    /**
     * Get all effects for a card
     * @param {string} cardId - Card ID
     * @returns {Array} Array of effects for the card
     */
    getCardEffects(cardId) {
        if (!this.cardInfoUtils) {
            console.warn('CardInfoUtils not set in CardEffectRegistry');
            return [];
        }

        const cardDetails = this.cardInfoUtils.getCardDetails(cardId);
        if (!cardDetails || !cardDetails.effects || !cardDetails.effects.rules) {
            return [];
        }

        // Return the rules array from the effects object
        return cardDetails.effects.rules;
    }

    /**
     * Check if effect conditions are met
     * @param {Object} effect - Effect definition
     * @param {Object} simState - Current simulation state
     * @param {string} sourcePlayerId - Player who owns the card with the effect
     * @returns {boolean} Whether conditions are met
     */
    checkConditions(effect, simState, sourcePlayerId) {
        if (!effect.conditions) {
            return true; // No conditions means always active
        }

        const conditions = effect.conditions;

        // Check if self is on field
        if (conditions.selfOnField) {
            const zones = conditions.selfOnField.zones || ['leader', 'top', 'left', 'right'];
            const playerField = simState.players[sourcePlayerId].Field;
            
            let foundSelf = false;
            for (const zone of zones) {
                if (zone === 'leader' && playerField.leader) {
                    foundSelf = true;
                    break;
                } else if (Array.isArray(playerField[zone]) && playerField[zone].length > 0) {
                    foundSelf = true;
                    break;
                }
            }
            
            if (!foundSelf) {
                return false;
            }
        }

        // Check if self is leader
        if (conditions.selfAsLeader) {
            const playerField = simState.players[sourcePlayerId].Field;
            if (!playerField.leader) {
                return false;
            }
        }

        // Check card name conditions
        if (conditions.requiresCard) {
            const req = conditions.requiresCard;
            const checkPlayerId = req.playerId === 'self' ? sourcePlayerId : this.getOpponentId(sourcePlayerId, simState);
            const playerField = simState.players[checkPlayerId].Field;
            
            let foundRequired = false;
            for (const zone of req.zones) {
                if (zone === 'leader' && playerField.leader && playerField.leader.name === req.name) {
                    foundRequired = true;
                    break;
                } else if (Array.isArray(playerField[zone])) {
                    const found = playerField[zone].some(card => card && card.name === req.name);
                    if (found) {
                        foundRequired = true;
                        break;
                    }
                }
            }
            
            if (!foundRequired) {
                return false;
            }
        }

        // Check phase conditions
        if (conditions.phase && conditions.phase !== simState.currentPhase) {
            return false;
        }

        // Check turn conditions
        if (conditions.turn !== undefined && conditions.turn !== simState.currentTurn) {
            return false;
        }

        return true;
    }

    /**
     * Apply effect to simulation state
     * @param {Object} effect - Effect definition
     * @param {Object} simState - Current simulation state
     * @param {string} sourcePlayerId - Player who owns the card with the effect
     */
    applyEffect(effect, simState, sourcePlayerId) {
        const targetPlayerId = this.resolveTargetPlayer(effect.targets?.playerId, sourcePlayerId, simState);
        
        switch (effect.type) {
            case 'DISABLE_OPPONENT_CARDS':
                this.applyDisableOpponentCards(effect, simState, sourcePlayerId, targetPlayerId);
                break;
                
            case 'POWER_NULLIFICATION':
                this.applyPowerNullification(effect, simState, sourcePlayerId, targetPlayerId);
                break;
                
            case 'POWER_MODIFICATION':
                this.applyPowerModification(effect, simState, sourcePlayerId, targetPlayerId);
                break;
                
            case 'ZONE_RESTRICTION':
                this.applyZoneRestriction(effect, simState, sourcePlayerId, targetPlayerId);
                break;
                
            case 'POWER_BOOST':
                this.applyPowerBoost(effect, simState, sourcePlayerId, targetPlayerId);
                break;
                
            default:
                console.warn(`Unknown effect type: ${effect.type}`);
        }
    }

    /**
     * Apply disable opponent cards effect
     */
    applyDisableOpponentCards(effect, simState, sourcePlayerId, targetPlayerId) {
        const targetField = simState.players[targetPlayerId].Field;
        const cardTypes = effect.targets.cardTypes || [];
        
        cardTypes.forEach(cardType => {
            const zone = cardType.toLowerCase();
            if (Array.isArray(targetField[zone])) {
                targetField[zone].forEach(card => {
                    if (card && !card.isFaceDown) {
                        card.effectsDisabled = true;
                        simState.disabledCards.push({
                            cardId: card.id,
                            playerId: targetPlayerId,
                            zone: zone,
                            disabledBy: sourcePlayerId
                        });
                    }
                });
            }
        });
        
        console.log(`🚫 Disabled ${cardTypes.join(', ')} cards for ${targetPlayerId}`);
    }

    /**
     * Apply power nullification effect
     */
    applyPowerNullification(effect, simState, sourcePlayerId, targetPlayerId) {
        const targetField = simState.players[targetPlayerId].Field;
        const cardTypes = effect.targets.cardTypes || ['character'];
        const count = effect.targets.count || 1;
        
        let nullified = 0;
        cardTypes.forEach(cardType => {
            if (nullified >= count) return;
            
            const zones = cardType === 'character' ? ['top', 'left', 'right'] : [cardType.toLowerCase()];
            
            zones.forEach(zone => {
                if (nullified >= count || !Array.isArray(targetField[zone])) return;
                
                targetField[zone].forEach(card => {
                    if (nullified >= count || !card || card.isFaceDown) return;
                    
                    if (!simState.powerModifiers[targetPlayerId]) {
                        simState.powerModifiers[targetPlayerId] = {};
                    }
                    
                    simState.powerModifiers[targetPlayerId][card.id] = {
                        originalPower: card.power,
                        modifiedPower: 0,
                        modifier: 'NULLIFICATION',
                        source: sourcePlayerId
                    };
                    
                    nullified++;
                });
            });
        });
        
        console.log(`💥 Nullified power of ${nullified} cards for ${targetPlayerId}`);
    }

    /**
     * Apply power boost effect
     */
    applyPowerBoost(effect, simState, sourcePlayerId, targetPlayerId) {
        const targetField = simState.players[targetPlayerId].Field;
        const cardTypes = effect.targets.cardTypes || ['character'];
        const gameTypes = effect.targets.gameTypes || [];
        const boost = effect.value || 0;
        
        cardTypes.forEach(cardType => {
            const zones = cardType === 'character' ? ['top', 'left', 'right'] : [cardType.toLowerCase()];
            
            zones.forEach(zone => {
                if (!Array.isArray(targetField[zone])) return;
                
                targetField[zone].forEach(card => {
                    if (!card || card.isFaceDown) return;
                    
                    // Check if card matches game type filter
                    if (gameTypes.length > 0 && !gameTypes.includes(card.gameType)) {
                        return;
                    }
                    
                    if (!simState.powerModifiers[targetPlayerId]) {
                        simState.powerModifiers[targetPlayerId] = {};
                    }
                    
                    const current = simState.powerModifiers[targetPlayerId][card.id];
                    const newPower = (current?.modifiedPower ?? card.power) + boost;
                    
                    simState.powerModifiers[targetPlayerId][card.id] = {
                        originalPower: card.power,
                        modifiedPower: Math.max(0, newPower), // Ensure non-negative
                        modifier: 'BOOST',
                        source: sourcePlayerId,
                        value: boost
                    };
                });
            });
        });
        
        console.log(`⬆️ Applied +${boost} power boost to ${targetPlayerId} ${cardTypes.join(', ')} cards`);
    }

    /**
     * Apply zone restriction effect
     */
    applyZoneRestriction(effect, simState, sourcePlayerId, targetPlayerId) {
        const restrictions = effect.value || {};
        
        if (!simState.players[targetPlayerId].fieldEffects) {
            simState.players[targetPlayerId].fieldEffects = {
                zoneRestrictions: {},
                activeEffects: []
            };
        }
        
        Object.assign(simState.players[targetPlayerId].fieldEffects.zoneRestrictions, restrictions);
        
        console.log(`🔒 Applied zone restrictions to ${targetPlayerId}:`, restrictions);
    }

    /**
     * Resolve target player ID
     */
    resolveTargetPlayer(targetPlayerId, sourcePlayerId, simState) {
        if (targetPlayerId === 'opponent') {
            return this.getOpponentId(sourcePlayerId, simState);
        } else if (targetPlayerId === 'self') {
            return sourcePlayerId;
        }
        return targetPlayerId || sourcePlayerId;
    }

    /**
     * Get opponent player ID
     */
    getOpponentId(playerId, simState) {
        const playerIds = Object.keys(simState.players);
        return playerIds.find(id => id !== playerId);
    }

    /**
     * Get effect priority (for sorting)
     */
    getEffectPriority(effectType) {
        const priorities = {
            'DISABLE_OPPONENT_CARDS': 100,
            'POWER_NULLIFICATION': 90,
            'POWER_MODIFICATION': 80,
            'ZONE_RESTRICTION': 70,
            'POWER_BOOST': 60
        };
        
        return priorities[effectType] || 50;
    }
}

module.exports = new CardEffectRegistry();