/**
 * Direct test of GameLogic methods without server
 * Tests the restored functionality directly
 */

const path = require('path');

async function testGameLogicDirect() {
    console.log('🎮 Direct GameLogic Test - Restored Functionality');
    console.log('Testing startReady and joinGame methods directly...\n');
    
    try {
        // Import the compiled GameLogic
        const gameLogicPath = path.join(__dirname, 'dist/src/services/GameLogic.js');
        const { gameLogic } = require(gameLogicPath);
        
        console.log('📋 STEP 1: Testing createGame...');
        const createResult = await gameLogic.createGame('player_1');
        
        if (createResult.success) {
            console.log('✅ createGame successful');
            console.log(`   Game ID: ${createResult.gameEnv.gameId}`);
            console.log(`   Phase: ${createResult.gameEnv.phase}`);
        } else {
            console.log('❌ createGame failed:', createResult.error);
            return;
        }
        
        const gameId = createResult.gameEnv.gameId;
        
        console.log('\n📋 STEP 2: Testing joinGame...');
        const joinResult = await gameLogic.joinGame(gameId, 'player_2');
        
        if (joinResult.success) {
            console.log('✅ joinGame successful');
            console.log(`   Phase: ${joinResult.gameEnv.phase}`);
            console.log(`   Player 1: ${joinResult.gameEnv.playerId_1}`);
            console.log(`   Player 2: ${joinResult.gameEnv.playerId_2}`);
        } else {
            console.log('❌ joinGame failed:', joinResult.error);
            return;
        }
        
        console.log('\n📋 STEP 3: Testing startReady method exists...');
        if (typeof gameLogic.startReady === 'function') {
            console.log('✅ startReady method exists!');
            
            // Test the method call
            console.log('   Testing startReady call for player_1 (no redraw)...');
            const startReadyResult1 = await gameLogic.startReady(gameId, 'player_1', false);
            
            if (startReadyResult1.success) {
                console.log('   ✅ Player 1 startReady successful');
                console.log(`      Phase: ${startReadyResult1.gameEnv.phase}`);
                console.log(`      Player 1 Ready: ${startReadyResult1.gameEnv.getPlayer('player_1').isReady}`);
            } else {
                console.log('   ❌ Player 1 startReady failed:', startReadyResult1.error);
            }
            
            console.log('   Testing startReady call for player_2 (with redraw)...');
            const startReadyResult2 = await gameLogic.startReady(gameId, 'player_2', true);
            
            if (startReadyResult2.success) {
                console.log('   ✅ Player 2 startReady successful');
                console.log(`      Phase: ${startReadyResult2.gameEnv.phase}`);
                console.log(`      Game Started: ${startReadyResult2.gameEnv.gameStarted}`);
                console.log(`      Current Player: ${startReadyResult2.gameEnv.currentPlayer}`);
            } else {
                console.log('   ❌ Player 2 startReady failed:', startReadyResult2.error);
            }
            
        } else {
            console.log('❌ startReady method does not exist');
        }
        
        console.log('\n🎯 FUNCTIONALITY ASSESSMENT:');
        console.log('✅ GameLogic class instantiation: Working');
        console.log('✅ createGame method: Working');
        console.log('✅ joinGame method: Working');
        console.log(typeof gameLogic.startReady === 'function' ? '✅' : '❌', 'startReady method: ' + (typeof gameLogic.startReady === 'function' ? 'Implemented' : 'Missing'));
        
        console.log('\n🎉 RESTORED FUNCTIONALITY VERIFICATION COMPLETE!');
        
    } catch (error) {
        console.error('❌ Direct test failed:', error.message);
        console.error('   This indicates compilation or import issues');
        console.error('   Stack:', error.stack);
    }
}

// Run the test
testGameLogicDirect();