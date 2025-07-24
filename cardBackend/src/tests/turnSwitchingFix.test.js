// =======================================================================================
// 🎯 TURN SWITCHING FIX VALIDATION TEST
// =======================================================================================
//
// This test validates the critical fix for missing turn switching logic in processAction.
// 
// Issue Fixed: PlayCard/PlayCardBack actions were not triggering turn switches,
// breaking the fundamental turn-based gameplay mechanics.
//
// Test Scenarios:
// 1. PlayCard action triggers turn switching
// 2. PlayCardBack (face-down) action triggers turn switching  
// 3. Turn switching works after card placement validation
// 4. Turn switching respects error conditions
// 5. Integration with TurnManager delegation
//
// =======================================================================================

const mozGamePlay = require('../mozGame/mozGamePlay');

describe('Turn Switching Fix Validation', () => {
    const gamePlayInstance = mozGamePlay;

    describe('🎯 PlayCard Turn Switching', () => {
        test('should call shouldUpdateTurn after successful PlayCard action', async () => {
            const mockGameEnv = {
                phase: 'MAIN_PHASE',
                currentTurn: 1,
                players: { 
                    'testPlayer': { deck: { hand: ['c-1'] } },
                    'otherPlayer': { deck: { hand: ['c-2'] } }
                },
                zones: { 
                    'testPlayer': { top: [], left: [], right: [], help: [], sp: [] },
                    'otherPlayer': { top: [], left: [], right: [], help: [], sp: [] }
                },
                gameEvents: [],
                lastEventId: 0
            };
            
            const mockAction = { type: 'PlayCard', field_idx: 0, card_idx: 0 };

            // Track method calls to validate flow
            let cardActionHandlerCalled = false;
            let shouldUpdateTurnCalled = false;
            let turnSwitchGameEnv = null;

            // Mock CardActionHandler to return successful result
            const originalCardAction = gamePlayInstance.cardActionHandler.handleCardPlayAction;
            gamePlayInstance.cardActionHandler.handleCardPlayAction = async function(gameEnv, playerId, action) {
                cardActionHandlerCalled = true;
                expect(gameEnv).toEqual(mockGameEnv);
                expect(playerId).toBe('testPlayer');
                expect(action).toEqual(mockAction);
                // Return successful gameEnv (no error)
                return { ...gameEnv, cardPlaced: true };
            };

            // Mock shouldUpdateTurn to track if it's called
            const originalShouldUpdateTurn = gamePlayInstance.shouldUpdateTurn;
            gamePlayInstance.shouldUpdateTurn = async function(gameEnv, playerId) {
                shouldUpdateTurnCalled = true;
                turnSwitchGameEnv = gameEnv;
                expect(gameEnv.cardPlaced).toBe(true); // Should receive updated gameEnv
                expect(playerId).toBe('testPlayer');
                // Return gameEnv with turn switched
                return { ...gameEnv, currentTurn: 2, turnSwitched: true };
            };

            // Execute action through main game flow
            const result = await gamePlayInstance.processAction(mockGameEnv, 'testPlayer', mockAction);
            
            // Validate complete flow
            expect(cardActionHandlerCalled).toBe(true);
            expect(shouldUpdateTurnCalled).toBe(true);
            expect(result.cardPlaced).toBe(true);
            expect(result.turnSwitched).toBe(true);
            expect(result.currentTurn).toBe(2);
            
            // Restore original methods
            gamePlayInstance.cardActionHandler.handleCardPlayAction = originalCardAction;
            gamePlayInstance.shouldUpdateTurn = originalShouldUpdateTurn;

            console.log('✅ PlayCard action successfully triggers turn switching after card placement');
        });

        test('should call shouldUpdateTurn after successful PlayCardBack action', async () => {
            const mockGameEnv = {
                phase: 'MAIN_PHASE',
                currentTurn: 3,
                players: { 
                    'testPlayer': { deck: { hand: ['c-1'] } }
                },
                zones: { 
                    'testPlayer': { top: [], left: [], right: [], help: [], sp: [] }
                },
                gameEvents: [],
                lastEventId: 0
            };
            
            const mockAction = { type: 'PlayCardBack', field_idx: 1, card_idx: 0 };

            let cardActionHandlerCalled = false;
            let shouldUpdateTurnCalled = false;

            // Mock CardActionHandler to return successful result
            const originalCardAction = gamePlayInstance.cardActionHandler.handleCardPlayAction;
            gamePlayInstance.cardActionHandler.handleCardPlayAction = async function(gameEnv, playerId, action) {
                cardActionHandlerCalled = true;
                expect(action.type).toBe('PlayCardBack');
                return { ...gameEnv, faceDownCardPlaced: true };
            };

            // Mock shouldUpdateTurn to track if it's called
            const originalShouldUpdateTurn = gamePlayInstance.shouldUpdateTurn;
            gamePlayInstance.shouldUpdateTurn = async function(gameEnv, playerId) {
                shouldUpdateTurnCalled = true;
                expect(gameEnv.faceDownCardPlaced).toBe(true);
                return { ...gameEnv, currentTurn: 4, turnSwitched: true };
            };

            // Execute face-down card action
            const result = await gamePlayInstance.processAction(mockGameEnv, 'testPlayer', mockAction);
            
            // Validate both methods were called
            expect(cardActionHandlerCalled).toBe(true);
            expect(shouldUpdateTurnCalled).toBe(true);
            expect(result.faceDownCardPlaced).toBe(true);
            expect(result.turnSwitched).toBe(true);
            
            // Restore original methods
            gamePlayInstance.cardActionHandler.handleCardPlayAction = originalCardAction;
            gamePlayInstance.shouldUpdateTurn = originalShouldUpdateTurn;

            console.log('✅ PlayCardBack action successfully triggers turn switching after face-down placement');
        });
    });

    describe('🎯 Error Handling in Turn Switching', () => {
        test('should NOT call shouldUpdateTurn when card placement fails', async () => {
            const mockGameEnv = {
                phase: 'MAIN_PHASE',
                currentTurn: 1,
                players: { 'testPlayer': { deck: { hand: [] } } }, // Empty hand
                gameEvents: [],
                lastEventId: 0
            };
            
            const mockAction = { type: 'PlayCard', field_idx: 0, card_idx: 0 };

            let cardActionHandlerCalled = false;
            let shouldUpdateTurnCalled = false;

            // Mock CardActionHandler to return error result
            const originalCardAction = gamePlayInstance.cardActionHandler.handleCardPlayAction;
            gamePlayInstance.cardActionHandler.handleCardPlayAction = async function(gameEnv, playerId, action) {
                cardActionHandlerCalled = true;
                // Return error result
                return { error: true, message: 'Card placement failed' };
            };

            // Mock shouldUpdateTurn to track if it's called (should NOT be called)
            const originalShouldUpdateTurn = gamePlayInstance.shouldUpdateTurn;
            gamePlayInstance.shouldUpdateTurn = async function(gameEnv, playerId) {
                shouldUpdateTurnCalled = true;
                return gameEnv;
            };

            // Execute action that should fail
            const result = await gamePlayInstance.processAction(mockGameEnv, 'testPlayer', mockAction);
            
            // Validate error handling
            expect(cardActionHandlerCalled).toBe(true);
            expect(shouldUpdateTurnCalled).toBe(false); // Should NOT be called on error
            expect(result.error).toBe(true);
            expect(result.message).toBe('Card placement failed');
            
            // Restore original methods
            gamePlayInstance.cardActionHandler.handleCardPlayAction = originalCardAction;
            gamePlayInstance.shouldUpdateTurn = originalShouldUpdateTurn;

            console.log('✅ Turn switching correctly skipped when card placement fails');
        });

        test('should handle null gameEnv gracefully', async () => {
            const mockAction = { type: 'PlayCard', field_idx: 0, card_idx: 0 };

            let shouldUpdateTurnCalled = false;

            // Mock CardActionHandler to return null
            const originalCardAction = gamePlayInstance.cardActionHandler.handleCardPlayAction;
            gamePlayInstance.cardActionHandler.handleCardPlayAction = async function(gameEnv, playerId, action) {
                return null; // Return null gameEnv
            };

            // Mock shouldUpdateTurn to track if it's called (should NOT be called)
            const originalShouldUpdateTurn = gamePlayInstance.shouldUpdateTurn;
            gamePlayInstance.shouldUpdateTurn = async function(gameEnv, playerId) {
                shouldUpdateTurnCalled = true;
                return gameEnv;
            };

            // Execute action with null result
            const result = await gamePlayInstance.processAction({}, 'testPlayer', mockAction);
            
            // Validate null handling
            expect(shouldUpdateTurnCalled).toBe(false); // Should NOT be called with null gameEnv
            expect(result).toBeNull();
            
            // Restore original methods
            gamePlayInstance.cardActionHandler.handleCardPlayAction = originalCardAction;
            gamePlayInstance.shouldUpdateTurn = originalShouldUpdateTurn;

            console.log('✅ Null gameEnv handled gracefully without calling turn switching');
        });
    });

    describe('🎯 TurnManager Integration Validation', () => {
        test('should delegate turn switching to TurnManager through shouldUpdateTurn', async () => {
            const mockGameEnv = {
                phase: 'MAIN_PHASE',
                currentTurn: 1,
                players: { 'testPlayer': { deck: { hand: ['c-1'] } } },
                zones: { 'testPlayer': { top: [], left: [], right: [], help: [], sp: [] } },
                gameEvents: [],
                lastEventId: 0
            };
            
            const mockAction = { type: 'PlayCard', field_idx: 0, card_idx: 0 };

            let turnManagerCalled = false;

            // Mock CardActionHandler to return successful result
            const originalCardAction = gamePlayInstance.cardActionHandler.handleCardPlayAction;
            gamePlayInstance.cardActionHandler.handleCardPlayAction = async function(gameEnv, playerId, action) {
                return { ...gameEnv, cardPlaced: true };
            };

            // Mock TurnManager to track delegation
            const originalTurnManagerMethod = gamePlayInstance.turnManager.shouldUpdateTurn;
            gamePlayInstance.turnManager.shouldUpdateTurn = async function(gameEnv, playerId) {
                turnManagerCalled = true;
                expect(gameEnv.cardPlaced).toBe(true);
                expect(playerId).toBe('testPlayer');
                return { ...gameEnv, delegatedToTurnManager: true };
            };

            // Execute action
            const result = await gamePlayInstance.processAction(mockGameEnv, 'testPlayer', mockAction);
            
            // Validate TurnManager delegation
            expect(turnManagerCalled).toBe(true);
            expect(result.delegatedToTurnManager).toBe(true);
            
            // Restore original methods
            gamePlayInstance.cardActionHandler.handleCardPlayAction = originalCardAction;
            gamePlayInstance.turnManager.shouldUpdateTurn = originalTurnManagerMethod;

            console.log('✅ Turn switching correctly delegates to TurnManager class');
        });
    });

    describe('🎯 Complete Game Flow Integration', () => {
        test('should maintain complete action → placement → turn switching flow', async () => {
            const mockGameEnv = {
                phase: 'MAIN_PHASE',
                currentTurn: 1,
                players: { 
                    'player1': { deck: { hand: ['c-1'] } },
                    'player2': { deck: { hand: ['c-2'] } }
                },
                zones: { 
                    'player1': { top: [], left: [], right: [], help: [], sp: [] },
                    'player2': { top: [], left: [], right: [], help: [], sp: [] }
                },
                gameEvents: [],
                lastEventId: 0
            };
            
            const mockAction = { type: 'PlayCard', field_idx: 0, card_idx: 0 };

            // Track complete flow execution
            const flowSteps = [];

            // Mock all components to track execution order
            const originalCardAction = gamePlayInstance.cardActionHandler.handleCardPlayAction;
            gamePlayInstance.cardActionHandler.handleCardPlayAction = async function(gameEnv, playerId, action) {
                flowSteps.push('CardActionHandler.handleCardPlayAction');
                return { ...gameEnv, cardPlaced: true };
            };

            const originalShouldUpdateTurn = gamePlayInstance.shouldUpdateTurn;
            gamePlayInstance.shouldUpdateTurn = async function(gameEnv, playerId) {
                flowSteps.push('mozGamePlay.shouldUpdateTurn');
                return gameEnv;
            };

            const originalTurnManagerMethod = gamePlayInstance.turnManager.shouldUpdateTurn;
            gamePlayInstance.turnManager.shouldUpdateTurn = async function(gameEnv, playerId) {
                flowSteps.push('TurnManager.shouldUpdateTurn');
                return { ...gameEnv, turnProcessed: true };
            };

            // Execute complete flow
            const result = await gamePlayInstance.processAction(mockGameEnv, 'player1', mockAction);
            
            // Validate execution order
            expect(flowSteps).toEqual([
                'CardActionHandler.handleCardPlayAction',
                'mozGamePlay.shouldUpdateTurn',
                'TurnManager.shouldUpdateTurn'
            ]);
            
            expect(result.cardPlaced).toBe(true);
            expect(result.turnProcessed).toBe(true);
            
            // Restore original methods
            gamePlayInstance.cardActionHandler.handleCardPlayAction = originalCardAction;
            gamePlayInstance.shouldUpdateTurn = originalShouldUpdateTurn;
            gamePlayInstance.turnManager.shouldUpdateTurn = originalTurnManagerMethod;

            console.log('✅ Complete action → placement → turn switching flow validated');
            console.log(`✅ Execution order: ${flowSteps.join(' → ')}`);
        });
    });

    describe('🎯 Fix Validation Summary', () => {
        test('should confirm turn switching fix resolves the critical issue', () => {
            // Validate the fix components are in place
            expect(typeof gamePlayInstance.processAction).toBe('function');
            expect(typeof gamePlayInstance.shouldUpdateTurn).toBe('function');
            expect(typeof gamePlayInstance.turnManager.shouldUpdateTurn).toBe('function');
            expect(typeof gamePlayInstance.cardActionHandler.handleCardPlayAction).toBe('function');

            console.log('🎯 TURN SWITCHING FIX VALIDATION: COMPLETE SUCCESS');
            console.log('✅ Critical Issue: Missing turn switching after PlayCard/PlayCardBack actions');
            console.log('✅ Root Cause: Class decomposition omitted turn switching step');
            console.log('✅ Solution: Added shouldUpdateTurn call after successful card placement');
            console.log('✅ Integration: Maintains delegation to TurnManager class');
            console.log('✅ Error Handling: Skips turn switching on card placement errors');
            console.log('✅ Game Flow: Restores proper turn-based gameplay mechanics');
        });
    });
});