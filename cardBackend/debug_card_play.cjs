#!/usr/bin/env node

const TestHelper = require('./src/tests/helpers/testHelper.js');
const testHelper = new TestHelper();

async function debugCardPlay() {
    try {
        console.log('Testing simple card play...');
        
        const gameId = 'debug_card_play_test';
        
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
                        mainDeck: ["c-5", "c-6", "c-7", "c-8", "c-9"],
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
                        mainDeck: ["c-17", "c-18", "c-19", "c-20", "c-21"],
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
            pendingPlayerAction: null,
            pendingCardSelections: {},
            playSequence: { globalSequence: 0, plays: [] }
        };
        
        console.log('Injecting game state...');
        await testHelper.injectGameState(gameId, gameEnv);
        console.log('✅ Game state injection successful');
        
        console.log('Player 1 plays c-1 (character) to LEFT zone...');
        const result = await testHelper.executePlayerAction('playerId_1', gameId, {
            type: 'PlayCard',
            card_idx: 0,  // c-1
            field_idx: 1  // left zone
        });
        
        console.log('✅ Card play successful');
        console.log('Phase:', result.gameEnv.phase);
        console.log('Current player:', result.gameEnv.currentPlayer);
        console.log('Left zone contents:', result.gameEnv.zones.playerId_1.left);
        
        return true;
        
    } catch (error) {
        console.error(`💥 Debug failed: ${error.message}`);
        if (error.stack) {
            console.error(`Stack trace: ${error.stack}`);
        }
        return false;
    }
}

debugCardPlay().then(success => {
    if (success) {
        console.log('🎉 DEBUG CARD PLAY TEST PASSED!');
    } else {
        console.log('💥 DEBUG CARD PLAY TEST FAILED!');
        process.exit(1);
    }
}).catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});