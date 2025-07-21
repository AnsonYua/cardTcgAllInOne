#!/usr/bin/env node

/**
 * TEST H2 CARD SELECTION TRIGGER
 * =============================
 * 
 * Tests whether h-2 card now triggers selection properly after fixing the card definition
 */

const TestHelper = require('./src/tests/helpers/testHelper.js');
const testHelper = new TestHelper();

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testH2Selection() {
    try {
        log('🎮 Testing H2 Card Selection Trigger', 'bright');
        log('=====================================', 'bright');
        
        const gameId = 'h2_selection_test';
        
        // Create basic game state with h-2 in player 2's hand and c-1 on player 1's field
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
                        hand: ["h-1", "c-2", "c-3"],
                        mainDeck: ["c-5", "c-6", "c-7", "c-8", "c-9"],
                        leader: ["s-1", "s-2", "s-3", "s-4"],
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
                        hand: ["h-2", "c-17", "c-18"],
                        mainDeck: ["c-21", "c-22", "c-23", "c-24", "c-25"],
                        leader: ["s-2", "s-3", "s-4", "s-5"],
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
                        card: ["c-1"],
                        cardDetails: [{ id: "c-1", name: "總統特朗普", cardType: "character", gameType: "愛國者", power: 100, traits: ["特朗普家族"] }],
                        isBack: [false]
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
            pendingPlayerAction: null,
            pendingCardSelections: {},
            playSequence: { globalSequence: 0, plays: [] }
        };
        
        log('\n🔧 Injecting test game state...', 'cyan');
        await testHelper.injectGameState(gameId, gameEnv);
        log('✅ Game state injected', 'green');
        
        log('\n🎯 Player 2 plays h-2 to HELP zone...', 'magenta');
        const result = await testHelper.executePlayerAction('playerId_2', gameId, {
            type: 'PlayCard',
            card_idx: 0,  // h-2 is at index 0
            field_idx: 3  // help zone
        });
        
        log(`\n📋 Response received:`, 'blue');
        log(`   pendingPlayerAction: ${result.gameEnv.pendingPlayerAction}`, 'blue');
        log(`   pendingCardSelections keys: ${Object.keys(result.gameEnv.pendingCardSelections)}`, 'blue');
        
        // Check if selection was triggered
        if (result.gameEnv.pendingPlayerAction && Object.keys(result.gameEnv.pendingCardSelections).length > 0) {
            log('✅ SUCCESS: h-2 card triggered selection!', 'green');
            
            const selectionId = Object.keys(result.gameEnv.pendingCardSelections)[0];
            const selection = result.gameEnv.pendingCardSelections[selectionId];
            
            log(`\n📝 Selection details:`, 'cyan');
            log(`   Selection ID: ${selectionId}`, 'blue');
            log(`   Eligible cards: ${selection.eligibleCards.length}`, 'blue');
            log(`   Card IDs: ${selection.eligibleCards.map(c => c.id).join(', ')}`, 'blue');
            
            // Complete the selection
            log('\n🔄 Completing selection (targeting c-1)...', 'yellow');
            const selectionResult = await testHelper.completeCardSelection(gameId, 'playerId_2', selectionId, ['c-1']);
            
            log('✅ Selection completed successfully!', 'green');
            
            // Check final state
            const finalState = await testHelper.getPlayerData('playerId_1', gameId);
            const c1Power = finalState.gameEnv.players.playerId_1.fieldEffects.calculatedPowers['c-1'];
            
            if (c1Power === 0) {
                log('✅ FINAL SUCCESS: c-1 power set to 0 by h-2 effect!', 'green');
            } else {
                log(`❌ ISSUE: c-1 power is ${c1Power}, expected 0`, 'red');
            }
            
        } else {
            log('❌ FAILED: h-2 card did not trigger selection', 'red');
            
            // Let's check the card definition used
            if (result.gameEnv.zones.playerId_2.help.length > 0) {
                const h2Card = result.gameEnv.zones.playerId_2.help[0];
                log(`\n🔍 H-2 card in zone:`, 'yellow');
                log(JSON.stringify(h2Card, null, 2), 'yellow');
            }
            
            return false;
        }
        
        return true;
        
    } catch (error) {
        log(`\n💥 Test failed: ${error.message}`, 'red');
        if (error.stack) {
            log(`Stack trace: ${error.stack}`, 'red');
        }
        return false;
    }
}

// Run the test
testH2Selection().then(success => {
    if (success) {
        log('\n🎉 H2 SELECTION TEST PASSED!', 'bright');
    } else {
        log('\n💥 H2 SELECTION TEST FAILED!', 'red');
        process.exit(1);
    }
}).catch(error => {
    log(`Fatal error: ${error.message}`, 'red');
    process.exit(1);
});