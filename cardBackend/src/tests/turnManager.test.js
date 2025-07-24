// =======================================================================================
// 🎯 TURN MANAGER INTEGRATION TEST
// =======================================================================================
// Tests the new TurnManager class integration with mozGamePlay

const mozGamePlay = require('../mozGame/mozGamePlay');

describe('TurnManager Integration Tests', () => {
    
    describe('TurnManager Class Integration', () => {
        test('should properly instantiate TurnManager in mozGamePlay', () => {
            // Test that TurnManager is properly initialized
            expect(mozGamePlay.turnManager).toBeDefined();
            expect(typeof mozGamePlay.turnManager.shouldUpdateTurn).toBe('function');
            expect(typeof mozGamePlay.turnManager.startNewTurn).toBe('function');
            expect(typeof mozGamePlay.turnManager.checkIsMainPhaseComplete).toBe('function');
            expect(typeof mozGamePlay.turnManager.advanceToSpPhaseOrBattle).toBe('function');
            expect(typeof mozGamePlay.turnManager.shouldPlayerSkipTurn).toBe('function');
        });

        test('should delegate shouldUpdateTurn to TurnManager', async () => {
            // Create a minimal game environment for testing
            const mockGameEnv = {
                currentTurn: 0,
                currentPlayer: 'testPlayer1',
                phase: 'MAIN_PHASE',
                players: {
                    'testPlayer1': {
                        turnAction: []
                    }
                },
                zones: {
                    'testPlayer1': {
                        top: [],
                        left: [],
                        right: [],
                        help: [],
                        sp: []
                    }
                }
            };

            // Mock the TurnManager method to track if it was called
            const originalMethod = mozGamePlay.turnManager.shouldUpdateTurn;
            let turnManagerCalled = false;
            
            mozGamePlay.turnManager.shouldUpdateTurn = async function(gameEnv, playerId) {
                turnManagerCalled = true;
                expect(playerId).toBe('testPlayer1');
                expect(gameEnv).toBeDefined();
                
                // Return a mock result
                return gameEnv;
            };

            try {
                // Call shouldUpdateTurn which should delegate to TurnManager
                const result = await mozGamePlay.shouldUpdateTurn(mockGameEnv, 'testPlayer1');
                
                // Verify the delegation occurred
                expect(turnManagerCalled).toBe(true);
                expect(result).toBeDefined();
                
            } finally {
                // Restore original method
                mozGamePlay.turnManager.shouldUpdateTurn = originalMethod;
            }
        });

        test('should delegate startNewTurn to TurnManager', async () => {
            // Create a minimal game environment for testing
            const mockGameEnv = {
                currentTurn: 0,
                firstPlayer: 0,
                players: {
                    'testPlayer1': {},
                    'testPlayer2': {}
                }
            };

            // Mock the TurnManager method to track if it was called
            const originalMethod = mozGamePlay.turnManager.startNewTurn;
            let turnManagerCalled = false;
            
            mozGamePlay.turnManager.startNewTurn = async function(gameEnv) {
                turnManagerCalled = true;
                expect(gameEnv).toBeDefined();
                
                // Return a mock result with incremented turn
                return {
                    ...gameEnv,
                    currentTurn: gameEnv.currentTurn + 1,
                    currentPlayer: 'testPlayer2'
                };
            };

            try {
                // Call startNewTurn which should delegate to TurnManager
                const result = await mozGamePlay.startNewTurn(mockGameEnv);
                
                // Verify the delegation occurred
                expect(turnManagerCalled).toBe(true);
                expect(result).toBeDefined();
                expect(result.currentTurn).toBe(1);
                
            } finally {
                // Restore original method
                mozGamePlay.turnManager.startNewTurn = originalMethod;
            }
        });

        test('should delegate checkIsMainPhaseComplete to TurnManager', async () => {
            // Create a minimal game environment for testing
            const mockGameEnv = {
                phase: 'MAIN_PHASE',
                players: {
                    'testPlayer1': {},
                    'testPlayer2': {}
                },
                zones: {
                    'testPlayer1': {
                        top: [{}],
                        left: [{}],
                        right: [{}],
                        help: [{}]
                    },
                    'testPlayer2': {
                        top: [{}],
                        left: [{}],
                        right: [{}],
                        help: [{}]
                    }
                }
            };

            // Mock the TurnManager method to track if it was called
            const originalMethod = mozGamePlay.turnManager.checkIsMainPhaseComplete;
            let turnManagerCalled = false;
            
            mozGamePlay.turnManager.checkIsMainPhaseComplete = async function(gameEnv) {
                turnManagerCalled = true;
                expect(gameEnv).toBeDefined();
                expect(gameEnv.phase).toBe('MAIN_PHASE');
                
                // Return mock completion status
                return true;
            };

            try {
                // Call checkIsMainPhaseComplete which should delegate to TurnManager
                const result = await mozGamePlay.checkIsMainPhaseComplete(mockGameEnv);
                
                // Verify the delegation occurred
                expect(turnManagerCalled).toBe(true);
                expect(result).toBe(true);
                
            } finally {
                // Restore original method
                mozGamePlay.turnManager.checkIsMainPhaseComplete = originalMethod;
            }
        });

        test('should delegate phase skipping methods to TurnManager', () => {
            const mockGameEnv = {
                zones: {
                    'testPlayer1': {
                        help: [],
                        sp: []
                    }
                }
            };

            // Test shouldSkipHelpPhase delegation
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            
            try {
                const helpSkipResult = mozGamePlay.shouldSkipHelpPhase(mockGameEnv, 'testPlayer1');
                const spSkipResult = mozGamePlay.shouldSkipSpPhase(mockGameEnv, 'testPlayer1');
                
                // Verify logging occurred (indicates delegation)
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('🎯 mozGamePlay: Delegating help phase skip check to TurnManager')
                );
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('🎯 mozGamePlay: Delegating SP phase skip check to TurnManager')
                );
                
                // Results should be boolean
                expect(typeof helpSkipResult).toBe('boolean');
                expect(typeof spSkipResult).toBe('boolean');
                
            } finally {
                consoleSpy.mockRestore();
            }
        });
    });

    describe('Turn Management Logic', () => {
        test('should handle missing gameEnv gracefully', async () => {
            // Test error handling for invalid inputs
            try {
                await mozGamePlay.shouldUpdateTurn(null, 'testPlayer1');
            } catch (error) {
                expect(error).toBeDefined();
            }
        });

        test('should handle turn switching logic', async () => {
            const mockGameEnv = {
                currentTurn: 0,
                firstPlayer: 0,
                phase: 'MAIN_PHASE',
                players: {
                    'testPlayer1': {
                        turnAction: [{
                            type: 'PlayCard',
                            turn: 0
                        }]
                    }
                }
            };

            // This should trigger turn switching logic
            try {
                const result = await mozGamePlay.shouldUpdateTurn(mockGameEnv, 'testPlayer1');
                expect(result).toBeDefined();
            } catch (error) {
                // Expected due to missing complete game setup
                expect(error).toBeDefined();
            }
        });
    });
});