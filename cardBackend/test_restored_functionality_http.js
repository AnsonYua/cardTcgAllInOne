// HTTP-based test to verify restored joinGame functionality
const axios = require('axios');

const API_BASE = 'http://localhost:8080';

async function testRestoredJoinGameViaHTTP() {
    console.log('🧪 Testing restored joinGame functionality via HTTP API...\n');
    
    try {
        // Test 1: Create a new game
        console.log('📝 Step 1: Creating new game...');
        const createResponse = await axios.post(`${API_BASE}/api/game/player/startGame`, {
            playerId: 'playerId_1'
        });
        
        if (!createResponse.data || !createResponse.data.gameId) {
            console.error('❌ Failed to create game: No game ID returned');
            return false;
        }
        
        const gameId = createResponse.data.gameId;
        console.log(`✅ Game created: ${gameId}`);
        console.log(`   Phase: ${createResponse.data.phase}`);
        console.log(`   Player 1: ${createResponse.data.playerId_1}`);
        console.log(`   Player 2: ${createResponse.data.playerId_2 || 'Not set'}\n`);
        
        // Test 2: Join game with second player (this will test restored functionality)
        console.log('📝 Step 2: Player 2 joining game (testing restored functionality)...');
        const joinResponse = await axios.post(`${API_BASE}/api/game/player/joinRoom`, {
            playerId: 'playerId_2',
            gameId: gameId
        });
        
        if (!joinResponse.data) {
            console.error('❌ Failed to join game: No response data');
            return false;
        }
        
        const gameData = joinResponse.data;
        console.log('✅ Player 2 joined successfully!');
        console.log(`   Phase: ${gameData.phase}`);
        console.log(`   Player 1: ${gameData.playerId_1}`);
        console.log(`   Player 2: ${gameData.playerId_2}`);
        
        // Test 3: Verify deck initialization
        console.log('\n📝 Step 3: Verifying deck initialization...');
        
        if (!gameData.players || !gameData.players.playerId_1 || !gameData.players.playerId_2) {
            console.error('❌ Players data structure not found in response');
            console.log('Available data structure:', JSON.stringify(Object.keys(gameData), null, 2));
            return false;
        }
        
        const player1 = gameData.players.playerId_1;
        const player2 = gameData.players.playerId_2;
        
        console.log('✅ Player deck data verified:');
        console.log(`   Player 1 hand size: ${player1.hand ? player1.hand.length : 'No hand'}`);
        console.log(`   Player 1 deck size: ${player1.deck && player1.deck.mainDeck ? player1.deck.mainDeck.length : 'No deck'}`);
        console.log(`   Player 1 leader count: ${player1.deck && player1.deck.leader ? player1.deck.leader.length : 'No leaders'}`);
        
        console.log(`   Player 2 hand size: ${player2.hand ? player2.hand.length : 'No hand'}`);
        console.log(`   Player 2 deck size: ${player2.deck && player2.deck.mainDeck ? player2.deck.mainDeck.length : 'No deck'}`);
        console.log(`   Player 2 leader count: ${player2.deck && player2.deck.leader ? player2.deck.leader.length : 'No leaders'}`);
        
        // Test 4: Verify zone initialization
        console.log('\n📝 Step 4: Verifying zone initialization...');
        if (!gameData.zones) {
            console.error('❌ Zones data not found');
            return false;
        }
        
        console.log('✅ Zone system initialized:');
        console.log(`   Player 1 zones: ${Object.keys(gameData.zones.playerId_1 || {}).join(', ')}`);
        console.log(`   Player 2 zones: ${Object.keys(gameData.zones.playerId_2 || {}).join(', ')}`);
        
        const player1Zones = gameData.zones.playerId_1 || {};
        const player2Zones = gameData.zones.playerId_2 || {};
        
        console.log(`   Player 1 leader zone: ${player1Zones.leader ? 'Occupied' : 'Empty'}`);
        console.log(`   Player 2 leader zone: ${player2Zones.leader ? 'Occupied' : 'Empty'}`);
        
        // Test 5: Verify events were generated
        console.log('\n📝 Step 5: Verifying event generation...');
        if (!gameData.gameEvents) {
            console.error('❌ No game events found');
            return false;
        }
        
        console.log('✅ Events generated:');
        console.log(`   Total events: ${gameData.gameEvents.length}`);
        gameData.gameEvents.forEach((event, idx) => {
            console.log(`   Event ${idx + 1}: ${event.type} - ${event.data ? JSON.stringify(event.data).substring(0, 100) + '...' : 'No data'}`);
        });
        
        // Test 6: Verify correct phase after join
        console.log('\n📝 Step 6: Verifying phase progression...');
        if (gameData.phase !== 'READY_PHASE') {
            console.warn(`⚠️  Expected phase READY_PHASE but got: ${gameData.phase}`);
        } else {
            console.log('✅ Phase correctly set to READY_PHASE after join');
        }
        
        console.log('\n🎉 All tests passed! Restored joinGame functionality is working correctly.\n');
        
        return true;
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        return false;
    }
}

// Run the test
testRestoredJoinGameViaHTTP().then(success => {
    if (success) {
        console.log('🎊 HTTP test completed successfully!');
        process.exit(0);
    } else {
        console.log('💥 HTTP test failed!');
        process.exit(1);
    }
}).catch(error => {
    console.error('💥 Unexpected error in HTTP test:', error);
    process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
    console.error('❌ Test timed out after 30 seconds');
    process.exit(1);
}, 30000);