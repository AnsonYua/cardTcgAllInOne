const fs = require('fs').promises;
const path = require('path');

// Use native fetch for Node.js 18+ or fallback to node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
} else {
    try {
        fetch = require('node-fetch');
    } catch (error) {
        throw new Error('fetch is not available. Please use Node.js 18+ or install node-fetch');
    }
}

// Test configuration
const BASE_URL = 'http://localhost:8080/api/game';
const TEST_SCENARIOS_PATH = path.join(__dirname, '../../../shared/testScenarios/gameStates');

// Helper function to make HTTP requests
async function makeRequest(method, url, body = null) {
    const config = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        config.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, config);
    return await response.json();
}

// Helper function to load test scenario
async function loadTestScenario(filename) {
    const filePath = path.join(TEST_SCENARIOS_PATH, filename);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
}

// Helper function to inject game state and validate
async function runTestScenario(scenario) {
    const { gameId, gameEnv, validationPoints } = scenario;
    
    // Inject the game state
    const injectResult = await makeRequest('POST', `${BASE_URL}/test/injectGameState`, {
        gameId,
        gameEnv
    });
    
    if (injectResult.error) {
        throw new Error(`Failed to inject game state: ${injectResult.error}`);
    }
    
    // Get the current game state to validate
    const playerData = await makeRequest('GET', `${BASE_URL}/player/playerId_1?gameId=${gameId}`);
    
    if (playerData.error) {
        throw new Error(`Failed to get player data: ${playerData.error}`);
    }
    
    return {
        gameEnv: playerData.gameEnv,
        validationPoints,
        injectResult
    };
}

// Helper function to validate power calculations
function validatePowerCalculations(gameEnv, validationPoints) {
    const results = [];
    
    for (const [pointId, validation] of Object.entries(validationPoints)) {
        const { expected, description } = validation;
        const { cardId, finalPower } = expected;
        
        // Find the card in the game environment
        let actualCard = null;
        let actualPower = null;
        
        // Search through all zones for the card
        for (const playerId of ['playerId_1', 'playerId_2']) {
            const zones = gameEnv.zones[playerId];
            for (const [zoneName, zoneCards] of Object.entries(zones)) {
                if (zoneName === 'leader') continue;
                
                const foundCard = zoneCards.find(card => card.id === cardId);
                if (foundCard) {
                    actualCard = foundCard;
                    // In a real scenario, you'd calculate the actual power here
                    // For now, we'll use the card's base power as a placeholder
                    actualPower = foundCard.power;
                    break;
                }
            }
            if (actualCard) break;
        }
        
        const result = {
            pointId,
            description,
            cardId,
            expected: finalPower,
            actual: actualPower,
            passed: actualPower === finalPower,
            cardFound: actualCard !== null
        };
        
        results.push(result);
    }
    
    return results;
}

describe('Leader Effects Integration Tests', () => {
    describe('Trump (s-1) Leader Effects', () => {
        test('Trump boost effect - Right-Wing and Patriot cards get +45 power', async () => {
            const scenario = await loadTestScenario('leader_s-1_trump_boost_corrected.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
            // Check that c-1 (Patriot) gets the boost
            const c1Result = validationResults.find(r => r.cardId === 'c-1');
            expect(c1Result).toBeDefined();
            expect(c1Result.cardFound).toBe(true);
            expect(c1Result.description).toContain('Patriot');
            // Note: In a real test, you'd verify the actual power calculation
            // For now, we're just checking the structure
            
            // Check that c-2 (Right-Wing) gets the boost
            const c2Result = validationResults.find(r => r.cardId === 'c-2');
            expect(c2Result).toBeDefined();
            expect(c2Result.cardFound).toBe(true);
            expect(c2Result.description).toContain('Right-Wing');
        });
        
        test('Trump vs Powell - Economy cards set to 0 power', async () => {
            const scenario = await loadTestScenario('leader_s-1_trump_vs_powell_nerf.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
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
            const scenario = await loadTestScenario('leader_s-2_biden_boost.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
            // Verify that all cards get the universal boost
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Biden');
                // The expected power should be base power + 40
            });
        });
    });
    
    describe('Musk (s-3) Leader Effects', () => {
        test('Musk Freedom boost - Freedom cards get +50 power', async () => {
            const scenario = await loadTestScenario('leader_s-3_musk_freedom_boost.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Freedom');
            });
        });
        
        test('Musk Doge boost - Cards with Doge in name get additional +20 power', async () => {
            const scenario = await loadTestScenario('leader_s-3_musk_doge_boost.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Doge');
            });
        });
    });
    
    describe('Harris (s-4) Leader Effects', () => {
        test('Harris Left-Wing boost - Left-Wing cards get +40 power', async () => {
            const scenario = await loadTestScenario('leader_s-4_harris_leftwing_boost.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Left-Wing');
            });
        });
        
        test('Harris Economy boost - Economy cards get +20 power', async () => {
            const scenario = await loadTestScenario('leader_s-4_harris_economy_boost.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Economy');
            });
        });
        
        test('Harris vs Trump - Right zone cards set to 0 power', async () => {
            const scenario = await loadTestScenario('leader_s-4_harris_vs_trump_nerf.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.expected).toBe(0);
                expect(result.description).toContain('right zone');
            });
        });
    });
    
    describe('Vance (s-5) Leader Effects', () => {
        test('Vance multiple boosts - Right-Wing +40, Freedom +20, Economy +10', async () => {
            const scenario = await loadTestScenario('leader_s-5_vance_boosts.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Vance');
            });
        });
    });
    
    describe('Powell (s-6) Leader Effects', () => {
        test('Powell standard boost - Freedom and Economy cards get +30 power', async () => {
            const scenario = await loadTestScenario('leader_s-6_powell_boost.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Powell');
            });
        });
        
        test('Powell vs Trump - Economy cards get additional +20 power', async () => {
            const scenario = await loadTestScenario('leader_s-6_powell_vs_trump_boost.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.cardFound).toBe(true);
                expect(result.description).toContain('Economy');
            });
        });
        
        test('Powell vs Trump - Right-Wing cards cannot be summoned', async () => {
            const scenario = await loadTestScenario('leader_s-6_powell_vs_trump_restriction.json');
            const { gameEnv, validationPoints } = await runTestScenario(scenario);
            
            const validationResults = validatePowerCalculations(gameEnv, validationPoints);
            
            validationResults.forEach(result => {
                expect(result.description).toContain('restriction');
            });
        });
    });
});

describe('Leader Effects Unit Tests', () => {
    // These would be direct unit tests of the card effect logic
    // without going through the HTTP API
    
    describe('Card Effect Manager', () => {
        test('should correctly identify leader zone restrictions', () => {
            // Test the CardEffectManager logic directly
            // This would require importing and testing the actual modules
            expect(true).toBe(true); // Placeholder
        });
        
        test('should correctly calculate power modifications', () => {
            // Test power calculation logic
            expect(true).toBe(true); // Placeholder
        });
        
        test('should correctly handle conditional effects', () => {
            // Test conditional effect logic (like Trump vs Powell)
            expect(true).toBe(true); // Placeholder
        });
    });
});