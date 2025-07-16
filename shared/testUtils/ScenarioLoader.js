// shared/testUtils/ScenarioLoader.js
/**
 * Shared scenario loader utility for both frontend and backend testing
 * Provides consistent access to test scenarios across the application
 */

const fs = require('fs');
const path = require('path');

class ScenarioLoader {
    constructor() {
        this.scenariosPath = path.join(__dirname, '../testScenarios');
        this.cache = new Map();
    }

    /**
     * Load a specific scenario by ID
     * @param {string} scenarioId - The scenario identifier
     * @param {string} category - Category (effectTests, gameStates, edgeCases)
     * @returns {Object} Complete scenario object
     */
    loadScenario(scenarioId, category = 'effectTests') {
        const cacheKey = `${category}:${scenarioId}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const scenarioPath = path.join(this.scenariosPath, category, `${scenarioId}.json`);
        
        if (!fs.existsSync(scenarioPath)) {
            throw new Error(`Scenario not found: ${scenarioPath}`);
        }

        try {
            const scenarioData = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
            
            // Validate required fields
            this.validateScenario(scenarioData);
            
            // Cache the scenario
            this.cache.set(cacheKey, scenarioData);
            
            return scenarioData;
        } catch (error) {
            throw new Error(`Failed to load scenario ${scenarioId}: ${error.message}`);
        }
    }

    /**
     * Load all scenarios from a category
     * @param {string} category - Category directory name
     * @returns {Object} Map of scenario ID to scenario data
     */
    loadAllScenariosFromCategory(category) {
        const categoryPath = path.join(this.scenariosPath, category);
        
        if (!fs.existsSync(categoryPath)) {
            return {};
        }

        const scenarios = {};
        const files = fs.readdirSync(categoryPath);
        
        for (const file of files) {
            if (file.endsWith('.json')) {
                const scenarioId = file.replace('.json', '');
                try {
                    scenarios[scenarioId] = this.loadScenario(scenarioId, category);
                } catch (error) {
                    console.warn(`Failed to load scenario ${scenarioId}: ${error.message}`);
                }
            }
        }

        return scenarios;
    }

    /**
     * Get all available scenarios organized by category
     * @returns {Object} All scenarios organized by category
     */
    getAllScenarios() {
        const categories = ['effectTests', 'gameStates', 'edgeCases'];
        const allScenarios = {};

        for (const category of categories) {
            allScenarios[category] = this.loadAllScenariosFromCategory(category);
        }

        return allScenarios;
    }

    /**
     * Get scenario metadata (without loading full scenario)
     * @param {string} scenarioId - The scenario identifier
     * @param {string} category - Category (effectTests, gameStates, edgeCases)
     * @returns {Object} Scenario metadata
     */
    getScenarioMetadata(scenarioId, category = 'effectTests') {
        const scenario = this.loadScenario(scenarioId, category);
        return {
            id: scenario.id,
            name: scenario.name,
            description: scenario.description,
            category: category,
            validationPoints: Object.keys(scenario.validationPoints || {}).length,
            hasComputedState: !!(scenario.gameEnv && scenario.gameEnv.computedState)
        };
    }

    /**
     * Validate scenario structure
     * @param {Object} scenario - Scenario object to validate
     * @throws {Error} If validation fails
     */
    validateScenario(scenario) {
        // Required top-level fields
        const requiredFields = ['id', 'name', 'description', 'gameEnv'];
        
        for (const field of requiredFields) {
            if (!scenario[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        // Validate gameEnv structure
        this.validateGameEnv(scenario.gameEnv);

        // Validate validationPoints if present
        if (scenario.validationPoints) {
            this.validateValidationPoints(scenario.validationPoints);
        }
    }

    /**
     * Validate gameEnv structure
     * @param {Object} gameEnv - Game environment object
     * @throws {Error} If validation fails
     */
    validateGameEnv(gameEnv) {
        const requiredFields = [
            'phase', 'currentPlayer', 'currentTurn', 'gameStarted',
            'playerId_1', 'playerId_2', 'playersReady'
        ];

        for (const field of requiredFields) {
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

            // Validate required zones
            const requiredZones = ['leader', 'top', 'left', 'right', 'help', 'sp'];
            for (const zone of requiredZones) {
                if (!(zone in gameEnv[playerId].Field)) {
                    throw new Error(`Missing zone ${zone} for player: ${playerId}`);
                }
            }
        }
    }

    /**
     * Validate validation points structure
     * @param {Object} validationPoints - Validation points object
     * @throws {Error} If validation fails
     */
    validateValidationPoints(validationPoints) {
        for (const [testId, testData] of Object.entries(validationPoints)) {
            if (!testData.description) {
                throw new Error(`Missing description for validation point: ${testId}`);
            }
            
            if (!testData.expected) {
                throw new Error(`Missing expected results for validation point: ${testId}`);
            }

            // Validate expected results structure
            for (const [cardId, expected] of Object.entries(testData.expected)) {
                if (typeof expected.originalPower !== 'number' || 
                    typeof expected.finalPower !== 'number') {
                    throw new Error(`Invalid power values for card ${cardId} in test ${testId}`);
                }
            }
        }
    }

    /**
     * Clear scenario cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

module.exports = ScenarioLoader;