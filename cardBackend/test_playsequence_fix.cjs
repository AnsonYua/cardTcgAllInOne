#!/usr/bin/env node

/**
 * TEST PLAYSEQUENCE RECORDING FIX
 * ==============================
 * 
 * This test verifies that the duplicate playSequence recording issue is fixed.
 * Expected behavior:
 * - Only one PLAY_CARD record per action
 * - Correct cardId (string, not object)
 * - Correct action ("PLAY_CARD", not zone name)
 * - Correct zone (zone name, not boolean)
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8080/api/game';
const gameId = 'playsequence_fix_test';

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

async function testPlaySequenceFix() {
    try {
        log('🔧 Testing PlaySequence Recording Fix', 'bright');
        log('=====================================', 'bright');
        
        // Step 1: Inject minimal game state
        log('\\n🎯 Step 1: Injecting game state...', 'cyan');
        
        const gameEnv = {
            "phase": "MAIN_PHASE",
            "round": 1,
            "gameStarted": true,
            "currentPlayer": "playerId_1",
            "currentTurn": 0,
            "firstPlayer": 0,
            "players": {
                "playerId_1": {
                    "id": "playerId_1",
                    "name": "Player 1",
                    "deck": {
                        "hand": ["c-1", "h-1", "c-2"],
                        "mainDeck": ["c-5", "c-6"],
                        "leader": ["s-1", "s-2"],
                        "currentLeaderIdx": 0
                    },
                    "isReady": true,
                    "redraw": 1,
                    "turnAction": [],
                    "playerPoint": 0,
                    "fieldEffects": {
                        "zoneRestrictions": {},
                        "activeEffects": [],
                        "specialEffects": {},
                        "calculatedPowers": {},
                        "disabledCards": [],
                        "victoryPointModifiers": 0
                    }
                },
                "playerId_2": {
                    "id": "playerId_2",
                    "name": "Player 2",
                    "deck": {
                        "hand": ["c-17", "h-2"],
                        "mainDeck": ["c-21"],
                        "leader": ["s-2", "s-3"],
                        "currentLeaderIdx": 0
                    },
                    "isReady": true,
                    "redraw": 1,
                    "turnAction": [],
                    "playerPoint": 0,
                    "fieldEffects": {
                        "zoneRestrictions": {},
                        "activeEffects": [],
                        "specialEffects": {},
                        "calculatedPowers": {},
                        "disabledCards": [],
                        "victoryPointModifiers": 0
                    }
                }
            },
            "zones": {
                "playerId_1": {
                    "leader": {"id": "s-1", "name": "特朗普", "cardType": "leader"},
                    "top": [], "left": [], "right": [], "help": [], "sp": []
                },
                "playerId_2": {
                    "leader": {"id": "s-2", "name": "拜登", "cardType": "leader"},
                    "top": [], "left": [], "right": [], "help": [], "sp": []
                }
            },
            "gameEvents": [],
            "lastEventId": 0,
            "pendingPlayerAction": null,
            "pendingCardSelections": {},
            "playSequence": {
                "globalSequence": 0,
                "plays": []
            }
        };
        
        const injectResponse = await axios.post(`${BASE_URL}/test/injectGameState`, {
            gameId: gameId,
            gameEnv: gameEnv
        });
        
        if (injectResponse.status !== 200) {
            throw new Error(`Injection failed: ${injectResponse.status}`);
        }
        
        log('✅ Game state injected successfully', 'green');
        const initialSequence = injectResponse.data.gameEnv.playSequence;
        log(`   Initial sequence length: ${initialSequence.plays.length}`, 'blue');
        
        // Step 2: Play a card and check the sequence
        log('\\n🎯 Step 2: Playing c-1 card to LEFT zone...', 'cyan');
        
        const playResponse = await axios.post(`${BASE_URL}/player/playerAction`, {
            playerId: "playerId_1",
            gameId: gameId,
            action: {
                type: "PlayCard",
                card_idx: 0,  // c-1
                field_idx: 1  // LEFT zone
            }
        });
        
        if (playResponse.status !== 200) {
            throw new Error(`Play action failed: ${playResponse.status}`);
        }
        
        log('✅ Card played successfully', 'green');
        
        // Step 3: Analyze the playSequence
        log('\\n🔍 Step 3: Analyzing playSequence...', 'cyan');
        
        const finalSequence = playResponse.data.gameEnv.playSequence;
        const newPlays = finalSequence.plays.filter(play => 
            !initialSequence.plays.some(initial => initial.sequenceId === play.sequenceId)
        );
        
        log(`   Total plays: ${finalSequence.plays.length}`, 'blue');
        log(`   New plays added: ${newPlays.length}`, 'blue');
        
        // Validation
        let allGood = true;
        
        // Check for card plays only (exclude leader plays)
        const cardPlays = newPlays.filter(play => play.action === 'PLAY_CARD');
        
        if (cardPlays.length !== 1) {
            log(`❌ Expected 1 PLAY_CARD record, found ${cardPlays.length}`, 'red');
            allGood = false;
        } else {
            log(`✅ Found exactly 1 PLAY_CARD record`, 'green');
        }
        
        if (cardPlays.length > 0) {
            const cardPlay = cardPlays[0];
            
            // Check cardId
            if (typeof cardPlay.cardId !== 'string') {
                log(`❌ cardId should be string, found: ${typeof cardPlay.cardId}`, 'red');
                log(`   cardId value: ${JSON.stringify(cardPlay.cardId)}`, 'red');
                allGood = false;
            } else if (cardPlay.cardId === 'c-1') {
                log(`✅ cardId is correct: ${cardPlay.cardId}`, 'green');
            } else {
                log(`❌ cardId incorrect. Expected: c-1, Found: ${cardPlay.cardId}`, 'red');
                allGood = false;
            }
            
            // Check action
            if (cardPlay.action !== 'PLAY_CARD') {
                log(`❌ action should be PLAY_CARD, found: ${cardPlay.action}`, 'red');
                allGood = false;
            } else {
                log(`✅ action is correct: ${cardPlay.action}`, 'green');
            }
            
            // Check zone
            if (cardPlay.zone !== 'left') {
                log(`❌ zone should be left, found: ${cardPlay.zone}`, 'red');
                allGood = false;
            } else {
                log(`✅ zone is correct: ${cardPlay.zone}`, 'green');
            }
            
            // Check data complexity
            const dataKeys = Object.keys(cardPlay.data || {});
            if (dataKeys.length > 4) {
                log(`⚠️  data object has ${dataKeys.length} keys - might be too complex`, 'yellow');
                log(`   Keys: ${dataKeys.join(', ')}`, 'yellow');
            } else {
                log(`✅ data object complexity reasonable (${dataKeys.length} keys)`, 'green');
            }
        }
        
        // Final summary
        log('\\n🏆 TEST SUMMARY', 'bright');
        log('==============', 'bright');
        
        if (allGood) {
            log('✅ All validations passed! PlaySequence recording is fixed.', 'green');
        } else {
            log('❌ Some validations failed. PlaySequence recording needs more work.', 'red');
        }
        
        // Show the problematic record details if any
        if (cardPlays.length > 0) {
            log('\\n📊 Card Play Record Details:', 'cyan');
            console.log(JSON.stringify(cardPlays[0], null, 2));
        }
        
    } catch (error) {
        log(`\\n💥 Test failed: ${error.message}`, 'red');
        if (error.response) {
            log(`   Status: ${error.response.status}`, 'red');
            log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
        }
        process.exit(1);
    }
}

// Run the test
testPlaySequenceFix().catch(error => {
    log(`Fatal error: ${error.message}`, 'red');
    process.exit(1);
});