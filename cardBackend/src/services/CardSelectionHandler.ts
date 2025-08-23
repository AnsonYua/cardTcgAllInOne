/**
 * CardSelectionHandler.ts - Type-safe card selection system
 * 
 * Handles ALL card selection workflows with clear switch-case routing and
 * full integration with the dynamic selectionType system from EnhancedEffectManager.
 * 
 * Key improvements over JS version:
 * - Full TypeScript type safety
 * - Integration with ActiveEffect classes
 * - Simplified selection type handling (trusts dynamic selectionType)
 * - Unified card data structures
 * - Better error handling
 */

import { EventType, GameEnvironment } from '../models/GameEnvironment';
import { ActiveEffect } from '../models/ActiveEffect';
import PostActionHandler, { ActionContext, PostActionResult } from './PostActionHandler';
import { 
    CardSelectionData, 
    EligibleCard, 
    CardDetails, 
    SelectCardAction, 
    CardSelectionResult, 
    SelectionValidation,
    SelectionType,
    EffectType,
    Zone,
    Destination,
    ActiveEffectData
} from '../models/CardSelection';

// Import PlayerStateManager for deck/hand access
const PlayerStateManager = require('../utils/PlayerStateManager');

class CardSelectionHandler {
    private mozGamePlay: any;
    public postActionHandler: PostActionHandler;
    private getPlayerField: (gameEnv: GameEnvironment, playerId: string) => any;
    private addGameEvent: (gameEnv: GameEnvironment, eventType: string, data: any) => void;
    private addErrorEvent: (gameEnv: GameEnvironment, eventType: string, message: string, playerId: string) => void;

    constructor(mozGamePlay: any, gameId?: string) {
        this.mozGamePlay = mozGamePlay;
        
        // Unified architecture: PostActionHandler → mozGamePlay → OptimizedGameEngine
        // mozGamePlay now handles delegation to OptimizedGameEngine internally
        this.postActionHandler = new PostActionHandler(mozGamePlay);
        console.log('🎯 CardSelectionHandler: Initialized with unified delegation architecture');
        
        // Use PlayerStateManager static methods directly instead of binding non-existent mozGamePlay methods
        this.getPlayerField = mozGamePlay.getPlayerField?.bind(mozGamePlay) || (() => ({}));
        this.addGameEvent = mozGamePlay.addGameEvent?.bind(mozGamePlay) || (() => {});
        this.addErrorEvent = mozGamePlay.addErrorEvent?.bind(mozGamePlay) || (() => {});
    }

    /**
     * Main card selection handler - routes to appropriate selection type
     * Now with full type safety and simplified selection type handling
     */
    async handleSelectCardAction(gameEnv: GameEnvironment, playerId: string, action: SelectCardAction): Promise<CardSelectionResult> {
        console.log(`🎯 CardSelectionHandler: Routing SelectCard action for player: ${playerId}`);
        
        // Validate required parameters
        const selectedCardIdentifiers = action.selectedCardUIds;
        if (!action.selectionId || !selectedCardIdentifiers) {
            this.addErrorEvent(gameEnv, 'INVALID_SELECTION_DATA', 
                'Missing required selection parameters', playerId);
            return this.createErrorResult('Missing required selection parameters');
        }

        // Get selection details
        const selection = gameEnv.pendingCardSelections?.[action.selectionId];
        if (!selection) {
            this.addErrorEvent(gameEnv, 'INVALID_SELECTION_ID', 
                'Invalid or expired card selection', playerId);
            return this.createErrorResult('Invalid or expired card selection');
        }

        // Trust the dynamic selectionType from EnhancedEffectManager
        // No need for complex inference logic - our dynamic system handles this
        const selectionType = selection.selectionType;
        if (!selectionType) {
            this.addErrorEvent(gameEnv, 'MISSING_SELECTION_TYPE', 
                'Selection type not provided by dynamic system', playerId);
            return this.createErrorResult('Selection type not provided by dynamic system');
        }
        
        console.log(`🎯 Dynamic selection type: ${selectionType}`);

        // Route to appropriate handler based on dynamic selection type
        switch (selectionType) {
            case SelectionType.DECK_SEARCH:
            case 'deckSearch':
                console.log(`📦 Routing to deck search selection handler`);
                return await this.handleDeckSearchSelection(gameEnv, action.selectionId, selectedCardIdentifiers);

            case SelectionType.FIELD_TARGET:
            case 'fieldTarget':
                console.log(`🎯 Routing to field target selection handler`);
                return await this.handleFieldTargetSelection(gameEnv, action.selectionId, selectedCardIdentifiers);

            case SelectionType.SINGLE_TARGET:
            case SelectionType.TARGET_SELECTION:
            case 'SingleTargetSelection':
            case 'targetSelection':
                console.log(`🎯1111Routing to single target selection handler`);
                return await this.handleSingleTargetSelection(gameEnv, action.selectionId, selectedCardIdentifiers);

            case SelectionType.SP_SEARCH:
            case 'spSearch':
                console.log(`🌟 Routing to SP search selection handler`);
                return await this.handleSpSearchSelection(gameEnv, action.selectionId, selectedCardIdentifiers);

            case SelectionType.HELP_SEARCH:  
            case 'helpSearch':
                console.log(`🆘 Routing to help search selection handler`);
                return await this.handleHelpSearchSelection(gameEnv, action.selectionId, selectedCardIdentifiers);

            case SelectionType.CHARACTER_SEARCH:
            case 'characterSearch':
                console.log(`👤 Routing to character search selection handler`);
                return await this.handleCharacterSearchSelection(gameEnv, action.selectionId, selectedCardIdentifiers);

            default:
                console.log(`❌ Unknown selection type: ${selectionType}`);
                this.addErrorEvent(gameEnv, 'INVALID_SELECTION_TYPE', 
                    `Unknown selection type: ${selectionType}`, playerId);
                return this.createErrorResult(`Unknown selection type: ${selectionType}`);
        }
    }

    /**
     * Handle deck search selection with type safety
     */
    private async handleDeckSearchSelection(gameEnv: GameEnvironment, selectionId: string, selectedCardIdentifiers: string[]): Promise<CardSelectionResult> {
        console.log(`📦 CardSelectionHandler: Processing deck search selection: ${selectionId}`);
        
        const selection = gameEnv.pendingCardSelections?.[selectionId];
        if (!selection) {
            return this.createErrorResult('Selection not found');
        }

        const { playerId, selectCount, effect } = selection;

        // Validate selection count
        if (selectedCardIdentifiers.length !== selectCount) {
            this.addErrorEvent(gameEnv, 'INVALID_SELECTION_COUNT', 
                `Must select exactly ${selectCount} cards`, playerId);
            return this.createErrorResult(`Must select exactly ${selectCount} cards`);
        }

        // Validate card choices
        const validation = this.validateCardSelection(selectedCardIdentifiers, selection.eligibleCards);
        if (!validation.valid) {
            this.addErrorEvent(gameEnv, 'INVALID_CARD_SELECTION', 
                `Invalid card selection: ${validation.invalidCard}`, playerId);
            return this.createErrorResult(`Invalid card selection: ${validation.invalidCard}`);
        }

        // Route to destination handler
        console.log(`📦 Destination: ${effect.destination}`);
        
        switch (effect.destination) {
            case Destination.HAND:
            case 'hand':
                return await this.moveDeckSearchCardsToHand(gameEnv, selectionId, selectedCardIdentifiers);

            case Destination.SP_ZONE:
            case 'spZone':
                return await this.moveDeckSearchCardsToSpZone(gameEnv, selectionId, selectedCardIdentifiers);

            case Destination.HELP_ZONE:
            case 'helpZone':
                return await this.moveDeckSearchCardsToHelpZone(gameEnv, selectionId, selectedCardIdentifiers);

            default:
                this.addErrorEvent(gameEnv, 'INVALID_DESTINATION', 
                    `Unknown destination: ${effect.destination}`, playerId);
                return this.createErrorResult(`Unknown destination: ${effect.destination}`);
        }
    }

    /**
     * Handle field target selection with type safety
     */
    private async handleFieldTargetSelection(gameEnv: GameEnvironment, selectionId: string, selectedCardIdentifiers: string[]): Promise<CardSelectionResult> {
        console.log(`🎯 CardSelectionHandler: Processing field target selection: ${selectionId}`);
        
        const selection = gameEnv.pendingCardSelections?.[selectionId];
        if (!selection) {
            return this.createErrorResult('Selection not found');
        }

        const { playerId, selectCount, effectType } = selection;

        // Validate selection count
        if (selectedCardIdentifiers.length !== selectCount) {
            this.addErrorEvent(gameEnv, 'INVALID_SELECTION_COUNT', 
                `Must select exactly ${selectCount} cards`, playerId);
            return this.createErrorResult(`Must select exactly ${selectCount} cards`);
        }

        // Validate card choices
        const validation = this.validateCardSelection(selectedCardIdentifiers, selection.eligibleCards);
        if (!validation.valid) {
            this.addErrorEvent(gameEnv, 'INVALID_CARD_SELECTION', 
                `Invalid card selection: ${validation.invalidCard}`, playerId);
            return this.createErrorResult(`Invalid card selection: ${validation.invalidCard}`);
        }

        // Route to effect handler
        console.log(`🎯 Effect type: ${effectType}`);
        
        switch (effectType) {
            case EffectType.NEUTRALIZE_EFFECT:
            case 'neutralizeEffect':
                return await this.applyNeutralizationEffect(gameEnv, selectionId, selectedCardIdentifiers);

            case EffectType.SET_POWER:
            case 'setPower':
                return await this.applySetPowerEffect(gameEnv, selectionId, selectedCardIdentifiers);

            default:
                this.addErrorEvent(gameEnv, 'INVALID_EFFECT_TYPE', 
                    `Unknown effect type: ${effectType}`, playerId);
                return this.createErrorResult(`Unknown effect type: ${effectType}`);
        }
    }

    /**
     * Handle single target selection with type safety and ActiveEffect integration
     */
    private async handleSingleTargetSelection(gameEnv: GameEnvironment, selectionId: string, selectedCardIdentifiers: string[]): Promise<CardSelectionResult> {
        console.log(`🎯 CardSelectionHandler: Processing single target selection: ${selectionId}`);
        
        const selection = gameEnv.pendingCardSelections?.[selectionId];
        if (!selection) {
            return this.createErrorResult('Selection not found');
        }

        const { playerId, effectType } = selection;

        // Validate exactly one selection
        if (selectedCardIdentifiers.length !== 1) {
            this.addErrorEvent(gameEnv, 'INVALID_SELECTION_COUNT', 
                'Must select exactly 1 target', playerId);
            return this.createErrorResult('Must select exactly 1 target');
        }

        // Validate card choice
        const validation = this.validateCardSelection(selectedCardIdentifiers, selection.eligibleCards);
        if (!validation.valid) {
            this.addErrorEvent(gameEnv, 'INVALID_CARD_SELECTION', 
                `Invalid card selection: ${validation.invalidCard}`, playerId);
            return this.createErrorResult(`Invalid card selection: ${validation.invalidCard}`);
        }

        const selectedCardId = selectedCardIdentifiers[0];

        // Route to effect handler with ActiveEffect integration
        switch (effectType) {
            case EffectType.POWER_BOOST:
            case 'powerBoost':
                return await this.applySingleTargetPowerBoost(gameEnv, selectionId, selectedCardId);

            case EffectType.POWER_NERF:
            case 'powerNerf':
                return await this.applySingleTargetPowerNerf(gameEnv, selectionId, selectedCardId);

            default:
                this.addErrorEvent(gameEnv, 'INVALID_EFFECT_TYPE', 
                    `Unknown effect type: ${effectType}`, playerId);
                return this.createErrorResult(`Unknown effect type: ${effectType}`);
        }
    }

    /**
     * Handle SP search selection (Edward's effect)
     */
    private async handleSpSearchSelection(gameEnv: GameEnvironment, selectionId: string, selectedCardIdentifiers: string[]): Promise<CardSelectionResult> {
        console.log(`🌟 CardSelectionHandler: Processing SP search selection: ${selectionId}`);
        return await this.moveDeckSearchCardsToSpZone(gameEnv, selectionId, selectedCardIdentifiers);
    }

    /**
     * Handle help search selection (Luke's effect)
     */
    private async handleHelpSearchSelection(gameEnv: GameEnvironment, selectionId: string, selectedCardIdentifiers: string[]): Promise<CardSelectionResult> {
        console.log(`🆘 CardSelectionHandler: Processing help search selection: ${selectionId}`);
        return await this.moveDeckSearchCardsToHelpZone(gameEnv, selectionId, selectedCardIdentifiers);
    }

    /**
     * Handle character search selection (utility card effects)
     */
    private async handleCharacterSearchSelection(gameEnv: GameEnvironment, selectionId: string, selectedCardIdentifiers: string[]): Promise<CardSelectionResult> {
        console.log(`👤 CardSelectionHandler: Processing character search selection: ${selectionId}`);
        return await this.moveDeckSearchCardsToHand(gameEnv, selectionId, selectedCardIdentifiers);
    }

    /**
     * Apply single target power boost using ActiveEffect integration
     */
    private async applySingleTargetPowerBoost(gameEnv: GameEnvironment, selectionId: string, selectedCardId: string): Promise<CardSelectionResult> {
        console.log(`⚡ CardSelectionHandler: Applying power boost to: ${selectedCardId}`);
        
        const selection = gameEnv.pendingCardSelections?.[selectionId];
        if (!selection) {
            return this.createErrorResult('Selection not found');
        }

        const { effect, playerId } = selection;
        const boostValue = effect.value || 50;
        
        // Find which player owns the target card
        const targetPlayerId = this.findCardOwner(gameEnv, selectedCardId);
        if (!targetPlayerId) {
            return this.createErrorResult('Target card owner not found');
        }

        const targetPlayer = gameEnv.players[targetPlayerId];
        console.log(`🎯 Target card ${selectedCardId} belongs to player: ${targetPlayerId}`);
        
        if (targetPlayer?.fieldEffects) {
            // Initialize activeEffects array if needed
            if (!targetPlayer.fieldEffects.activeEffects) {
                targetPlayer.fieldEffects.activeEffects = [];
            }
            
            // Create proper ActiveEffect object compatible with FieldEffect interface
            const activeEffect = {
                effectId: `${selectionId}_powerBoost_${Date.now()}`,
                source: effect.sourceCard || 'cardSelection',
                sourcePlayerId: playerId,
                type: 'powerBoost',
                target: {
                    scope: 'SPECIFIC' as const,
                    cardIds: [selectedCardId]
                },
                value: boostValue,
                isEnabled: true,
                createdAt: Date.now()
            };
            
            // Add to activeEffects with type safety
            targetPlayer.fieldEffects.activeEffects.push(activeEffect);
            
            console.log(`⚡ Added powerBoost effect: +${boostValue} to ${selectedCardId} in ${targetPlayerId}'s activeEffects`);
            console.log(`📊 Player ${targetPlayerId} now has ${targetPlayer.fieldEffects.activeEffects.length} active effects`);
        }

        return await this.completeCardSelection(gameEnv, selectionId);
    }

    /**
     * Apply single target power nerf using ActiveEffect integration
     */
    private async applySingleTargetPowerNerf(gameEnv: GameEnvironment, selectionId: string, selectedCardId: string): Promise<CardSelectionResult> {
        console.log(`⚡ CardSelectionHandler: Applying power nerf to: ${selectedCardId}`);
        
        const selection = gameEnv.pendingCardSelections?.[selectionId];
        if (!selection) {
            return this.createErrorResult('Selection not found');
        }

        const { effect, playerId } = selection;
        const nerfValue = effect.value || 60;
        
        // Find which player owns the target card
        const targetPlayerId = this.findCardOwner(gameEnv, selectedCardId);
        if (!targetPlayerId) {
            return this.createErrorResult('Target card owner not found');
        }

        const targetPlayer = gameEnv.players[targetPlayerId];
        console.log(`🎯 Target card ${selectedCardId} belongs to player: ${targetPlayerId}`);
        
        if (targetPlayer?.fieldEffects) {
            // Initialize activeEffects array if needed
            if (!targetPlayer.fieldEffects.activeEffects) {
                targetPlayer.fieldEffects.activeEffects = [];
            }
            
            // Create proper ActiveEffect object compatible with FieldEffect interface
            const activeEffect = {
                effectId: `${selectionId}_powerReduction_${Date.now()}`,
                source: effect.sourceCard || 'cardSelection',
                sourcePlayerId: playerId,
                type: 'powerReduction',
                target: {
                    scope: 'SPECIFIC' as const,
                    cardIds: [selectedCardId]
                },
                value: nerfValue,
                isEnabled: true,
                createdAt: Date.now()
            };
            
            // Add to activeEffects with type safety
            targetPlayer.fieldEffects.activeEffects.push(activeEffect);
            
            console.log(`⚡ Added powerReduction effect: -${nerfValue} to ${selectedCardId} in ${targetPlayerId}'s activeEffects`);
            console.log(`📊 Player ${targetPlayerId} now has ${targetPlayer.fieldEffects.activeEffects.length} active effects`);
        }

        return await this.completeCardSelection(gameEnv, selectionId);
    }

    // Remaining methods (move card operations, validation, utilities) with type safety
    private async moveDeckSearchCardsToHand(gameEnv: GameEnvironment, selectionId: string, selectedCardIdentifiers: string[]): Promise<CardSelectionResult> {
        console.log(`📝 CardSelectionHandler: Moving ${selectedCardIdentifiers.length} cards to hand`);
        
        const selection = gameEnv.pendingCardSelections?.[selectionId];
        if (!selection) {
            return this.createErrorResult('Selection not found');
        }

        const { playerId } = selection;
        const deck = PlayerStateManager.getPlayerMainDeck(gameEnv, playerId);
        const hand = PlayerStateManager.getPlayerHand(gameEnv, playerId);
        console.log("deck a ",JSON.stringify(deck))
        console.log("deck ab ",JSON.stringify(hand))
        console.log("deck abcc ",JSON.stringify(selectedCardIdentifiers))
        for (const cardId of selectedCardIdentifiers) {
            const deckIndex = deck.indexOf(cardId);
            if (deckIndex !== -1) {
                deck.splice(deckIndex, 1);
            }
            hand.push(cardId);
            
            // CRITICAL FIX: Also update handDetails array to keep it in sync
            if (gameEnv.players?.[playerId]?.deck?.handDetails) {
                const cardDetails = this.getCardDetails(cardId);
                if (cardDetails) {
                    gameEnv.players[playerId].deck.handDetails.push({
                        uid: cardId,
                        id: cardDetails.id,
                        name: cardDetails.name,
                        cardType: cardDetails.cardType,
                        gameType: cardDetails.gameType,
                        traits: cardDetails.traits || [],
                        power: cardDetails.power || 0
                    });
                }
            }
            
            this.addGameEvent(gameEnv, EventType.CARD_MOVED_TO_HAND, {
                playerId: playerId,
                cardId: cardId,
                source: 'deckSearch'
            });
        }

        return await this.completeCardSelection(gameEnv, selectionId);
    }

    private async moveDeckSearchCardsToSpZone(gameEnv: GameEnvironment, selectionId: string, selectedCardIdentifiers: string[]): Promise<CardSelectionResult> {
        console.log(`🌟 CardSelectionHandler: Moving ${selectedCardIdentifiers.length} cards to SP zone`);
        
        const selection = gameEnv.pendingCardSelections?.[selectionId];
        if (!selection) {
            return this.createErrorResult('Selection not found');
        }

        const { playerId } = selection;
        const playerField = this.getPlayerField(gameEnv, playerId);
        
        if (playerField.sp?.length > 0) {
            console.log(`🌟 SP zone occupied, moving card to hand instead`);
            return await this.moveDeckSearchCardsToHand(gameEnv, selectionId, selectedCardIdentifiers);
        }

        const deck = PlayerStateManager.getPlayerMainDeck(gameEnv, playerId);

        for (const cardId of selectedCardIdentifiers) {
            const deckIndex = deck.indexOf(cardId);
            if (deckIndex !== -1) {
                deck.splice(deckIndex, 1);
            }

            // Create card object for SP zone (face-down)
            const cardDetails = this.getCardDetails(cardId);
            const cardObj = {
                "card": [cardId],
                "cardDetails": [cardDetails],
                "isBack": [true],
                "valueOnField": 0
            };

            playerField.sp.push(cardObj);
            
            this.addGameEvent(gameEnv, 'CARD_MOVED_TO_SP_ZONE', {
                playerId: playerId,
                cardId: cardId,
                source: 'deckSearch',
                faceDown: true
            });
        }

        return await this.completeCardSelection(gameEnv, selectionId);
    }

    private async moveDeckSearchCardsToHelpZone(gameEnv: GameEnvironment, selectionId: string, selectedCardIdentifiers: string[]): Promise<CardSelectionResult> {
        console.log(`🆘 CardSelectionHandler: Moving ${selectedCardIdentifiers.length} cards to Help zone`);
        
        const selection = gameEnv.pendingCardSelections?.[selectionId];
        if (!selection) {
            return this.createErrorResult('Selection not found');
        }

        const { playerId } = selection;
        const playerField = this.getPlayerField(gameEnv, playerId);
        
        if (playerField.help?.length > 0) {
            console.log(`🆘 Help zone occupied, moving card to hand instead`);
            return await this.moveDeckSearchCardsToHand(gameEnv, selectionId, selectedCardIdentifiers);
        }

        const deck = PlayerStateManager.getPlayerMainDeck(gameEnv, playerId);

        for (const cardId of selectedCardIdentifiers) {
            const deckIndex = deck.indexOf(cardId);
            if (deckIndex !== -1) {
                deck.splice(deckIndex, 1);
            }

            const cardDetails = this.getCardDetails(cardId);
            if (!cardDetails || cardDetails.cardType !== 'help') {
                this.addErrorEvent(gameEnv, 'INVALID_CARD_TYPE', 
                    'Selected card is not a Help card', playerId);
                return this.createErrorResult('Selected card is not a Help card');
            }

            const cardObj = {
                "card": [cardId],
                "cardDetails": [cardDetails],
                "isBack": [false],
                "valueOnField": cardDetails.power || 0
            };

            playerField.help.push(cardObj);
            
            this.addGameEvent(gameEnv, 'CARD_MOVED_TO_HELP_ZONE', {
                playerId: playerId,
                cardId: cardId,
                source: 'deckSearch',
                faceDown: false
            });

            // Process Help card effects immediately
            const effectResult = await this.mozGamePlay.processUtilityCardEffects?.(gameEnv, playerId, cardDetails);
            if (effectResult?.requiresCardSelection) {
                return { success: true, gameEnv: effectResult.gameEnv };
            }
        }

        return await this.completeCardSelection(gameEnv, selectionId);
    }

    // Utility methods with type safety
    private validateCardSelection(selectedCardIdentifiers: string[], eligibleCards: EligibleCard[]): SelectionValidation {
        console.log(`🔍 Validating selection: ${selectedCardIdentifiers.join(', ')} against ${eligibleCards.length} eligible cards`);
        
        for (const identifier of selectedCardIdentifiers) {
            const isValidCard = eligibleCards.some(card => {
                return card.cardId === identifier || card.cardUid === identifier;
            });
            
            if (!isValidCard) {
                console.log(`❌ Invalid card selection: ${identifier}`);
                return { valid: false, invalidCard: identifier };
            }
        }
        
        console.log(`✅ All selected cards are valid`);
        return { valid: true };
    }

    private findCardOwner(gameEnv: GameEnvironment, cardIdentifier: string): string | null {
        for (const playerId of Object.keys(gameEnv.players)) {
            const playerZones = gameEnv.zones.getPlayerZones?.(playerId);
            if (!playerZones) continue;
            
            const allZones = ['top', 'left', 'right', 'help', 'sp', 'leader'];
            
            for (const zoneName of allZones) {
                const zone = (playerZones as any)[zoneName];
                if (!zone) continue;
                
                if (Array.isArray(zone)) {
                    const found = zone.some((card: any) => 
                        card.cardId === cardIdentifier || 
                        card.cardUid === cardIdentifier ||
                        card.cardId === cardIdentifier.split('_')[0]
                    );
                    if (found) {
                        console.log(`🔍 Found card ${cardIdentifier} in ${playerId}'s ${zoneName} zone`);
                        return playerId;
                    }
                }
                else if (zone && typeof zone === 'object') {
                    if ((zone as any).cardId === cardIdentifier || 
                        (zone as any).cardUid === cardIdentifier ||
                        (zone as any).cardId === cardIdentifier.split('_')[0]) {
                        console.log(`🔍 Found card ${cardIdentifier} in ${playerId}'s ${zoneName} zone`);
                        return playerId;
                    }
                }
            }
        }
        
        console.warn(`⚠️ Could not find owner for card: ${cardIdentifier}`);
        return null;
    }

    private async completeCardSelection(gameEnv: GameEnvironment, selectionId: string): Promise<CardSelectionResult> {
        console.log(`✅ CardSelectionHandler: Completing card selection: ${selectionId}`);

        // Get the playerId from the selection data before cleanup
        const selection = gameEnv.pendingCardSelections?.[selectionId];
        const playerId = selection?.playerId;

        if (!playerId) {
            console.error(`❌ Could not find playerId for selection: ${selectionId}`);
            return { success: false, error: 'Player ID not found for card selection' };
        }

        // Clean up selection data
        if (gameEnv.pendingCardSelections) {
            delete gameEnv.pendingCardSelections[selectionId];
        }

        // Add completion event
        this.addGameEvent(gameEnv, 'CARD_SELECTION_COMPLETED', {
            selectionId: selectionId,
            playerId: playerId
        });

        // Continue game flow with proper playerId
        return await this.continueGameFlow(gameEnv, playerId);
    }

    private async continueGameFlow(gameEnv: GameEnvironment, playerId: string): Promise<CardSelectionResult> {
        console.log(`🎮 CardSelectionHandler: Using unified PostActionHandler for game flow continuation for player: ${playerId}`);

        // Create action context for card selection completion with proper playerId
        const actionContext: ActionContext = PostActionHandler.createContext('CARD_SELECTION', playerId, {
            skipTurnCheck: false,   // Card selections should trigger turn management
            skipPhaseCheck: false   // Card selections should trigger phase progression checks
        });

        try {
            // Use unified PostActionHandler pipeline
            const result = await this.postActionHandler.execute(gameEnv, actionContext);
            
            if (result.success) {
                return { success: true, gameEnv: result.gameEnv };
            } else {
                console.error(`❌ PostActionHandler failed: ${result.error}`);
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error(`❌ Error in PostActionHandler execution:`, error);
            return { success: false, error: 'Post-action processing failed' };
        }
    }

    // Delegate to existing methods for complex effect processing
    private async applyNeutralizationEffect(gameEnv: GameEnvironment, selectionId: string, selectedCardIdentifiers: string[]): Promise<CardSelectionResult> {
        const result = await this.mozGamePlay.applyNeutralizationSelection?.(gameEnv, selectionId, selectedCardIdentifiers);
        return { success: !!result, gameEnv: result || gameEnv };
    }

    private async applySetPowerEffect(gameEnv: GameEnvironment, selectionId: string, selectedCardIdentifiers: string[]): Promise<CardSelectionResult> {
        const result = await this.mozGamePlay.applySetPowerSelection?.(gameEnv, selectionId, selectedCardIdentifiers);
        return { success: !!result, gameEnv: result || gameEnv };
    }

    // Helper methods
    private createErrorResult(message: string): CardSelectionResult {
        console.error(`🚨 CardSelectionHandler Error: ${message}`);
        return { success: false, error: message };
    }

    private getCardDetails(cardId: string): CardDetails {
        // Integrate with existing card info system
        const cardDetails = require('../mozGame/mozDeckHelper').getDeckCardDetails?.(cardId);
        return cardDetails || { 
            id: cardId, 
            name: `Card ${cardId}`, 
            cardType: 'character',
            power: 100 
        };
    }
}

export { CardSelectionHandler };