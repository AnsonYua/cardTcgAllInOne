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
        // Check if it's a leader effect test file (starts with "leader_")
        let filePath;
        if (filename.startsWith('leader_')) {
            filePath = path.join(this.testScenariosPath, 'LeaderCase', filename);
        } else if (filename.startsWith('utility_') || filename.startsWith('h1_') || filename.startsWith('targetCount_')) {
            filePath = path.join(this.testScenariosPath, 'UtilityEffects', filename);
        } else if (filename.startsWith('character_')) {
            filePath = path.join(this.testScenariosPath, 'CharacterCase', filename);
        } else {
            filePath = path.join(this.testScenariosPath, filename);
        }
        
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
     * Execute a player action
     */
    async executePlayerAction(playerId, gameId, action) {
        return await this.makeRequest('POST', '/player/playerAction', {
            playerId,
            gameId,
            action
        });
    }

    /**
     * Complete card selection
     */
    async completeCardSelection(gameId, playerId, selectionId, selectedCardIds) {
        return await this.makeRequest('POST', '/player/selectCard', {
            gameId,
            playerId,
            selectionId,
            selectedCardIds
        });
    }

    /**
     * Acknowledge game events
     */
    async acknowledgeEvents(gameId, eventIds) {
        return await this.makeRequest('POST', '/player/acknowledgeEvents', {
            gameId,
            eventIds
        });
    }

    /**
     * Acknowledge events of specific types (helper function)
     */
    async acknowledgeEventsByType(gameId, playerId, eventTypes) {
        // Get current game state to find events
        const gameState = await this.getPlayerData(playerId, gameId);
        
        if (!gameState.gameEnv || !gameState.gameEnv.gameEvents) {
            return { eventsAcknowledged: 0, message: 'No events found' };
        }

        // Filter events by type
        const eventsToAck = gameState.gameEnv.gameEvents.filter(event => 
            eventTypes.includes(event.type)
        );

        if (eventsToAck.length === 0) {
            return { eventsAcknowledged: 0, message: `No events of types: ${eventTypes.join(', ')}` };
        }

        // Acknowledge the events
        const eventIds = eventsToAck.map(event => event.id);
        const result = await this.acknowledgeEvents(gameId, eventIds);
        
        return {
            ...result,
            acknowledgedEventTypes: eventsToAck.map(e => e.type),
            acknowledgedEventIds: eventIds
        };
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
    validatePowerCalculations(gameEnv, validationPoints, cardDefinitions = null) {
        const results = [];
        
        if (!validationPoints || typeof validationPoints !== 'object') {
            console.log('⚠️  Debug: validationPoints is not an object:', validationPoints);
            return results;
        }
        
        for (const [pointId, validation] of Object.entries(validationPoints)) {
            if (!validation || typeof validation !== 'object') {
                continue;
            }
            
            const { expected, description } = validation;
            
            if (!expected) {
                continue;
            }
            
            const { cardId, finalPower } = expected;
            
            // Find the card in the game environment
            const cardLocation = this.findCardInGameEnv(gameEnv, cardId);
            
            // Calculate actual power with card definitions
            let actualPower = null;
            if (cardLocation) {
                actualPower = this.calculateActualPower(cardLocation.card, gameEnv, cardLocation.location.playerId, cardLocation, cardDefinitions);
            }
            
            const result = {
                pointId,
                description,
                cardId,
                expected: finalPower,
                actual: actualPower,
                passed: actualPower === finalPower,
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
                
                const foundCard = zoneCards.find(card => {
                    // Handle both unified format (card.cardDetails[0].id) and simple format (card.id)
                    return card.cardDetails?.[0]?.id === cardId || card.id === cardId;
                });
                if (foundCard) {
                    const cardLocation = {
                        location: { playerId, zone: zoneName },
                        card: foundCard,
                        actualPower: null // Will be calculated next
                    };
                    // Calculate actual power passing the location to avoid recursion
                    cardLocation.actualPower = this.calculateActualPower(foundCard, gameEnv, playerId, cardLocation);
                    return cardLocation;
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
    calculateActualPower(card, gameEnv, playerId, cardLocation = null, cardDefinitions = null) {
        // Handle both unified format (card.cardDetails[0].power) and simple format (card.power)
        let power = card.cardDetails?.[0]?.power || card.power || card.valueOnField || 0;
        let setPowerValue = null; // Track if any setPower effect applies
        
        // Get the leader for this player
        const leader = gameEnv.zones[playerId].leader;
        
        // Apply leader effects based on the leader's rules
        if (leader && leader.effects && leader.effects.rules) {
            for (const rule of leader.effects.rules) {
                if (rule.type === 'continuous') {
                    const result = this.applyEffectRule(rule, card, gameEnv, playerId, cardLocation);
                    if (result.type === 'setPower') {
                        setPowerValue = result.value;
                    } else {
                        power += result.value;
                    }
                }
            }
        }
        
        // Apply card effects from all cards on the field
        for (const playerIdKey of ['playerId_1', 'playerId_2']) {
            if (gameEnv.zones && gameEnv.zones[playerIdKey]) {
                const zones = gameEnv.zones[playerIdKey];
                for (const [zoneName, zoneCards] of Object.entries(zones)) {
                    if (zoneName === 'leader') continue;
                    
                    for (const fieldCard of zoneCards) {
                        // Handle unified format card structure
                        const fieldCardData = fieldCard.cardDetails?.[0] || fieldCard;
                        const fieldCardId = fieldCardData.id;
                        
                        // Get card effects from definitions if not in field card
                        let cardEffects = fieldCardData.effects;
                        if (!cardEffects && cardDefinitions && cardDefinitions[fieldCardId]) {
                            cardEffects = cardDefinitions[fieldCardId].effects;
                        }
                        
                        if (cardEffects && cardEffects.rules) {
                            for (const rule of cardEffects.rules) {
                                if (rule.type === 'continuous') {
                                    // Cards with targetCount should not apply to themselves (like Obama)
                                    // Cards without targetCount can apply to themselves (like Trump)
                                    if (rule.target.targetCount && rule.target.targetCount > 0) {
                                        const targetCardData = card.cardDetails?.[0] || card;
                                        if (fieldCardId === targetCardData.id) {
                                            continue; // Skip self-effects for targetCount effects
                                        }
                                    }
                                    
                                    // Handle targetCount - if specified, only apply to limited number of cards
                                    if (rule.target.targetCount && rule.target.targetCount > 0) {
                                        // For targetCount effects, only apply to first eligible card
                                        // This is a simplified implementation - in reality you'd need more complex logic
                                        if (cardLocation && cardLocation.location.playerId === playerIdKey) {
                                            const result = this.applyEffectRule(rule, card, gameEnv, playerIdKey, cardLocation);
                                            if (result.type === 'setPower') {
                                                setPowerValue = result.value;
                                            } else {
                                                power += result.value;
                                            }
                                        }
                                    } else {
                                        const result = this.applyEffectRule(rule, card, gameEnv, playerIdKey, cardLocation);
                                        if (result.type === 'setPower') {
                                            setPowerValue = result.value;
                                        } else {
                                            power += result.value;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // If any setPower effect was applied, use that value instead
        if (setPowerValue !== null) {
            power = setPowerValue;
        }
        
        return power;
    }

    /**
     * Apply a specific effect rule to a card
     */
    applyEffectRule(rule, card, gameEnv, playerId, cardLocation) {
        // Check if the rule applies to this card (pass cardLocation to avoid recursion)
        if (this.doesRuleApplyToCard(rule, card, gameEnv, playerId, cardLocation)) {
            if (rule.effect.type === 'powerBoost') {
                return { type: 'powerBoost', value: rule.effect.value };
            } else if (rule.effect.type === 'setPower') {
                return { type: 'setPower', value: rule.effect.value };
            }
        }
        
        return { type: 'powerBoost', value: 0 };
    }

    /**
     * Check if a rule applies to a specific card
     */
    doesRuleApplyToCard(rule, card, gameEnv, playerId, cardLocation = null) {
        // Check target owner
        if (rule.target.owner === 'self' && playerId !== cardLocation?.location?.playerId) {
            return false;
        }
        
        // Check zone restrictions (use provided location to avoid recursion)
        if (rule.target.zones && cardLocation) {
            const cardZone = cardLocation.location.zone.toLowerCase();
            const targetZones = rule.target.zones.map(zone => zone.toLowerCase());
            if (!targetZones.includes(cardZone)) {
                return false;
            }
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
        // Handle both unified format (card.cardDetails[0]) and simple format (card)
        const cardData = card.cardDetails?.[0] || card;
        
        switch (filter.type) {
            case 'gameType':
                return cardData.gameType === filter.value;
            case 'gameTypeOr':
                return filter.values.includes(cardData.gameType);
            case 'trait':
                return cardData.traits && cardData.traits.includes(filter.value);
            case 'nameContains':
                return cardData.name && cardData.name.includes(filter.value);
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
    getCardOwner(card, gameEnv, cardLocation = null) {
        if (cardLocation) {
            return cardLocation.location?.playerId || null;
        }
        // Only call findCardInGameEnv if no location provided (avoid recursion)
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