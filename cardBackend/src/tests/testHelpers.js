const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api/game';

/**
 * Make a POST request to the game API
 * @param {string} endpoint - API endpoint
 * @param {Object} body - Request body
 * @returns {Promise<Object>} - Response data
 */
async function makePostRequest(endpoint, body) {
    try {
        const response = await axios.post(`${API_BASE_URL}${endpoint}`, body, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        console.log("-----------response------------");
        console.log(response);
        console.log("--------------------------------");
        return response.data;
    } catch (error) {
        console.log("-----------response------------");
        console.log(error);
        console.log("--------------------------------");
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            return error.response.data;
        }
        throw error;
    }
}

async function loadTestScenario(scenarioName) {
    try {
        const filePath = path.join(__dirname, 'scenarios', `${scenarioName}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        throw new Error(`Failed to load test scenario: ${error.message}`);
    }
}

async function injectGameState(scenario) {
    try {
        return await makePostRequest('/test/injectGameState', scenario);
    } catch (error) {
        throw new Error(`Failed to inject game state: ${error.message}`);
    }
}

/**
 * Set up a new test game
 * @returns {Promise<Object>} - Game setup response
 */
async function setupTestGame() {
    return await makePostRequest('/player/startGame', {
        playerId: "playerId_1",
        players: ["playerId_1", "playerId_2"]
    });
}

async function performPlayerAction(gameId, playerId, action) {
    try {
        return await makePostRequest('/player/playerAction', {
            playerId: playerId,
            gameId: gameId,
            action: action
        });
    } catch (error) {
        console.log("-----------error------------");
        console.log(error);
        console.log("--------------------------------");
        throw new Error(`Failed to perform player action: ${error.message}`);
    }
}

/**
 * Create a test game environment
 * @returns {Object} - Test game environment
 */
function createTestGameEnv() {
    return {
        playerId_1: {
            deck: {
                hand: [],
                mainDeck: [],
                leader: []
            },
            Field: {
                top: [],
                left: [],
                right: [],
                help: [],
                summonner: []
            }
        },
        playerId_2: {
            deck: {
                hand: [],
                mainDeck: [],
                leader: []
            },
            Field: {
                top: [],
                left: [],
                right: [],
                help: [],
                summonner: []
            }
        },
        firstPlayer: null,
        currentPlayer: null
    };
}

module.exports = {
    loadTestScenario,
    injectGameState,
    setupTestGame,
    performPlayerAction,
    makePostRequest,
    createTestGameEnv
}; 