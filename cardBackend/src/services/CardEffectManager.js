const DeckManager = require('./DeckManager');
const CardInfoUtils = require('./CardInfoUtils');
const { 
    getPlayerFromGameEnv,
    getOpponentPlayer,
    isConditionMatch
 } = require('../utils/gameUtils');

class CardEffectManager {
    constructor() {
        this.deckManager = DeckManager;
        this.cardInfoUtils = CardInfoUtils;
    }

    /**
     * Check if a card can be summoned to a specific position
     */
    async checkSummonRestriction(gameEnv, currentPlayerId, cardDetails, playPos) {
        // 1. Basic position validation
        if (cardDetails.cardType === 'character') {
            // Characters can only be placed in top, left, or right
            if (playPos === 'help' || playPos === 'sp') {
                return {
                    canPlace: false,
                    reason: `Character cards cannot be placed in ${playPos} position`
                };
            }
        }

        // 2. Check leader restrictions
        const leader = gameEnv[currentPlayerId].Field.leader;
        if (leader && leader.zoneCompatibility) {
            const allowedFields = leader.zoneCompatibility[playPos] || [];
            if (!allowedFields.includes('all') && !allowedFields.includes(cardDetails.gameType)) {
                return {
                    canPlace: false,
                    reason: `Leader does not allow ${cardDetails.gameType} type cards in ${playPos} field. Allowed types: ${JSON.stringify(allowedFields)}`
                };
            }
        }
        let opponentPlayerId = getOpponentPlayer(gameEnv);
        
        // 3. SP card restrictions are not needed during MAIN_PHASE since SP cards
        // haven't executed their effects yet (they only execute during SP_PHASE)

        // 4. Check help card restrictions
        const helpCards = gameEnv[currentPlayerId].Field.help || [];
        for (const helpCard of helpCards) {
            const effectRules = helpCard.cardDetails[0].effectRules || [];
            for (const rule of effectRules) {
                if (rule.effectType === 'blockSummonCard') {
                    const canPlace = await this.evaluatePlacementCondition(rule, gameEnv, currentPlayerId, cardDetails);
                    if (!canPlace) {
                        return {
                            canPlace: false,
                            reason: rule.reason || 'Help card effect prevents card placement'
                        };
                    }
                }
            }
        }

        // 5. Check monster card restrictions
        const monsters = gameEnv[currentPlayerId].Field[playPos] || [];
        for (const monster of monsters) {
            const effectRules = monster.cardDetails[0].effectRules || [];
            for (const rule of effectRules) {
                if (rule.effectType === 'blockSummonCard') {
                    const canPlace = await this.evaluatePlacementCondition(rule, gameEnv, currentPlayerId, cardDetails);
                    if (!canPlace) {
                        return {
                            canPlace: false,
                            reason: rule.reason || 'Monster effect prevents card placement'
                        };
                    }
                }
            }
        }

        // 6. Check for overrides
        const overrideResult = await this.checkOverrideRestrictions(gameEnv, currentPlayerId, cardDetails, playPos);
        if (overrideResult.hasOverride) {
            return {
                canPlace: true,
                overrideInfo: {
                    overrideCardId: overrideResult.overrideCardId,
                    overrideCardType: overrideResult.overrideCardType,
                    overrideReason: overrideResult.overrideReason
                }
            };
        }

        return { canPlace: true };
    }

    async checkIsTargetMatch(
        effectType,
        target, 
        gameEnv, 
        isOpponent, 
        cardDetails,
        playPos) {
        let returnValue = false;

        switch(effectType){
            case "blockSummonCard":
                returnValue = await this.checkBlockSummonCard(target, gameEnv, isOpponent, cardDetails, playPos);
                break;
        }
        return returnValue;
    }

    async checkBlockSummonCard(target, gameEnv, isOpponent, cardDetails, playPos) {
        let returnValue = false;
        let lookingAt = "self"
        if(isOpponent){
            target.type = "opponent";
        }
        if(target.type == lookingAt && target.scope.includes(playPos)){
            let subScope = target.subScope;
            if(subScope.includes("attr_")){
                let attribute = subScope.split("_")[1];
                returnValue = cardDetails.traits.includes(attribute);
            }else if(subScope.includes("monsterType_")){
                let monsterType = subScope.split("_")[1];
                returnValue = cardDetails.monsterType.includes(monsterType);
            }else if(subScope.includes("name_")){
                let monsterName = subScope.split("_")[1];
                returnValue = cardDetails.cardName.includes(monsterName);
            }else if(subScope.includes("all")){
                returnValue = true;
            }
        }
        return returnValue;
    }

    /**
     * Evaluate placement condition for a specific rule
     */
    async evaluatePlacementCondition(rule, gameEnv, playerId, cardDetails) {
        const condition = rule.condition;
        
        switch (condition.type) {
            case 'opponentHasLeader':
                return this.checkOpponentHasLeader(gameEnv, playerId, condition.value);
            
            case 'opponentLeaderHasType':
                return this.checkOpponentLeaderType(gameEnv, playerId, condition.value);
            
            case 'selfHasMonster':
                return this.checkSelfHasMonster(gameEnv, playerId, condition.value);
            
            case 'selfHasMonsterWithAttribute':
                return this.checkSelfHasMonsterWithAttribute(gameEnv, playerId, condition.value);
            
            case 'cardHasAttribute':
                return this.checkCardHasAttribute(cardDetails, condition.value);
            
            case 'cardHasMonsterType':
                return this.checkCardHasMonsterType(cardDetails, condition.value);
            
            default:
                return true;
        }
    }

    /**
     * Check for override restrictions
     */
    async checkOverrideRestrictions(gameEnv, playerId, cardDetails, playPos) {
        // Check SP cards for overrides
        const spCards = gameEnv[playerId].Field.sp || [];
        for (const spCard of spCards) {
            const effectRules = spCard.cardDetails[0].effectRules || [];
            for (const rule of effectRules) {
                if (rule.effectType === 'overrideRestriction') {
                    const canOverride = await this.evaluatePlacementCondition(rule, gameEnv, playerId, cardDetails);
                    if (canOverride) {
                        return {
                            hasOverride: true,
                            overrideCardId: spCard.cardDetails[0].id,
                            overrideCardType: 'SP',
                            overrideReason: rule.reason || 'SP card overrides placement restriction'
                        };
                    }
                }
            }
        }

        // Check help cards for overrides
        const helpCards = gameEnv[playerId].Field.help || [];
        for (const helpCard of helpCards) {
            const effectRules = helpCard.cardDetails[0].effectRules || [];
            for (const rule of effectRules) {
                if (rule.effectType === 'overrideRestriction') {
                    const canOverride = await this.evaluatePlacementCondition(rule, gameEnv, playerId, cardDetails);
                    if (canOverride) {
                        return {
                            hasOverride: true,
                            overrideCardId: helpCard.cardDetails[0].id,
                            overrideCardType: 'HELP',
                            overrideReason: rule.reason || 'Help card overrides placement restriction'
                        };
                    }
                }
            }
        }

        return { hasOverride: false };
    }

    // Helper methods for condition evaluation
    checkOpponentHasLeader(gameEnv, playerId, leaderName) {
        const opponentId = this.getOpponentId(playerId);
        const opponentLeader = gameEnv[opponentId].Field.leader;
        return opponentLeader && opponentLeader.name === leaderName;
    }

    checkOpponentLeaderType(gameEnv, playerId, type) {
        const opponentId = this.getOpponentId(playerId);
        const opponentLeader = gameEnv[opponentId].Field.leader;
        return opponentLeader && opponentLeader.type.includes(type);
    }

    checkSelfHasMonster(gameEnv, playerId, monsterName) {
        return ['top', 'left', 'right'].some(field => {
            return gameEnv[playerId].Field[field].some(monster => 
                monster.cardDetails[0].cardName === monsterName
            );
        });
    }

    checkSelfHasMonsterWithAttribute(gameEnv, playerId, attribute) {
        return ['top', 'left', 'right'].some(field => {
            return gameEnv[playerId].Field[field].some(monster => 
                monster.cardDetails[0].traits.includes(attribute)
            );
        });
    }

    checkCardHasAttribute(card, attribute) {
        return card.traits.includes(attribute);
    }

    checkCardHasMonsterType(card, monsterType) {
        return card.monsterType && card.monsterType.includes(monsterType);
    }

    getOpponentId(playerId) {
        return playerId === 'playerId_1' ? 'playerId_2' : 'playerId_1';
    }

    /**
     * Helper method to check if a monster is on the field
     */
    hasMonsterOnField(gameEnv, playerId, monsterName) {
        const fields = ['top', 'left', 'right'];
        return fields.some(field => {
            return gameEnv[playerId].Field[field].some(cardObj => {
                return !cardObj.isBack[0] && cardObj.cardDetails[0].cardName === monsterName;
            });
        });
    }

    /**
     * Helper method to check if a monster type is on the field
     */
    hasMonsterTypeOnField(gameEnv, playerId, monsterType) {
        const fields = ['top', 'left', 'right'];
        return fields.some(field => {
            return gameEnv[playerId].Field[field].some(cardObj => {
                return !cardObj.isBack[0] && 
                       cardObj.cardDetails[0].monsterType && 
                       cardObj.cardDetails[0].monsterType.includes(monsterType);
            });
        });
    }

    /**
     * Helper method to set a card's value
     */
    setCardValue(gameEnv, playerId, target, value) {
        const fields = ['top', 'left', 'right'];
        fields.forEach(field => {
            gameEnv[playerId].Field[field].forEach(cardObj => {
                if (!cardObj.isBack[0] && cardObj.cardDetails[0].id === target.cardId) {
                    cardObj.valueOnField = value;
                }
            });
        });
    }

    /**
     * Helper method to set opponent's monster value
     */
    setOpponentMonsterValue(gameEnv, opponentId, monsterName, value) {
        const fields = ['top', 'left', 'right'];
        fields.forEach(field => {
            gameEnv[opponentId].Field[field].forEach(cardObj => {
                if (!cardObj.isBack[0] && cardObj.cardDetails[0].cardName === monsterName) {
                    cardObj.cardDetails[0].power = value;
                }
            });
        });
    }

    /**
     * Helper method to check if a help card was played
     */
    isHelpCardPlayed(gameEnv, playerId, helpCardName) {
        return gameEnv[playerId].Field.help.some(cardObj => {
            return !cardObj.isBack[0] && cardObj.cardDetails[0].cardName === helpCardName;
        });
    }

    /**
     * Helper method to set adjacent monsters' values
     */
    setAdjacentMonstersValue(gameEnv, opponentId, value) {
        ['left', 'right'].forEach(field => {
            gameEnv[opponentId].Field[field].forEach(cardObj => {
                if (!cardObj.isBack[0]) {
                    cardObj.cardDetails[0].power = value;
                }
            });
        });
    }

    /**
     * Helper method to set value for all monsters of a specific type
     */
    setMonsterTypeValue(gameEnv, playerId, monsterType, value) {
        const fields = ['top', 'left', 'right'];
        fields.forEach(field => {
            gameEnv[playerId].Field[field].forEach(cardObj => {
                if (!cardObj.isBack[0] && 
                    cardObj.cardDetails[0].monsterType && 
                    cardObj.cardDetails[0].monsterType.includes(monsterType)) {
                    cardObj.cardDetails[0].power = value;
                }
            });
        });
    }

    /**
     * Helper method to set value for monsters with specific value
     */
    setValueBasedMonsterValue(gameEnv, playerId, targetValue, newValue) {
        const fields = ['top', 'left', 'right'];
        fields.forEach(field => {
            gameEnv[playerId].Field[field].forEach(cardObj => {
                if (!cardObj.isBack[0] && cardObj.cardDetails[0].power === targetValue) {
                    cardObj.cardDetails[0].power = newValue;
                }
            });
        });
    }

    /**
     * Helper method to set value for all opponent's monsters
     */
    setAllOpponentMonsterValue(gameEnv, opponentId, value) {
        const fields = ['top', 'left', 'right'];
        fields.forEach(field => {
            gameEnv[opponentId].Field[field].forEach(cardObj => {
                if (!cardObj.isBack[0]) {
                    cardObj.cardDetails[0].power = value;
                }
            });
        });
    }

    /**
     * Initialize restrictions for a player if they don't exist
     * @param {Object} gameEnv - Current game environment
     * @param {string} playerId - ID of the player to initialize restrictions for
     */
    initializeRestrictions(gameEnv, playerId) {
        if (!gameEnv[playerId].restrictions) {
            gameEnv[playerId].restrictions = { summonRestrictions: [] };
        }
        if (!gameEnv[playerId].restrictions.summonRestrictions) {
            gameEnv[playerId].restrictions.summonRestrictions = [];
        }
    }
}

module.exports = new CardEffectManager(); 