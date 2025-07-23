// =======================================================================================
// 🎯 REVAMPED SELECT CARD METHOD - Clear Switch Cases for Easy Tracking
// =======================================================================================

/**
 * 🎯 REVAMPED SELECT CARD - Main Card Selection Handler
 * 
 * This method handles card selection requests from the frontend with clear routing
 * and comprehensive validation for all selection types
 */
async selectCard(req) {
    console.log(`🎯 Processing selectCard request`);
    
    // ===== STEP 1: EXTRACT AND VALIDATE REQUEST PARAMETERS =====
    const { selectionId, selectedCardIds, playerId, gameId } = req.body;
    
    if (!selectionId) {
        console.log(`❌ Missing selectionId parameter`);
        throw new Error('Missing required parameter: selectionId');
    }
    
    if (!selectedCardIds || !Array.isArray(selectedCardIds)) {
        console.log(`❌ Missing or invalid selectedCardIds parameter`);
        throw new Error('Missing or invalid parameter: selectedCardIds (must be array)');
    }
    
    if (!playerId) {
        console.log(`❌ Missing playerId parameter`);
        throw new Error('Missing required parameter: playerId');
    }
    
    if (!gameId) {
        console.log(`❌ Missing gameId parameter`);
        throw new Error('Missing required parameter: gameId');
    }

    console.log(`📋 Request details:`, {
        selectionId,
        selectedCardCount: selectedCardIds.length,
        playerId,
        gameId
    });

    // ===== STEP 2: LOAD GAME DATA =====
    console.log(`📁 Loading game data for gameId: ${gameId}`);
    const gameData = await this.readJSONFileAsync(gameId);
    if (!gameData) {
        console.log(`❌ Game not found: ${gameId}`);
        throw new Error('Game not found');
    }

    // ===== STEP 3: VALIDATE SELECTION EXISTS =====
    if (!gameData.gameEnv.pendingCardSelections || 
        !gameData.gameEnv.pendingCardSelections[selectionId]) {
        console.log(`❌ Invalid or expired selection: ${selectionId}`);
        throw new Error('Invalid or expired card selection');
    }

    const selection = gameData.gameEnv.pendingCardSelections[selectionId];
    console.log(`📋 Selection details:`, {
        selectionType: selection.selectionType,
        selectCount: selection.selectCount,
        effectType: selection.effectType,
        playerId: selection.playerId
    });

    // ===== STEP 4: VALIDATE PLAYER AUTHORIZATION =====
    if (selection.playerId !== playerId) {
        console.log(`❌ Player ${playerId} not authorized for selection ${selectionId}`);
        throw new Error('You are not authorized to complete this selection');
    }

    // ===== STEP 5: ROUTE TO APPROPRIATE HANDLER BASED ON SELECTION TYPE =====
    console.log(`🎯 Routing to selection handler: ${selection.selectionType}`);
    
    let updatedGameEnv;
    
    switch (selection.selectionType) {
        case 'deckSearch':
            console.log(`📦 Processing deck search selection`);
            updatedGameEnv = await this.processDeckSearchSelection(
                gameData.gameEnv, 
                selectionId, 
                selectedCardIds
            );
            break;

        case 'fieldTarget':
            console.log(`🎯 Processing field target selection`);
            updatedGameEnv = await this.processFieldTargetSelection(
                gameData.gameEnv, 
                selectionId, 
                selectedCardIds
            );
            break;

        case 'singleTarget':
            console.log(`🎯 Processing single target selection`);
            updatedGameEnv = await this.processSingleTargetSelection(
                gameData.gameEnv, 
                selectionId, 
                selectedCardIds
            );
            break;

        default:
            console.log(`❌ Unknown selection type: ${selection.selectionType}`);
            throw new Error(`Unknown selection type: ${selection.selectionType}`);
    }

    // ===== STEP 6: HANDLE PROCESSING ERRORS =====
    if (updatedGameEnv.error) {
        console.log(`❌ Selection processing failed: ${updatedGameEnv.error}`);
        throw new Error(updatedGameEnv.error);
    }

    // ===== STEP 7: SAVE UPDATED GAME STATE =====
    console.log(`💾 Saving updated game state`);
    gameData.gameEnv = updatedGameEnv;
    const updatedGameData = this.addUpdateUUID(gameData);
    await this.saveOrCreateGame(updatedGameData, gameId);

    // ===== STEP 8: RETURN SUCCESS RESPONSE =====
    console.log(`✅ Card selection completed successfully`);
    return {
        success: true,
        gameEnv: updatedGameData.gameEnv,
        selectionCompleted: true,
        message: `Successfully processed ${selection.selectionType} selection`
    };
}

// =======================================================================================
// 📦 DECK SEARCH SELECTION PROCESSOR
// =======================================================================================

/**
 * 📦 PROCESS DECK SEARCH SELECTION
 * 
 * Handles deck search selections where player searched deck and selected cards
 * Routes to mozGamePlay for actual processing
 */
async processDeckSearchSelection(gameEnv, selectionId, selectedCardIds) {
    console.log(`📦 Processing deck search selection in GameLogic`);
    
    const selection = gameEnv.pendingCardSelections[selectionId];
    
    // Log selection details for debugging
    console.log(`📦 Deck search details:`, {
        searchCount: selection.searchCount,
        selectCount: selection.selectCount,
        destination: selection.effect?.destination || 'unknown',
        eligibleCardsCount: selection.eligibleCards?.length || 0
    });

    // Create SelectCard action for mozGamePlay
    const selectCardAction = {
        type: 'SelectCard',
        selectionId: selectionId,
        selectedCardIds: selectedCardIds
    };

    // Process through mozGamePlay with the new routing system
    return await this.mozGamePlay.processAction(gameEnv, selection.playerId, selectCardAction);
}

// =======================================================================================
// 🎯 FIELD TARGET SELECTION PROCESSOR
// =======================================================================================

/**
 * 🎯 PROCESS FIELD TARGET SELECTION
 * 
 * Handles field target selections where player chose specific battlefield cards
 * Routes to mozGamePlay for actual processing
 */
async processFieldTargetSelection(gameEnv, selectionId, selectedCardIds) {
    console.log(`🎯 Processing field target selection in GameLogic`);
    
    const selection = gameEnv.pendingCardSelections[selectionId];
    
    // Log selection details for debugging
    console.log(`🎯 Field target details:`, {
        effectType: selection.effectType,
        selectCount: selection.selectCount,
        targetZones: selection.targetZones || 'unknown',
        eligibleCardsCount: selection.eligibleCards?.length || 0
    });

    // Validate effect type for field targeting
    const validFieldEffectTypes = ['neutralizeEffect', 'setPower'];
    if (!validFieldEffectTypes.includes(selection.effectType)) {
        console.log(`❌ Invalid effect type for field targeting: ${selection.effectType}`);
        throw new Error(`Invalid effect type for field targeting: ${selection.effectType}`);
    }

    // Create SelectCard action for mozGamePlay
    const selectCardAction = {
        type: 'SelectCard',
        selectionId: selectionId,
        selectedCardIds: selectedCardIds
    };

    // Process through mozGamePlay with the new routing system
    return await this.mozGamePlay.processAction(gameEnv, selection.playerId, selectCardAction);
}

// =======================================================================================
// 🎯 SINGLE TARGET SELECTION PROCESSOR
// =======================================================================================

/**
 * 🎯 PROCESS SINGLE TARGET SELECTION
 * 
 * Handles single target selections where player chose exactly one target
 * Routes to mozGamePlay for actual processing
 */
async processSingleTargetSelection(gameEnv, selectionId, selectedCardIds) {
    console.log(`🎯 Processing single target selection in GameLogic`);
    
    const selection = gameEnv.pendingCardSelections[selectionId];
    
    // Validate exactly one selection for single target
    if (selectedCardIds.length !== 1) {
        console.log(`❌ Single target selection must have exactly 1 card, got: ${selectedCardIds.length}`);
        throw new Error('Single target selection must select exactly 1 card');
    }

    // Log selection details for debugging
    console.log(`🎯 Single target details:`, {
        effectType: selection.effectType,
        targetFilters: selection.targetFilters || 'none',
        selectedCardId: selectedCardIds[0],
        eligibleCardsCount: selection.eligibleCards?.length || 0
    });

    // Validate effect type for single targeting
    const validSingleEffectTypes = ['powerBoost', 'powerNerf', 'setPower', 'neutralizeEffect'];
    if (!validSingleEffectTypes.includes(selection.effectType)) {
        console.log(`❌ Invalid effect type for single targeting: ${selection.effectType}`);
        throw new Error(`Invalid effect type for single targeting: ${selection.effectType}`);
    }

    // Create SelectCard action for mozGamePlay
    const selectCardAction = {
        type: 'SelectCard',
        selectionId: selectionId,
        selectedCardIds: selectedCardIds
    };

    // Process through mozGamePlay with the new routing system
    return await this.mozGamePlay.processAction(gameEnv, selection.playerId, selectCardAction);
}

// =======================================================================================
// 🔧 SELECTION VALIDATION UTILITIES
// =======================================================================================

/**
 * 🔍 VALIDATE SELECTION REQUEST
 * 
 * Comprehensive validation for selection requests
 */
validateSelectionRequest(selectionId, selectedCardIds, playerId, gameId) {
    const errors = [];

    if (!selectionId || typeof selectionId !== 'string') {
        errors.push('selectionId must be a non-empty string');
    }

    if (!Array.isArray(selectedCardIds)) {
        errors.push('selectedCardIds must be an array');
    } else if (selectedCardIds.length === 0) {
        errors.push('selectedCardIds cannot be empty');
    } else {
        // Validate each card ID is a string
        for (let i = 0; i < selectedCardIds.length; i++) {
            if (typeof selectedCardIds[i] !== 'string') {
                errors.push(`selectedCardIds[${i}] must be a string`);
            }
        }
    }

    if (!playerId || typeof playerId !== 'string') {
        errors.push('playerId must be a non-empty string');
    }

    if (!gameId || typeof gameId !== 'string') {
        errors.push('gameId must be a non-empty string');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * 📊 LOG SELECTION STATISTICS
 * 
 * Logs detailed statistics about selection for debugging
 */
logSelectionStatistics(selection, selectedCardIds) {
    console.log(`📊 Selection Statistics:`, {
        selectionType: selection.selectionType,
        effectType: selection.effectType,
        expectedCount: selection.selectCount,
        actualCount: selectedCardIds.length,
        eligibleOptionsCount: selection.eligibleCards?.length || 0,
        playerId: selection.playerId,
        timestamp: new Date().toISOString()
    });
}

// =======================================================================================
// 🎯 SELECTION TYPE DETECTION UTILITIES
// =======================================================================================

/**
 * 🔍 DETECT SELECTION TYPE FROM EFFECT
 * 
 * Helper method to determine selection type from card effect rules
 * This can be used when creating selections to ensure proper typing
 */
detectSelectionTypeFromEffect(effectRule) {
    // Deck search selection: has searchCard effect type
    if (effectRule.effect?.type === 'searchCard') {
        return 'deckSearch';
    }

    // Field target selection: has requiresSelection in target
    if (effectRule.target?.requiresSelection === true) {
        return 'fieldTarget';
    }

    // Single target selection: has targetCount in target
    if (effectRule.target?.targetCount === 1) {
        return 'singleTarget';
    }

    // Default fallback
    console.log(`⚠️ Could not detect selection type from effect rule:`, effectRule);
    return 'unknown';
}

/**
 * 🎯 CREATE SELECTION DATA TEMPLATE
 * 
 * Creates a properly structured selection data object
 */
createSelectionDataTemplate(selectionType, playerId, effectRule) {
    const baseTemplate = {
        selectionId: `selection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        selectionType: selectionType,
        playerId: playerId,
        createdAt: Date.now(),
        eligibleCards: [],
        selectCount: 1
    };

    switch (selectionType) {
        case 'deckSearch':
            return {
                ...baseTemplate,
                searchCount: effectRule.effect?.searchCount || 5,
                selectCount: effectRule.effect?.selectCount || 1,
                destination: effectRule.effect?.destination || 'hand',
                filters: effectRule.effect?.filters || [],
                searchedCards: []
            };

        case 'fieldTarget':
            return {
                ...baseTemplate,
                selectCount: effectRule.target?.selectCount || 1,
                targetZones: effectRule.target?.zones || [],
                effectType: effectRule.effect?.type || 'unknown',
                filters: effectRule.target?.filters || []
            };

        case 'singleTarget':
            return {
                ...baseTemplate,
                selectCount: 1, // Always 1 for single target
                targetZones: effectRule.target?.zones || [],
                effectType: effectRule.effect?.type || 'powerBoost',
                filters: effectRule.target?.filters || []
            };

        default:
            return baseTemplate;
    }
}

module.exports = {
    selectCard,
    processDeckSearchSelection,
    processFieldTargetSelection,
    processSingleTargetSelection,
    validateSelectionRequest,
    logSelectionStatistics,
    detectSelectionTypeFromEffect,
    createSelectionDataTemplate
};