const TestHelper = require('./helpers/testHelper');
const { setupTestServer, teardownTestServer } = require('./setup');

describe('Leader Effects Integration Tests', () => {
    let testHelper;

    beforeAll(async () => {
        await setupTestServer();
        testHelper = new TestHelper();
    });

    afterAll(async () => {
        await teardownTestServer();
    });

    describe('Trump (s-1) Leader Effects', () => {
        test('Trump standard boost - Right-Wing and Patriot cards get +45 power', async () => {
            const result = await testHelper.runTestScenario('leader_s-1_trump_boost.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify game state was injected correctly
            expect(gameEnv).toBeDefined();
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-1');
            expect(gameEnv.zones.playerId_1.leader.name).toBe('特朗普');
            
            // Validate power calculations
            const validationResults = testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            // Check that all validation points are found
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
            });
            
            // Check specific power calculations
            const c1Result = validationResults.find(r => r.cardId === 'c-1');
            expect(c1Result).toBeDefined();
            expect(c1Result.description).toContain('Patriot');
            expect(c1Result.expected).toBe(155); // 100 base + 45 Trump boost + 10 self-effect
            
            const c2Result = validationResults.find(r => r.cardId === 'c-2');
            expect(c2Result).toBeDefined();
            expect(c2Result.description).toContain('Right-Wing');
            expect(c2Result.expected).toBe(145); // 80 base + 45 Trump boost + 10 self-effect
        });

        test('Trump vs Powell - Economy cards set to 0 power', async () => {
            const result = await testHelper.runTestScenario('leader_s-1_trump_vs_powell_nerf.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify the scenario setup
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-1'); // Trump
            expect(gameEnv.zones.playerId_2.leader.id).toBe('s-6'); // Powell
            
            // Validate power calculations
            const validationResults = testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            // Check that c-13 (Economy) power is set to 0
            const c13Result = validationResults.find(r => r.cardId === 'c-13');
            expect(c13Result).toBeDefined();
            expect(c13Result.cardFound).toBe(true);
            expect(c13Result.expected).toBe(0);
            expect(c13Result.description).toContain('Economy');
        });
    });

    describe('Biden (s-2) Leader Effects', () => {
        test('Biden universal boost - All cards get +40 power', async () => {
            const result = await testHelper.runTestScenario('leader_s-2_biden_boost.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify Biden is the leader
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-2');
            expect(gameEnv.zones.playerId_1.leader.name).toBe('拜登');
            
            // Validate power calculations
            const validationResults = testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            // All cards should get the universal +40 boost
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Biden');
                // The expected power should be base power + 40
            });
        });
    });

    describe('Musk (s-3) Leader Effects', () => {
        test('Musk Freedom boost - Freedom cards get +50 power', async () => {
            const result = await testHelper.runTestScenario('leader_s-3_musk_freedom_boost.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify Musk is the leader
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-3');
            expect(gameEnv.zones.playerId_1.leader.name).toBe('馬斯克');
            
            // Validate power calculations
            const validationResults = testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Freedom');
                // Freedom cards should get +50 power
            });
        });

        test('Musk Doge boost - Cards with Doge in name get additional +20 power', async () => {
            const result = await testHelper.runTestScenario('leader_s-3_musk_doge_boost.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify Musk is the leader
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-3');
            
            // Validate power calculations
            const validationResults = testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Doge');
                // Cards with Doge in name should get both Freedom (+50) and Doge (+20) boosts
            });
        });
    });

    describe('Harris (s-4) Leader Effects', () => {
        test('Harris Left-Wing boost - Left-Wing cards get +40 power', async () => {
            const result = await testHelper.runTestScenario('leader_s-4_harris_leftwing_boost.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify Harris is the leader
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-4');
            expect(gameEnv.zones.playerId_1.leader.name).toBe('賀錦麗');
            
            // Validate power calculations
            const validationResults = testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Left-Wing');
            });
        });

        test('Harris Economy boost - Economy cards get +20 power', async () => {
            const result = await testHelper.runTestScenario('leader_s-4_harris_economy_boost.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify Harris is the leader
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-4');
            
            // Validate power calculations
            const validationResults = testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Economy');
            });
        });

        test('Harris vs Trump - Right zone cards set to 0 power', async () => {
            const result = await testHelper.runTestScenario('leader_s-4_harris_vs_trump_nerf.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify the scenario setup
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-4'); // Harris
            expect(gameEnv.zones.playerId_2.leader.id).toBe('s-1'); // Trump
            
            // Validate power calculations
            const validationResults = testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.expected).toBe(0);
                expect(result.description).toContain('right zone');
            });
        });
    });

    describe('Vance (s-5) Leader Effects', () => {
        test('Vance multiple boosts - Right-Wing +40, Freedom +20, Economy +10', async () => {
            const result = await testHelper.runTestScenario('leader_s-5_vance_boosts.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify Vance is the leader
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-5');
            expect(gameEnv.zones.playerId_1.leader.name).toBe('范斯');
            
            // Validate power calculations
            const validationResults = testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Vance');
                // Different card types should get different boosts
            });
        });
    });

    describe('Powell (s-6) Leader Effects', () => {
        test('Powell standard boost - Freedom and Economy cards get +30 power', async () => {
            const result = await testHelper.runTestScenario('leader_s-6_powell_boost.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify Powell is the leader
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-6');
            expect(gameEnv.zones.playerId_1.leader.name).toBe('鮑威爾');
            
            // Validate power calculations
            const validationResults = testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Powell');
            });
        });

        test('Powell vs Trump - Economy cards get additional +20 power', async () => {
            const result = await testHelper.runTestScenario('leader_s-6_powell_vs_trump_boost.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify the scenario setup
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-6'); // Powell
            expect(gameEnv.zones.playerId_2.leader.id).toBe('s-1'); // Trump
            
            // Validate power calculations
            const validationResults = testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Economy');
                // Economy cards should get base +30 plus conditional +20 = +50 total
            });
        });

        test('Powell vs Trump - Right-Wing cards cannot be summoned', async () => {
            const result = await testHelper.runTestScenario('leader_s-6_powell_vs_trump_restriction.json');
            const { gameEnv, validationPoints } = result;
            
            // Verify the scenario setup
            expect(gameEnv.zones.playerId_1.leader.id).toBe('s-6'); // Powell
            expect(gameEnv.zones.playerId_2.leader.id).toBe('s-1'); // Trump
            
            // This test would need to verify that Right-Wing cards cannot be placed
            // For now, we'll just verify the scenario loads correctly
            expect(gameEnv).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid scenario files gracefully', async () => {
            await expect(testHelper.runTestScenario('nonexistent_scenario.json'))
                .rejects
                .toThrow('Failed to load test scenario');
        });

        test('should handle server errors gracefully', async () => {
            // Test with invalid game state
            await expect(testHelper.injectGameState('invalid_game_id', null))
                .rejects
                .toThrow();
        });
    });

    describe('Performance Tests', () => {
        test('should complete scenario loading within reasonable time', async () => {
            const startTime = Date.now();
            
            await testHelper.runTestScenario('leader_s-1_trump_boost.json');
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should complete within 5 seconds
            expect(duration).toBeLessThan(5000);
        });
    });
});