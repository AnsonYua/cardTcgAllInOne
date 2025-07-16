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

class TestHelper {
    constructor(baseUrl = 'http://localhost:8080/api/game') {
        this.baseUrl = baseUrl;
        this.testScenariosPath = path.join(__dirname, '../../../../shared/testScenarios/gameStates');
    }

    /**
     * Make HTTP request to the backend
     */
    async makeRequest(method, endpoint, body = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (body) {
            config.body = JSON.stringify(body);
        }
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
            }
            
            return data;
        } catch (error) {
            throw new Error(`Request failed: ${error.message}`);
        }
    }

    /**
     * Load test scenario from JSON file
     */
    async loadTestScenario(filename) {
        const filePath = path.join(this.testScenariosPath, filename);
        
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to load test scenario ${filename}: ${error.message}`);
        }
    }

    /**
     * Inject game state and return the result
     */
    async injectGameState(gameId, gameEnv) {
        return await this.makeRequest('POST', '/test/injectGameState', {
            gameId,
            gameEnv
        });
    }

    /**
     * Get player data for a specific game
     */
    async getPlayerData(playerId, gameId) {
        return await this.makeRequest('GET', `/player/${playerId}?gameId=${gameId}`);
    }

    /**
     * Run a complete test scenario
     */
    async runTestScenario(scenarioFile) {
        const scenario = await this.loadTestScenario(scenarioFile);
        const { gameId, gameEnv, validationPoints } = scenario;
        
        // Inject the game state
        const injectResult = await this.injectGameState(gameId, gameEnv);
        
        // Get the current game state
        const playerData = await this.getPlayerData('playerId_1', gameId);
        
        return {
            scenario,
            gameEnv: playerData.gameEnv,
            validationPoints,
            injectResult
        };
    }

    /**
     * Validate power calculations against expected results
     */
    validatePowerCalculations(gameEnv, validationPoints) {
        const results = [];
        
        if (!validationPoints || typeof validationPoints !== 'object') {
            console.log('⚠️  Debug: validationPoints is not an object:', validationPoints);
            return results;
        }
        
        for (const [pointId, validation] of Object.entries(validationPoints)) {
            console.log('🔍 Debug: Processing validation point:', pointId, validation);
            
            if (!validation || typeof validation !== 'object') {
                console.log('⚠️  Debug: validation is not an object:', validation);
                continue;
            }
            
            const { expected, description } = validation;
            
            if (!expected) {
                console.log('⚠️  Debug: expected is missing:', expected);
                continue;
            }
            
            const { cardId, finalPower } = expected;
            
            // Find the card in the game environment
            const cardLocation = this.findCardInGameEnv(gameEnv, cardId);
            
            const result = {
                pointId,
                description,
                cardId,
                expected: finalPower,
                actual: cardLocation?.actualPower || null,
                passed: cardLocation?.actualPower === finalPower,
                cardFound: cardLocation !== null,
                location: cardLocation?.location || null
            };
            
            results.push(result);
        }
        
        return results;
    }

    /**
     * Find a card in the game environment and return its location and power
     */
    findCardInGameEnv(gameEnv, cardId) {
        //console.log('🔍 Debug: Finding card', cardId, 'in gameEnv');
        
        if (!gameEnv || !gameEnv.zones) {
            console.log('⚠️  Debug: gameEnv.zones is missing:', gameEnv);
            return null;
        }
        
        // Search through all zones for the card
        for (const playerId of ['playerId_1', 'playerId_2']) {
            const zones = gameEnv.zones[playerId];
            
            if (!zones) {
                console.log('⚠️  Debug: zones is missing for', playerId);
                continue;
            }
            
            for (const [zoneName, zoneCards] of Object.entries(zones)) {
                if (zoneName === 'leader') continue;
                
                const foundCard = zoneCards.find(card => card.id === cardId);
                if (foundCard) {
                    return {
                        location: { playerId, zone: zoneName },
                        card: foundCard,
                        actualPower: this.calculateActualPower(foundCard, gameEnv, playerId)
                    };
                }
            }
        }
        
        return null;
    }

    /**
     * Calculate the actual power of a card considering all effects
     * This is a simplified version - in reality, you'd need to implement
     * the full effect calculation logic
     */
    calculateActualPower(card, gameEnv, playerId) {
        let power = card.power;
        
        // Get the leader for this player
        const leader = gameEnv.zones[playerId].leader;
        
        // Apply leader effects based on the leader's rules
        if (leader && leader.effects && leader.effects.rules) {
            for (const rule of leader.effects.rules) {
                if (rule.type === 'continuous') {
                    power += this.applyEffectRule(rule, card, gameEnv, playerId);
                }
            }
        }
        
        return power;
    }

    /**
     * Apply a specific effect rule to a card
     */
    applyEffectRule(rule, card, gameEnv, playerId) {
        let powerModification = 0;
        
        // Check if the rule applies to this card
        if (this.doesRuleApplyToCard(rule, card, gameEnv, playerId)) {
            if (rule.effect.type === 'powerBoost') {
                powerModification = rule.effect.value;
            } else if (rule.effect.type === 'setPower') {
                // For setPower effects, we need to return the difference
                // to achieve the target power
                powerModification = rule.effect.value - card.power;
            }
        }
        
        return powerModification;
    }

    /**
     * Check if a rule applies to a specific card
     */
    doesRuleApplyToCard(rule, card, gameEnv, playerId) {
        // Check target owner
        if (rule.target.owner === 'self' && playerId !== this.getCardOwner(card, gameEnv)) {
            return false;
        }
        
        // Check zone restrictions
        const cardLocation = this.findCardInGameEnv(gameEnv, card.id);
        if (rule.target.zones && !rule.target.zones.includes(cardLocation.location.zone)) {
            return false;
        }
        
        // Check filters
        if (rule.target.filters) {
            for (const filter of rule.target.filters) {
                if (!this.doesFilterMatch(filter, card, gameEnv)) {
                    return false;
                }
            }
        }
        
        // Check trigger conditions
        if (rule.trigger.conditions) {
            for (const condition of rule.trigger.conditions) {
                if (!this.doesConditionMatch(condition, gameEnv, playerId)) {
                    return false;
                }
            }
        }
        
        return true;
    }

    /**
     * Check if a filter matches a card
     */
    doesFilterMatch(filter, card, gameEnv) {
        switch (filter.type) {
            case 'gameType':
                return card.gameType === filter.value;
            case 'gameTypeOr':
                return filter.values.includes(card.gameType);
            case 'trait':
                return card.traits && card.traits.includes(filter.value);
            case 'nameContains':
                return card.name.includes(filter.value);
            default:
                return true;
        }
    }

    /**
     * Check if a condition matches the game state
     */
    doesConditionMatch(condition, gameEnv, playerId) {
        switch (condition.type) {
            case 'opponentLeader':
                const opponentId = playerId === 'playerId_1' ? 'playerId_2' : 'playerId_1';
                const opponentLeader = gameEnv.zones[opponentId].leader;
                return opponentLeader && opponentLeader.name === condition.value;
            default:
                return true;
        }
    }

    /**
     * Get the owner of a card
     */
    getCardOwner(card, gameEnv) {
        const location = this.findCardInGameEnv(gameEnv, card.id);
        return location?.location?.playerId || null;
    }

    /**
     * Create a simple game state for testing
     */
    createBasicGameState(gameId, player1Leader, player2Leader) {
        return {
            gameId,
            gameEnv: {
                phase: 'MAIN_PHASE',
                round: 1,
                gameStarted: true,
                players: {
                    playerId_1: {
                        id: 'playerId_1',
                        name: 'playerId_1',
                        hand: [],
                        deck: {
                            mainDeck: [],
                            leader: [player1Leader, 's-2', 's-3', 's-4'],
                            currentLeaderIdx: 0
                        },
                        isReady: true,
                        redraw: 1,
                        turnAction: [],
                        fieldEffects: {
                            zoneRestrictions: {
                                TOP: 'ALL',
                                LEFT: 'ALL',
                                RIGHT: 'ALL',
                                HELP: 'ALL',
                                SP: 'ALL'
                            },
                            activeEffects: []
                        }
                    },
                    playerId_2: {
                        id: 'playerId_2',
                        name: 'playerId_2',
                        hand: [],
                        deck: {
                            mainDeck: [],
                            leader: [player2Leader, 's-3', 's-4', 's-5'],
                            currentLeaderIdx: 0
                        },
                        isReady: true,
                        redraw: 1,
                        turnAction: [],
                        fieldEffects: {
                            zoneRestrictions: {
                                TOP: 'ALL',
                                LEFT: 'ALL',
                                RIGHT: 'ALL',
                                HELP: 'ALL',
                                SP: 'ALL'
                            },
                            activeEffects: []
                        }
                    }
                },
                zones: {
                    playerId_1: {
                        leader: null, // Will be set based on player1Leader
                        TOP: [],
                        LEFT: [],
                        RIGHT: [],
                        HELP: [],
                        SP: []
                    },
                    playerId_2: {
                        leader: null, // Will be set based on player2Leader
                        TOP: [],
                        LEFT: [],
                        RIGHT: [],
                        HELP: [],
                        SP: []
                    }
                },
                victoryPoints: {
                    playerId_1: 0,
                    playerId_2: 0
                },
                gameEvents: [],
                lastEventId: 1,
                pendingPlayerAction: null,
                pendingCardSelections: {},
                playSequence: {
                    globalSequence: 0,
                    plays: []
                },
                computedState: {
                    playerPowers: {},
                    activeRestrictions: {},
                    disabledCards: [],
                    victoryPointModifiers: {}
                }
            },
            lastUpdate: new Date().toISOString(),
            validationPoints: {}
        };
    }
}

module.exports = TestHelper;