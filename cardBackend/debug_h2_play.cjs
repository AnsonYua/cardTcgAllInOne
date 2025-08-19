#!/usr/bin/env node

const TestHelper = require('./src/tests/helpers/testHelper.js');
const testHelper = new TestHelper();

async function debugH2Play() {
    try {
        console.log('Testing h-2 card play...');
        
        const gameId = 'debug_h2_play_test';
        
        const gameEnv = {
            phase: "MAIN_PHASE",
            round: 1,
            gameStarted: true,
            currentPlayer: "playerId_2",
            currentTurn: 1,
            firstPlayer: 0,
            players: {
                playerId_1: {
                    id: "playerId_1",
                    name: "Player 1",
                    deck: {
                        hand: ["c-2", "h-1"],
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
                    left: [{
                        id: "c-1", 
                        name: "總統特朗普", 
                        cardType: "character", 
                        gameType: "愛國者", 
                        power: 100,
                        traits: ["特朗普家族"]
                    }],
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
        
        console.log('Player 2 plays h-2 to HELP zone...');
        const result = await testHelper.executePlayerAction('playerId_2', gameId, {
            type: 'PlayCard',
            card_idx: 0,  // h-2
            field_idx: 3  // help zone
        });
        
        console.log('✅ H-2 card play successful');
        console.log('Phase:', result.gameEnv.phase);
        console.log('Current player:', result.gameEnv.currentPlayer);
        console.log('Help zone contents:', result.gameEnv.zones.playerId_2.help);
        // REFACTOR: Check consolidated selection system
        const hasPendingSelection = result.gameEnv.pendingCardSelections && Object.keys(result.gameEnv.pendingCardSelections).length > 0;
        console.log('Pending selection:', hasPendingSelection ? Object.keys(result.gameEnv.pendingCardSelections) : 'none');
        
        return true;
        
    } catch (error) {
        console.error(`💥 Debug failed: ${error.message}`);
        if (error.stack) {
            console.error(`Stack trace: ${error.stack}`);
        }
        return false;
    }
}

debugH2Play().then(success => {
    if (success) {
        console.log('🎉 DEBUG H2 PLAY TEST PASSED!');
    } else {
        console.log('💥 DEBUG H2 PLAY TEST FAILED!');
        process.exit(1);
    }
}).catch(error => {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
});