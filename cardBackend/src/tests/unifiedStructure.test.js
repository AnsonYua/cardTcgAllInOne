const TestHelper = require('./helpers/testHelper');

describe('Unified GameEnv Structure Tests', () => {
    let testHelper;
    
    beforeEach(() => {
        testHelper = new TestHelper();
    });

    test('should create game with unified structure', async () => {
        const scenario = {
            gameId: 'test-unified-structure',
            initialGameEnv: {
                gameId: 'test-unified-structure',
                phase: 'MAIN_PHASE',
                round: 1,
                gameStarted: true,
                currentPlayer: 'playerId_1',
                currentTurn: 0,
                firstPlayer: 0,
                players: {
                    playerId_1: {
                        id: 'playerId_1',
                        name: 'playerId_1',
                        deck: {
                            hand: ['c-1', 'c-2'],
                            mainDeck: ['c-3', 'c-4'],
                            leader: ['s-1', 's-2'],
                            currentLeaderIdx: 0
                        },
                        isReady: true,
                        redraw: 1,
                        turnAction: [],
                        playerPoint: 0
                    },
                    playerId_2: {
                        id: 'playerId_2',
                        name: 'playerId_2',
                        deck: {
                            hand: ['c-21', 'c-22'],
                            mainDeck: ['c-23', 'c-24'],
                            leader: ['s-2', 's-3'],
                            currentLeaderIdx: 0
                        },
                        isReady: true,
                        redraw: 1,
                        turnAction: [],
                        playerPoint: 0
                    }
                },
                zones: {
                    playerId_1: {
                        leader: { id: 's-1', name: 'Trump' },
                        top: [],
                        left: [],
                        right: [],
                        help: [],
                        sp: []
                    },
                    playerId_2: {
                        leader: { id: 's-2', name: 'Biden' },
                        top: [],
                        left: [],
                        right: [],
                        help: [],
                        sp: []
                    }
                },
                fieldEffects: {
                    playerId_1: {
                        zoneRestrictions: {
                            TOP: ['右翼', '自由'],
                            LEFT: ['右翼', '愛國者'],
                            RIGHT: ['右翼', '經濟'],
                            HELP: 'ALL',
                            SP: 'ALL'
                        },
                        activeEffects: []
                    },
                    playerId_2: {
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
                gameEvents: [],
                lastEventId: 1,
                pendingPlayerAction: null,
                pendingCardSelections: {},
                playSequence: { globalSequence: 0, plays: [] },
                computedState: {
                    playerPowers: {},
                    activeRestrictions: {},
                    disabledCards: [],
                    victoryPointModifiers: {}
                }
            }
        };
        
        // Test that we can inject and retrieve the unified structure
        const injectResult = await testHelper.injectGameState(scenario.gameId, scenario.initialGameEnv);
        
        expect(injectResult).toBeDefined();
        expect(injectResult.gameEnv).toBeDefined();
        expect(injectResult.gameEnv.players).toBeDefined();
        expect(injectResult.gameEnv.zones).toBeDefined();
        expect(injectResult.gameEnv.fieldEffects).toBeDefined();
        
        // Test that player data is accessible
        expect(injectResult.gameEnv.players.playerId_1).toBeDefined();
        expect(injectResult.gameEnv.players.playerId_1.deck.hand).toEqual(['c-1', 'c-2']);
        
        // Test that zone data is accessible
        expect(injectResult.gameEnv.zones.playerId_1).toBeDefined();
        expect(injectResult.gameEnv.zones.playerId_1.leader.id).toBe('s-1');
        
        // Test that field effects are accessible
        expect(injectResult.gameEnv.fieldEffects.playerId_1).toBeDefined();
        expect(injectResult.gameEnv.fieldEffects.playerId_1.zoneRestrictions.TOP).toEqual(['右翼', '自由']);
        
        console.log('✅ Unified structure test passed');
    });
    
    test('should work with gameUtils helper functions', () => {
        const { getPlayerFromGameEnv, getPlayerData, getPlayerField, getPlayerFieldEffects } = require('../utils/gameUtils');
        
        const mockGameEnv = {
            players: {
                playerId_1: { id: 'playerId_1', deck: { hand: ['c-1'] } },
                playerId_2: { id: 'playerId_2', deck: { hand: ['c-2'] } }
            },
            zones: {
                playerId_1: { leader: { id: 's-1' }, top: [] },
                playerId_2: { leader: { id: 's-2' }, top: [] }
            },
            fieldEffects: {
                playerId_1: { zoneRestrictions: { TOP: ['右翼'] } },
                playerId_2: { zoneRestrictions: { TOP: 'ALL' } }
            }
        };
        
        // Test player list extraction
        const playerList = getPlayerFromGameEnv(mockGameEnv);
        expect(playerList).toEqual(['playerId_1', 'playerId_2']);
        
        // Test player data extraction
        const playerData = getPlayerData(mockGameEnv, 'playerId_1');
        expect(playerData).toBeDefined();
        expect(playerData.deck.hand).toEqual(['c-1']);
        
        // Test player field extraction
        const playerField = getPlayerField(mockGameEnv, 'playerId_1');
        expect(playerField).toBeDefined();
        expect(playerField.leader.id).toBe('s-1');
        
        // Test player field effects extraction
        const fieldEffects = getPlayerFieldEffects(mockGameEnv, 'playerId_1');
        expect(fieldEffects).toBeDefined();
        expect(fieldEffects.zoneRestrictions.TOP).toEqual(['右翼']);
        
        console.log('✅ GameUtils helper functions test passed');
    });
});