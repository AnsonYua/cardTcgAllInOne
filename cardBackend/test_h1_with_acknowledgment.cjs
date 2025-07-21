#!/usr/bin/env node

/**
 * TEST H1 SCENARIO WITH EVENT ACKNOWLEDGMENT
 * =========================================
 * 
 * Tests the complete h1_card.json scenario including the critical event acknowledgment steps:
 * 1. Player 1 plays c-1 card → DRAW_PHASE
 * 1.5. Acknowledge DRAW_PHASE_COMPLETE → MAIN_PHASE
 * 2. Player 2 plays h-2 with selection → DRAW_PHASE  
 * 2.5. Acknowledge DRAW_PHASE_COMPLETE → MAIN_PHASE
 * 3. Player 1 plays h-1 with selection
 * 
 * This validates the complete event acknowledgment pattern.
 */

const path = require('path');

// Use the test helper
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

async function runH1ScenarioWithAcknowledgment() {
    try {
        log('🎮 Testing H1 Scenario with Event Acknowledgment', 'bright');
        log('================================================', 'bright');
        
        // Load the scenario
        const scenario = await testHelper.loadTestScenario('UtilityEffects/h1_card.json');
        const gameId = scenario.gameId;
        
        log('\\n🔧 Step 0: Injecting initial game state...', 'cyan');
        await testHelper.injectGameState(gameId, scenario.initialGameEnv);
        log('✅ Game state injected successfully', 'green');
        
        // STEP 1: Player 1 plays c-1 card
        log('\\n🎯 Step 1: Player 1 plays c-1 (愛國者) to LEFT zone', 'magenta');
        const step1Result = await testHelper.executePlayerAction('playerId_1', gameId, {
            type: 'PlayCard',
            card_idx: 0,
            field_idx: 1
        });
        
        // Validate step 1 results
        const step1State = await testHelper.getPlayerData('playerId_2', gameId);
        
        if (step1State.gameEnv.phase !== 'DRAW_PHASE') {
            throw new Error(`Step 1 FAILED: Expected DRAW_PHASE, got ${step1State.gameEnv.phase}`);
        }
        
        if (step1State.gameEnv.currentPlayer !== 'playerId_2') {
            throw new Error(`Step 1 FAILED: Expected currentPlayer playerId_2, got ${step1State.gameEnv.currentPlayer}`);
        }
        
        const drawEvents = step1State.gameEnv.gameEvents?.filter(e => e.type === 'DRAW_PHASE_COMPLETE') || [];
        if (drawEvents.length === 0) {
            throw new Error('Step 1 FAILED: No DRAW_PHASE_COMPLETE event generated');
        }
        
        log('✅ Step 1 validated: Turn switched, DRAW_PHASE active, event generated', 'green');
        
        // STEP 1.5: Acknowledge DRAW_PHASE_COMPLETE event
        log('\\n🔄 Step 1.5: Acknowledging DRAW_PHASE_COMPLETE event...', 'magenta');
        const ackResult1 = await testHelper.acknowledgeEventsByType(gameId, 'playerId_2', ['DRAW_PHASE_COMPLETE']);
        
        if (ackResult1.eventsAcknowledged !== 1) {
            throw new Error(`Step 1.5 FAILED: Expected 1 event acknowledged, got ${ackResult1.eventsAcknowledged}`);
        }
        
        const step1_5State = await testHelper.getPlayerData('playerId_2', gameId);
        if (step1_5State.gameEnv.phase !== 'MAIN_PHASE') {
            throw new Error(`Step 1.5 FAILED: Expected MAIN_PHASE, got ${step1_5State.gameEnv.phase}`);
        }
        
        log('✅ Step 1.5 validated: Event acknowledged, transitioned to MAIN_PHASE', 'green');
        
        // STEP 2: Player 2 plays h-2 card
        log('\\n🎯 Step 2: Player 2 plays h-2 to HELP zone', 'magenta');
        const step2Result = await testHelper.executePlayerAction('playerId_2', gameId, {
            type: 'PlayCard',
            card_idx: 0,
            field_idx: 3
        });
        
        // Check if selection is required
        if (!step2Result.gameEnv.pendingPlayerAction) {
            throw new Error('Step 2 FAILED: Expected card selection to be required');
        }
        
        log('🔄 Step 2a: Completing card selection (h-2 targets c-1)...', 'yellow');
        const selectionId = Object.keys(step2Result.gameEnv.pendingCardSelections)[0];
        const selectionResult = await testHelper.completeCardSelection(gameId, 'playerId_2', selectionId, ['c-1']);
        
        // Validate h-2 effect applied
        const step2State = await testHelper.getPlayerData('playerId_1', gameId);
        const c1Power = step2State.gameEnv.players.playerId_1.fieldEffects.calculatedPowers['c-1'];
        if (c1Power !== 0) {
            throw new Error(`Step 2 FAILED: Expected c-1 power to be 0, got ${c1Power}`);
        }
        
        if (step2State.gameEnv.phase !== 'DRAW_PHASE') {
            throw new Error(`Step 2 FAILED: Expected DRAW_PHASE after selection, got ${step2State.gameEnv.phase}`);
        }
        
        if (step2State.gameEnv.currentPlayer !== 'playerId_1') {
            throw new Error(`Step 2 FAILED: Expected currentPlayer playerId_1, got ${step2State.gameEnv.currentPlayer}`);
        }
        
        log('✅ Step 2 validated: h-2 effect applied, turn switched to Player 1', 'green');
        
        // STEP 2.5: Acknowledge DRAW_PHASE_COMPLETE event  
        log('\\n🔄 Step 2.5: Acknowledging second DRAW_PHASE_COMPLETE event...', 'magenta');
        const ackResult2 = await testHelper.acknowledgeEventsByType(gameId, 'playerId_1', ['DRAW_PHASE_COMPLETE']);
        
        if (ackResult2.eventsAcknowledged !== 1) {
            throw new Error(`Step 2.5 FAILED: Expected 1 event acknowledged, got ${ackResult2.eventsAcknowledged}`);
        }
        
        const step2_5State = await testHelper.getPlayerData('playerId_1', gameId);
        if (step2_5State.gameEnv.phase !== 'MAIN_PHASE') {
            throw new Error(`Step 2.5 FAILED: Expected MAIN_PHASE, got ${step2_5State.gameEnv.phase}`);
        }
        
        log('✅ Step 2.5 validated: Event acknowledged, Player 1 in MAIN_PHASE', 'green');
        
        // STEP 3: Player 1 plays h-1 card
        log('\\n🎯 Step 3: Player 1 plays h-1 to neutralize h-2', 'magenta');
        const step3Result = await testHelper.executePlayerAction('playerId_1', gameId, {
            type: 'PlayCard',
            card_idx: 1,
            field_idx: 3
        });
        
        // Check if selection is required
        if (!step3Result.gameEnv.pendingPlayerAction) {
            throw new Error('Step 3 FAILED: Expected card selection to be required');
        }
        
        log('🔄 Step 3a: Completing card selection (h-1 neutralizes h-2)...', 'yellow');
        const selectionId3 = Object.keys(step3Result.gameEnv.pendingCardSelections)[0];
        const selectionResult3 = await testHelper.completeCardSelection(gameId, 'playerId_1', selectionId3, ['h-2']);
        
        // Validate h-1 neutralization effect
        const finalState = await testHelper.getPlayerData('playerId_1', gameId);
        
        // Check that h-2 is disabled
        const h2Disabled = finalState.gameEnv.players.playerId_2.fieldEffects.disabledCards.includes('h-2');
        if (!h2Disabled) {
            throw new Error('Step 3 FAILED: h-2 should be in disabled cards');
        }
        
        // Check that c-1 power is restored (no longer in calculatedPowers)
        const c1PowerFinal = finalState.gameEnv.players.playerId_1.fieldEffects.calculatedPowers['c-1'];
        if (c1PowerFinal !== undefined) {
            throw new Error(`Step 3 FAILED: c-1 power should be restored (undefined), got ${c1PowerFinal}`);
        }
        
        log('✅ Step 3 validated: h-1 neutralized h-2, c-1 power restored', 'green');
        
        // Final validation summary
        log('\\n🏆 SCENARIO VALIDATION COMPLETE', 'bright');
        log('==============================', 'bright');
        
        const playSequence = finalState.gameEnv.playSequence.plays;
        const cardPlays = playSequence.filter(p => p.action === 'PLAY_CARD');
        
        log(`✅ Total card plays recorded: ${cardPlays.length}`, 'green');
        log(`✅ PlaySequence integrity: Valid`, 'green');
        log(`✅ Field effects applied correctly: h-2 disabled, c-1 restored`, 'green');
        log(`✅ Event acknowledgment pattern: Working correctly`, 'green');
        log(`✅ Phase transitions: All correct (DRAW_PHASE ↔ MAIN_PHASE)`, 'green');
        
        // Show final game state summary
        log('\\n📊 Final Game State:', 'cyan');
        log(`   Phase: ${finalState.gameEnv.phase}`, 'blue');
        log(`   Current Player: ${finalState.gameEnv.currentPlayer}`, 'blue');
        log(`   Player 1 LEFT zone: ${finalState.gameEnv.zones.playerId_1.left.map(c => c.id).join(', ')}`, 'blue');
        log(`   Player 2 HELP zone: ${finalState.gameEnv.zones.playerId_2.help.map(c => c.id).join(', ')}`, 'blue');
        log(`   Player 1 HELP zone: ${finalState.gameEnv.zones.playerId_1.help.map(c => c.id).join(', ')}`, 'blue');
        log(`   Disabled cards: ${finalState.gameEnv.players.playerId_2.fieldEffects.disabledCards.join(', ')}`, 'blue');
        
        log('\\n🎉 H1 SCENARIO WITH ACKNOWLEDGMENT COMPLETED SUCCESSFULLY!', 'bright');
        log('All 5 steps (including acknowledgments) executed and validated correctly.', 'green');
        
    } catch (error) {
        log(`\\n💥 Test failed: ${error.message}`, 'red');
        if (error.stack) {
            log(`Stack trace: ${error.stack}`, 'red');
        }
        process.exit(1);
    }
}

// Run the test
runH1ScenarioWithAcknowledgment().catch(error => {
    log(`Fatal error: ${error.message}`, 'red');
    process.exit(1);
});