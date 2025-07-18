#!/usr/bin/env node

/**
 * Quick Test Runner - No server management
 * Run individual test scenarios assuming server is already running
 */

const TestHelper = require('./helpers/testHelper');
const path = require('path');
const fs = require('fs').promises;

class QuickTestRunner {
    constructor() {
        this.testHelper = new TestHelper();
    }

    async listScenarios() {
        console.log('📋 Available Test Scenarios:\n');
        
        const scenarios = [
            { file: 'leader_s-1_trump_boost.json', name: 'Trump Standard Boost', desc: 'Right-Wing & Patriot +45 power' },
            { file: 'leader_s-1_trump_vs_powell_nerf.json', name: 'Trump vs Powell', desc: 'Economy cards → 0 power' },
            { file: 'leader_s-2_biden_boost.json', name: 'Biden Universal', desc: 'All cards +40 power' },
            { file: 'leader_s-3_musk_freedom_boost.json', name: 'Musk Freedom', desc: 'Freedom cards +50 power' },
            { file: 'leader_s-3_musk_doge_boost.json', name: 'Musk Doge', desc: 'Doge name cards +20 power' },
            { file: 'leader_s-4_harris_leftwing_boost.json', name: 'Harris Left-Wing', desc: 'Left-Wing cards +40 power' },
            { file: 'leader_s-4_harris_economy_boost.json', name: 'Harris Economy', desc: 'Economy cards +20 power' },
            { file: 'leader_s-4_harris_vs_trump_nerf.json', name: 'Harris vs Trump', desc: 'Right zone cards → 0 power' },
            { file: 'leader_s-5_vance_boosts.json', name: 'Vance Multiple', desc: 'Right-Wing +40, Freedom +20, Economy +10' },
            { file: 'leader_s-6_powell_boost.json', name: 'Powell Standard', desc: 'Freedom & Economy +30 power' },
            { file: 'leader_s-6_powell_vs_trump_boost.json', name: 'Powell vs Trump', desc: 'Economy +50 total power' },
            { file: 'leader_s-6_powell_vs_trump_restriction.json', name: 'Powell Restriction', desc: 'Cannot summon Right-Wing' }
        ];

        for (let i = 0; i < scenarios.length; i++) {
            const scenario = scenarios[i];
            console.log(`${i + 1}. ${scenario.name}`);
            console.log(`   File: ${scenario.file}`);
            console.log(`   Effect: ${scenario.desc}`);
            console.log('');
        }
        
        console.log('💡 Usage:');
        console.log('   node src/tests/quickTest.js run <filename>');
        console.log('   node src/tests/quickTest.js run leader_s-1_trump_boost.json');
    }

    async runScenario(scenarioFile, verbose = false) {
        console.log(`\n🧪 Running: ${scenarioFile}`);
        console.log('=' .repeat(50));
        
        try {
            const startTime = Date.now();
            
            // Load scenario
            const scenario = await this.testHelper.loadTestScenario(scenarioFile);
            const { gameId, gameEnv, validationPoints } = scenario;
            
            console.log(`📋 Scenario: ${gameId}`);
            
            if (verbose) {
                console.log(`👥 Leaders: ${gameEnv.zones.playerId_1.leader.name} vs ${gameEnv.zones.playerId_2.leader.name}`);
                console.log(`🎯 Phase: ${gameEnv.phase}`);
                console.log(`📊 Validation Points: ${Object.keys(validationPoints || {}).length}`);
            }
            
            // Try to inject game state
            console.log('🔄 Injecting game state...');
            const injectResult = await this.testHelper.injectGameState(gameId, gameEnv);
            
            if (injectResult.error) {
                throw new Error(`Failed to inject game state: ${injectResult.error}`);
            }
            
            console.log('✅ Game state injected successfully');
            
            // Get current game state
            console.log('🔄 Retrieving game state...');
            const playerData = await this.testHelper.getPlayerData('playerId_1', gameId);
            
            if (playerData.error) {
                throw new Error(`Failed to get player data: ${playerData.error}`);
            }
            
            console.log('✅ Game state retrieved successfully');
            
            if (verbose) {
                console.log('🔍 Debug: Retrieved gameEnv structure:');
                console.log('gameEnv keys:', Object.keys(playerData.gameEnv));
                console.log('gameEnv.zones keys:', playerData.gameEnv.zones ? Object.keys(playerData.gameEnv.zones) : 'zones is missing');
            }
            
            // Validate power calculations
            console.log('\n📊 Validation Results:');
            if (!validationPoints || Object.keys(validationPoints).length === 0) {
                console.log('⚠️  No validation points found in scenario');
                return;
            }
            
            try {
                const validationResults = this.testHelper.validatePowerCalculations(playerData.gameEnv, validationPoints);
            
                let passed = 0;
                let failed = 0;
                
                for (const validation of validationResults) {
                    if (validation.cardFound) {
                        if (validation.passed) {
                            console.log(`✅ ${validation.description}`);
                            if (verbose) {
                                console.log(`   Card: ${validation.cardId}, Expected: ${validation.expected}, Actual: ${validation.actual}`);
                            }
                            passed++;
                        } else {
                            console.log(`❌ ${validation.description}`);
                            console.log(`   Card: ${validation.cardId}, Expected: ${validation.expected}, Actual: ${validation.actual}`);
                            failed++;
                        }
                    } else {
                        console.log(`❌ ${validation.description}`);
                        console.log(`   Card: ${validation.cardId} - NOT FOUND`);
                        failed++;
                    }
                }
                
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                console.log(`\n📈 Summary: ${passed} passed, ${failed} failed (${duration}ms)`);
                
                if (failed === 0) {
                    console.log('🎉 All validations passed!');
                } else {
                    console.log('⚠️  Some validations failed. Check the backend logic.');
                }
            } catch (validationError) {
                console.log(`❌ Validation Error: ${validationError.message}`);
                console.log('Debug info:');
                console.log('gameEnv:', typeof playerData.gameEnv);
                console.log('validationPoints:', typeof validationPoints);
                console.log('validationPoints keys:', validationPoints ? Object.keys(validationPoints) : 'null');
            }
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            console.log('\n💡 Make sure the server is running:');
            console.log('   npm run dev');
            console.log('   (in another terminal)');
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const runner = new QuickTestRunner();
    
    switch (command) {
        case 'list':
            await runner.listScenarios();
            break;
            
        case 'run':
            const scenarioFile = args[1];
            const verbose = args.includes('--verbose') || args.includes('-v');
            console.log('🔍 Debug: verbose flag:', verbose, 'args:', args);
            
            if (!scenarioFile) {
                console.error('❌ Please specify a scenario file');
                console.log('Usage: node src/tests/quickTest.js run <scenario-file> [--verbose]');
                console.log('Example: node src/tests/quickTest.js run leader_s-1_trump_boost.json --verbose');
                return;
            }
            
            await runner.runScenario(scenarioFile, verbose);
            break;
            
        default:
            console.log('🧪 Quick Test Runner');
            console.log('');
            console.log('Prerequisites:');
            console.log('  Make sure the server is running: npm run dev');
            console.log('');
            console.log('Usage:');
            console.log('  node src/tests/quickTest.js list                    # List scenarios');
            console.log('  node src/tests/quickTest.js run <file> [--verbose]  # Run scenario');
            console.log('');
            console.log('Examples:');
            console.log('  node src/tests/quickTest.js list');
            console.log('  node src/tests/quickTest.js run leader_s-1_trump_boost.json');
            console.log('  node src/tests/quickTest.js run leader_s-1_trump_boost.json --verbose');
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = QuickTestRunner;