// =======================================================================================
// 🎯 CARD ACTION HANDLER INTEGRATION TESTS
// =======================================================================================
//
// This test suite validates the CardActionHandler class integration with mozGamePlay.js
// following the established pattern from CardSelectionHandler, BattleCalculator, TurnManager, and EventManager.
//
// Test Categories:
// 1. CardActionHandler Class Integration - Proper instantiation and delegation
// 2. Card Placement Validation - Multi-layered validation pipeline
// 3. Face-Down Card Mechanics - Complete restriction bypass for strategic placement
// 4. Phase-Based Restrictions - SP zone and MAIN_PHASE/SP_PHASE rules
// 5. Card Type Validation - Character, help, and SP card placement rules
// 6. Event Generation - Proper event creation for frontend synchronization
//
// =======================================================================================

const mozGamePlay = require('../mozGame/mozGamePlay');
const CardActionHandler = require('../services/CardActionHandler');

describe('CardActionHandler Integration Tests', () => {
    // mozGamePlay is a singleton instance, not a class
    const gamePlayInstance = mozGamePlay;

    describe('CardActionHandler Class Integration', () => {
        test('should properly instantiate CardActionHandler in mozGamePlay', () => {
            expect(gamePlayInstance.cardActionHandler).toBeInstanceOf(CardActionHandler);
            expect(gamePlayInstance.cardActionHandler).toBeDefined();
            expect(typeof gamePlayInstance.cardActionHandler.handleCardPlayAction).toBe('function');
            expect(typeof gamePlayInstance.cardActionHandler.validateBasicPlacement).toBe('function');
            expect(typeof gamePlayInstance.cardActionHandler.validateAdvancedRestrictions).toBe('function');
            expect(typeof gamePlayInstance.cardActionHandler.validatePhaseRestrictions).toBe('function');
            expect(typeof gamePlayInstance.cardActionHandler.validateCardTypeRestrictions).toBe('function');
        });

        test('should delegate PlayCard action to CardActionHandler', async () => {
            const mockGameEnv = { 
                phase: 'MAIN_PHASE',
                currentTurn: 1,
                players: { 'testPlayer': { deck: { hand: ['card1'] } } }
            };
            const mockAction = { type: 'PlayCard', field_idx: 0, card_idx: 0 };

            // Mock the CardActionHandler method to track if it was called
            const originalMethod = gamePlayInstance.cardActionHandler.handleCardPlayAction;
            let handlerCalled = false;
            
            gamePlayInstance.cardActionHandler.handleCardPlayAction = async function(gameEnv, playerId, action) {
                handlerCalled = true;
                expect(gameEnv).toEqual(mockGameEnv);
                expect(playerId).toBe('testPlayer');
                expect(action).toEqual(mockAction);
                return mockGameEnv;
            };

            // Test delegation through processAction
            const result = await gamePlayInstance.processAction(mockGameEnv, 'testPlayer', mockAction);
            
            expect(handlerCalled).toBe(true);
            expect(result).toEqual(mockGameEnv);
            
            // Restore original method
            gamePlayInstance.cardActionHandler.handleCardPlayAction = originalMethod;
        });

        test('should delegate PlayCardBack action to CardActionHandler', async () => {
            const mockGameEnv = { 
                phase: 'MAIN_PHASE',
                currentTurn: 1,
                players: { 'testPlayer': { deck: { hand: ['card1'] } } }
            };
            const mockAction = { type: 'PlayCardBack', field_idx: 0, card_idx: 0 };

            // Mock the CardActionHandler method to track if it was called
            const originalMethod = gamePlayInstance.cardActionHandler.handleCardPlayAction;
            let handlerCalled = false;
            
            gamePlayInstance.cardActionHandler.handleCardPlayAction = async function(gameEnv, playerId, action) {
                handlerCalled = true;
                expect(gameEnv).toEqual(mockGameEnv);
                expect(playerId).toBe('testPlayer');
                expect(action).toEqual(mockAction);
                return mockGameEnv;
            };

            // Test delegation through processAction
            const result = await gamePlayInstance.processAction(mockGameEnv, 'testPlayer', mockAction);
            
            expect(handlerCalled).toBe(true);
            expect(result).toEqual(mockGameEnv);
            
            // Restore original method
            gamePlayInstance.cardActionHandler.handleCardPlayAction = originalMethod;
        });
    });

    describe('Card Placement Validation Logic', () => {
        test('should handle basic placement validation', async () => {
            const mockGameEnv = { 
                players: { 'testPlayer': { deck: { hand: ['c-1'] } } }
            };
            const mockAction = { field_idx: 0, card_idx: 0 };

            const result = await gamePlayInstance.cardActionHandler.validateBasicPlacement(mockGameEnv, 'testPlayer', mockAction);
            
            // Should successfully validate if card exists in hand
            if (result.isValid) {
                expect(result.data).toBeDefined();
                expect(result.data.playPos).toBeDefined();
                expect(result.data.cardDetails).toBeDefined();
                expect(result.data.hand).toBeDefined();
            } else {
                // Should fail gracefully with proper error message
                expect(result.error).toBeDefined();
                expect(typeof result.error).toBe('string');
            }
        });

        test('should handle invalid position index', async () => {
            const mockGameEnv = { 
                players: { 'testPlayer': { deck: { hand: ['c-1'] } } }
            };
            const mockAction = { field_idx: 10, card_idx: 0 }; // Invalid position

            const result = await gamePlayInstance.cardActionHandler.validateBasicPlacement(mockGameEnv, 'testPlayer', mockAction);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe("position out of range");
        });

        test('should handle invalid card index', async () => {
            const mockGameEnv = { 
                players: { 'testPlayer': { deck: { hand: ['c-1'] } } }
            };
            const mockAction = { field_idx: 0, card_idx: 10 }; // Invalid card index

            const result = await gamePlayInstance.cardActionHandler.validateBasicPlacement(mockGameEnv, 'testPlayer', mockAction);
            
            expect(result.isValid).toBe(false);
            expect(result.error).toBe("hand card out of range");
        });

        test('should handle phase restrictions validation', async () => {
            // Test SP zone restriction during MAIN_PHASE for face-down cards
            const phaseResult1 = await gamePlayInstance.cardActionHandler.validatePhaseRestrictions(
                { phase: 'MAIN_PHASE' }, 'sp', true
            );
            expect(phaseResult1.isValid).toBe(false);
            expect(phaseResult1.error).toContain("Cannot play face-down cards in SP zone during MAIN_PHASE");

            // Test SP zone enforcement during SP_PHASE for face-up cards
            const phaseResult2 = await gamePlayInstance.cardActionHandler.validatePhaseRestrictions(
                { phase: 'SP_PHASE' }, 'sp', false
            );
            expect(phaseResult2.isValid).toBe(false);
            expect(phaseResult2.error).toContain("Cards in SP zone must be played face-down during SP phase");

            // Test valid placement
            const phaseResult3 = await gamePlayInstance.cardActionHandler.validatePhaseRestrictions(
                { phase: 'MAIN_PHASE' }, 'top', false
            );
            expect(phaseResult3.isValid).toBe(true);
        });
    });

    describe('Face-Down Card Mechanics', () => {
        test('should bypass restrictions for face-down cards', async () => {
            // Face-down cards should bypass all advanced restrictions
            const mockGameEnv = { phase: 'MAIN_PHASE' };
            
            // Any card type should be allowed face-down in any valid zone (except SP zone during MAIN_PHASE)
            const result1 = await gamePlayInstance.cardActionHandler.validatePhaseRestrictions(mockGameEnv, 'help', true);
            expect(result1.isValid).toBe(true);
            
            const result2 = await gamePlayInstance.cardActionHandler.validatePhaseRestrictions(mockGameEnv, 'top', true);
            expect(result2.isValid).toBe(true);
        });

        test('should enforce SP zone restriction for face-down cards during MAIN_PHASE', async () => {
            const mockGameEnv = { phase: 'MAIN_PHASE' };
            
            const result = await gamePlayInstance.cardActionHandler.validatePhaseRestrictions(mockGameEnv, 'sp', true);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain("Cannot play face-down cards in SP zone during MAIN_PHASE");
        });
    });

    describe('Card Type Validation', () => {
        test('should validate character card restrictions', async () => {
            const mockGameEnv = {};
            const mockPlayerField = { top: [], left: [], right: [], help: [], sp: [] };

            // Character cards should not be allowed in utility zones
            const result1 = await gamePlayInstance.cardActionHandler.validateCharacterCardRestrictions(
                mockGameEnv, 'testPlayer', 'help', mockPlayerField
            );
            expect(result1.isValid).toBe(false);
            expect(result1.error).toContain("Can't play character card in utility zones");

            // Character cards should be allowed in battle zones
            const result2 = await gamePlayInstance.cardActionHandler.validateCharacterCardRestrictions(
                mockGameEnv, 'testPlayer', 'top', mockPlayerField
            );
            expect(result2.isValid).toBe(true);
        });

        test('should validate help card restrictions', async () => {
            const mockGameEnv = {};
            const mockPlayerField = { help: [] };

            // Help cards should only be allowed in help zone
            const result1 = await gamePlayInstance.cardActionHandler.validateHelpCardRestrictions(
                mockGameEnv, 'testPlayer', 'top', mockPlayerField
            );
            expect(result1.isValid).toBe(false);
            expect(result1.error).toContain("Help cards can only be played in help zone");

            // Help cards should be allowed in help zone if empty
            const result2 = await gamePlayInstance.cardActionHandler.validateHelpCardRestrictions(
                mockGameEnv, 'testPlayer', 'help', mockPlayerField
            );
            expect(result2.isValid).toBe(true);
        });

        test('should validate SP card restrictions', async () => {
            const mockGameEnv = { phase: 'MAIN_PHASE' };
            const mockPlayerField = { sp: [] };

            // SP cards should only be allowed during SP_PHASE
            const result1 = await gamePlayInstance.cardActionHandler.validateSpCardRestrictions(
                mockGameEnv, 'testPlayer', 'sp', mockPlayerField
            );
            expect(result1.isValid).toBe(false);
            expect(result1.error).toContain("SP cards can only be played during SP phase");

            // SP cards should be allowed during SP_PHASE
            mockGameEnv.phase = 'SP_PHASE';
            const result2 = await gamePlayInstance.cardActionHandler.validateSpCardRestrictions(
                mockGameEnv, 'testPlayer', 'sp', mockPlayerField
            );
            expect(result2.isValid).toBe(true);
        });
    });

    describe('Event Generation', () => {
        test('should generate proper placement events', () => {
            const mockGameEnv = { gameEvents: [], lastEventId: 0 };
            const mockCardDetails = {
                cardId: 'c-1',
                name: 'Test Card',
                cardType: 'character',
                power: 100,
                gameType: 'test',
                traits: ['test']
            };

            gamePlayInstance.cardActionHandler.generatePlacementEvents(
                mockGameEnv, 'testPlayer', mockCardDetails, 'top', false
            );

            expect(mockGameEnv.gameEvents.length).toBeGreaterThan(0);
            
            // Check for CARD_PLAYED event
            const cardPlayedEvent = mockGameEnv.gameEvents.find(e => e.type === 'CARD_PLAYED');
            expect(cardPlayedEvent).toBeDefined();
            expect(cardPlayedEvent.data.playerId).toBe('testPlayer');
            expect(cardPlayedEvent.data.zone).toBe('top');
            expect(cardPlayedEvent.data.isFaceDown).toBe(false);

            // Check for ZONE_FILLED event
            const zoneFilledEvent = mockGameEnv.gameEvents.find(e => e.type === 'ZONE_FILLED');
            expect(zoneFilledEvent).toBeDefined();
            expect(zoneFilledEvent.data.playerId).toBe('testPlayer');
            expect(zoneFilledEvent.data.zone).toBe('top');
        });
    });

    describe('CardActionHandler Integration Validation', () => {
        test('should maintain consistent delegation pattern with other managers', () => {
            // CardActionHandler should follow same pattern as other manager classes
            expect(gamePlayInstance.cardActionHandler).toBeInstanceOf(CardActionHandler);
            expect(gamePlayInstance.cardSelectionHandler).toBeDefined();
            expect(gamePlayInstance.battleCalculator).toBeDefined();
            expect(gamePlayInstance.turnManager).toBeDefined();
            expect(gamePlayInstance.eventManager).toBeDefined();
            
            // All managers should be properly initialized
            expect(typeof gamePlayInstance.cardActionHandler.handleCardPlayAction).toBe('function');
            expect(typeof gamePlayInstance.cardSelectionHandler.handleSelectCardAction).toBe('function');
            expect(typeof gamePlayInstance.battleCalculator.calculateTotalPower).toBe('function');
            expect(typeof gamePlayInstance.turnManager.shouldUpdateTurn).toBe('function');
            expect(typeof gamePlayInstance.eventManager.addGameEvent).toBe('function');
        });

        test('should provide all required card action methods', () => {
            const requiredMethods = [
                'handleCardPlayAction',
                'validateBasicPlacement',
                'validateAdvancedRestrictions',
                'validatePhaseRestrictions',
                'validateCardTypeRestrictions',
                'executeCardPlacement',
                'processImmediateEffects'
            ];
            
            for (const method of requiredMethods) {
                expect(typeof gamePlayInstance.cardActionHandler[method]).toBe('function');
            }
        });

        test('should handle card data extraction utility methods', () => {
            const mockFieldCard1 = {
                cardDetails: [{ id: 'c-1', name: 'Test Card' }]
            };
            
            const mockFieldCard2 = {
                id: 'c-2',
                name: 'Direct Card'
            };
            
            const result1 = gamePlayInstance.cardActionHandler.extractCardData(mockFieldCard1);
            expect(result1).toEqual({ id: 'c-1', name: 'Test Card' });
            
            const result2 = gamePlayInstance.cardActionHandler.extractCardData(mockFieldCard2);
            expect(result2).toEqual({ id: 'c-2', name: 'Direct Card' });
            
            const result3 = gamePlayInstance.cardActionHandler.extractCardData({});
            expect(result3).toBeNull();
        });
    });
});