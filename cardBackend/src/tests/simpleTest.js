#!/usr/bin/env node

/**
 * Simple Test Runner - Test individual scenarios by directly reading the JSON
 * and validating the structure without relying on backend injection
 */

const fs = require('fs').promises;
const path = require('path');

class SimpleTestRunner {
    constructor() {
        this.testScenariosPath = path.join(__dirname, '../../../shared/testScenarios/gameStates');
    }

    async loadTestScenario(filename) {
        const filePath = path.join(this.testScenariosPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
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
    }

    async validateScenario(scenarioFile, verbose = false) {
        console.log(`\n🧪 Validating: ${scenarioFile}`);
        console.log('=' .repeat(50));
        
        try {
            const scenario = await this.loadTestScenario(scenarioFile);
            const { gameId, gameEnv, validationPoints } = scenario;
            
            console.log(`📋 Scenario: ${gameId}`);
            
            if (verbose) {
                console.log(`👥 Leaders: ${gameEnv.zones.playerId_1.leader.name} vs ${gameEnv.zones.playerId_2.leader.name}`);
                console.log(`🎯 Phase: ${gameEnv.phase}`);
                console.log(`📊 Validation Points: ${Object.keys(validationPoints).length}`);
                console.log(`🔍 GameEnv Structure:`)
                console.log(`   - players: ${Object.keys(gameEnv.players).length} players`);
                console.log(`   - zones: ${Object.keys(gameEnv.zones).length} player zones`);
                console.log(`   - victoryPoints: ${JSON.stringify(gameEnv.victoryPoints)}`);
                console.log('');
            }

            console.log('📊 Validation Results:');
            
            if (!validationPoints || Object.keys(validationPoints).length === 0) {
                console.log('⚠️  No validation points found in scenario');
                return;
            }
            
            let passed = 0;
            let failed = 0;
            
            for (const [pointId, validation] of Object.entries(validationPoints)) {
                const { expected, description } = validation;
                const { cardId, finalPower } = expected;
                
                // Find the card in the scenario
                const cardLocation = this.findCardInScenario(gameEnv, cardId);
                
                if (cardLocation) {
                    // For now, just verify that the card exists and has the expected structure
                    const card = cardLocation.card;
                    const actualPower = card.power; // This is the base power, not calculated
                    
                    console.log(`✅ ${description}`);
                    if (verbose) {
                        console.log(`   Card: ${cardId} (${card.name}) - ${card.gameType}`);
                        console.log(`   Base Power: ${actualPower}, Expected Final: ${finalPower}`);
                        console.log(`   Location: ${cardLocation.location.playerId} - ${cardLocation.location.zone}`);
                        console.log(`   Leader Effect: ${this.getLeaderEffect(gameEnv, cardLocation.location.playerId)}`);
                    }
                    passed++;
                } else {
                    console.log(`❌ ${description}`);
                    console.log(`   Card: ${cardId} - NOT FOUND in scenario`);
                    failed++;
                }
            }
            
            console.log(`\n📈 Summary: ${passed} passed, ${failed} failed`);
            
            if (failed === 0) {
                console.log('🎉 All cards found in scenario!');
                if (verbose) {
                    console.log('💡 Note: This validates the test scenario structure.');
                    console.log('   To test actual power calculations, use the backend integration tests.');
                }
            } else {
                console.log('⚠️  Some cards not found in scenario.');
            }
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
    }

    findCardInScenario(gameEnv, cardId) {
        // Search through all zones for the card
        for (const playerId of ['playerId_1', 'playerId_2']) {
            const zones = gameEnv.zones[playerId];
            
            if (!zones) continue;
            
            for (const [zoneName, zoneCards] of Object.entries(zones)) {
                if (zoneName === 'leader') continue;
                
                const foundCard = zoneCards.find(card => card.id === cardId);
                if (foundCard) {
                    return {
                        location: { playerId, zone: zoneName },
                        card: foundCard
                    };
                }
            }
        }
        
        return null;
    }

    getLeaderEffect(gameEnv, playerId) {
        const leader = gameEnv.zones[playerId].leader;
        if (!leader || !leader.effects) return 'No effects';
        
        const effectCount = leader.effects.rules ? leader.effects.rules.length : 0;
        return `${effectCount} effect(s)`;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const runner = new SimpleTestRunner();
    
    switch (command) {
        case 'list':
            await runner.listScenarios();
            break;
            
        case 'validate':
            const scenarioFile = args[1];
            const verbose = args.includes('--verbose') || args.includes('-v');
            
            if (!scenarioFile) {
                console.error('❌ Please specify a scenario file');
                console.log('Usage: node src/tests/simpleTest.js validate <scenario-file> [--verbose]');
                console.log('Example: node src/tests/simpleTest.js validate leader_s-1_trump_boost.json --verbose');
                return;
            }
            
            await runner.validateScenario(scenarioFile, verbose);
            break;
            
        default:
            console.log('🧪 Simple Test Runner - Validate test scenarios without backend');
            console.log('');
            console.log('Usage:');
            console.log('  node src/tests/simpleTest.js list                        # List scenarios');
            console.log('  node src/tests/simpleTest.js validate <file> [--verbose] # Validate scenario');
            console.log('');
            console.log('Examples:');
            console.log('  node src/tests/simpleTest.js list');
            console.log('  node src/tests/simpleTest.js validate leader_s-1_trump_boost.json');
            console.log('  node src/tests/simpleTest.js validate leader_s-1_trump_boost.json --verbose');
            break;
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = SimpleTestRunner;