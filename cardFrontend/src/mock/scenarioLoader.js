// cardFrontend/src/mock/scenarioLoader.js
/**
 * Frontend scenario loader for complete GameEnv test scenarios
 * Handles loading, validation, and management of test scenarios
 */

import testConfig from './testConfig.json';

class FrontendScenarioLoader {
    constructor() {
        this.cache = new Map();
        this.currentScenario = null;
    }

    /**
     * Get all available scenarios from config
     * @returns {Object} All scenarios with metadata
     */
    static getAllScenarios() {
        return testConfig.scenarios;
    }

    /**
     * Get scenarios grouped by category
     * @returns {Object} Scenarios grouped by category
     */
    static getScenariosByCategory() {
        const scenarios = testConfig.scenarios;
        const categories = {};

        for (const [id, scenario] of Object.entries(scenarios)) {
            const category = scenario.category || 'misc';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push({ id, ...scenario });
        }

        return categories;
    }

    /**
     * Load a complete scenario asynchronously
     * @param {string} scenarioId - The scenario identifier
     * @returns {Promise<Object>} Complete scenario object
     */
    static async loadCompleteScenario(scenarioId) {
        const scenarioConfig = testConfig.scenarios[scenarioId];
        
        if (!scenarioConfig) {
            throw new Error(`Scenario not found: ${scenarioId}`);
        }

        // For frontend, we'll load from the shared directory
        // In a real implementation, this would be adapted for browser environment
        const scenarioPath = `../../../${scenarioConfig.source}`;
        
        try {
            // In browser environment, this would be a fetch request
            const response = await fetch(scenarioPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch scenario: ${response.status}`);
            }
            
            const scenario = await response.json();
            
            // Validate the scenario structure
            FrontendScenarioLoader.validateScenario(scenario);
            
            return scenario;
        } catch (error) {
            // Fallback for development/testing
            console.warn(`Failed to load scenario ${scenarioId} from ${scenarioPath}:`, error.message);
            
            // Return a basic scenario structure for development
            return FrontendScenarioLoader.createFallbackScenario(scenarioId, scenarioConfig);
        }
    }

    /**
     * Create a fallback scenario for development
     * @param {string} scenarioId - Scenario ID
     * @param {Object} scenarioConfig - Scenario configuration
     * @returns {Object} Fallback scenario
     */
    static createFallbackScenario(scenarioId, scenarioConfig) {
        return {
            id: scenarioId,
            name: scenarioConfig.name,
            description: scenarioConfig.description,
            gameEnv: {
                phase: "BATTLE_PHASE",
                currentPlayer: "player1",
                currentTurn: 1,
                gameStarted: true,
                playerId_1: "player1",
                playerId_2: "player2",
                playersReady: { player1: true, player2: true },
                player1: {
                    deck: { currentLeaderIdx: 0, leader: ["s-1"], hand: [], mainDeck: [] },
                    Field: { leader: null, top: [], left: [], right: [], help: [], sp: [] },
                    turnAction: [],
                    playerPoint: 0,
                    redraw: 0,
                    fieldEffects: { zoneRestrictions: {}, activeEffects: [] }
                },
                player2: {
                    deck: { currentLeaderIdx: 0, leader: ["s-2"], hand: [], mainDeck: [] },
                    Field: { leader: null, top: [], left: [], right: [], help: [], sp: [] },
                    turnAction: [],
                    playerPoint: 0,
                    redraw: 0,
                    fieldEffects: { zoneRestrictions: {}, activeEffects: [] }
                },
                gameEvents: [],
                lastEventId: 0,
                pendingPlayerAction: null,
                pendingCardSelections: {},
                playSequence: { globalSequence: 0, plays: [] },
                computedState: { playerPowers: {}, activeRestrictions: {}, disabledCards: [], victoryPointModifiers: {} }
            },
            validationPoints: {}
        };
    }

    /**
     * Validate scenario structure
     * @param {Object} scenario - Scenario object to validate
     * @throws {Error} If validation fails
     */
    static validateScenario(scenario) {
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
            if (!gameEnv[playerId] || !gameEnv[playerId].Field) {
                throw new Error(`Invalid player structure for: ${playerId}`);
            }
        }
    }

    /**
     * Get current active scenario ID
     * @returns {string} Current scenario ID
     */
    static getCurrentScenarioId() {
        return testConfig.activeScenario;
    }

    /**
     * Set active scenario
     * @param {string} scenarioId - Scenario ID to set as active
     */
    static setActiveScenario(scenarioId) {
        if (!testConfig.scenarios[scenarioId]) {
            throw new Error(`Scenario not found: ${scenarioId}`);
        }
        
        testConfig.activeScenario = scenarioId;
        
        // Save to localStorage for persistence
        localStorage.setItem('activeScenario', scenarioId);
    }

    /**
     * Get scenario metadata without loading full scenario
     * @param {string} scenarioId - Scenario ID
     * @returns {Object} Scenario metadata
     */
    static getScenarioMetadata(scenarioId) {
        const scenarioConfig = testConfig.scenarios[scenarioId];
        
        if (!scenarioConfig) {
            throw new Error(`Scenario not found: ${scenarioId}`);
        }

        return {
            id: scenarioId,
            name: scenarioConfig.name,
            category: scenarioConfig.category,
            description: scenarioConfig.description,
            source: scenarioConfig.source
        };
    }

    /**
     * Export current game state as a new scenario
     * @param {Object} gameState - Current game state
     * @param {string} name - Scenario name
     * @param {string} description - Scenario description
     * @returns {Object} Exportable scenario object
     */
    static exportGameStateAsScenario(gameState, name, description) {
        const scenarioId = `exported_${Date.now()}`;
        
        const scenario = {
            id: scenarioId,
            name: name || `Exported Scenario ${new Date().toISOString()}`,
            description: description || "Exported from frontend demo",
            gameEnv: JSON.parse(JSON.stringify(gameState)), // Deep copy
            validationPoints: {
                custom_validation: {
                    description: "Custom validation point - define your expected results",
                    expected: {}
                }
            }
        };

        return scenario;
    }

    /**
     * Download scenario as JSON file
     * @param {Object} scenario - Scenario object
     * @param {string} filename - Optional filename
     */
    static downloadScenario(scenario, filename) {
        const jsonStr = JSON.stringify(scenario, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `${scenario.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Get validation configuration
     * @returns {Object} Validation configuration
     */
    static getValidationConfig() {
        return testConfig.validation;
    }

    /**
     * Get UI configuration
     * @returns {Object} UI configuration
     */
    static getUIConfig() {
        return testConfig.ui;
    }

    /**
     * Update test configuration
     * @param {Object} updates - Configuration updates
     */
    static updateConfig(updates) {
        Object.assign(testConfig, updates);
        
        // Save to localStorage
        localStorage.setItem('testConfig', JSON.stringify(testConfig));
    }

    /**
     * Load configuration from localStorage
     */
    static loadConfigFromStorage() {
        const stored = localStorage.getItem('testConfig');
        if (stored) {
            try {
                const storedConfig = JSON.parse(stored);
                Object.assign(testConfig, storedConfig);
            } catch (error) {
                console.warn('Failed to load config from localStorage:', error);
            }
        }

        // Load active scenario from localStorage
        const activeScenario = localStorage.getItem('activeScenario');
        if (activeScenario && testConfig.scenarios[activeScenario]) {
            testConfig.activeScenario = activeScenario;
        }
    }
}

// Initialize configuration from localStorage
FrontendScenarioLoader.loadConfigFromStorage();

export default FrontendScenarioLoader;