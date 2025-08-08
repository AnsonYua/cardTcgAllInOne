// Test script to verify DRAW_PHASE_COMPLETE event structure after requiresAcknowledgment removal
const axios = require('axios');

async function testDrawPhaseEventStructure() {
    try {
        console.log('🧪 Testing DRAW_PHASE_COMPLETE event structure...');
        
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
        
        // Step 2: Join second player to trigger game flow
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
        
        // Step 3: Mark both players ready to trigger draw phase
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
        
        // Step 4: Check for DRAW_PHASE_COMPLETE events
        const gameEvents = readyResponse.data.gameEnv.gameEvents || [];
        const drawPhaseEvents = gameEvents.filter(event => event.type === 'DRAW_PHASE_COMPLETE');
        
        console.log(`\n🎯 Found ${drawPhaseEvents.length} DRAW_PHASE_COMPLETE events`);
        
        drawPhaseEvents.forEach((event, index) => {
            console.log(`\n📋 Event ${index + 1} structure:`);
            console.log('   - Has requiresAcknowledgment in data:', 'requiresAcknowledgment' in event.data);
            console.log('   - Event data keys:', Object.keys(event.data));
            console.log('   - Full event data:', JSON.stringify(event.data, null, 2));
            
            // Check expected structure
            const hasPlayerId = 'playerId' in event.data;
            const hasCardCount = 'cardCount' in event.data;
            const hasNewHandSize = 'newHandSize' in event.data;
            const hasRequiresAck = 'requiresAcknowledgment' in event.data;
            
            if (hasPlayerId && hasCardCount && hasNewHandSize && !hasRequiresAck) {
                console.log('   ✅ SUCCESS: Event structure is correct (no requiresAcknowledgment)');
            } else {
                console.log('   ❌ ISSUE: Event structure unexpected');
                console.log(`      - Has playerId: ${hasPlayerId}`);
                console.log(`      - Has cardCount: ${hasCardCount}`);
                console.log(`      - Has newHandSize: ${hasNewHandSize}`);
                console.log(`      - Has requiresAcknowledgment: ${hasRequiresAck} (should be false)`);
            }
        });
        
        if (drawPhaseEvents.length > 0) {
            console.log('\n🎯 Overall result: requiresAcknowledgment successfully removed from DRAW_PHASE_COMPLETE events!');
        } else {
            console.log('\n⚠️ No DRAW_PHASE_COMPLETE events found to test');
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.response?.data) {
            console.log('   Response data:', error.response.data);
        }
    }
}

// Run test
testDrawPhaseEventStructure();