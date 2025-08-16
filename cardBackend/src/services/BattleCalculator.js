// =======================================================================================
// 🎯 BATTLE CALCULATOR - Clean Class Implementation for Power Calculation
// =======================================================================================
//
// This class handles ALL battle power calculations with clear step-by-step processing.
// Extracted from the massive calculatePlayerPoint method for better maintainability.
//
// Key Features:
// - Clear step-by-step calculation process
// - Switch-case routing for different calculation phases
// - Easy to understand and maintain code structure
// - Comprehensive logging for debugging and tracking
// - Modular methods for each calculation step
//
// Calculation Steps:
// 1. Base Power Calculation - Extract face-up character card powers
// 2. Leader Effects - Apply continuous leader bonuses/penalties
// 3. Utility Card Effects - Process Help and SP card effects
// 4. Total Power Calculation - Sum all character powers
// 5. Combo Bonuses - Add combination bonuses
// 6. Final Effects - Apply post-combo modifications
//
// =======================================================================================

// Import utility functions
const { getPlayerFromGameEnv, getPlayerField } = require('../utils/gameUtils');

class BattleCalculator {
    constructor(mozGamePlay) {
        this.mozGamePlay = mozGamePlay;
        
        // Use imported utility functions directly
        this.getPlayerField = getPlayerField;
        this.getOpponentId = mozGamePlay.getOpponentId?.bind(mozGamePlay) || (() => {});
        this.applyEffectRule = mozGamePlay.applyEffectRule?.bind(mozGamePlay) || (() => {});
        this.calculateComboBonus = mozGamePlay.calculateComboBonus?.bind(mozGamePlay) || (() => {});
    }

    /**
     * 🎯 MAIN BATTLE CALCULATION - Complete Power Calculation with Clear Steps
     * 
     * This is the main entry point that calculates total player power through
     * a clear, step-by-step process with comprehensive logging
     */
    async calculatePlayerPoints(gameEnv, playerId) {
        console.log(`🎯 BattleCalculator: Starting power calculation for player: ${playerId}`);
        
        // Initialize calculation context - use GameZones class method
        const playerField = gameEnv.zones.getPlayerZones(playerId);
        console.log(`🔍 DEBUG: playerField for ${playerId}:`, playerField);
        
        const calculationContext = {
            gameEnv,
            playerId,
            playerField: playerField,
            currentLeader: null,
            characterPowers: {},
            totalPoints: 0,
            comboPoints: 0,
            cardData: this.loadCardData()
        };
        
        if (calculationContext.playerField) {
            calculationContext.currentLeader = calculationContext.playerField.leader;
        } else {
            console.log(`⚠️ PlayerField is null for ${playerId}`);
        }
        
        console.log(`📋 Player field zones:`, {
            top: calculationContext.playerField.top?.length || 0,
            left: calculationContext.playerField.left?.length || 0,
            right: calculationContext.playerField.right?.length || 0,
            help: calculationContext.playerField.help?.length || 0,
            sp: calculationContext.playerField.sp?.length || 0,
            leader: calculationContext.currentLeader?.name || 'None'
        });
        
        // Debug: Show actual zone contents
        console.log(`🔍 DEBUG: Zone contents for ${playerId}:`);
        console.log(`  - top:`, calculationContext.playerField.top);
        console.log(`  - left:`, calculationContext.playerField.left);
        console.log(`  - right:`, calculationContext.playerField.right);
        console.log(`  - help:`, calculationContext.playerField.help);
        console.log(`  - leader:`, calculationContext.playerField.leader);

        // ===== EXECUTE CALCULATION STEPS IN ORDER =====
        const steps = [
            { id: 'step1', name: 'Base Power Calculation', handler: this.calculateBasePower },
            { id: 'step2', name: 'Leader Effects', handler: this.applyLeaderEffects },
            { id: 'step3', name: 'Utility Card Effects', handler: this.applyUtilityCardEffects },
            { id: 'step4', name: 'Total Power Calculation', handler: this.calculateTotalPower },
            { id: 'step5', name: 'Combo Bonuses', handler: this.calculateComboBonuses },
            { id: 'step6', name: 'Final Effects', handler: this.applyFinalEffects }
        ];

        for (const step of steps) {
            console.log(`🎯 BattleCalculator: Executing ${step.name}...`);
            
            try {
                await step.handler.call(this, calculationContext);
                console.log(`✅ ${step.name} completed`);
            } catch (error) {
                console.error(`❌ Error in ${step.name}:`, error.message);
                throw new Error(`Battle calculation failed at ${step.name}: ${error.message}`);
            }
        }

        console.log(`🎯 BattleCalculator: Final total for ${playerId}: ${calculationContext.totalPoints}`);
        return calculationContext.totalPoints;
    }

    /**
     * 📦 LOAD CARD DATA
     * Loads all card data files for effect processing
     */
    loadCardData() {
        return {
            characterCards: require('../data/characterCards.json'),
            utilityCards: require('../data/utilityCards.json'),
            leaderCards: require('../data/leaderCards.json')
        };
    }

    // =======================================================================================
    // 📊 STEP 1: BASE POWER CALCULATION
    // =======================================================================================
    // Calculate base power for each face-up character card with field effects

    /**
     * 📊 CALCULATE BASE POWER
     * Extract power values from all face-up character cards
     */
    async calculateBasePower(context) {
        console.log(`📊 BattleCalculator: Calculating base power for character cards`);
        
        const fields = ['top', 'left', 'right'];
        context.characterPowers = {};

        for (const zone of fields) {
            if (context.playerField[zone] && context.playerField[zone].length > 0) {
                await this.processZoneCharacters(context, zone);
            }
        }

        const characterCount = Object.keys(context.characterPowers).length;
        console.log(`📊 Found ${characterCount} face-up character cards for power calculation`);
    }

    /**
     * 📊 PROCESS ZONE CHARACTERS
     * Process all characters in a specific zone
     */
    async processZoneCharacters(context, zone) {
        for (const cardObj of context.playerField[zone]) {
            const cardInfo = this.extractCardInfo(cardObj);
            
            if (this.isValidCharacterForPower(cardInfo)) {
                const power = this.calculateCharacterBasePower(context, cardInfo);
                
                context.characterPowers[cardInfo.cardId] = {
                    basePower: power.modifiedPower,
                    zone,
                    modifiers: 0,
                    hasUnifiedSystemOverride: power.hasUnifiedSystemOverride
                };
                
                console.log(`📊 Character ${cardInfo.cardId} in ${zone}: ${power.modifiedPower} power`);
            }
        }
    }

    /**
     * 📊 EXTRACT CARD INFO
     * Safely extract card information from card object
     */
    extractCardInfo(cardObj) {
        let cardData = null;
        let isFaceDown = false;
        
        console.log(`🔍 DEBUG extractCardInfo: Processing cardObj:`, JSON.stringify(cardObj, null, 2));
        
        // Handle NEW zone card structure (current format)
        if (cardObj.cardData) {
            cardData = cardObj.cardData;
            console.log(`🔍 DEBUG extractCardInfo: Using cardObj.cardData`);
        }
        // Handle legacy card structures safely  
        else if (cardObj.cardDetails && Array.isArray(cardObj.cardDetails) && cardObj.cardDetails.length > 0) {
            cardData = cardObj.cardDetails[0];
            console.log(`🔍 DEBUG extractCardInfo: Using cardObj.cardDetails[0]`);
        } else if (cardObj.id) {
            cardData = cardObj;
            console.log(`🔍 DEBUG extractCardInfo: Using cardObj directly`);
        }
        
        // Handle NEW zone card structure (current format)
        if (typeof cardObj.isFaceDown === 'boolean') {
            isFaceDown = cardObj.isFaceDown;
            console.log(`🔍 DEBUG extractCardInfo: Using cardObj.isFaceDown = ${isFaceDown}`);
        }
        // Handle legacy isBack format
        else if (cardObj.isBack && Array.isArray(cardObj.isBack) && cardObj.isBack.length > 0) {
            isFaceDown = cardObj.isBack[0];
            console.log(`🔍 DEBUG extractCardInfo: Using cardObj.isBack[0] = ${isFaceDown}`);
        } else if (typeof cardObj.isBack === 'boolean') {
            isFaceDown = cardObj.isBack;
            console.log(`🔍 DEBUG extractCardInfo: Using cardObj.isBack = ${isFaceDown}`);
        }

        const result = {
            cardData,
            cardId: cardData?.id,
            isFaceDown,
            isValid: cardData && cardData.cardType === 'character' && !isFaceDown
        };
        
        console.log(`🔍 DEBUG extractCardInfo: Final result:`, result);
        return result;
    }

    /**
     * 📊 IS VALID CHARACTER FOR POWER
     * Check if character card should contribute to power calculation
     */
    isValidCharacterForPower(cardInfo) {
        return cardInfo.isValid;
    }

    /**
     * 📊 CALCULATE CHARACTER BASE POWER
     * Calculate base power with unified field effects system overrides
     */
    calculateCharacterBasePower(context, cardInfo) {
        const { cardData, cardId } = cardInfo;
        const basePower = cardData.power || 0;
        
        // Check unified field effects system for power overrides
        let modifiedPower = basePower;
        let hasUnifiedSystemOverride = false;
        
        // Check if there's a calculated power override in the unified system
        if (context.gameEnv.players && 
            context.gameEnv.players[context.playerId] && 
            context.gameEnv.players[context.playerId].fieldEffects && 
            context.gameEnv.players[context.playerId].fieldEffects.calculatedPowers &&
            context.gameEnv.players[context.playerId].fieldEffects.calculatedPowers[cardId] !== undefined) {
            
            modifiedPower = context.gameEnv.players[context.playerId].fieldEffects.calculatedPowers[cardId];
            hasUnifiedSystemOverride = true;
            console.log(`📊 Using unified system power override for ${cardId}: ${modifiedPower}`);
        }

        return { modifiedPower, hasUnifiedSystemOverride };
    }

    // =======================================================================================
    // 👑 STEP 2: LEADER EFFECTS
    // =======================================================================================
    // Apply leader continuous effects (always active)

    /**
     * 👑 APPLY LEADER EFFECTS
     * Process continuous effects from the current leader
     */
    async applyLeaderEffects(context) {
        console.log(`👑 BattleCalculator: Applying leader effects`);
        
        if (!context.currentLeader || !context.currentLeader.effects || !context.currentLeader.effects.rules) {
            console.log(`👑 No leader effects to process`);
            return;
        }

        const leaderEffects = context.currentLeader.effects.rules.filter(rule => rule.type === 'continuous');
        console.log(`👑 Processing ${leaderEffects.length} leader continuous effects`);

        for (const rule of leaderEffects) {
            console.log(`👑 Applying leader effect: ${rule.effect?.type || 'unknown'}`);
            
            context.characterPowers = this.applyEffectRule(
                rule, 
                context.characterPowers, 
                context.playerField, 
                context.gameEnv, 
                context.playerId, 
                'leader', 
                context.currentLeader
            );
        }
    }

    // =======================================================================================
    // 🔧 STEP 3: UTILITY CARD EFFECTS
    // =======================================================================================
    // Apply utility card continuous effects (help and SP cards)

    /**
     * 🔧 APPLY UTILITY CARD EFFECTS
     * Process continuous effects from Help and SP cards
     */
    async applyUtilityCardEffects(context) {
        console.log(`🔧 BattleCalculator: Applying utility card effects`);
        
        const utilityZones = ['help', 'sp'];
        
        for (const zone of utilityZones) {
            await this.processUtilityZone(context, zone);
        }
    }

    /**
     * 🔧 PROCESS UTILITY ZONE
     * Process all utility cards in a specific zone
     */
    async processUtilityZone(context, zone) {
        if (!context.playerField[zone] || context.playerField[zone].length === 0) {
            return;
        }

        console.log(`🔧 Processing ${zone} zone with ${context.playerField[zone].length} cards`);

        for (const cardObj of context.playerField[zone]) {
            const cardInfo = this.extractCardInfo(cardObj);
            
            if (cardInfo.isValid && !cardInfo.isFaceDown) {
                await this.processUtilityCardEffects(context, cardInfo);
            }
        }
    }

    /**
     * 🔧 PROCESS UTILITY CARD EFFECTS
     * Apply effects from a single utility card
     */
    async processUtilityCardEffects(context, cardInfo) {
        const { cardData, cardId } = cardInfo;
        
        if (!cardData.effects || !cardData.effects.rules) {
            return;
        }

        const continuousEffects = cardData.effects.rules.filter(rule => 
            rule.type === 'continuous' || 
            (rule.trigger && rule.trigger.includes('finalCalculation'))
        );

        console.log(`🔧 Processing ${continuousEffects.length} utility card effects from ${cardId}`);

        for (const rule of continuousEffects) {
            // Route effect processing based on effect type
            switch (rule.effect?.type) {
                case 'powerBoost':
                case 'powerNerf':
                case 'setPower':
                    context.characterPowers = this.applyEffectRule(
                        rule, 
                        context.characterPowers, 
                        context.playerField, 
                        context.gameEnv, 
                        context.playerId, 
                        'utility', 
                        cardData
                    );
                    break;

                default:
                    console.log(`🔧 Skipping non-power effect: ${rule.effect?.type}`);
                    break;
            }
        }
    }

    // =======================================================================================
    // 🧮 STEP 4: TOTAL POWER CALCULATION
    // =======================================================================================
    // Calculate total power from all characters (enforce minimum 0)

    /**
     * 🧮 CALCULATE TOTAL POWER
     * Sum all character powers and enforce minimum 0
     */
    async calculateTotalPower(context) {
        console.log(`🧮 BattleCalculator: Calculating total power`);
        
        context.totalPoints = 0;
        const powerBreakdown = {};

        for (const [cardId, powerData] of Object.entries(context.characterPowers)) {
            const cardPower = Math.max(0, powerData.basePower + powerData.modifiers);
            context.totalPoints += cardPower;
            powerBreakdown[cardId] = cardPower;
            
            console.log(`🧮 ${cardId}: ${powerData.basePower} base + ${powerData.modifiers} modifiers = ${cardPower}`);
        }

        // Enforce minimum 0 total power
        context.totalPoints = Math.max(0, context.totalPoints);
        
        console.log(`🧮 Total character power: ${context.totalPoints}`);
        console.log(`🧮 Power breakdown:`, powerBreakdown);
    }

    // =======================================================================================
    // 🎲 STEP 5: COMBO BONUSES
    // =======================================================================================
    // Add combo bonuses for special card combinations

    /**
     * 🎲 CALCULATE COMBO BONUSES
     * Add combination bonuses based on card types and traits
     */
    async calculateComboBonuses(context) {
        console.log(`🎲 BattleCalculator: Calculating combo bonuses`);
        
        // Check if combos are disabled by any effects
        if (this.areCombosDisabled(context)) {
            console.log(`🎲 Combos are disabled by card effects`);
            context.comboPoints = 0;
            return;
        }

        // Calculate combo bonuses using existing combo system
        if (this.calculateComboBonus && typeof this.calculateComboBonus === 'function') {
            context.comboPoints = this.calculateComboBonus(context.characterPowers, context.cardData.characterCards, context.gameEnv, context.playerId);
        } else {
            console.log(`🎲 calculateComboBonus method not available - no combos calculated`);
            context.comboPoints = 0;
        }
        
        // Ensure comboPoints is a valid number
        if (typeof context.comboPoints !== 'number' || isNaN(context.comboPoints)) {
            console.log(`🎲 Invalid combo points (${context.comboPoints}), setting to 0`);
            context.comboPoints = 0;
        }
        
        context.totalPoints += context.comboPoints;
        
        console.log(`🎲 Combo points: ${context.comboPoints}`);
        console.log(`🎲 Total with combos: ${context.totalPoints}`);
    }

    /**
     * 🎲 ARE COMBOS DISABLED
     * Check if any effects disable combo calculation
     */
    areCombosDisabled(context) {
        // Check for combo-disabling effects in utility cards
        const utilityZones = ['help', 'sp'];
        
        for (const zone of utilityZones) {
            if (context.playerField[zone] && context.playerField[zone].length > 0) {
                for (const cardObj of context.playerField[zone]) {
                    const cardInfo = this.extractCardInfo(cardObj);
                    
                    if (cardInfo.isValid && !cardInfo.isFaceDown && cardInfo.cardData.effects) {
                        const rules = cardInfo.cardData.effects.rules || [];
                        
                        for (const rule of rules) {
                            if (rule.effect?.type === 'disableCombos') {
                                console.log(`🎲 Combos disabled by ${cardInfo.cardId}`);
                                return true;
                            }
                        }
                    }
                }
            }
        }
        
        return false;
    }

    // =======================================================================================
    // ⚡ STEP 6: FINAL EFFECTS
    // =======================================================================================
    // Apply final calculation effects (like totalPowerNerf)

    /**
     * ⚡ APPLY FINAL EFFECTS
     * Apply post-combo modifications to total power
     */
    async applyFinalEffects(context) {
        console.log(`⚡ BattleCalculator: Applying final calculation effects`);
        
        // Note: No final calculation effects method available in mozGamePlay
        // This step is included for potential future expansion
        console.log(`⚡ No final calculation effects to apply - total power remains: ${context.totalPoints}`);
    }

    // =======================================================================================
    // 🔧 UTILITY METHODS
    // =======================================================================================

    /**
     * 🔍 GET CALCULATION SUMMARY
     * Returns detailed breakdown of calculation for debugging
     */
    getCalculationSummary(context) {
        return {
            playerId: context.playerId,
            characterCount: Object.keys(context.characterPowers).length,
            characterPowers: context.characterPowers,
            totalCharacterPower: context.totalPoints - context.comboPoints,
            comboPoints: context.comboPoints,
            finalTotalPower: context.totalPoints,
            leaderName: context.currentLeader?.name || 'None'
        };
    }

    /**
     * 📊 LOG CALCULATION DETAILS
     * Comprehensive logging for debugging
     */
    logCalculationDetails(context) {
        const summary = this.getCalculationSummary(context);
        console.log(`📊 BattleCalculator Summary:`, summary);
    }
}

module.exports = BattleCalculator;