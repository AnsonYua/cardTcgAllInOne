// cardBackend/src/tests/testUtils/CompleteScenarioRunner.js
/**
 * Backend scenario runner for complete GameEnv test scenarios
 * Handles loading, execution, and validation of complete game scenarios
 */

const path = require('path');
const fs = require('fs');
const gameLogic = require('../../services/GameLogic');

class CompleteScenarioRunner {
    constructor() {
        this.scenariosPath = path.join(__dirname, '../../../shared/testScenarios');
        this.testGameIds = new Set(); // Track test game IDs for cleanup
    }

    /**
     * Run a complete scenario and validate results
     * @param {string} scenarioId - The scenario identifier
     * @param {string} category - Category (effectTests, gameStates, edgeCases)
     * @returns {Promise<Object>} Test results with validation
     */
    async runCompleteScenario(scenarioId, category = 'effectTests') {
        console.log(`🎬 Running complete scenario: ${scenarioId} (${category})`);
        
        const scenarioPath = path.join(this.scenariosPath, category, `${scenarioId}.json`);
        
        if (!fs.existsSync(scenarioPath)) {
            throw new Error(`Scenario not found: ${scenarioPath}`);
        }

        let scenario;
        try {
            scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
        } catch (error) {
            throw new Error(`Failed to parse scenario ${scenarioId}: ${error.message}`);
        }

        // Validate scenario structure
        this.validateScenario(scenario);

        // Create unique test game ID
        const gameId = `test-${scenarioId}-${Date.now()}`;
        this.testGameIds.add(gameId);

        try {
            // Inject complete game environment
            const result = await gameLogic.injectGameState(gameId, scenario.gameEnv);
            
            // Get updated state after injection (includes effect simulation)
            const gameData = await gameLogic.getGameState(gameId);
            
            if (!gameData) {
                throw new Error(`Failed to retrieve game state for ${gameId}`);
            }

            // Validate against expected results
            const validation = this.validateCompleteScenario(gameData.gameEnv, scenario.validationPoints);
            
            const testResult = {
                scenarioId: scenarioId,
                category: category,
                gameId: gameId,
                gameEnv: gameData.gameEnv,
                validation: validation,
                passed: validation.passed,
                executionTime: Date.now(),
                scenario: scenario
            };

            console.log(`✅ Scenario ${scenarioId} completed - ${validation.passed ? 'PASSED' : 'FAILED'}`);
            
            return testResult;
        } catch (error) {
            console.error(`❌ Scenario ${scenarioId} failed:`, error.message);
            throw error;
        }
    }

    /**
     * Validate complete scenario against expected results
     * @param {Object} gameEnv - Current game environment
     * @param {Object} validationPoints - Expected validation points
     * @returns {Object} Validation results
     */
    validateCompleteScenario(gameEnv, validationPoints) {
        const validation = { 
            passed: true, 
            results: {},
            summary: {
                totalTests: 0,
                passedTests: 0,
                totalCards: 0,
                passedCards: 0
            }
        };

        if (!validationPoints || Object.keys(validationPoints).length === 0) {
            console.warn('No validation points provided');
            return validation;
        }

        for (const [testId, testData] of Object.entries(validationPoints)) {
            validation.summary.totalTests++;
            
            validation.results[testId] = {
                description: testData.description,
                passed: true,
                cards: {}
            };

            for (const [cardId, expected] of Object.entries(testData.expected)) {
                validation.summary.totalCards++;
                
                const actualPower = this.getCardPowerFromGameEnv(gameEnv, cardId);
                const passed = actualPower === expected.finalPower;

                validation.results[testId].cards[cardId] = {
                    expected: expected.finalPower,
                    actual: actualPower,
                    originalPower: expected.originalPower,
                    boost: expected.boost || 0,
                    passed: passed
                };

                if (!passed) {
                    validation.passed = false;
                    validation.results[testId].passed = false;
                    console.log(`❌ Card ${cardId}: Expected ${expected.finalPower}, got ${actualPower}`);
                } else {
                    validation.summary.passedCards++;
                    console.log(`✅ Card ${cardId}: Expected ${expected.finalPower}, got ${actualPower}`);
                }
            }
            
            if (validation.results[testId].passed) {
                validation.summary.passedTests++;
            }
        }

        // Calculate success rate
        validation.summary.successRate = validation.summary.totalCards > 0 ? 
            (validation.summary.passedCards / validation.summary.totalCards) * 100 : 0;

        console.log(`📊 Validation Summary: ${validation.summary.passedCards}/${validation.summary.totalCards} cards passed (${validation.summary.successRate.toFixed(1)}%)`);

        return validation;
    }

    /**
     * Get card power from game environment
     * @param {Object} gameEnv - Game environment
     * @param {string} cardId - Card ID to find
     * @returns {number} Card power value
     */
    getCardPowerFromGameEnv(gameEnv, cardId) {
        // Check computedState first (includes effect modifications)
        if (gameEnv.computedState && gameEnv.computedState.playerPowers) {
            for (const [playerId, powers] of Object.entries(gameEnv.computedState.playerPowers)) {
                if (powers[cardId]) {
                    return powers[cardId].finalPower;
                }
            }
        }

        // Fallback to searching field data
        const playerIds = [gameEnv.playerId_1, gameEnv.playerId_2];
        
        for (const playerId of playerIds) {
            if (!gameEnv[playerId] || !gameEnv[playerId].Field) continue;
            
            const field = gameEnv[playerId].Field;
            
            // Check all zones
            for (const [zone, cards] of Object.entries(field)) {
                if (zone === 'leader' && field.leader && field.leader.id === cardId) {
                    return field.leader.power || field.leader.initialPoint || 0;
                }
                
                if (Array.isArray(cards)) {
                    for (const card of cards) {
                        if (card.cardDetails && card.cardDetails[0] && card.cardDetails[0].id === cardId) {
                            return card.valueOnField || card.cardDetails[0].power || 0;
                        }
                    }
                }
            }
        }

        console.warn(`Card ${cardId} not found in game environment`);
        return 0;
    }

    /**
     * Validate scenario structure
     * @param {Object} scenario - Scenario to validate
     * @throws {Error} If validation fails
     */
    validateScenario(scenario) {
        const requiredFields = ['id', 'name', 'description', 'gameEnv'];
        
        for (const field of requiredFields) {
            if (!scenario[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Validate gameEnv structure
        const gameEnv = scenario.gameEnv;
        const requiredGameEnvFields = [
            'phase', 'currentPlayer', 'currentTurn', 'gameStarted',
            'playerId_1', 'playerId_2', 'playersReady'
        ];

        for (const field of requiredGameEnvFields) {
            if (!(field in gameEnv)) {
                throw new Error(`Missing required gameEnv field: ${field}`);
            }
        }

        // Validate player structure
        const playerIds = [gameEnv.playerId_1, gameEnv.playerId_2];
        for (const playerId of playerIds) {
            if (!gameEnv[playerId]) {
                throw new Error(`Missing player data for: ${playerId}`);
            }
            
            if (!gameEnv[playerId].Field) {
                throw new Error(`Missing Field data for player: ${playerId}`);
            }
        }
    }

    /**
     * Run multiple scenarios
     * @param {Array} scenarioIds - Array of scenario IDs to run
     * @param {string} category - Category for scenarios
     * @returns {Promise<Array>} Array of test results
     */
    async runMultipleScenarios(scenarioIds, category = 'effectTests') {
        const results = [];
        
        for (const scenarioId of scenarioIds) {
            try {
                const result = await this.runCompleteScenario(scenarioId, category);
                results.push(result);
            } catch (error) {
                results.push({
                    scenarioId: scenarioId,
                    category: category,
                    passed: false,
                    error: error.message,
                    validation: { passed: false, results: {} }
                });
            }
        }

        return results;
    }

    /**
     * Run all scenarios in a category
     * @param {string} category - Category to run all scenarios from
     * @returns {Promise<Array>} Array of test results
     */
    async runAllScenariosInCategory(category) {
        const categoryPath = path.join(this.scenariosPath, category);
        
        if (!fs.existsSync(categoryPath)) {
            throw new Error(`Category not found: ${category}`);
        }

        const files = fs.readdirSync(categoryPath);
        const scenarioIds = files
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace('.json', ''));

        console.log(`🎯 Running all scenarios in category ${category}: ${scenarioIds.join(', ')}`);

        return await this.runMultipleScenarios(scenarioIds, category);
    }

    /**
     * Generate test report
     * @param {Array} testResults - Array of test results
     * @returns {Object} Test report
     */
    generateTestReport(testResults) {
        const report = {
            timestamp: new Date().toISOString(),
            totalScenarios: testResults.length,
            passedScenarios: testResults.filter(r => r.passed).length,
            failedScenarios: testResults.filter(r => !r.passed).length,
            successRate: 0,
            results: testResults,
            summary: {
                totalTests: 0,
                passedTests: 0,
                totalCards: 0,
                passedCards: 0
            }
        };

        // Calculate aggregate statistics
        testResults.forEach(result => {
            if (result.validation && result.validation.summary) {
                report.summary.totalTests += result.validation.summary.totalTests;
                report.summary.passedTests += result.validation.summary.passedTests;
                report.summary.totalCards += result.validation.summary.totalCards;
                report.summary.passedCards += result.validation.summary.passedCards;
            }
        });

        report.successRate = report.totalScenarios > 0 ? 
            (report.passedScenarios / report.totalScenarios) * 100 : 0;

        return report;
    }

    /**
     * Clean up test game data
     * @returns {Promise<void>}
     */
    async cleanupTestGames() {
        const gameDataPath = path.join(__dirname, '../../gameData');
        
        for (const gameId of this.testGameIds) {
            const filePath = path.join(gameDataPath, `${gameId}.json`);
            
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`🧹 Cleaned up test game: ${gameId}`);
                } catch (error) {
                    console.warn(`Failed to cleanup ${gameId}:`, error.message);
                }
            }
        }

        this.testGameIds.clear();
    }

    /**
     * Get available scenarios
     * @returns {Object} Available scenarios by category
     */
    getAvailableScenarios() {
        const categories = ['effectTests', 'gameStates', 'edgeCases'];
        const scenarios = {};

        for (const category of categories) {
            const categoryPath = path.join(this.scenariosPath, category);
            scenarios[category] = [];

            if (fs.existsSync(categoryPath)) {
                const files = fs.readdirSync(categoryPath);
                
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const scenarioId = file.replace('.json', '');
                        try {
                            const scenarioPath = path.join(categoryPath, file);
                            const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
                            
                            scenarios[category].push({
                                id: scenarioId,
                                name: scenario.name,
                                description: scenario.description,
                                validationPoints: Object.keys(scenario.validationPoints || {}).length
                            });
                        } catch (error) {
                            console.warn(`Failed to load scenario metadata ${scenarioId}:`, error.message);
                        }
                    }
                }
            }
        }

        return scenarios;
    }
}

module.exports = CompleteScenarioRunner;