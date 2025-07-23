// =======================================================================================
// 🎯 REVAMPED CARD SELECTION SYSTEM - Clear Switch Cases for Easy Tracking
// =======================================================================================
//
// This revamped system provides clear switch-case structure for all card selection types:
// 1. Deck Search Selection (searchCard + selectCount) - Search deck, select cards to zones
// 2. Field Target Selection (requiresSelection + selectCount) - Target battlefield cards
// 3. Single Target Selection (targetCount) - Player selects exactly one target
//
// Key Improvements:
// - Clear switch-case routing for all action types
// - Separate handler methods for each selection type
// - Easy to understand and maintain code structure
// - Comprehensive error handling and validation
//
// =======================================================================================

/**
 * 🎯 REVAMPED PROCESS ACTION - Main Entry Point with Clear Routing
 * 
 * This method handles ALL player actions with clear switch-case routing:
 * - PlayCard/PlayCardBack: Card placement actions
 * - SelectCard: Card selection responses
 * - Pass: Skip turn actions
 * - Other future action types can be easily added
 */
async processAction(gameEnvInput, playerId, action) {
    console.log(`🎮 Processing action: ${action.type} for player: ${playerId}`);
    var gameEnv = gameEnvInput;

    // ===== SECTION 1: PENDING ACTION VALIDATION =====
    const pendingCheck = this.validatePendingActions(gameEnv, playerId, action);
    if (pendingCheck.blocked) {
        return this.throwError(pendingCheck.reason);
    }

    // ===== SECTION 2: ACTION TYPE ROUTING WITH CLEAR SWITCH CASES =====
    switch (action.type) {
        case 'PlayCard':
            console.log(`🎴 Processing PlayCard action (face-up)`);
            return await this.handlePlayCardAction(gameEnv, playerId, action, false);

        case 'PlayCardBack':
            console.log(`🎴 Processing PlayCardBack action (face-down)`);
            return await this.handlePlayCardAction(gameEnv, playerId, action, true);

        case 'SelectCard':
            console.log(`🎯 Processing SelectCard action`);
            return await this.handleSelectCardAction(gameEnv, playerId, action);

        case 'Pass':
            console.log(`⏭️ Processing Pass action`);
            return await this.handlePassAction(gameEnv, playerId, action);

        default:
            console.log(`❌ Unknown action type: ${action.type}`);
            this.addErrorEvent(gameEnv, 'INVALID_ACTION_TYPE', 
                `Unknown action type: ${action.type}`, playerId);
            return this.throwError(`Unknown action type: ${action.type}`);
    }
}

/**
 * 🚫 VALIDATE PENDING ACTIONS - Check if Player Can Act
 * 
 * Prevents players from taking actions when card selection is pending
 */
validatePendingActions(gameEnv, playerId, action) {
    // Check if there's a pending player action that blocks normal gameplay
    if (gameEnv.pendingPlayerAction) {
        const pendingAction = gameEnv.pendingPlayerAction;
        
        switch (pendingAction.type) {
            case 'cardSelection':
                const selection = gameEnv.pendingCardSelections[pendingAction.selectionId];
                if (selection) {
                    if (selection.playerId === playerId) {
                        // Current player needs to complete their card selection first
                        this.addErrorEvent(gameEnv, 'CARD_SELECTION_PENDING', 
                            `You must complete your card selection first. Select ${selection.selectCount} card(s).`, playerId);
                        return {
                            blocked: true,
                            reason: `You must complete your card selection first. Select ${selection.selectCount} card(s).`
                        };
                    } else {
                        // Other player is waiting for the current player to complete selection
                        this.addErrorEvent(gameEnv, 'WAITING_FOR_PLAYER', 
                            `Waiting for ${selection.playerId} to complete card selection. Please wait.`, playerId);
                        return {
                            blocked: true,
                            reason: `Waiting for ${selection.playerId} to complete card selection. Please wait.`
                        };
                    }
                }
                break;

            default:
                this.addErrorEvent(gameEnv, 'GAME_BLOCKED', `Game is waiting for player action.`, playerId);
                return {
                    blocked: true,
                    reason: `Game is waiting for player action.`
                };
        }
    }

    return { blocked: false };
}

/**
 * 🎯 HANDLE SELECT CARD ACTION - Route to Appropriate Selection Handler
 * 
 * This method routes SelectCard actions to the appropriate handler based on selection type
 */
async handleSelectCardAction(gameEnv, playerId, action) {
    console.log(`🎯 Routing SelectCard action for player: ${playerId}`);
    
    // Validate required parameters
    if (!action.selectionId || !action.selectedCardIds) {
        this.addErrorEvent(gameEnv, 'INVALID_SELECTION_DATA', 
            'Missing required selection parameters', playerId);
        return this.throwError('Missing required selection parameters');
    }

    // Get selection details
    const selection = gameEnv.pendingCardSelections[action.selectionId];
    if (!selection) {
        this.addErrorEvent(gameEnv, 'INVALID_SELECTION_ID', 
            'Invalid or expired card selection', playerId);
        return this.throwError('Invalid or expired card selection');
    }

    // Route to appropriate handler based on selection type
    switch (selection.selectionType) {
        case 'deckSearch':
            console.log(`📦 Routing to deck search selection handler`);
            return await this.handleDeckSearchSelection(gameEnv, action.selectionId, action.selectedCardIds);

        case 'fieldTarget':
            console.log(`🎯 Routing to field target selection handler`);
            return await this.handleFieldTargetSelection(gameEnv, action.selectionId, action.selectedCardIds);

        case 'singleTarget':
            console.log(`🎯 Routing to single target selection handler`);
            return await this.handleSingleTargetSelection(gameEnv, action.selectionId, action.selectedCardIds);

        default:
            console.log(`❌ Unknown selection type: ${selection.selectionType}`);
            this.addErrorEvent(gameEnv, 'INVALID_SELECTION_TYPE', 
                `Unknown selection type: ${selection.selectionType}`, playerId);
            return this.throwError(`Unknown selection type: ${selection.selectionType}`);
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
async handleDeckSearchSelection(gameEnv, selectionId, selectedCardIds) {
    console.log(`📦 Processing deck search selection: ${selectionId}`);
    
    const selection = gameEnv.pendingCardSelections[selectionId];
    const { playerId, searchedCards, selectCount, effect } = selection;

    // ===== STEP 1: VALIDATE SELECTION COUNT =====
    if (selectedCardIds.length !== selectCount) {
        this.addErrorEvent(gameEnv, 'INVALID_SELECTION_COUNT', 
            `Must select exactly ${selectCount} cards`, playerId);
        return this.throwError(`Must select exactly ${selectCount} cards`);
    }

    // ===== STEP 2: VALIDATE CARD CHOICES =====
    for (const cardId of selectedCardIds) {
        if (!selection.eligibleCards.includes(cardId)) {
            this.addErrorEvent(gameEnv, 'INVALID_CARD_SELECTION', 
                `Invalid card selection: ${cardId}`, playerId);
            return this.throwError(`Invalid card selection: ${cardId}`);
        }
    }

    // ===== STEP 3: ROUTE TO DESTINATION HANDLER =====
    switch (effect.destination) {
        case 'hand':
            console.log(`📝 Moving selected cards to hand`);
            return await this.moveDeckSearchCardsToHand(gameEnv, selectionId, selectedCardIds);

        case 'spZone':
            console.log(`🌟 Moving selected cards to SP zone`);
            return await this.moveDeckSearchCardsToSpZone(gameEnv, selectionId, selectedCardIds);

        case 'helpZone':
            console.log(`🆘 Moving selected cards to Help zone`);
            return await this.moveDeckSearchCardsToHelpZone(gameEnv, selectionId, selectedCardIds);

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
async moveDeckSearchCardsToHand(gameEnv, selectionId, selectedCardIds) {
    const selection = gameEnv.pendingCardSelections[selectionId];
    const { playerId, searchedCards } = selection;

    // Get player's deck and hand
    const deck = this.getPlayerMainDeck(gameEnv, playerId);
    const hand = this.getPlayerHand(gameEnv, playerId);

    for (const cardId of selectedCardIds) {
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
    this.returnUnselectedCardsToDeck(gameEnv, playerId, searchedCards, selectedCardIds);

    // Complete the selection
    return await this.completeCardSelection(gameEnv, selectionId);
}

/**
 * 🌟 MOVE DECK SEARCH CARDS TO SP ZONE
 * Used by: c-10 (爱德华)
 */
async moveDeckSearchCardsToSpZone(gameEnv, selectionId, selectedCardIds) {
    const selection = gameEnv.pendingCardSelections[selectionId];
    const { playerId, searchedCards } = selection;

    // Check if SP zone is available
    const playerField = this.getPlayerField(gameEnv, playerId);
    if (playerField.sp.length > 0) {
        // SP zone occupied - card goes to hand instead
        console.log(`🌟 SP zone occupied, moving card to hand instead`);
        return await this.moveDeckSearchCardsToHand(gameEnv, selectionId, selectedCardIds);
    }

    // Get player's deck
    const deck = this.getPlayerMainDeck(gameEnv, playerId);

    for (const cardId of selectedCardIds) {
        // Remove from deck
        const deckIndex = deck.indexOf(cardId);
        if (deckIndex !== -1) {
            deck.splice(deckIndex, 1);
        }

        // Create card object for SP zone (face-down)
        const cardDetails = require('./mozDeckHelper').getDeckCardDetails(cardId);
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
    this.returnUnselectedCardsToDeck(gameEnv, playerId, searchedCards, selectedCardIds);

    // Complete the selection
    return await this.completeCardSelection(gameEnv, selectionId);
}

/**
 * 🆘 MOVE DECK SEARCH CARDS TO HELP ZONE
 * Used by: c-12 (盧克)
 */
async moveDeckSearchCardsToHelpZone(gameEnv, selectionId, selectedCardIds) {
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

    for (const cardId of selectedCardIds) {
        // Remove from deck
        const deckIndex = deck.indexOf(cardId);
        if (deckIndex !== -1) {
            deck.splice(deckIndex, 1);
        }

        // Validate card type
        const cardDetails = require('./mozDeckHelper').getDeckCardDetails(cardId);
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
        const effectResult = await this.processUtilityCardEffects(gameEnv, playerId, cardDetails);
        if (effectResult && effectResult.requiresCardSelection) {
            // If the Help card's effect requires another selection, return immediately
            return effectResult.gameEnv;
        }
    }

    // Put remaining searched cards back to bottom of deck
    this.returnUnselectedCardsToDeck(gameEnv, playerId, searchedCards, selectedCardIds);

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
async handleFieldTargetSelection(gameEnv, selectionId, selectedCardIds) {
    console.log(`🎯 Processing field target selection: ${selectionId}`);
    
    const selection = gameEnv.pendingCardSelections[selectionId];
    const { playerId, selectCount, effectType } = selection;

    // ===== STEP 1: VALIDATE SELECTION COUNT =====
    if (selectedCardIds.length !== selectCount) {
        this.addErrorEvent(gameEnv, 'INVALID_SELECTION_COUNT', 
            `Must select exactly ${selectCount} cards`, playerId);
        return this.throwError(`Must select exactly ${selectCount} cards`);
    }

    // ===== STEP 2: VALIDATE CARD CHOICES =====
    for (const cardId of selectedCardIds) {
        const isValidCard = selection.eligibleCards.some(card => 
            (typeof card === 'string' && card === cardId) ||
            (typeof card === 'object' && card.cardId === cardId)
        );
        if (!isValidCard) {
            this.addErrorEvent(gameEnv, 'INVALID_CARD_SELECTION', 
                `Invalid card selection: ${cardId}`, playerId);
            return this.throwError(`Invalid card selection: ${cardId}`);
        }
    }

    // ===== STEP 3: ROUTE TO EFFECT HANDLER =====
    switch (effectType) {
        case 'neutralizeEffect':
            console.log(`🚫 Applying neutralization effect`);
            return await this.applyNeutralizationEffect(gameEnv, selectionId, selectedCardIds);

        case 'setPower':
            console.log(`⚡ Applying set power effect`);
            return await this.applySetPowerEffect(gameEnv, selectionId, selectedCardIds);

        default:
            console.log(`❌ Unknown effect type: ${effectType}`);
            this.addErrorEvent(gameEnv, 'INVALID_EFFECT_TYPE', 
                `Unknown effect type: ${effectType}`, playerId);
            return this.throwError(`Unknown effect type: ${effectType}`);
    }
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
async handleSingleTargetSelection(gameEnv, selectionId, selectedCardIds) {
    console.log(`🎯 Processing single target selection: ${selectionId}`);
    
    const selection = gameEnv.pendingCardSelections[selectionId];
    const { playerId, effectType } = selection;

    // ===== STEP 1: VALIDATE EXACTLY ONE SELECTION =====
    if (selectedCardIds.length !== 1) {
        this.addErrorEvent(gameEnv, 'INVALID_SELECTION_COUNT', 
            'Must select exactly 1 target', playerId);
        return this.throwError('Must select exactly 1 target');
    }

    // ===== STEP 2: VALIDATE CARD CHOICE =====
    const selectedCardId = selectedCardIds[0];
    const isValidCard = selection.eligibleCards.some(card => 
        (typeof card === 'string' && card === selectedCardId) ||
        (typeof card === 'object' && card.cardId === selectedCardId)
    );
    
    if (!isValidCard) {
        this.addErrorEvent(gameEnv, 'INVALID_CARD_SELECTION', 
            `Invalid card selection: ${selectedCardId}`, playerId);
        return this.throwError(`Invalid card selection: ${selectedCardId}`);
    }

    // ===== STEP 3: ROUTE TO EFFECT HANDLER =====
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

// =======================================================================================
// 🔧 UTILITY METHODS
// =======================================================================================

/**
 * 🔄 RETURN UNSELECTED CARDS TO DECK
 * Puts the cards that weren't selected back to the bottom of the deck
 */
returnUnselectedCardsToDeck(gameEnv, playerId, searchedCards, selectedCardIds) {
    const deck = this.getPlayerMainDeck(gameEnv, playerId);
    const unselectedCards = searchedCards.filter(cardId => !selectedCardIds.includes(cardId));
    
    // Add unselected cards to bottom of deck
    deck.push(...unselectedCards);
    
    console.log(`🔄 Returned ${unselectedCards.length} unselected cards to deck`);
}

/**
 * ✅ COMPLETE CARD SELECTION
 * Cleans up the selection state and continues game flow
 */
async completeCardSelection(gameEnv, selectionId) {
    console.log(`✅ Completing card selection: ${selectionId}`);

    // Clean up selection data
    delete gameEnv.pendingCardSelections[selectionId];
    delete gameEnv.pendingPlayerAction;

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
    console.log(`🎮 Continuing game flow after selection`);

    // Run unified effect simulation to ensure all effects are properly processed
    if (this.effectSimulator) {
        console.log(`🔄 Running unified effect simulation`);
        await this.effectSimulator.simulateCardPlaySequence(gameEnv);
    }

    // Check if turn should advance
    const currentPlayerId = gameEnv.currentPlayer;
    gameEnv = await this.shouldUpdateTurn(gameEnv, currentPlayerId);

    return gameEnv;
}

module.exports = mozGamePlay;