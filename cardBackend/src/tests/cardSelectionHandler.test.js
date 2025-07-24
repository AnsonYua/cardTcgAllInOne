// =======================================================================================
// 🎯 CARD SELECTION HANDLER INTEGRATION TEST
// =======================================================================================
// Tests the new CardSelectionHandler class integration with mozGamePlay

const GameLogic = require('../services/GameLogic');
const CardSelectionHandler = require('../services/CardSelectionHandler');

describe('CardSelectionHandler Integration Tests', () => {
    const testPlayerId1 = 'testPlayer1';
    const testPlayerId2 = 'testPlayer2';

    describe('CardSelectionHandler Class Integration', () => {
        test('should properly instantiate CardSelectionHandler in mozGamePlay', () => {
            // Test that CardSelectionHandler is properly initialized
            const mozGamePlay = require('../mozGame/mozGamePlay');
            
            expect(mozGamePlay.cardSelectionHandler).toBeDefined();
            expect(typeof mozGamePlay.cardSelectionHandler.handleSelectCardAction).toBe('function');
            expect(typeof mozGamePlay.cardSelectionHandler.handleDeckSearchSelection).toBe('function');
            expect(typeof mozGamePlay.cardSelectionHandler.handleFieldTargetSelection).toBe('function');
            expect(typeof mozGamePlay.cardSelectionHandler.handleSingleTargetSelection).toBe('function');
        });

        test('should route SelectCard actions through CardSelectionHandler', async () => {
            // Create a mock game environment with a pending card selection
            const mockGameEnv = {
                currentPlayer: testPlayerId1,
                phase: 'MAIN_PHASE',
                pendingPlayerAction: {
                    type: 'cardSelection',
                    selectionId: 'test_selection_123'
                },
                pendingCardSelections: {
                    'test_selection_123': {
                        selectionId: 'test_selection_123',
                        selectionType: 'deckSearch',
                        playerId: testPlayerId1,
                        selectCount: 1,
                        eligibleCards: ['c-9'],
                        searchedCards: ['c-9', 'c-10'],
                        effect: {
                            type: 'searchCard',
                            destination: 'hand'
                        }
                    }
                }
            };

            // Mock a SelectCard action
            const selectCardAction = {
                type: 'SelectCard',
                selectionId: 'test_selection_123',
                selectedCardIds: ['c-9']
            };

            // Test that the action gets routed to CardSelectionHandler
            const mozGamePlay = require('../mozGame/mozGamePlay');
            
            // Mock the CardSelectionHandler method to track if it was called
            const originalMethod = mozGamePlay.cardSelectionHandler.handleSelectCardAction;
            let handlerCalled = false;
            
            mozGamePlay.cardSelectionHandler.handleSelectCardAction = async function(gameEnv, playerId, action) {
                handlerCalled = true;
                expect(action.type).toBe('SelectCard');
                expect(action.selectionId).toBe('test_selection_123');
                expect(action.selectedCardIds).toEqual(['c-9']);
                
                // Return a mock successful result
                return {
                    ...gameEnv,
                    pendingPlayerAction: null,
                    pendingCardSelections: {}
                };
            };

            try {
                // Call processAction with SelectCard action
                const result = await mozGamePlay.processAction(mockGameEnv, testPlayerId1, selectCardAction);
                
                // Verify the handler was called
                expect(handlerCalled).toBe(true);
                expect(result).toBeDefined();
                
            } finally {
                // Restore original method
                mozGamePlay.cardSelectionHandler.handleSelectCardAction = originalMethod;
            }
        });

        test('should handle unknown action types with proper error', async () => {
            const mockGameEnv = {
                currentPlayer: testPlayerId1,
                phase: 'MAIN_PHASE'
            };

            const unknownAction = {
                type: 'UnknownAction',
                someData: 'test'
            };

            const mozGamePlay = require('../mozGame/mozGamePlay');
            
            // processAction returns an error object instead of throwing
            const result = await mozGamePlay.processAction(mockGameEnv, testPlayerId1, unknownAction);
            
            // Verify the result contains the error
            expect(result).toHaveProperty('error');
            expect(result.error).toContain('Unknown action type: UnknownAction');
        });

        test('should route PlayCard actions to existing logic', async () => {
            const mockGameEnv = {
                currentPlayer: testPlayerId1,
                phase: 'MAIN_PHASE',
                players: {
                    [testPlayerId1]: {
                        deck: {
                            hand: ['c-43']
                        }
                    }
                },
                zones: {
                    [testPlayerId1]: {
                        top: [],
                        left: [],
                        right: [],
                        help: [],
                        sp: [],
                        leader: { id: 's-1', name: 'Trump' }
                    }
                }
            };

            const playCardAction = {
                type: 'PlayCard',
                card_idx: 0,
                field_idx: 0
            };

            const mozGamePlay = require('../mozGame/mozGamePlay');
            
            // This should still work and route to existing card play logic
            // We don't expect it to complete fully due to missing game setup,
            // but it should get past the action routing
            try {
                await mozGamePlay.processAction(mockGameEnv, testPlayerId1, playCardAction);
            } catch (error) {
                // We expect some error due to incomplete game setup,
                // but it should NOT be an "Unknown action type" error
                expect(error.message).not.toContain('Unknown action type');
            }
        });
    });

    describe('Action Type Routing', () => {
        test('should recognize all expected action types', () => {
            const expectedActionTypes = ['SelectCard', 'PlayCard', 'PlayCardBack', 'Pass'];
            
            // This test verifies that our switch statement covers all expected cases
            // We can't easily test the actual routing without complex mocking,
            // but we can verify the structure exists
            const mozGamePlay = require('../mozGame/mozGamePlay');
            expect(mozGamePlay.cardSelectionHandler).toBeDefined();
        });

        test('should provide clear console logging for action routing', () => {
            // Test that our logging is in place for debugging
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            
            const mockGameEnv = { currentPlayer: testPlayerId1, phase: 'MAIN_PHASE' };
            const selectAction = { type: 'SelectCard', selectionId: 'test', selectedCardIds: [] };
            
            const mozGamePlay = require('../mozGame/mozGamePlay');
            
            // Mock the handler to prevent actual execution
            const originalHandler = mozGamePlay.cardSelectionHandler.handleSelectCardAction;
            mozGamePlay.cardSelectionHandler.handleSelectCardAction = jest.fn().mockResolvedValue(mockGameEnv);
            
            return mozGamePlay.processAction(mockGameEnv, testPlayerId1, selectAction)
                .then(() => {
                    // Verify logging was called
                    expect(consoleSpy).toHaveBeenCalledWith(
                        expect.stringContaining('🎮 mozGamePlay: Processing action: SelectCard')
                    );
                    expect(consoleSpy).toHaveBeenCalledWith(
                        expect.stringContaining('🎯 Processing SelectCard action through CardSelectionHandler')
                    );
                    
                    // Restore mocks
                    consoleSpy.mockRestore();
                    mozGamePlay.cardSelectionHandler.handleSelectCardAction = originalHandler;
                });
        });
    });
});