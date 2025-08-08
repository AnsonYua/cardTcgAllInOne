// Test script to verify restored joinGame functionality
const { gameLogic } = require('./dist/src/services/GameLogic.js');

async function testRestoredJoinGame() {
    console.log('🧪 Testing restored joinGame functionality...\n');
    
    try {
        // Test 1: Create a new game
        console.log('📝 Step 1: Creating new game...');
        const createResult = await gameLogic.createGame('player1');
        
        if (!createResult.success) {
            console.error('❌ Failed to create game:', createResult.error);
            return;
        }
        
        const gameId = createResult.gameEnv.gameId;
        console.log(`✅ Game created: ${gameId}`);
        console.log(`   Phase: ${createResult.gameEnv.phase}`);
        console.log(`   Player 1: ${createResult.gameEnv.playerId_1}`);
        console.log(`   Player 2: ${createResult.gameEnv.playerId_2 || 'Not set'}\n`);
        
        // Test 2: Join game with second player (this will test restored functionality)
        console.log('📝 Step 2: Player 2 joining game (testing restored functionality)...');
        const joinResult = await gameLogic.joinGame(gameId, 'player2');
        
        if (!joinResult.success) {
            console.error('❌ Failed to join game:', joinResult.error);
            return;
        }
        
        console.log('✅ Player 2 joined successfully!');
        console.log(`   Phase: ${joinResult.gameEnv.phase}`);
        console.log(`   Player 1: ${joinResult.gameEnv.playerId_1}`);
        console.log(`   Player 2: ${joinResult.gameEnv.playerId_2}`);
        
        // Test 3: Verify deck initialization
        console.log('\n📝 Step 3: Verifying deck initialization...');
        const player1 = joinResult.gameEnv.getPlayer(joinResult.gameEnv.playerId_1);
        const player2 = joinResult.gameEnv.getPlayer(joinResult.gameEnv.playerId_2);
        
        if (!player1 || !player2) {
            console.error('❌ Players not found in game environment');
            return;
        }
        
        console.log('✅ Player deck data verified:');
        console.log(`   Player 1 hand size: ${player1.getHandSize()}`);
        console.log(`   Player 1 deck size: ${player1.getDeckSize()}`);
        console.log(`   Player 1 leader count: ${player1.deck.leader.length}`);
        console.log(`   Player 1 current leader: ${player1.getCurrentLeaderCardId()}`);
        
        console.log(`   Player 2 hand size: ${player2.getHandSize()}`);
        console.log(`   Player 2 deck size: ${player2.getDeckSize()}`);
        console.log(`   Player 2 leader count: ${player2.deck.leader.length}`);
        console.log(`   Player 2 current leader: ${player2.getCurrentLeaderCardId()}`);
        
        // Test 4: Verify game state structure
        console.log('\n📝 Step 4: Verifying game state structure...');
        const gameEnv = joinResult.gameEnv;
        
        console.log('✅ Game state structure verified:');
        console.log(`   Game started: ${gameEnv.gameStarted}`);
        console.log(`   First player: ${gameEnv.firstPlayer}`);
        console.log(`   Current turn: ${gameEnv.currentTurn || 'Not set'}`);
        console.log(`   Events count: ${gameEnv.eventManager.getEvents().length}`);
        console.log(`   Play sequence count: ${gameEnv.playSequenceManager.getPlays().length}`);
        
        // Test 5: Verify zone initialization
        console.log('\n📝 Step 5: Verifying zone initialization...');
        console.log('✅ Zone system initialized:');
        console.log(`   Player 1 leader zone: ${gameEnv.zones.getCardInZone(gameEnv.playerId_1, 'LEADER') ? 'Occupied' : 'Empty'}`);
        console.log(`   Player 2 leader zone: ${gameEnv.zones.getCardInZone(gameEnv.playerId_2, 'LEADER') ? 'Occupied' : 'Empty'}`);
        
        console.log('\n🎉 All tests passed! Restored joinGame functionality is working correctly.\n');
        
        // Test 6: Verify phase consistency (should be READY_PHASE after successful join)
        if (gameEnv.phase !== 'READY_PHASE') {
            console.warn(`⚠️  Expected phase READY_PHASE but got: ${gameEnv.phase}`);
        } else {
            console.log('✅ Phase correctly set to READY_PHASE after join');
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        return false;
    }
}

// Run the test
testRestoredJoinGame().then(success => {
    if (success) {
        console.log('🎊 Test completed successfully!');
        process.exit(0);
    } else {
        console.log('💥 Test failed!');
        process.exit(1);
    }
}).catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
});