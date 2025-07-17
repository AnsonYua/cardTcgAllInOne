const TestHelper = require('./helpers/testHelper');

describe('Quick Integration Tests', () => {
    let testHelper;
    
    beforeEach(() => {
        testHelper = new TestHelper();
    });

    test('unified structure should work with API', async () => {
        try {
            // Create a game with unified structure
            const gameEnv = {
                gameId: 'test-integration',
                phase: 'MAIN_PHASE',
                round: 1,
                gameStarted: true,
                currentPlayer: 'playerId_1',
                currentTurn: 0,
                firstPlayer: 0,
                players: {
                    playerId_1: {
                        id: 'playerId_1',
                        name: 'Player 1',
                        deck: { hand: ['c-1'], mainDeck: ['c-2'], leader: ['s-1'], currentLeaderIdx: 0 },
                        isReady: true,
                        redraw: 1,
                        turnAction: [],
                        playerPoint: 0
                    },
                    playerId_2: {
                        id: 'playerId_2',
                        name: 'Player 2',
                        deck: { hand: ['c-21'], mainDeck: ['c-22'], leader: ['s-2'], currentLeaderIdx: 0 },
                        isReady: true,
                        redraw: 1,
                        turnAction: [],
                        playerPoint: 0
                    }
                },
                zones: {
                    playerId_1: { leader: { id: 's-1' }, top: [], left: [], right: [], help: [], sp: [] },
                    playerId_2: { leader: { id: 's-2' }, top: [], left: [], right: [], help: [], sp: [] }
                },
                fieldEffects: {
                    playerId_1: { zoneRestrictions: { TOP: 'ALL' }, activeEffects: [] },
                    playerId_2: { zoneRestrictions: { TOP: 'ALL' }, activeEffects: [] }
                },
                gameEvents: [],
                lastEventId: 1,
                pendingPlayerAction: null,
                pendingCardSelections: {},
                playSequence: { globalSequence: 0, plays: [] },
                computedState: { playerPowers: {}, activeRestrictions: {}, disabledCards: [], victoryPointModifiers: {} }
            };
            
            const result = await testHelper.injectGameState('test-integration', gameEnv);
            
            expect(result).toBeDefined();
            expect(result.gameEnv.players).toBeDefined();
            expect(result.gameEnv.zones).toBeDefined();
            expect(result.gameEnv.fieldEffects).toBeDefined();
            
            // Verify data integrity
            expect(result.gameEnv.players.playerId_1.deck.hand[0]).toBe('c-1');
            expect(result.gameEnv.zones.playerId_1.leader.id).toBe('s-1');
            expect(result.gameEnv.fieldEffects.playerId_1.zoneRestrictions.TOP).toBe('ALL');
            
            console.log('✅ API integration test passed');
        } catch (error) {
            console.error('❌ API integration test failed:', error);
            throw error;
        }
    });
});