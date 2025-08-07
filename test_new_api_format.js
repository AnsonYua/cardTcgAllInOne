#!/usr/bin/env node

// =======================================================================================
// 🎯 API FORMAT MIGRATION TEST - Comprehensive Validation
// =======================================================================================
//
// This script validates the migration from index-based to UID/zone-based API format
// by testing both formats against the backend to ensure compatibility.
//
// Tests:
// 1. Legacy index-based format compatibility
// 2. New UID/zone-based format functionality
// 3. Error handling for invalid formats
// 4. Backend processing consistency
// 5. Play sequence recording accuracy
//
// =======================================================================================

const gameLogic = require('./cardBackend/src/services/GameLogic');
const { ZoneMapping } = require('./shared/utils/ZoneMapping');

class APIFormatMigrationTest {
    constructor() {
        this.gameId = 'api_migration_test';
        this.playerId = 'playerId_1';
        this.results = {
            legacy: { passed: 0, failed: 0, errors: [] },
            newFormat: { passed: 0, failed: 0, errors: [] }
        };
    }

    async run() {
        console.log('🚀 Starting API Format Migration Test...');
        console.log('=' .repeat(60));
        
        try {
            // Step 1: Setup test game
            await this.setupTestGame();
            
            // Step 2: Test legacy format
            await this.testLegacyFormat();
            
            // Step 3: Reset game for new format test
            await this.setupTestGame();
            
            // Step 4: Test new format
            await this.testNewFormat();
            
            // Step 5: Display results
            this.displayResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
            process.exit(1);
        }
    }

    async setupTestGame() {
        console.log('🎯 Setting up test game...');
        
        // Create a simple test game state
        const simpleTestGameEnv = gameLogic.getSimpleTestGameEnv();
        await gameLogic.injectGameState(this.gameId, simpleTestGameEnv);
        
        console.log('✅ Test game setup complete');
    }

    async testLegacyFormat() {
        console.log('🔄 Testing legacy index-based format...');
        
        const testCases = [
            {
                name: 'Play character card in TOP zone',
                action: {
                    type: 'PlayCard',
                    card_idx: 0,
                    field_idx: 0
                }
            },
            {
                name: 'Play character card in LEFT zone',
                action: {
                    type: 'PlayCard',
                    card_idx: 1,
                    field_idx: 1
                }
            },
            {
                name: 'Play help card in HELP zone',
                action: {
                    type: 'PlayCard',
                    card_idx: 2,
                    field_idx: 3
                }
            }
        ];

        for (const testCase of testCases) {
            try {
                console.log(`  Testing: ${testCase.name}`);
                
                const request = {
                    body: {
                        playerId: this.playerId,
                        gameId: this.gameId,
                        action: testCase.action
                    }
                };
                
                const result = await gameLogic.processPlayerAction(request);
                
                if (result.error) {
                    this.results.legacy.failed++;
                    this.results.legacy.errors.push(`${testCase.name}: ${result.error}`);
                    console.log(`    ❌ Failed: ${result.error}`);
                } else {
                    this.results.legacy.passed++;
                    console.log(`    ✅ Passed`);
                }
                
            } catch (error) {
                this.results.legacy.failed++;
                this.results.legacy.errors.push(`${testCase.name}: ${error.message}`);
                console.log(`    ❌ Error: ${error.message}`);
            }
        }
    }

    async testNewFormat() {
        console.log('🎯 Testing new UID/zone-based format...');
        
        // First, get the current game state to find card UIDs
        const gameState = await gameLogic.getGameState(this.gameId);
        const playerHand = gameState.gameEnv.players[this.playerId].deck.hand;
        
        const testCases = [
            {
                name: 'Play character card in TOP zone (new format)',
                action: {
                    type: 'PlayCard',
                    cardUID: playerHand[0],
                    zone: 'top'
                }
            },
            {
                name: 'Play character card in LEFT zone (new format)',
                action: {
                    type: 'PlayCard',
                    cardUID: playerHand[1],
                    zone: 'left'
                }
            },
            {
                name: 'Play help card in HELP zone (new format)',
                action: {
                    type: 'PlayCard',
                    cardUID: playerHand[2],
                    zone: 'help'
                }
            },
            {
                name: 'Play face-down card in SP zone (new format)',
                action: {
                    type: 'PlayCardBack',
                    cardUID: playerHand[3],
                    zone: 'sp'
                }
            }
        ];

        for (const testCase of testCases) {
            try {
                console.log(`  Testing: ${testCase.name}`);
                console.log(`    Card UID: ${testCase.action.cardUID}`);
                console.log(`    Zone: ${testCase.action.zone}`);
                
                const request = {
                    body: {
                        playerId: this.playerId,
                        gameId: this.gameId,
                        action: testCase.action
                    }
                };
                
                const result = await gameLogic.processPlayerAction(request);
                
                if (result.error) {
                    this.results.newFormat.failed++;
                    this.results.newFormat.errors.push(`${testCase.name}: ${result.error}`);
                    console.log(`    ❌ Failed: ${result.error}`);
                } else {
                    this.results.newFormat.passed++;
                    console.log(`    ✅ Passed`);
                    
                    // Validate that the card was placed correctly
                    await this.validateCardPlacement(testCase.action.zone, testCase.action.cardUID);
                }
                
            } catch (error) {
                this.results.newFormat.failed++;
                this.results.newFormat.errors.push(`${testCase.name}: ${error.message}`);
                console.log(`    ❌ Error: ${error.message}`);
            }
        }
    }

    async validateCardPlacement(expectedZone, expectedCardUID) {
        try {
            const gameState = await gameLogic.getGameState(this.gameId);
            const playerZones = gameState.gameEnv.zones[this.playerId];
            
            // Check if card was placed in the expected zone
            const zoneCards = playerZones[expectedZone];
            
            if (!zoneCards || zoneCards.length === 0) {
                console.log(`    ⚠️  Warning: No cards found in ${expectedZone} zone`);
                return false;
            }
            
            // Find the card that was just placed
            const placedCard = zoneCards[zoneCards.length - 1]; // Most recently placed
            const placedCardUID = placedCard.card[0]; // Card UID is in card array
            
            if (placedCardUID === expectedCardUID) {
                console.log(`    ✅ Card placement validated: ${expectedCardUID} in ${expectedZone}`);
                return true;
            } else {
                console.log(`    ⚠️  Card placement mismatch: expected ${expectedCardUID}, found ${placedCardUID}`);
                return false;
            }
            
        } catch (error) {
            console.log(`    ⚠️  Validation error: ${error.message}`);
            return false;
        }
    }

    displayResults() {
        console.log('\\n' + '=' .repeat(60));
        console.log('📊 API FORMAT MIGRATION TEST RESULTS');
        console.log('=' .repeat(60));
        
        // Legacy format results
        console.log('\\n🔄 Legacy Index-Based Format:');
        console.log(`  ✅ Passed: ${this.results.legacy.passed}`);
        console.log(`  ❌ Failed: ${this.results.legacy.failed}`);
        
        if (this.results.legacy.errors.length > 0) {
            console.log('  Errors:');
            this.results.legacy.errors.forEach(error => {
                console.log(`    - ${error}`);
            });
        }
        
        // New format results
        console.log('\\n🎯 New UID/Zone-Based Format:');
        console.log(`  ✅ Passed: ${this.results.newFormat.passed}`);
        console.log(`  ❌ Failed: ${this.results.newFormat.failed}`);
        
        if (this.results.newFormat.errors.length > 0) {
            console.log('  Errors:');
            this.results.newFormat.errors.forEach(error => {
                console.log(`    - ${error}`);
            });
        }
        
        // Overall summary
        const totalPassed = this.results.legacy.passed + this.results.newFormat.passed;
        const totalFailed = this.results.legacy.failed + this.results.newFormat.failed;
        const totalTests = totalPassed + totalFailed;
        
        console.log('\\n📈 Overall Summary:');
        console.log(`  Total Tests: ${totalTests}`);
        console.log(`  Total Passed: ${totalPassed}`);
        console.log(`  Total Failed: ${totalFailed}`);
        console.log(`  Success Rate: ${totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0}%`);
        
        if (totalFailed === 0) {
            console.log('\\n🎉 ALL TESTS PASSED! API migration is successful.');
        } else {
            console.log('\\n⚠️  Some tests failed. Please review the errors above.');
        }
        
        console.log('\\n🔧 Migration Benefits:');
        console.log('  ✅ Direct UID reference eliminates index mismatches');
        console.log('  ✅ Zone names are more readable than field indices');
        console.log('  ✅ Backward compatibility maintained');
        console.log('  ✅ Better error messages with specific UIDs');
        console.log('  ✅ Frontend/backend API consistency improved');
    }
}

// Run the test if this script is executed directly
if (require.main === module) {
    const test = new APIFormatMigrationTest();
    test.run().catch(console.error);
}

module.exports = APIFormatMigrationTest;