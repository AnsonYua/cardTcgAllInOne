// =======================================================================================
// 🎯 CARD ACTION HANDLER - Clean Class Implementation for Card Placement Logic
// =======================================================================================
//
// This class handles ALL card placement and validation logic with clear switch-case routing.
// Extracted from the massive mozGamePlay.js for better maintainability.
//
// Key Features:
// - Comprehensive card placement validation with multi-layered checks
// - Face-down card mechanics with complete restriction bypass
// - Zone compatibility enforcement with leader restrictions
// - Phase-based placement rules (MAIN_PHASE vs SP_PHASE)
// - Card type validation (character, help, SP cards)
// - Immediate effect processing for character and help cards
// - Event generation for frontend synchronization
//
// Validation Layers:
// 1. Basic Validation: Position bounds, card index, card existence
// 2. Advanced Restrictions: Leader effects, card effects, zone compatibility
// 3. Phase Validation: Phase-specific rules for SP cards and face-down placement
// 4. Card Type Validation: Type-specific zone restrictions and occupancy rules
//
// Card Placement Flow:
// 1. validateBasicPlacement() - Position, hand index, card existence
// 2. validateAdvancedRestrictions() - Leader restrictions, field effects
// 3. validatePhaseRestrictions() - Phase-based rules for SP/face-down cards
// 4. validateCardTypeRestrictions() - Type-specific zone and occupancy rules
// 5. executeCardPlacement() - State update and field placement
// 6. processImmediateEffects() - Card effects and selection requirements
//
// =======================================================================================

const mozDeckHelper = require('../mozGame/mozDeckHelper');

// TurnPhase constants (defined inline in mozGamePlay.js)
const TurnPhase = {
    START_REDRAW: 'START_REDRAW',
    DRAW_PHASE: 'DRAW_PHASE',
    MAIN_PHASE: 'MAIN_PHASE',
    SP_PHASE: 'SP_PHASE',
    BATTLE_PHASE: 'BATTLE_PHASE',
    END_PHASE: 'END_PHASE',
    GAME_END: 'GAME_END'
};

/**
 * CardActionHandler - Manages card placement and validation logic
 * 
 * Responsibilities:
 * - Multi-layered card placement validation
 * - Face-down card mechanics and restrictions
 * - Zone compatibility and occupancy enforcement
 * - Phase-based placement rules
 * - Card type-specific validation
 * - Field state updates and action tracking
 * - Immediate effect processing
 */
class CardActionHandler {
    constructor(mozGamePlay) {
        this.mozGamePlay = mozGamePlay;
        
        // Bind required methods from mozGamePlay for clean delegation
        this.getPlayerHand = mozGamePlay.getPlayerHand.bind(mozGamePlay);
        this.setPlayerHand = mozGamePlay.setPlayerHand.bind(mozGamePlay);
        this.getPlayerData = mozGamePlay.getPlayerData.bind(mozGamePlay);
        this.monsterInField = mozGamePlay.monsterInField.bind(mozGamePlay);
        this.addGameEvent = mozGamePlay.addGameEvent.bind(mozGamePlay);
        this.addErrorEvent = mozGamePlay.addErrorEvent.bind(mozGamePlay);
        this.throwError = mozGamePlay.throwError.bind(mozGamePlay);
        this.processCharacterSummonEffects = mozGamePlay.processCharacterSummonEffects.bind(mozGamePlay);
        this.processUtilityCardEffects = mozGamePlay.processUtilityCardEffects.bind(mozGamePlay);
        
        // Import required utilities
        this.fieldEffectProcessor = mozGamePlay.fieldEffectProcessor;
        
        // Position mapping for consistent zone handling
        this.POSITION_DICT = ["top", "left", "right", "help", "sp"];
        
        console.log('🎯 CardActionHandler: Initialized with comprehensive card placement logic');
    }

    // =======================================================================================
    // 🎯 Main Card Action Processing - Entry Point for PlayCard/PlayCardBack
    // =======================================================================================

    /**
     * Process PlayCard or PlayCardBack actions with comprehensive validation
     * Main entry point for all card placement logic
     */
    async handleCardPlayAction(gameEnv, playerId, action) {
        console.log(`🎯 CardActionHandler: Processing ${action.type} action for player ${playerId}`);
        
        // Determine if this is a face-down placement
        const isPlayInFaceDown = action.type === "PlayCardBack";
        console.log(`🎯 Face-down placement: ${isPlayInFaceDown}`);
        
        try {
            // VALIDATION PIPELINE: Multi-layered validation with early exits
            
            // Layer 1: Basic placement validation
            const basicValidation = await this.validateBasicPlacement(gameEnv, playerId, action);
            if (!basicValidation.isValid) {
                return this.throwError(basicValidation.error);
            }
            
            const { playPos, cardDetails, hand } = basicValidation.data;
            
            // Layer 2: Advanced restrictions (only for face-up cards)
            if (!isPlayInFaceDown) {
                const advancedValidation = await this.validateAdvancedRestrictions(gameEnv, playerId, cardDetails, playPos);
                if (!advancedValidation.isValid) {
                    return this.throwError(advancedValidation.error);
                }
            }
            
            // Layer 3: Phase-based restrictions
            const phaseValidation = await this.validatePhaseRestrictions(gameEnv, playPos, isPlayInFaceDown);
            if (!phaseValidation.isValid) {
                return this.throwError(phaseValidation.error);
            }
            
            // Layer 4: Card type-specific restrictions (only for face-up cards)
            if (!isPlayInFaceDown) {
                const typeValidation = await this.validateCardTypeRestrictions(gameEnv, playerId, cardDetails, playPos);
                if (!typeValidation.isValid) {
                    return this.throwError(typeValidation.error);
                }
            }
            
            // EXECUTION PIPELINE: State updates and effect processing
            
            // Execute card placement and update game state
            const placementResult = await this.executeCardPlacement(gameEnv, playerId, action, cardDetails, playPos, isPlayInFaceDown, hand);
            
            // Process immediate effects (only for face-up, non-SP cards)
            const effectResult = await this.processImmediateEffects(gameEnv, playerId, cardDetails, playPos, isPlayInFaceDown);
            
            // Return effect result if card selection is required, otherwise return updated game state
            return effectResult || gameEnv;
            
        } catch (error) {
            console.error(`🎯 CardActionHandler: Error processing card play:`, error);
            this.addErrorEvent(gameEnv, 'CARD_ACTION_ERROR', error.message, playerId);
            return this.throwError(error.message);
        }
    }

    // =======================================================================================
    // 🎯 Validation Layer 1 - Basic Placement Validation
    // =======================================================================================

    /**
     * Validate basic placement requirements: position bounds, card index, card existence
     */
    async validateBasicPlacement(gameEnv, playerId, action) {
        console.log(`🎯 CardActionHandler: Validating basic placement for action:`, action);
        
        // Validate field position index (0-4 for top, left, right, help, sp)
        if (action.field_idx >= this.POSITION_DICT.length) {
            this.addErrorEvent(gameEnv, 'INVALID_POSITION', "position out of range", playerId);
            return { isValid: false, error: "position out of range" };
        }
        
        const playPos = this.POSITION_DICT[action.field_idx];
        const hand = [...this.getPlayerHand(gameEnv, playerId)];
        
        // Validate card index in hand (prevent playing non-existent cards)
        if (action.card_idx >= hand.length) {
            this.addErrorEvent(gameEnv, 'INVALID_CARD_INDEX', "hand card out of range", playerId);
            return { isValid: false, error: "hand card out of range" };
        }
        
        // Get card details from deck manager
        const cardToPlay = hand[action.card_idx];
        const cardDetails = mozDeckHelper.getDeckCardDetails(cardToPlay);
        
        if (!cardDetails) {
            this.addErrorEvent(gameEnv, 'CARD_NOT_FOUND', "Card not found", playerId);
            return { isValid: false, error: "Card not found" };
        }
        
        console.log(`🎯 Basic validation passed - Position: ${playPos}, Card: ${cardDetails.name}`);
        
        return {
            isValid: true,
            data: { playPos, cardDetails, hand }
        };
    }

    // =======================================================================================
    // 🎯 Validation Layer 2 - Advanced Placement Restrictions
    // =======================================================================================

    /**
     * Validate advanced restrictions: leader effects, field effects, card restrictions
     * Only applies to face-up cards (face-down cards bypass all restrictions)
     */
    async validateAdvancedRestrictions(gameEnv, playerId, cardDetails, playPos) {
        console.log(`🎯 CardActionHandler: Validating advanced restrictions for ${cardDetails.name} in ${playPos}`);
        
        // 1. Basic card type validation
        if (cardDetails.cardType === 'character') {
            // Characters can only be placed in battle zones (top, left, right)
            if (playPos === 'help' || playPos === 'sp') {
                this.addErrorEvent(gameEnv, 'ZONE_COMPATIBILITY_ERROR', `Character cards cannot be placed in ${playPos} position`, playerId);
                return { isValid: false, error: `Character cards cannot be placed in ${playPos} position` };
            }
        }
        
        // 2. Leader zone restrictions validation (unified field effects system)
        const fieldEffectCheck = await this.fieldEffectProcessor.validateCardPlacementWithFieldEffects(
            gameEnv,
            playerId,
            cardDetails,
            playPos
        );
        
        if (!fieldEffectCheck.canPlace) {
            this.addErrorEvent(gameEnv, 'FIELD_EFFECT_RESTRICTION', fieldEffectCheck.reason, playerId);
            return { isValid: false, error: fieldEffectCheck.reason };
        }
        
        // 3. Check card effect restrictions from existing field cards
        const restrictionCheck = await this.validateCardEffectRestrictions(gameEnv, playerId, cardDetails, playPos);
        if (!restrictionCheck.isValid) {
            return restrictionCheck;
        }
        
        console.log(`🎯 Advanced restrictions validation passed`);
        return { isValid: true };
    }

    /**
     * Check for placement restrictions from existing field cards
     */
    async validateCardEffectRestrictions(gameEnv, playerId, cardDetails, playPos) {
        const { getPlayerField } = require('../utils/gameUtils');
        const playerField = getPlayerField(gameEnv, playerId);
        
        if (!playerField) return { isValid: true };
        
        // Check help card restrictions
        const helpCards = playerField.help || [];
        for (const helpCard of helpCards) {
            const cardData = this.extractCardData(helpCard);
            if (cardData && this.hasPlacementRestrictions(cardData)) {
                // TODO: Implement proper rule evaluation when needed
                // For now, help cards don't block placement
                console.log(`Found potential placement restriction in help card ${cardData.name}`);
            }
        }
        
        // Check character card restrictions in target zone
        const characterCards = playerField[playPos] || [];
        for (const characterCard of characterCards) {
            const cardData = this.extractCardData(characterCard);
            if (cardData && this.hasPlacementRestrictions(cardData)) {
                // TODO: Implement proper rule evaluation when needed
                // For now, character cards don't block placement in same zone
                console.log(`Found potential placement restriction in character card ${cardData.name}`);
            }
        }
        
        return { isValid: true };
    }

    /**
     * Extract card data from field card structure (handles both legacy and new formats)
     */
    extractCardData(fieldCard) {
        if (fieldCard.cardDetails && Array.isArray(fieldCard.cardDetails) && fieldCard.cardDetails.length > 0) {
            return fieldCard.cardDetails[0];
        } else if (fieldCard.id) {
            return fieldCard;
        }
        return null;
    }

    /**
     * Check if a card has placement restriction effects
     */
    hasPlacementRestrictions(cardData) {
        if (!cardData.effects || !cardData.effects.rules) return false;
        
        return cardData.effects.rules.some(rule => 
            rule.effect && rule.effect.type === 'preventPlay'
        );
    }

    // =======================================================================================
    // 🎯 Validation Layer 3 - Phase-Based Restrictions
    // =======================================================================================

    /**
     * Validate phase-specific placement rules for SP zone and face-down cards
     */
    async validatePhaseRestrictions(gameEnv, playPos, isPlayInFaceDown) {
        console.log(`🎯 CardActionHandler: Validating phase restrictions - Phase: ${gameEnv.phase}, Position: ${playPos}, FaceDown: ${isPlayInFaceDown}`);
        
        if (isPlayInFaceDown) {
            // Face-down placement rules
            // Phase restriction: No face-down cards in SP zone during MAIN_PHASE
            if (gameEnv.phase !== TurnPhase.SP_PHASE && playPos === "sp") {
                this.addErrorEvent(gameEnv, 'PHASE_RESTRICTION_ERROR', "Cannot play face-down cards in SP zone during MAIN_PHASE", null);
                return { isValid: false, error: "Cannot play face-down cards in SP zone during MAIN_PHASE" };
            }
        } else {
            // Face-up placement rules
            // SP zone enforcement: During SP_PHASE, SP zone cards MUST be played face-down
            if (gameEnv.phase === TurnPhase.SP_PHASE && playPos === "sp") {
                this.addErrorEvent(gameEnv, 'SP_PHASE_RESTRICTION', "Cards in SP zone must be played face-down during SP phase", null);
                return { isValid: false, error: "Cards in SP zone must be played face-down during SP phase" };
            }
        }
        
        console.log(`🎯 Phase restrictions validation passed`);
        return { isValid: true };
    }

    // =======================================================================================
    // 🎯 Validation Layer 4 - Card Type-Specific Restrictions
    // =======================================================================================

    /**
     * Validate card type-specific zone restrictions and occupancy rules
     * Only applies to face-up cards
     */
    async validateCardTypeRestrictions(gameEnv, playerId, cardDetails, playPos) {
        console.log(`🎯 CardActionHandler: Validating card type restrictions - Type: ${cardDetails.cardType}, Position: ${playPos}`);
        
        const { getPlayerField } = require('../utils/gameUtils');
        const playerField = getPlayerField(gameEnv, playerId);
        
        switch (cardDetails.cardType) {
            case "character":
                return await this.validateCharacterCardRestrictions(gameEnv, playerId, playPos, playerField);
                
            case "help":
                return await this.validateHelpCardRestrictions(gameEnv, playerId, playPos, playerField);
                
            case "sp":
                return await this.validateSpCardRestrictions(gameEnv, playerId, playPos, playerField);
                
            default:
                console.log(`🎯 Unknown card type: ${cardDetails.cardType}, allowing placement`);
                return { isValid: true };
        }
    }

    /**
     * Validate character card specific restrictions
     */
    async validateCharacterCardRestrictions(gameEnv, playerId, playPos, playerField) {
        // Character cards can only go in battle zones (top/left/right)
        if (playPos === "help" || playPos === "sp") {
            this.addErrorEvent(gameEnv, 'CARD_TYPE_ZONE_ERROR', "Can't play character card in utility zones", playerId);
            return { isValid: false, error: "Can't play character card in utility zones" };
        }
        
        // Ensure only one character per zone (no stacking)
        if (playPos === "top" || playPos === "left" || playPos === "right") {
            if (await this.monsterInField(playerField[playPos])) {
                this.addErrorEvent(gameEnv, 'ZONE_OCCUPIED_ERROR', "Character already in this position", playerId);
                return { isValid: false, error: "Character already in this position" };
            }
        }
        
        return { isValid: true };
    }

    /**
     * Validate help card specific restrictions
     */
    async validateHelpCardRestrictions(gameEnv, playerId, playPos, playerField) {
        // Help cards can only be played in help zone
        if (playPos !== "help") {
            this.addErrorEvent(gameEnv, 'CARD_TYPE_ZONE_ERROR', "Help cards can only be played in help zone", playerId);
            return { isValid: false, error: "Help cards can only be played in help zone" };
        }
        
        // Only one help card allowed per player
        if (playerField[playPos].length > 0) {
            this.addErrorEvent(gameEnv, 'ZONE_OCCUPIED_ERROR', "Help zone already occupied", playerId);
            return { isValid: false, error: "Help zone already occupied" };
        }
        
        return { isValid: true };
    }

    /**
     * Validate SP card specific restrictions
     */
    async validateSpCardRestrictions(gameEnv, playerId, playPos, playerField) {
        // SP cards can only be played during SP_PHASE
        if (gameEnv.phase !== TurnPhase.SP_PHASE) {
            this.addErrorEvent(gameEnv, 'PHASE_RESTRICTION_ERROR', "SP cards can only be played during SP phase", playerId);
            return { isValid: false, error: "SP cards can only be played during SP phase" };
        }
        
        // SP cards can only be played in SP zone
        if (playPos !== "sp") {
            this.addErrorEvent(gameEnv, 'CARD_TYPE_ZONE_ERROR', "SP cards can only be played in SP zone", playerId);
            return { isValid: false, error: "SP cards can only be played in SP zone" };
        }
        
        // Only one SP card allowed per player
        if (playerField[playPos].length > 0) {
            this.addErrorEvent(gameEnv, 'ZONE_OCCUPIED_ERROR', "SP zone already occupied", playerId);
            return { isValid: false, error: "SP zone already occupied" };
        }
        
        return { isValid: true };
    }

    // =======================================================================================
    // 🎯 Card Placement Execution - State Updates and Field Placement
    // =======================================================================================

    /**
     * Execute the actual card placement and update game state
     */
    async executeCardPlacement(gameEnv, playerId, action, cardDetails, playPos, isPlayInFaceDown, hand) {
        console.log(`🎯 CardActionHandler: Executing card placement - ${cardDetails.name} in ${playPos} (faceDown: ${isPlayInFaceDown})`);
        
        // Create card object for field placement with all necessary metadata
        const cardObj = {
            "card": hand.splice(action.card_idx, 1),        // Remove card from hand
            "cardDetails": [cardDetails],                    // Store card data for effects
            "isBack": [isPlayInFaceDown],                   // Track if face down (for battle calculations)
            "valueOnField": isPlayInFaceDown ? 0 : cardDetails.power  // Power for calculations (face-down = 0)
        };
        
        // Update game state with card placement
        const { getPlayerData, getPlayerField } = require('../utils/gameUtils');
        const playerData = getPlayerData(gameEnv, playerId);
        const playerField = getPlayerField(gameEnv, playerId);
        
        // Update player hand and field
        this.setPlayerHand(gameEnv, playerId, hand);   // Update hand (card removed)
        playerField[playPos].push(cardObj);            // Place card on field
        
        // Record action in turn history
        action.selectedCard = cardObj;                     // Track action details for history
        action.turn = gameEnv.currentTurn;
        this.getPlayerData(gameEnv, playerId).turnAction.push(action);
        
        // Generate events for frontend synchronization
        this.generatePlacementEvents(gameEnv, playerId, cardDetails, playPos, isPlayInFaceDown);
        
        console.log(`🎯 Card placement executed successfully`);
        return gameEnv;
    }

    /**
     * Generate events for successful card placement
     */
    generatePlacementEvents(gameEnv, playerId, cardDetails, playPos, isPlayInFaceDown) {
        // Add successful card placement event for frontend updates
        this.addGameEvent(gameEnv, 'CARD_PLAYED', {
            playerId: playerId,
            card: {
                cardId: cardDetails.cardId,
                name: cardDetails.name,
                cardType: cardDetails.cardType,
                power: cardDetails.power,
                gameType: cardDetails.gameType,
                traits: cardDetails.traits || []
            },
            zone: playPos,
            isFaceDown: isPlayInFaceDown,
            turn: gameEnv.currentTurn
        });
        
        // Add zone filled event for UI updates
        this.addGameEvent(gameEnv, 'ZONE_FILLED', {
            playerId: playerId,
            zone: playPos,
            cardType: cardDetails.cardType,
            isFaceDown: isPlayInFaceDown
        });
    }

    // =======================================================================================
    // 🎯 Immediate Effect Processing - Card Effects and Selection Requirements
    // =======================================================================================

    /**
     * Process immediate card effects for face-up, non-SP cards
     */
    async processImmediateEffects(gameEnv, playerId, cardDetails, playPos, isPlayInFaceDown) {
        console.log(`🎯 CardActionHandler: Processing immediate effects - FaceDown: ${isPlayInFaceDown}, Position: ${playPos}`);
        
        // Skip effect processing for face-down cards or SP zone cards
        if (isPlayInFaceDown || playPos === "sp") {
            console.log(`🎯 Skipping effect processing (faceDown: ${isPlayInFaceDown}, SP zone: ${playPos === "sp"})`);
            return null;
        }
        
        let effectResult = null;
        
        // Process card type-specific effects
        switch (cardDetails.cardType) {
            case "character":
                // Character summon effects (e.g., draw cards, search deck, boost power)
                effectResult = await this.processCharacterSummonEffects(gameEnv, playerId, cardDetails);
                break;
                
            case "help":
                // Help card play effects (e.g., discard opponent cards, boost power, search)
                effectResult = await this.processUtilityCardEffects(gameEnv, playerId, cardDetails);
                break;
                
            default:
                console.log(`🎯 No immediate effects for card type: ${cardDetails.cardType}`);
                break;
        }
        
        // Generate effect events and handle card selection requirements
        if (effectResult) {
            this.addGameEvent(gameEnv, 'CARD_EFFECT_TRIGGERED', {
                playerId: playerId,
                cardId: cardDetails.cardId,
                cardName: cardDetails.name,
                effectType: cardDetails.cardType === "character" ? "onSummon" : "onPlay",
                requiresSelection: effectResult.requiresCardSelection || false
            });
            
            // Handle card selection requirements
            if (effectResult.requiresCardSelection) {
                this.addGameEvent(gameEnv, 'CARD_SELECTION_REQUIRED', {
                    playerId: playerId,
                    selectionId: effectResult.cardSelection.selectionId,
                    eligibleCardCount: effectResult.cardSelection.eligibleCards.length,
                    selectCount: effectResult.cardSelection.selectCount,
                    cardTypeFilter: effectResult.cardSelection.cardTypeFilter
                });
                
                console.log(`🎯 Card selection required - blocking further actions`);
                return effectResult; // Block further actions until selection is completed
            }
        }
        
        console.log(`🎯 Immediate effects processing completed`);
        return null; // No blocking required
    }
}

module.exports = CardActionHandler;