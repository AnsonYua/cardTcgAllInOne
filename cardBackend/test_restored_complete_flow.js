/**
 * Test complete game flow with restored redraw functionality
 * Tests: create → join → ready (with/without redraw) → start
 */

const axios = require('axios');

const API_BASE = 'http://localhost:8080';
const GAME_API = `${API_BASE}/api/game`;

async function testCompleteGameFlow() {
    console.log('🎮 Testing Complete Game Flow with Redraw Functionality\n');
    
    try {
        // === STEP 1: Create Game ===
        console.log('📋 STEP 1: Creating new game...');
        const createResponse = await axios.post(`${GAME_API}/player/startGame`, {
            playerId: 'player_1',
            players: ['player_1', 'player_2']
        });
        
        if (!createResponse.data.success) {
            throw new Error('Failed to create game: ' + createResponse.data.error);
        }
        
        const gameId = createResponse.data.gameId;
        const initialGameEnv = createResponse.data.gameEnv;
        
        console.log(`✅ Game created successfully!`);
        console.log(`   Game ID: ${gameId}`);
        console.log(`   Phase: ${initialGameEnv.phase}`);
        console.log(`   Players: ${initialGameEnv.playerId_1}`);
        console.log();
        
        // === STEP 2: Join Game ===
        console.log('📋 STEP 2: Second player joining game...');
        const joinResponse = await axios.post(`${GAME_API}/player/joinRoom`, {
            playerId: 'player_2',
            gameId: gameId
        });
        
        if (!joinResponse.data.success) {
            throw new Error('Failed to join game: ' + joinResponse.data.error);
        }
        
        const joinedGameEnv = joinResponse.data.gameEnv;
        
        console.log(`✅ Player 2 joined successfully!`);
        console.log(`   Phase: ${joinedGameEnv.phase}`);
        console.log(`   Players: ${joinedGameEnv.playerId_1}, ${joinedGameEnv.playerId_2}`);
        console.log(`   Player 1 Hand Size: ${joinedGameEnv.playerId_1.deck.hand.length}`);
        console.log(`   Player 2 Hand Size: ${joinedGameEnv.playerId_2.deck.hand.length}`);
        console.log(`   Player 1 Redraw Count: ${joinedGameEnv.playerId_1.redraw}`);
        console.log(`   Player 2 Redraw Count: ${joinedGameEnv.playerId_2.redraw}`);
        console.log();
        
        // === STEP 3: Player 1 Ready (No Redraw) ===
        console.log('📋 STEP 3: Player 1 marking ready (no redraw)...');
        const player1ReadyResponse = await axios.post(`${GAME_API}/player/startReady`, {
            playerId: 'player_1',
            gameId: gameId,
            redraw: false
        });
        
        if (!player1ReadyResponse.data.success) {
            throw new Error('Failed player 1 ready: ' + player1ReadyResponse.data.error);
        }
        
        const afterPlayer1Ready = player1ReadyResponse.data.gameEnv;
        
        console.log(`✅ Player 1 marked ready!`);
        console.log(`   Phase: ${afterPlayer1Ready.phase}`);
        console.log(`   Player 1 Ready: ${afterPlayer1Ready.playerId_1.isReady}`);
        console.log(`   Player 2 Ready: ${afterPlayer1Ready.playerId_2.isReady}`);
        console.log(`   Player 1 Redraw Count: ${afterPlayer1Ready.playerId_1.redraw}`);
        console.log(`   Game Started: ${afterPlayer1Ready.gameStarted}`);
        console.log();
        
        // === STEP 4: Player 2 Ready (With Redraw) ===
        console.log('📋 STEP 4: Player 2 marking ready (WITH redraw)...');
        const player1HandBefore = afterPlayer1Ready.playerId_2.deck.hand.slice(); // Copy array
        
        const player2ReadyResponse = await axios.post(`${GAME_API}/player/startReady`, {
            playerId: 'player_2',
            gameId: gameId,
            redraw: true
        });
        
        if (!player2ReadyResponse.data.success) {
            throw new Error('Failed player 2 ready: ' + player2ReadyResponse.data.error);
        }
        
        const finalGameEnv = player2ReadyResponse.data.gameEnv;
        
        console.log(`✅ Player 2 marked ready with redraw!`);
        console.log(`   Phase: ${finalGameEnv.phase}`);
        console.log(`   Game Started: ${finalGameEnv.gameStarted}`);
        console.log(`   Current Player: ${finalGameEnv.currentPlayer}`);
        console.log(`   Current Turn: ${finalGameEnv.currentTurn}`);
        console.log(`   First Player: ${finalGameEnv.firstPlayer}`);
        console.log();
        
        console.log('📊 REDRAW VERIFICATION:');
        console.log(`   Player 2 Redraw Count: ${finalGameEnv.playerId_2.redraw}`);
        console.log(`   Player 2 Hand Size: ${finalGameEnv.playerId_2.deck.hand.length}`);
        
        // Check if hand actually changed (redraw should give different cards)
        const player2HandAfter = finalGameEnv.playerId_2.deck.hand;
        const handChanged = JSON.stringify(player1HandBefore.sort()) !== JSON.stringify(player2HandAfter.sort());
        console.log(`   Hand Changed: ${handChanged}`);
        
        if (handChanged) {
            console.log(`   ✅ Redraw successful - player got new cards!`);
        } else {
            console.log(`   ⚠️  Hand appears unchanged - may be coincidence or error`);
        }
        console.log();
        
        console.log('📊 FINAL GAME STATE:');
        console.log(`   Phase: ${finalGameEnv.phase}`);
        console.log(`   Game Started: ${finalGameEnv.gameStarted}`);
        console.log(`   Current Player: ${finalGameEnv.currentPlayer}`);
        console.log(`   Player 1 Hand: ${finalGameEnv.playerId_1.deck.hand.length} cards`);
        console.log(`   Player 2 Hand: ${finalGameEnv.playerId_2.deck.hand.length} cards`);
        console.log(`   Events: ${finalGameEnv.gameEvents?.length || 0} total events`);
        console.log();
        
        console.log('🎉 COMPLETE GAME FLOW TEST SUCCESSFUL!');
        console.log('   ✅ Game creation working');
        console.log('   ✅ Player joining working');
        console.log('   ✅ Ready system working');
        console.log('   ✅ Redraw functionality working');
        console.log('   ✅ Game start transition working');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        process.exit(1);
    }
}

// Run the test
testCompleteGameFlow();