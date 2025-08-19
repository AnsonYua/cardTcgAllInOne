#!/usr/bin/env node

const TestHelper = require('./src/tests/helpers/testHelper.js');
const testHelper = new TestHelper();

async function debugInjectOnly() {
    try {
        console.log('Testing game state injection only...');
        
        const gameId = 'debug_inject_test';
        
        const gameEnv = {
            phase: "MAIN_PHASE",
            round: 1,
            gameStarted: true,
            currentPlayer: "playerId_1",
            currentTurn: 0,
            firstPlayer: 0,
            players: {
                playerId_1: {
                    id: "playerId_1",
                    name: "Player 1",
                    deck: {
                        hand: ["c-1", "h-1"],
                        mainDeck: [],
                        leader: ["s-1"],
                        currentLeaderIdx: 0
                    },
                    isReady: true,
                    redraw: 1,
                    turnAction: [],
                    playerPoint: 0,
                    fieldEffects: {
                        zoneRestrictions: {},
                        activeEffects: [],
                        specialEffects: {},
                        calculatedPowers: {},
                        disabledCards: [],
                        victoryPointModifiers: 0
                    }
                },
                playerId_2: {
                    id: "playerId_2",
                    name: "Player 2",
                    deck: {
                        hand: ["h-2"],
                        mainDeck: [],
                        leader: ["s-2"],
                        currentLeaderIdx: 0
                    },
                    isReady: true,
                    redraw: 1,
                    turnAction: [],
                    playerPoint: 0,
                    fieldEffects: {
                        zoneRestrictions: {},
                        activeEffects: [],
                        specialEffects: {},
                        calculatedPowers: {},
                        disabledCards: [],
                        victoryPointModifiers: 0
                    }
                }
            },
            zones: {
                playerId_1: {
                    leader: { id: "s-1", name: "特朗普", cardType: "leader" },
                    top: [],
                    left: [],
                    right: [],
                    help: [],
                    sp: []
                },
                playerId_2: {
                    leader: { id: "s-2", name: "拜登", cardType: "leader" },
                    top: [],
                    left: [],
                    right: [],
                    help: [],
                    sp: []
                }
            },
            gameEvents: [],
            lastEventId: 0,
            // REFACTOR: Consolidated card selection system - removed pendingPlayerAction
            pendingCardSelections: {},
            playSequence: { globalSequence: 0, plays: [] }
        };
        
        console.log('Injecting game state...');
        await testHelper.injectGameState(gameId, gameEnv);
        console.log('✅ Game state injection successful');
        
        console.log('Getting player data to verify...');
        const result = await testHelper.getPlayerData('playerId_1', gameId);
        console.log('✅ Player data retrieved successfully');
        console.log('Phase:', result.gameEnv.phase);
        console.log('Current player:', result.gameEnv.currentPlayer);
        
        return true;
        
    } catch (error) {
        console.error(`💥 Debug failed: ${error.message}`);
        if (error.stack) {
            console.error(`Stack trace: ${error.stack}`);
        }
        return false;
    }
}

debugInjectOnly().then(success => {
    if (success) {
        console.log('🎉 DEBUG INJECT TEST PASSED!');
    } else {
        console.log('💥 DEBUG INJECT TEST FAILED!');
        process.exit(1);
    }
}).catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});