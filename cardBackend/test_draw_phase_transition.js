// Test script to verify DRAW_PHASE to MAIN_PHASE transition on acknowledgment
const axios = require('axios');

async function testDrawPhaseTransition() {
    try {
        console.log('🧪 Testing DRAW_PHASE to MAIN_PHASE transition...');
        
        // Step 1: Create a game
        const createResponse = await axios.post('http://localhost:8080/api/game/player/startGame', {
            playerId: 'test_player_1'
        });
        
        if (!createResponse.data.success) {
            console.log('❌ Failed to create game');
            return;
        }
        
        const gameId = createResponse.data.gameId;
        console.log('✅ Game created:', gameId);
        
        // Step 2: Join second player
        const joinResponse = await axios.post('http://localhost:8080/api/game/player/joinRoom', {
            playerId: 'test_player_2',
            gameId: gameId,
            playerName: 'Test Player 2'
        });
        
        if (!joinResponse.data.success) {
            console.log('❌ Failed to join game');
            return;
        }
        
        console.log('✅ Second player joined');
        
        // Step 3: Mark both players ready to trigger phase transition and card drawing
        await axios.post('http://localhost:8080/api/game/player/startReady', {
            playerId: 'test_player_1',
            gameId: gameId,
            isRedraw: false
        });
        
        const readyResponse = await axios.post('http://localhost:8080/api/game/player/startReady', {
            playerId: 'test_player_2',
            gameId: gameId,
            isRedraw: false
        });
        
        console.log(`📋 Phase after ready: ${readyResponse.data.gameEnv.phase}`);
        
        // Step 4: Check for DRAW_PHASE_COMPLETE events
        const gameEvents = readyResponse.data.gameEnv.gameEvents || [];
        const drawPhaseCompleteEvents = gameEvents.filter(event => event.type === 'DRAW_PHASE_COMPLETE');
        
        console.log(`\n🎯 Found ${drawPhaseCompleteEvents.length} DRAW_PHASE_COMPLETE events`);
        
        if (drawPhaseCompleteEvents.length === 0) {
            console.log('⚠️ No DRAW_PHASE_COMPLETE events found to test transition');
            
            // Let's try triggering a card play to generate draw phase events
            console.log('   🔄 Attempting to trigger phase transition by playing a card...');
            
            // Get current game state to check what cards are available
            const playerStateResponse = await axios.get(`http://localhost:8080/api/game/player/test_player_1?gameId=${gameId}`);
            
            if (playerStateResponse.data.gameEnv.phase === 'MAIN_PHASE') {
                console.log('   ✅ Game is already in MAIN_PHASE');
                return;
            }
            
            console.log(`   Current phase: ${playerStateResponse.data.gameEnv.phase}`);
            return;
        }
        
        // Step 5: Check current phase before acknowledgment
        const preAckState = await axios.get(`http://localhost:8080/api/game/player/test_player_1?gameId=${gameId}`);
        console.log(`\n📋 Phase before acknowledgment: ${preAckState.data.gameEnv.phase}`);
        
        // Step 6: Acknowledge DRAW_PHASE_COMPLETE events
        const eventIdsToAck = drawPhaseCompleteEvents.map(event => event.id);
        console.log(`\n🔔 Acknowledging ${eventIdsToAck.length} DRAW_PHASE_COMPLETE events:`);
        eventIdsToAck.forEach(eventId => console.log(`   - ${eventId}`));
        
        const ackResponse = await axios.post('http://localhost:8080/api/game/player/acknowledgeEvents', {
            gameId: gameId,
            eventIds: eventIdsToAck
        });
        
        if (!ackResponse.data.success) {
            console.log('❌ Failed to acknowledge events:', ackResponse.data.error);
            return;
        }
        
        console.log('✅ Acknowledge request successful');
        
        // Step 7: Check phase after acknowledgment
        const postAckState = await axios.get(`http://localhost:8080/api/game/player/test_player_1?gameId=${gameId}`);
        console.log(`\n📋 Phase after acknowledgment: ${postAckState.data.gameEnv.phase}`);
        
        // Step 8: Verify the phase transition
        const phaseTransitionEvents = (postAckState.data.gameEnv.gameEvents || []).filter(event => 
            event.type === 'PHASE_CHANGE' && 
            event.data.reason === 'DRAW_PHASE_COMPLETE acknowledged'
        );
        
        console.log(`\n🔍 Phase transition verification:`);
        console.log(`   - Pre-acknowledgment phase: ${preAckState.data.gameEnv.phase}`);
        console.log(`   - Post-acknowledgment phase: ${postAckState.data.gameEnv.phase}`);
        console.log(`   - Phase transition events found: ${phaseTransitionEvents.length}`);
        
        if (phaseTransitionEvents.length > 0) {
            console.log(`   - Transition event data:`, JSON.stringify(phaseTransitionEvents[0].data, null, 2));
        }
        
        // Step 9: Final result
        if (preAckState.data.gameEnv.phase === 'DRAW_PHASE' && postAckState.data.gameEnv.phase === 'MAIN_PHASE') {
            console.log('\n🎯 SUCCESS: Phase transition from DRAW_PHASE to MAIN_PHASE works correctly!');
        } else if (postAckState.data.gameEnv.phase === 'MAIN_PHASE') {
            console.log('\n✅ Game is in MAIN_PHASE (may have already been transitioned)');
        } else {
            console.log('\n❌ ISSUE: Phase transition did not work as expected');
            console.log(`   Expected transition: DRAW_PHASE → MAIN_PHASE`);
            console.log(`   Actual: ${preAckState.data.gameEnv.phase} → ${postAckState.data.gameEnv.phase}`);
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.response?.data) {
            console.log('   Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run test
testDrawPhaseTransition();