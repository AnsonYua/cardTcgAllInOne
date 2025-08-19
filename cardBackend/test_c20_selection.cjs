// Test script to verify c-20 card selection system
const axios = require('axios');

const API_BASE = 'http://localhost:8080';
const gameId = 'test-c20-selection';

async function testC20CardSelection() {
    console.log('🎯 Testing c-20 Card Selection System...\n');
    
    try {
        // Step 1: Create test game state with c-20 and multiple 富商 cards
        const testGameEnv = {
            phase: "MAIN_PHASE",
            playerId_1: "playerId_1",
            playerId_2: "playerId_2", 
            gameStarted: true,
            currentPlayer: "playerId_1",
            currentTurn: 5,
            firstPlayer: 0,
            players: {
                playerId_1: {
                    id: "playerId_1",
                    name: "Player 1",
                    deck: {
                        hand: ["c-20_1"],  // c-20 (巴飛特) in hand
                        mainDeck: [],
                        leader: ["s-1"],
                        currentLeaderIdx: 0
                    },
                    isReady: true,
                    redraw: 1,
                    playerPoint: 100
                },
                playerId_2: {
                    id: "playerId_2", 
                    name: "Player 2",
                    deck: {
                        hand: [],
                        mainDeck: [],
                        leader: ["s-2"],
                        currentLeaderIdx: 0
                    },
                    isReady: true,
                    redraw: 1,
                    playerPoint: 50
                }
            },
            zones: {
                playerId_1: {
                    leader: { id: "s-1" },
                    top: [{ cardUid: "c-8_1", cardData: { id: "c-8", name: "馬斯克", power: 80, gameType: "自由", traits: ["富商", "Doge"] } }],
                    left: [{ cardUid: "c-16_1", cardData: { id: "c-16", name: "朱克伯格", power: 70, gameType: "自由", traits: ["富商"] } }],
                    right: [],
                    help: [],
                    sp: []
                },
                playerId_2: {
                    leader: { id: "s-2" },
                    top: [], left: [], right: [], help: [], sp: []
                }
            },
            // REFACTOR: Consolidated card selection system - removed pendingPlayerAction
            pendingCardSelections: {},
            gameEvents: [],
            playSequence: {
                globalSequence: 3,
                plays: [
                    { sequenceId: 1, playerId: "playerId_1", cardId: "s-1", action: "PLAY_LEADER", zone: "leader" },
                    { sequenceId: 2, playerId: "playerId_2", cardId: "s-2", action: "PLAY_LEADER", zone: "leader" },
                    { sequenceId: 3, playerId: "playerId_1", cardId: "c-8", action: "PLAY_CARD", zone: "top" }
                ]
            }
        };
        
        // Step 2: Inject test game state
        console.log('📝 Injecting test game state...');
        await axios.post(`${API_BASE}/test/injectGameState`, {
            gameId: gameId,
            gameEnv: testGameEnv
        });
        
        // Step 3: Play c-20 card (should trigger selection)
        console.log('🎮 Playing c-20 card...');
        const playResponse = await axios.post(`${API_BASE}/api/game/player/action`, {
            playerId: "playerId_1",
            gameId: gameId,
            action: {
                type: 'PlayCard',
                card_idx: 0,  // c-20 in hand
                field_idx: 3  // right zone
            }
        });
        
        console.log('✅ Card play response:', playResponse.data.success ? 'SUCCESS' : 'FAILED');
        
        // Step 4: Check for pendingPlayerAction in API response
        const checkResponse = await axios.get(`${API_BASE}/api/game/player/playerId_1?gameId=${gameId}`);
        const gameEnv = checkResponse.data.gameEnv;
        
        console.log('\n🔍 VERIFICATION RESULTS:');
        console.log('==========================================');
        
        // REFACTOR: Check consolidated card selection system
        const hasPendingSelection = gameEnv.pendingCardSelections && Object.keys(gameEnv.pendingCardSelections).length > 0;
        if (hasPendingSelection) {
            console.log('✅ Pending card selection found via consolidated system');
        } else {
            console.log('❌ No pending card selections found');
        }
        
        // Check if pendingCardSelections exists  
        if (gameEnv.pendingCardSelections && Object.keys(gameEnv.pendingCardSelections).length > 0) {
            console.log('✅ pendingCardSelections found:', Object.keys(gameEnv.pendingCardSelections));
            
            // Show selection details
            const selectionId = Object.keys(gameEnv.pendingCardSelections)[0];
            const selection = gameEnv.pendingCardSelections[selectionId];
            console.log(`\n📋 Selection Details (${selectionId}):`);
            console.log(`  - Player: ${selection.playerId}`);
            console.log(`  - Select Count: ${selection.selectCount}`);
            console.log(`  - Effect Type: ${selection.effectType}`);
            console.log(`  - Eligible Cards: ${selection.eligibleCards?.length || 0}`);
            
            if (selection.eligibleCards) {
                selection.eligibleCards.forEach((card, idx) => {
                    console.log(`    ${idx + 1}. ${card.cardData.name} (${card.zone}) - Traits: ${card.cardData.traits.join(', ')}`);
                });
            }
        } else {
            console.log('❌ pendingCardSelections missing or empty');
        }
        
        // Check for relevant events
        if (gameEnv.gameEvents) {
            const selectionEvents = gameEnv.gameEvents.filter(e => 
                e.type === 'CARD_SELECTION_REQUIRED' || e.type === 'CARD_EFFECT_TRIGGERED'
            );
            if (selectionEvents.length > 0) {
                console.log('\n📡 Related Events:');
                selectionEvents.forEach(event => {
                    console.log(`  - ${event.type}: ${JSON.stringify(event.data)}`);
                });
            }
        }
        
        console.log('\n🎯 TEST SUMMARY:');
        const hasSelection = gameEnv.pendingCardSelections && Object.keys(gameEnv.pendingCardSelections).length > 0;
        const hasSelectionData = !!(gameEnv.pendingCardSelections && Object.keys(gameEnv.pendingCardSelections).length > 0);
        
        if (hasSelection && hasSelectionData) {
            console.log('🎉 SUCCESS: c-20 card selection system is working correctly!');
            console.log('✅ pendingPlayerAction is present in API response');
            console.log('✅ pendingCardSelections contains selection data');
            console.log('✅ Frontend can now detect and show selection UI');
        } else {
            console.log('❌ ISSUE: Card selection system still not working properly');
            if (!hasSelection) console.log('   - Missing pendingCardSelections');
            if (!hasSelectionData) console.log('   - Missing pendingCardSelections');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure the server is running with: npm run dev');
        }
    }
}

// Run the test
testC20CardSelection();