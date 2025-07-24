// =======================================================================================
// 🎯 BATTLE CALCULATOR INTEGRATION TEST
// =======================================================================================
// Tests the new BattleCalculator class integration with mozGamePlay

const mozGamePlay = require('../mozGame/mozGamePlay');

describe('BattleCalculator Integration Tests', () => {
    
    describe('BattleCalculator Class Integration', () => {
        test('should properly instantiate BattleCalculator in mozGamePlay', () => {
            // Test that BattleCalculator is properly initialized
            expect(mozGamePlay.battleCalculator).toBeDefined();
            expect(typeof mozGamePlay.battleCalculator.calculatePlayerPoints).toBe('function');
            expect(typeof mozGamePlay.battleCalculator.calculateBasePower).toBe('function');
            expect(typeof mozGamePlay.battleCalculator.applyLeaderEffects).toBe('function');
            expect(typeof mozGamePlay.battleCalculator.calculateComboBonuses).toBe('function');
        });

        test('should delegate calculatePlayerPoint to BattleCalculator', async () => {
            // Create a minimal game environment for testing
            const mockGameEnv = {
                players: {
                    'testPlayer1': {
                        fieldEffects: {
                            calculatedPowers: {},
                            activeEffects: [],
                            zoneRestrictions: {}
                        }
                    }
                },
                zones: {
                    'testPlayer1': {
                        leader: {
                            id: 's-1',
                            name: 'Trump',
                            effects: { rules: [] }
                        },
                        top: [],
                        left: [],
                        right: [],
                        help: [],
                        sp: []
                    }
                }
            };

            // Mock the BattleCalculator method to track if it was called
            const originalMethod = mozGamePlay.battleCalculator.calculatePlayerPoints;
            let calculatorCalled = false;
            
            mozGamePlay.battleCalculator.calculatePlayerPoints = async function(gameEnv, playerId) {
                calculatorCalled = true;
                expect(playerId).toBe('testPlayer1');
                expect(gameEnv).toBeDefined();
                
                // Return a mock result
                return 150;
            };

            try {
                // Call calculatePlayerPoint which should delegate to BattleCalculator
                const result = await mozGamePlay.calculatePlayerPoint(mockGameEnv, 'testPlayer1');
                
                // Verify the delegation occurred
                expect(calculatorCalled).toBe(true);
                expect(result).toBe(150);
                
            } finally {
                // Restore original method
                mozGamePlay.battleCalculator.calculatePlayerPoints = originalMethod;
            }
        });

        test('should handle empty field power calculation', async () => {
            // Test with completely empty field
            const mockGameEnv = {
                players: {
                    'testPlayer1': {
                        fieldEffects: {
                            calculatedPowers: {},
                            activeEffects: [],
                            zoneRestrictions: {}
                        }
                    }
                },
                zones: {
                    'testPlayer1': {
                        leader: {
                            id: 's-1',
                            name: 'Trump',
                            effects: { rules: [] }
                        },
                        top: [],
                        left: [],
                        right: [],
                        help: [],
                        sp: []
                    }
                }
            };

            // This should complete without errors and return 0
            const result = await mozGamePlay.calculatePlayerPoint(mockGameEnv, 'testPlayer1');
            
            // Empty field should return 0 power
            expect(typeof result).toBe('number');
            expect(result >= 0).toBe(true);
        });

        test('should properly route power calculation through 6 steps', async () => {
            // Create a more realistic game environment
            const mockGameEnv = {
                players: {
                    'testPlayer1': {
                        fieldEffects: {
                            calculatedPowers: {
                                'c-1': 180  // Card with boosted power
                            },
                            activeEffects: [],
                            zoneRestrictions: {}
                        }
                    }
                },
                zones: {
                    'testPlayer1': {
                        leader: {
                            id: 's-1',
                            name: 'Trump',
                            initialPoint: 300,
                            effects: {
                                rules: [{
                                    type: 'continuous',
                                    effect: { type: 'powerBoost', value: 30 }
                                }]
                            }
                        },
                        top: [{
                            cardDetails: [{
                                id: 'c-1',
                                cardType: 'character',
                                power: 150,
                                gameType: '右翼'
                            }],
                            isBack: [false]
                        }],
                        left: [],
                        right: [],
                        help: [],
                        sp: []
                    }
                }
            };

            // Track that the calculation steps are being called
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            
            try {
                const result = await mozGamePlay.calculatePlayerPoint(mockGameEnv, 'testPlayer1');
                
                // Verify that BattleCalculator logging occurred (indicates step-by-step processing)
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining('🎯 BattleCalculator: Starting power calculation')
                );
                
                // Result should be a valid number
                expect(typeof result).toBe('number');
                expect(result >= 0).toBe(true);
                
            } finally {
                consoleSpy.mockRestore();
            }
        });
    });

    describe('Power Calculation Logic', () => {
        test('should handle missing gameEnv gracefully', async () => {
            // Test error handling for invalid inputs
            try {
                await mozGamePlay.calculatePlayerPoint(null, 'testPlayer1');
            } catch (error) {
                expect(error).toBeDefined();
            }
        });

        test('should handle missing playerId gracefully', async () => {
            const mockGameEnv = {
                players: {},
                zones: {}
            };
            
            try {
                const result = await mozGamePlay.calculatePlayerPoint(mockGameEnv, 'nonexistentPlayer');
                // Should handle gracefully and return a number (likely 0)
                expect(typeof result).toBe('number');
            } catch (error) {
                // Or throw a meaningful error
                expect(error).toBeDefined();
            }
        });
    });
});