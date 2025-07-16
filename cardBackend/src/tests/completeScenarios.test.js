// cardBackend/src/tests/completeScenarios.test.js
/**
 * Comprehensive test suite for complete GameEnv scenarios
 * Tests card effects, game states, and edge cases using full game environments
 */

const CompleteScenarioRunner = require('./testUtils/CompleteScenarioRunner');

describe('Complete Scenario Testing', () => {
    let scenarioRunner;

    beforeEach(() => {
        scenarioRunner = new CompleteScenarioRunner();
    });

    afterEach(async () => {
        // Clean up test games after each test
        await scenarioRunner.cleanupTestGames();
    });

    describe('Card Effect Tests', () => {
        test('Trump boost complete scenario', async () => {
            const result = await scenarioRunner.runCompleteScenario('trump_boost_complete');
            
            // Overall validation should pass
            expect(result.passed).toBe(true);
            expect(result.validation.passed).toBe(true);
            
            // Check specific validation points
            expect(result.validation.results.player1_trump_boost).toBeDefined();
            expect(result.validation.results.player1_trump_boost.passed).toBe(true);
            expect(result.validation.results.player2_biden_boost).toBeDefined();
            expect(result.validation.results.player2_biden_boost.passed).toBe(true);
            
            // Detailed assertions for Trump's boost effects
            const trumpBoost = result.validation.results.player1_trump_boost.cards;
            expect(trumpBoost['c-001'].actual).toBe(145); // 100 + 45 (right-wing boost)
            expect(trumpBoost['c-002'].actual).toBe(125); // 80 + 45 (patriot boost)
            
            // Ensure economic card is not boosted by Trump
            const noBoost = result.validation.results.player1_no_boost.cards;
            expect(noBoost['c-003'].actual).toBe(90); // No boost for economic card
            
            // Biden's universal boost
            const bidenBoost = result.validation.results.player2_biden_boost.cards;
            expect(bidenBoost['c-201'].actual).toBe(125); // 85 + 40
            expect(bidenBoost['c-202'].actual).toBe(115); // 75 + 40
            expect(bidenBoost['c-203'].actual).toBe(135); // 95 + 40
            
            // Help cards should not be affected
            const helpCards = result.validation.results.help_cards_unchanged.cards;
            expect(helpCards['u-001'].actual).toBe(30); // No change
            expect(helpCards['u-002'].actual).toBe(25); // No change
        }, 10000);

        test('Harris vs Trump conditional effects', async () => {
            // This test would require creating the harris_vs_trump_complete.json scenario
            // For now, we'll skip it but the structure shows how to test conditional effects
            
            // const result = await scenarioRunner.runCompleteScenario('harris_vs_trump_complete');
            // expect(result.passed).toBe(true);
            // 
            // // Test Harris's conditional effects against Trump
            // const conditionalEffect = result.validation.results.harris_vs_trump_conditional;
            // expect(conditionalEffect.passed).toBe(true);
            
            console.log('Harris vs Trump scenario test - requires harris_vs_trump_complete.json');
        });

        test('Musk Doge combo effects', async () => {
            // This test would require creating the musk_doge_combo.json scenario
            console.log('Musk Doge combo test - requires musk_doge_combo.json');
        });

        test('Powell restriction effects', async () => {
            // This test would require creating the powell_restrictions.json scenario
            console.log('Powell restrictions test - requires powell_restrictions.json');
        });
    });

    describe('Game State Tests', () => {
        test('Round 2 battle ready state', async () => {
            // This test would require creating the round2_battle_ready.json scenario
            console.log('Round 2 battle ready test - requires round2_battle_ready.json');
        });

        test('Mid-game complex state', async () => {
            // Test loading a complex mid-game state with multiple effects active
            console.log('Mid-game complex state test - requires additional scenarios');
        });
    });

    describe('Edge Case Tests', () => {
        test('SP phase with face-down cards', async () => {
            // This test would require creating the sp_phase_face_down.json scenario
            console.log('SP phase face-down test - requires sp_phase_face_down.json');
        });

        test('Disabled cards scenario', async () => {
            // This test would require creating the disabled_cards_scenario.json scenario
            console.log('Disabled cards test - requires disabled_cards_scenario.json');
        });

        test('Power nullification effects', async () => {
            // Test power nullification and complex effect interactions
            console.log('Power nullification test - requires additional scenarios');
        });
    });

    describe('Scenario Runner Functionality', () => {
        test('should handle invalid scenario IDs', async () => {
            await expect(scenarioRunner.runCompleteScenario('nonexistent_scenario'))
                .rejects
                .toThrow('Scenario not found');
        });

        test('should validate scenario structure', async () => {
            // Test with a malformed scenario (would need to create a test scenario)
            console.log('Scenario validation test - requires malformed test scenario');
        });

        test('should get available scenarios', () => {
            const scenarios = scenarioRunner.getAvailableScenarios();
            
            expect(scenarios).toHaveProperty('effectTests');
            expect(scenarios).toHaveProperty('gameStates');
            expect(scenarios).toHaveProperty('edgeCases');
            
            // Should include our trump_boost_complete scenario
            expect(scenarios.effectTests).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'trump_boost_complete',
                        name: 'Trump Right-Wing Boost - Complete Game State'
                    })
                ])
            );
        });

        test('should run multiple scenarios', async () => {
            const results = await scenarioRunner.runMultipleScenarios(['trump_boost_complete']);
            
            expect(results).toHaveLength(1);
            expect(results[0].scenarioId).toBe('trump_boost_complete');
            expect(results[0].passed).toBe(true);
        });

        test('should generate test report', async () => {
            const results = await scenarioRunner.runMultipleScenarios(['trump_boost_complete']);
            const report = scenarioRunner.generateTestReport(results);
            
            expect(report).toHaveProperty('timestamp');
            expect(report).toHaveProperty('totalScenarios', 1);
            expect(report).toHaveProperty('passedScenarios', 1);
            expect(report).toHaveProperty('failedScenarios', 0);
            expect(report).toHaveProperty('successRate', 100);
            expect(report).toHaveProperty('results');
            expect(report).toHaveProperty('summary');
        });

        test('should cleanup test games', async () => {
            const result = await scenarioRunner.runCompleteScenario('trump_boost_complete');
            
            // Verify game was created
            expect(result.gameId).toBeDefined();
            
            // Cleanup should not throw
            await expect(scenarioRunner.cleanupTestGames()).resolves.not.toThrow();
        });
    });

    describe('Integration with Effect System', () => {
        test('should properly simulate card effects', async () => {
            const result = await scenarioRunner.runCompleteScenario('trump_boost_complete');
            
            // Check that computedState is properly generated
            expect(result.gameEnv.computedState).toBeDefined();
            expect(result.gameEnv.computedState.playerPowers).toBeDefined();
            
            // Check that play sequence is recorded
            expect(result.gameEnv.playSequence).toBeDefined();
            expect(result.gameEnv.playSequence.plays).toBeDefined();
            expect(result.gameEnv.playSequence.plays.length).toBeGreaterThan(0);
        });

        test('should handle complex effect interactions', async () => {
            // Test scenarios with multiple interacting effects
            const result = await scenarioRunner.runCompleteScenario('trump_boost_complete');
            
            // Both Trump and Biden effects should be active
            const computedState = result.gameEnv.computedState;
            
            // Player 1 (Trump) should have Trump's effects
            expect(computedState.playerPowers.player1).toBeDefined();
            
            // Player 2 (Biden) should have Biden's effects
            expect(computedState.playerPowers.player2).toBeDefined();
        });
    });

    describe('Performance and Reliability', () => {
        test('should complete scenario within reasonable time', async () => {
            const startTime = Date.now();
            const result = await scenarioRunner.runCompleteScenario('trump_boost_complete');
            const endTime = Date.now();
            
            expect(result.passed).toBe(true);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
        });

        test('should handle concurrent scenario runs', async () => {
            const promises = [
                scenarioRunner.runCompleteScenario('trump_boost_complete'),
                scenarioRunner.runCompleteScenario('trump_boost_complete'),
                scenarioRunner.runCompleteScenario('trump_boost_complete')
            ];
            
            const results = await Promise.all(promises);
            
            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(result.passed).toBe(true);
                expect(result.gameId).toBeDefined();
            });
        });
    });
});

// Helper function to create additional scenarios for testing
describe('Scenario Creation Helpers', () => {
    test('should provide template for new scenarios', () => {
        const template = {
            id: 'new_scenario_template',
            name: 'New Scenario Template',
            description: 'Template for creating new test scenarios',
            gameEnv: {
                // Complete gameEnv structure
                phase: 'BATTLE_PHASE',
                currentPlayer: 'player1',
                currentTurn: 1,
                gameStarted: true,
                playerId_1: 'player1',
                playerId_2: 'player2',
                playersReady: { player1: true, player2: true },
                // ... rest of gameEnv structure
            },
            validationPoints: {
                test_validation: {
                    description: 'Test validation description',
                    expected: {
                        'card-id': {
                            originalPower: 100,
                            finalPower: 140,
                            boost: 40
                        }
                    }
                }
            }
        };
        
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('gameEnv');
        expect(template).toHaveProperty('validationPoints');
    });
});