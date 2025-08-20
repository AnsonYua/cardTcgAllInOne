// =======================================================================================
// 🎯 CARD SELECTION HANDLER - Clean Class Implementation
// =======================================================================================
//
// This class handles ALL card selection workflows with clear switch-case routing.
// Integrates the revamped card selection system into a maintainable class structure.
//
// Key Features:
// - Clear switch-case routing for all selection types
// - Separate handler methods for each selection type  
// - Easy to understand and maintain code structure
// - Comprehensive error handling and validation
// - Detailed logging for debugging and tracking
//
// =======================================================================================

class CardSelectionHandler {
    constructor(mozGamePlay) {
        this.mozGamePlay = mozGamePlay;
        
        // Helper method references for cleaner code (with defensive binding)
        this.getPlayerMainDeck = mozGamePlay.getPlayerMainDeck?.bind(mozGamePlay) || (() => {});
        this.getPlayerHand = mozGamePlay.getPlayerHand?.bind(mozGamePlay) || (() => {});
        this.getPlayerField = mozGamePlay.getPlayerField?.bind(mozGamePlay) || (() => {});
        this.addGameEvent = mozGamePlay.addGameEvent?.bind(mozGamePlay) || (() => {});
        this.addErrorEvent = mozGamePlay.addErrorEvent?.bind(mozGamePlay) || (() => {});
        
        // Create a proper error return method
        this.throwError = (errorMessage) => {
            console.error(`🚨 CardSelectionHandler Error: ${errorMessage}`);
            return { success: false, error: errorMessage };
        };
    }

    /**
     * 🎯 MAIN CARD SELECTION HANDLER - Routes to Appropriate Selection Type
     * 
     * This is the main entry point that routes SelectCard actions to the appropriate
     * handler based on selection type with clear switch-case logic
     */
    async handleSelectCardAction(gameEnv, playerId, action) {
        console.log(`🎯 CardSelectionHandler: Routing SelectCard action for player: ${playerId}`);
        
        // ===== STEP 1: VALIDATE REQUIRED PARAMETERS =====
        // Use selectedCardUIds (unified UID-based system)
        const selectedCardIdentifiers = action.selectedCardUIds;
        if (!action.selectionId || !selectedCardIdentifiers) {
            this.addErrorEvent(gameEnv, 'INVALID_SELECTION_DATA', 
                'Missing required selection parameters', playerId);
            return this.throwError('Missing required selection parameters');
        }

        // ===== STEP 2: GET SELECTION DETAILS =====
        const selection = gameEnv.pendingCardSelections[action.selectionId];
        if (!selection) {
            this.addErrorEvent(gameEnv, 'INVALID_SELECTION_ID', 
                'Invalid or expired card selection', playerId);
            return this.throwError('Invalid or expired card selection');
        }

        // ===== STEP 2.5: INFER SELECTION TYPE IF MISSING =====
        let selectionType = selection.selectionType;
        
        // Backward compatibility: Infer selection type if not present
        if (!selectionType) {
            if (selection.eligibleCards && selection.eligibleCards.length > 0) {
                // Check if this is a single target effect based on effect type and select count
                if (selection.selectCount === 1 && selection.effectType && 
                    ['powerBoost', 'powerNerf'].includes(selection.effectType)) {
                    selectionType = 'singleTarget';
                    console.log(`🔄 Inferred selection type as 'singleTarget' based on selectCount=1 and effectType=${selection.effectType}`);
                }
                // If eligible cards have zone information, it's a field target selection
                else if (selection.eligibleCards[0].zone) {
                    selectionType = 'fieldTarget';
                    console.log(`🔄 Inferred selection type as 'fieldTarget' based on eligible cards with zones`);
                } else {
                    // Otherwise assume it's a deck search
                    selectionType = 'deckSearch';
                    console.log(`🔄 Inferred selection type as 'deckSearch' based on eligible cards without zones`);
                }
            } else {
                // Default to single target if no eligible cards specified
                selectionType = 'singleTarget';
                console.log(`🔄 Inferred selection type as 'singleTarget' as fallback`);
            }
        }
        
        console.log(`🎯 Selection type detected: ${selectionType}`);

        // ===== STEP 3: ROUTE TO APPROPRIATE HANDLER BASED ON SELECTION TYPE =====
        switch (selectionType) {
            case 'deckSearch':
                console.log(`📦 Routing to deck search selection handler`);
                return await this.handleDeckSearchSelection(gameEnv, action.selectionId, selectedCardIdentifiers);

            case 'fieldTarget':
                console.log(`🎯 Routing to field target selection handler`);
                return await this.handleFieldTargetSelection(gameEnv, action.selectionId, selectedCardIdentifiers);

            case 'singleTarget':
                console.log(`🎯 Routing to single target selection handler`);
                return await this.handleSingleTargetSelection(gameEnv, action.selectionId, selectedCardIdentifiers);

            default:
                console.log(`❌ Unknown selection type: ${selectionType}`);
                this.addErrorEvent(gameEnv, 'INVALID_SELECTION_TYPE', 
                    `Unknown selection type: ${selectionType}`, playerId);
                return this.throwError(`Unknown selection type: ${selectionType}`);
        }
    }

    // =======================================================================================
    // 📦 DECK SEARCH SELECTION HANDLER
    // =======================================================================================
    // Handles cards like:
    // - c-9 (艾利茲): Search 4 cards → select 1 to hand
    // - c-10 (爱德华): Search 7 cards → select 1 SP card to SP zone
    // - c-12 (盧克): Search 7 cards → select 1 Help card to Help zone
    // - h-11 (海湖莊園): Search 5 cards → select 1 character to hand

    /**
     * 📦 HANDLE DECK SEARCH SELECTION
     * 
     * Processes selections from deck search effects where player searched deck
     * and now selects which cards to place in which zones
     */
    async handleDeckSearchSelection(gameEnv, selectionId, selectedCardIdentifiers) {
        console.log(`📦 CardSelectionHandler: Processing deck search selection: ${selectionId}`);
        
        const selection = gameEnv.pendingCardSelections[selectionId];
        const { playerId, searchedCards, selectCount, effect } = selection;

        // ===== STEP 1: VALIDATE SELECTION COUNT =====
        if (selectedCardIdentifiers.length !== selectCount) {
            this.addErrorEvent(gameEnv, 'INVALID_SELECTION_COUNT', 
                `Must select exactly ${selectCount} cards`, playerId);
            return this.throwError(`Must select exactly ${selectCount} cards`);
        }

        // ===== STEP 2: VALIDATE CARD CHOICES USING UNIFIED VALIDATION =====
        const validation = this.validateCardSelection(selectedCardIdentifiers, selection.eligibleCards);
        if (!validation.valid) {
            this.addErrorEvent(gameEnv, 'INVALID_CARD_SELECTION', 
                `Invalid card selection: ${validation.invalidCard}`, playerId);
            return this.throwError(`Invalid card selection: ${validation.invalidCard}`);
        }

        // ===== STEP 3: ROUTE TO DESTINATION HANDLER =====
        console.log(`📦 Destination: ${effect.destination}`);
        
        switch (effect.destination) {
            case 'hand':
                console.log(`📝 Moving selected cards to hand`);
                return await this.moveDeckSearchCardsToHand(gameEnv, selectionId, selectedCardIdentifiers);

            case 'spZone':
                console.log(`🌟 Moving selected cards to SP zone`);
                return await this.moveDeckSearchCardsToSpZone(gameEnv, selectionId, selectedCardIdentifiers);

            case 'helpZone':
                console.log(`🆘 Moving selected cards to Help zone`);
                return await this.moveDeckSearchCardsToHelpZone(gameEnv, selectionId, selectedCardIdentifiers);

            default:
                console.log(`❌ Unknown destination: ${effect.destination}`);
                this.addErrorEvent(gameEnv, 'INVALID_DESTINATION', 
                    `Unknown destination: ${effect.destination}`, playerId);
                return this.throwError(`Unknown destination: ${effect.destination}`);
        }
    }

    /**
     * 📝 MOVE DECK SEARCH CARDS TO HAND
     * Used by: c-9 (艾利茲), h-11 (海湖莊園)
     */
    async moveDeckSearchCardsToHand(gameEnv, selectionId, selectedCardIdentifiers) {
        console.log(`📝 CardSelectionHandler: Moving ${selectedCardIdentifiers.length} cards to hand`);
        
        const selection = gameEnv.pendingCardSelections[selectionId];
        const { playerId, searchedCards } = selection;

        // Get player's deck and hand
        const deck = this.getPlayerMainDeck(gameEnv, playerId);
        const hand = this.getPlayerHand(gameEnv, playerId);

        for (const cardId of selectedCardIdentifiers) {
            // Remove from deck
            const deckIndex = deck.indexOf(cardId);
            if (deckIndex !== -1) {
                deck.splice(deckIndex, 1);
            }

            // Add to hand
            hand.push(cardId);
            
            this.addGameEvent(gameEnv, 'CARD_MOVED_TO_HAND', {
                playerId: playerId,
                cardId: cardId,
                source: 'deckSearch'
            });
        }

        // Put remaining searched cards back to bottom of deck
        this.returnUnselectedCardsToDeck(gameEnv, playerId, searchedCards, selectedCardIdentifiers);

        // Complete the selection
        return await this.completeCardSelection(gameEnv, selectionId);
    }

    /**
     * 🌟 MOVE DECK SEARCH CARDS TO SP ZONE
     * Used by: c-10 (爱德华)
     */
    async moveDeckSearchCardsToSpZone(gameEnv, selectionId, selectedCardIdentifiers) {
        console.log(`🌟 CardSelectionHandler: Moving ${selectedCardIdentifiers.length} cards to SP zone`);
        
        const selection = gameEnv.pendingCardSelections[selectionId];
        const { playerId, searchedCards } = selection;

        // Check if SP zone is available
        const playerField = this.getPlayerField(gameEnv, playerId);
        if (playerField.sp.length > 0) {
            // SP zone occupied - card goes to hand instead
            console.log(`🌟 SP zone occupied, moving card to hand instead`);
            return await this.moveDeckSearchCardsToHand(gameEnv, selectionId, selectedCardIdentifiers);
        }

        // Get player's deck
        const deck = this.getPlayerMainDeck(gameEnv, playerId);

        for (const cardId of selectedCardIdentifiers) {
            // Remove from deck
            const deckIndex = deck.indexOf(cardId);
            if (deckIndex !== -1) {
                deck.splice(deckIndex, 1);
            }

            // Create card object for SP zone (face-down)
            const cardDetails = require('../mozGame/mozDeckHelper').getDeckCardDetails(cardId);
            const cardObj = {
                "card": [cardId],
                "cardDetails": [cardDetails],
                "isBack": [true], // Face-down for search effects
                "valueOnField": 0 // Face-down cards contribute 0 power
            };

            // Add to SP zone
            playerField.sp.push(cardObj);
            
            this.addGameEvent(gameEnv, 'CARD_MOVED_TO_SP_ZONE', {
                playerId: playerId,
                cardId: cardId,
                source: 'deckSearch',
                faceDown: true
            });
        }

        // Put remaining searched cards back to bottom of deck
        this.returnUnselectedCardsToDeck(gameEnv, playerId, searchedCards, selectedCardIdentifiers);

        // Complete the selection
        return await this.completeCardSelection(gameEnv, selectionId);
    }

    /**
     * 🆘 MOVE DECK SEARCH CARDS TO HELP ZONE
     * Used by: c-12 (盧克)
     */
    async moveDeckSearchCardsToHelpZone(gameEnv, selectionId, selectedCardIdentifiers) {
        console.log(`🆘 CardSelectionHandler: Moving ${selectedCardIdentifiers.length} cards to Help zone`);
        
        const selection = gameEnv.pendingCardSelections[selectionId];
        const { playerId, searchedCards } = selection;

        // Check if Help zone is available
        const playerField = this.getPlayerField(gameEnv, playerId);
        if (playerField.help.length > 0) {
            // Help zone occupied - card goes to hand instead
            console.log(`🆘 Help zone occupied, moving card to hand instead`);
            return await this.moveDeckSearchCardsToHand(gameEnv, selectionId, selectedCardIds);
        }

        // Get player's deck
        const deck = this.getPlayerMainDeck(gameEnv, playerId);

        for (const cardId of selectedCardIdentifiers) {
            // Remove from deck
            const deckIndex = deck.indexOf(cardId);
            if (deckIndex !== -1) {
                deck.splice(deckIndex, 1);
            }

            // Validate card type
            const cardDetails = require('../mozGame/mozDeckHelper').getDeckCardDetails(cardId);
            if (!cardDetails || cardDetails.cardType !== 'help') {
                this.addErrorEvent(gameEnv, 'INVALID_CARD_TYPE', 
                    'Selected card is not a Help card', playerId);
                return this.throwError('Selected card is not a Help card');
            }

            // Create card object for Help zone (face-up to activate effects)
            const cardObj = {
                "card": [cardId],
                "cardDetails": [cardDetails],
                "isBack": [false], // Face-up to activate effects
                "valueOnField": cardDetails["power"] || 0
            };

            // Add to Help zone
            playerField.help.push(cardObj);
            
            this.addGameEvent(gameEnv, 'CARD_MOVED_TO_HELP_ZONE', {
                playerId: playerId,
                cardId: cardId,
                source: 'deckSearch',
                faceDown: false
            });

            // Process Help card effects immediately
            const effectResult = await this.mozGamePlay.processUtilityCardEffects(gameEnv, playerId, cardDetails);
            if (effectResult && effectResult.requiresCardSelection) {
                // If the Help card's effect requires another selection, return immediately
                return effectResult.gameEnv;
            }
        }

        // Put remaining searched cards back to bottom of deck
        this.returnUnselectedCardsToDeck(gameEnv, playerId, searchedCards, selectedCardIdentifiers);

        // Complete the selection
        return await this.completeCardSelection(gameEnv, selectionId);
    }

    // =======================================================================================
    // 🎯 FIELD TARGET SELECTION HANDLER
    // =======================================================================================
    // Handles cards like:
    // - h-1 (Deep State): Select 1 opponent help/SP card → neutralize effect
    // - h-2 (Make America Great Again): Select 1 opponent character → set power to 0

    /**
     * 🎯 HANDLE FIELD TARGET SELECTION
     * 
     * Processes selections from battlefield targeting effects where player chooses
     * specific cards on the field to affect
     */
    async handleFieldTargetSelection(gameEnv, selectionId, selectedCardIdentifiers) {
        console.log(`🎯 CardSelectionHandler: Processing field target selection: ${selectionId}`);
        
        const selection = gameEnv.pendingCardSelections[selectionId];
        const { playerId, selectCount, effectType } = selection;

        // ===== STEP 1: VALIDATE SELECTION COUNT =====
        if (selectedCardIdentifiers.length !== selectCount) {
            this.addErrorEvent(gameEnv, 'INVALID_SELECTION_COUNT', 
                `Must select exactly ${selectCount} cards`, playerId);
            return this.throwError(`Must select exactly ${selectCount} cards`);
        }

        // ===== STEP 2: VALIDATE CARD CHOICES USING UNIFIED VALIDATION =====
        const validation = this.validateCardSelection(selectedCardIdentifiers, selection.eligibleCards);
        if (!validation.valid) {
            this.addErrorEvent(gameEnv, 'INVALID_CARD_SELECTION', 
                `Invalid card selection: ${validation.invalidCard}`, playerId);
            return this.throwError(`Invalid card selection: ${validation.invalidCard}`);
        }

        // ===== STEP 3: ROUTE TO EFFECT HANDLER =====
        console.log(`🎯 Effect type: ${effectType}`);
        
        switch (effectType) {
            case 'neutralizeEffect':
                console.log(`🚫 Applying neutralization effect`);
                return await this.applyNeutralizationEffect(gameEnv, selectionId, selectedCardIdentifiers);

            case 'setPower':
                console.log(`⚡ Applying set power effect`);
                return await this.applySetPowerEffect(gameEnv, selectionId, selectedCardIdentifiers);

            default:
                console.log(`❌ Unknown effect type: ${effectType}`);
                this.addErrorEvent(gameEnv, 'INVALID_EFFECT_TYPE', 
                    `Unknown effect type: ${effectType}`, playerId);
                return this.throwError(`Unknown effect type: ${effectType}`);
        }
    }

    /**
     * 🚫 APPLY NEUTRALIZATION EFFECT
     * Used by: h-1 (Deep State)
     */
    async applyNeutralizationEffect(gameEnv, selectionId, selectedCardIdentifiers) {
        console.log(`🚫 CardSelectionHandler: Applying neutralization to ${selectedCardIdentifiers.length} cards`);
        
        // Delegate to mozGamePlay's existing neutralization logic
        return await this.mozGamePlay.applyNeutralizationSelection(gameEnv, selectionId, selectedCardIdentifiers);
    }

    /**
     * ⚡ APPLY SET POWER EFFECT
     * Used by: h-2 (Make America Great Again)
     */
    async applySetPowerEffect(gameEnv, selectionId, selectedCardIdentifiers) {
        console.log(`⚡ CardSelectionHandler: Applying set power to ${selectedCardIdentifiers.length} cards`);
        
        // Delegate to mozGamePlay's existing set power logic
        return await this.mozGamePlay.applySetPowerSelection(gameEnv, selectionId, selectedCardIdentifiers);
    }

    // =======================================================================================
    // 🎯 SINGLE TARGET SELECTION HANDLER
    // =======================================================================================
    // Handles cards like:
    // - h-14 (聯邦法官): Player selects one opponent 特朗普家族 character (-60 power)
    // - c-20 (巴飛特): Player selects one ally 富商 character (+50 power)  
    // - c-21 (奧巴馬): Player selects one ally character (+50 power)

    /**
     * 🎯 HANDLE SINGLE TARGET SELECTION
     * 
     * Processes selections where player must choose exactly one target from valid options
     * These effects have targetCount: 1 in their rules
     */
    async handleSingleTargetSelection(gameEnv, selectionId, selectedCardIdentifiers) {
        console.log(`🎯 CardSelectionHandler: Processing single target selection: ${selectionId}`);
        
        const selection = gameEnv.pendingCardSelections[selectionId];
        const { playerId, effectType } = selection;

        // ===== STEP 1: VALIDATE EXACTLY ONE SELECTION =====
        if (selectedCardIdentifiers.length !== 1) {
            this.addErrorEvent(gameEnv, 'INVALID_SELECTION_COUNT', 
                'Must select exactly 1 target', playerId);
            return this.throwError('Must select exactly 1 target');
        }

        // ===== STEP 2: VALIDATE CARD CHOICE USING UNIFIED VALIDATION =====
        const validation = this.validateCardSelection(selectedCardIdentifiers, selection.eligibleCards);
        if (!validation.valid) {
            this.addErrorEvent(gameEnv, 'INVALID_CARD_SELECTION', 
                `Invalid card selection: ${validation.invalidCard}`, playerId);
            return this.throwError(`Invalid card selection: ${validation.invalidCard}`);
        }

        const selectedCardId = selectedCardIdentifiers[0];

        // ===== STEP 3: ROUTE TO EFFECT HANDLER =====
        console.log(`🎯 Single target effect type: ${effectType}`);
        
        switch (effectType) {
            case 'powerBoost':
                console.log(`⚡ Applying power boost effect to single target`);
                return await this.applySingleTargetPowerBoost(gameEnv, selectionId, selectedCardId);

            case 'powerNerf':
                console.log(`⚡ Applying power nerf effect to single target`);
                return await this.applySingleTargetPowerNerf(gameEnv, selectionId, selectedCardId);

            default:
                console.log(`❌ Unknown effect type: ${effectType}`);
                this.addErrorEvent(gameEnv, 'INVALID_EFFECT_TYPE', 
                    `Unknown effect type: ${effectType}`, playerId);
                return this.throwError(`Unknown effect type: ${effectType}`);
        }
    }

    /**
     * ⚡ APPLY SINGLE TARGET POWER BOOST
     * Used by: c-20 (巴飛特), c-21 (奧巴馬)
     */
    async applySingleTargetPowerBoost(gameEnv, selectionId, selectedCardId) {
        console.log(`⚡ CardSelectionHandler: Applying power boost to: ${selectedCardId}`);
        
        const selection = gameEnv.pendingCardSelections[selectionId];
        const { effect, playerId } = selection;
        const boostValue = effect.value || 50;
        
        // ✅ FIXED: Store as proper activeEffect object (not calculatedPowers)
        // 🎯 CRITICAL: Find which player owns the target card and store effect there
        const targetPlayerId = this.findCardOwner(gameEnv, selectedCardId);
        const targetPlayer = gameEnv.players[targetPlayerId];
        
        console.log(`🎯 Target card ${selectedCardId} belongs to player: ${targetPlayerId}`);
        
        if (targetPlayer && targetPlayer.fieldEffects) {
            // Initialize activeEffects array if needed
            if (!targetPlayer.fieldEffects.activeEffects) {
                targetPlayer.fieldEffects.activeEffects = [];
            }
            
            // Create proper activeEffect object that BattleCalculator can read
            const activeEffect = {
                effectId: `${selectionId}_powerBoost_${Date.now()}`,
                source: effect.sourceCard || 'cardSelection',
                sourcePlayerId: playerId, // Who triggered the effect
                type: 'powerBoost', // ⭐ This is what BattleCalculator looks for
                target: {
                    scope: 'SPECIFIC',
                    cardIds: [selectedCardId]
                },
                value: boostValue,
                isEnabled: true,
                createdAt: Date.now()
            };
            
            // Add to activeEffects (not calculatedPowers!)
            targetPlayer.fieldEffects.activeEffects.push(activeEffect);
            
            console.log(`⚡ Added powerBoost effect: +${boostValue} to ${selectedCardId} in ${targetPlayerId}'s activeEffects`);
            console.log(`📊 Player ${targetPlayerId} now has ${targetPlayer.fieldEffects.activeEffects.length} active effects`);
        }

        // Complete the selection
        return await this.completeCardSelection(gameEnv, selectionId);
    }

    /**
     * ⚡ APPLY SINGLE TARGET POWER NERF
     * Used by: h-14 (聯邦法官)
     */
    async applySingleTargetPowerNerf(gameEnv, selectionId, selectedCardId) {
        console.log(`⚡ CardSelectionHandler: Applying power nerf to: ${selectedCardId}`);
        
        const selection = gameEnv.pendingCardSelections[selectionId];
        const { effect, playerId } = selection;
        const nerfValue = effect.value || 60;
        
        // ✅ FIXED: Store as proper activeEffect object (not calculatedPowers)
        // 🎯 CRITICAL: Find which player owns the target card and store effect there
        const targetPlayerId = this.findCardOwner(gameEnv, selectedCardId);
        const targetPlayer = gameEnv.players[targetPlayerId];
        
        console.log(`🎯 Target card ${selectedCardId} belongs to player: ${targetPlayerId}`);
        
        if (targetPlayer && targetPlayer.fieldEffects) {
            // Initialize activeEffects array if needed
            if (!targetPlayer.fieldEffects.activeEffects) {
                targetPlayer.fieldEffects.activeEffects = [];
            }
            
            // Create proper activeEffect object that BattleCalculator can read
            const activeEffect = {
                effectId: `${selectionId}_powerReduction_${Date.now()}`,
                source: effect.sourceCard || 'cardSelection',
                sourcePlayerId: playerId, // Who triggered the effect
                type: 'powerReduction', // ⭐ BattleCalculator handles this type
                target: {
                    scope: 'SPECIFIC',
                    cardIds: [selectedCardId]
                },
                value: nerfValue,
                isEnabled: true,
                createdAt: Date.now()
            };
            
            // Add to activeEffects (not calculatedPowers!)
            targetPlayer.fieldEffects.activeEffects.push(activeEffect);
            
            console.log(`⚡ Added powerReduction effect: -${nerfValue} to ${selectedCardId} in ${targetPlayerId}'s activeEffects`);
            console.log(`📊 Player ${targetPlayerId} now has ${targetPlayer.fieldEffects.activeEffects.length} active effects`);
        }

        // Complete the selection
        return await this.completeCardSelection(gameEnv, selectionId);
    }

    // =======================================================================================
    // 🔧 UTILITY METHODS
    // =======================================================================================

    /**
     * ✅ UNIFIED CARD SELECTION VALIDATION
     * Validates selected card identifiers (supports both UIDs and IDs) against eligible cards
     * @param {string[]} selectedCardIdentifiers - Array of selected card UIDs or IDs
     * @param {Array} eligibleCards - Array of eligible cards (strings or objects)
     * @returns {Object} - Validation result with success status and details
     */
    validateCardSelection(selectedCardIdentifiers, eligibleCards) {
        console.log(`🔍 Validating selection: ${selectedCardIdentifiers.join(', ')} against ${eligibleCards.length} eligible cards`);
        
        for (const identifier of selectedCardIdentifiers) {
            const isValidCard = eligibleCards.some(card => {
                if (typeof card === 'string') {
                    // Simple string comparison for basic card IDs
                    return card === identifier;
                } else if (typeof card === 'object' && card) {
                    // Object comparison supports both cardId and cardUid
                    return card.cardId === identifier || card.cardUid === identifier;
                }
                return false;
            });
            
            if (!isValidCard) {
                console.log(`❌ Invalid card selection: ${identifier}`);
                return { valid: false, invalidCard: identifier };
            }
        }
        
        console.log(`✅ All selected cards are valid`);
        return { valid: true };
    }

    /**
     * 🔍 FIND CARD OWNER
     * Determines which player owns a specific card by searching all zones
     */
    findCardOwner(gameEnv, cardIdentifier) {
        // Search through all players' zones to find the card
        for (const playerId of Object.keys(gameEnv.players)) {
            const playerZones = gameEnv.zones[playerId];
            if (!playerZones) continue;
            
            // Check all character zones and other zones
            const allZones = ['top', 'left', 'right', 'help', 'sp', 'leader'];
            
            for (const zoneName of allZones) {
                const zone = playerZones[zoneName];
                if (!zone) continue;
                
                // Handle array zones (top, left, right, help, sp)
                if (Array.isArray(zone)) {
                    const found = zone.some(card => 
                        card.cardId === cardIdentifier || 
                        card.cardUid === cardIdentifier ||
                        card.cardId === cardIdentifier.split('_')[0]  // Handle UID format
                    );
                    if (found) {
                        console.log(`🔍 Found card ${cardIdentifier} in ${playerId}'s ${zoneName} zone`);
                        return playerId;
                    }
                }
                // Handle single card zones (leader)
                else if (zone && typeof zone === 'object') {
                    if (zone.cardId === cardIdentifier || 
                        zone.cardUid === cardIdentifier ||
                        zone.cardId === cardIdentifier.split('_')[0]) {
                        console.log(`🔍 Found card ${cardIdentifier} in ${playerId}'s ${zoneName} zone`);
                        return playerId;
                    }
                }
            }
        }
        
        console.warn(`⚠️ Could not find owner for card: ${cardIdentifier}`);
        return null;
    }

    /**
     * 🔄 RETURN UNSELECTED CARDS TO DECK
     * Puts the cards that weren't selected back to the bottom of the deck
     */
    returnUnselectedCardsToDeck(gameEnv, playerId, searchedCards, selectedCardIdentifiers) {
        const deck = this.getPlayerMainDeck(gameEnv, playerId);
        const unselectedCards = searchedCards.filter(cardId => !selectedCardIdentifiers.includes(cardId));
        
        // Add unselected cards to bottom of deck
        deck.push(...unselectedCards);
        
        console.log(`🔄 CardSelectionHandler: Returned ${unselectedCards.length} unselected cards to deck`);
    }

    /**
     * ✅ COMPLETE CARD SELECTION
     * Cleans up the selection state and continues game flow
     */
    async completeCardSelection(gameEnv, selectionId) {
        console.log(`✅ CardSelectionHandler: Completing card selection: ${selectionId}`);

        // Clean up selection data - REFACTOR: Only delete from consolidated field
        delete gameEnv.pendingCardSelections[selectionId];

        // Add completion event
        this.addGameEvent(gameEnv, 'CARD_SELECTION_COMPLETED', {
            selectionId: selectionId
        });

        // Continue game flow (check for turn completion, phase advancement, etc.)
        return await this.continueGameFlow(gameEnv);
    }

    /**
     * 🎮 CONTINUE GAME FLOW
     * Handles post-selection game flow continuation
     */
    async continueGameFlow(gameEnv) {
        console.log(`🎮 CardSelectionHandler: Continuing game flow after selection`);

        // Run unified effect simulation to ensure all effects are properly processed
        if (this.mozGamePlay.effectSimulator) {
            console.log(`🔄 Running unified effect simulation`);
            await this.mozGamePlay.effectSimulator.simulateCardPlaySequence(gameEnv);
        }

        // For card selections, we typically don't advance turns automatically
        // Card selections are usually part of the current player's turn actions
        // The turn advancement should happen when the player ends their turn or plays a card
        console.log(`✅ Game flow continued successfully after card selection`);
        
        return { success: true, gameEnv: gameEnv };
    }
}

module.exports = CardSelectionHandler;