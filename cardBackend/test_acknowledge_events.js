// Test script to verify acknowledgeEvents functionality
const axios = require('axios');

async function testAcknowledgeEventsFunc() {
    try {
        console.log('🧪 Testing acknowledgeEvents functionality...');
        
        // Step 1: Create a game to generate events
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
        
        // Step 3: Mark players ready to generate events
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
        
        // Step 4: Check initial events
        const initialEvents = readyResponse.data.gameEnv.gameEvents || [];
        const unprocessedInitial = initialEvents.filter(event => !event.frontendProcessed);
        
        console.log(`\n📋 Initial state:`);
        console.log(`   - Total events: ${initialEvents.length}`);
        console.log(`   - Unprocessed events: ${unprocessedInitial.length}`);
        
        if (unprocessedInitial.length === 0) {
            console.log('⚠️ No unprocessed events to test acknowledgment');
            return;
        }
        
        // Step 5: Select some events to acknowledge
        const eventIdsToAck = unprocessedInitial.slice(0, Math.min(3, unprocessedInitial.length)).map(event => event.id);
        
        console.log(`\n🔔 Acknowledging ${eventIdsToAck.length} events:`);
        eventIdsToAck.forEach(eventId => console.log(`   - ${eventId}`));
        
        // Step 6: Call acknowledgeEvents endpoint
        const ackResponse = await axios.post('http://localhost:8080/api/game/player/acknowledgeEvents', {
            gameId: gameId,
            eventIds: eventIdsToAck
        });
        
        if (!ackResponse.data.success) {
            console.log('❌ Failed to acknowledge events:', ackResponse.data.error);
            return;
        }
        
        console.log('✅ Acknowledge request successful:', ackResponse.data.message);
        console.log(`   - Acknowledged events count: ${ackResponse.data.acknowledgedEvents}`);
        
        // Step 7: Verify events were acknowledged by getting current game state
        const verifyResponse = await axios.get(`http://localhost:8080/api/game/player/test_player_1?gameId=${gameId}`);
        
        if (!verifyResponse.data.success) {
            console.log('❌ Failed to verify events');
            return;
        }
        
        const finalEvents = verifyResponse.data.gameEnv.gameEvents || [];
        const unprocessedFinal = finalEvents.filter(event => !event.frontendProcessed);
        const acknowledgedEvents = finalEvents.filter(event => 
            eventIdsToAck.includes(event.id) && event.frontendProcessed
        );
        
        console.log(`\n📋 Final verification:`);
        console.log(`   - Total events: ${finalEvents.length}`);
        console.log(`   - Unprocessed events: ${unprocessedFinal.length}`);
        console.log(`   - Successfully acknowledged: ${acknowledgedEvents.length}/${eventIdsToAck.length}`);
        
        // Check results
        if (acknowledgedEvents.length === eventIdsToAck.length) {
            console.log('🎯 SUCCESS: All events acknowledged correctly!');
            
            // Show details
            acknowledgedEvents.forEach(event => {
                console.log(`   ✅ Event ${event.id} (${event.type}) - frontendProcessed: ${event.frontendProcessed}`);
            });
        } else {
            console.log('❌ ISSUE: Not all events were acknowledged');
            console.log(`   Expected: ${eventIdsToAck.length}, Got: ${acknowledgedEvents.length}`);
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.response?.data) {
            console.log('   Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run test
testAcknowledgeEventsFunc();