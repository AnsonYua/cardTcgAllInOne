#!/usr/bin/env node

/**
 * Single Test Runner
 * Run individual test scenarios one by one
 */

const TestHelper = require('./helpers/testHelper');
const { setupTestServer, teardownTestServer } = require('./setup');
const path = require('path');
const fs = require('fs').promises;

class SingleTestRunner {
    constructor() {
        this.testHelper = new TestHelper();
        this.results = [];
    }

    async runSingleScenario(scenarioFile, verbose = false) {
        console.log(`\n🧪 Running: ${scenarioFile}`);
        console.log('=' .repeat(50));
        
        try {
            const startTime = Date.now();
            
            // Load and run the scenario
            const result = await this.testHelper.runTestScenario(scenarioFile);
            const { scenario, gameEnv, validationPoints } = result;
            
            if (verbose) {
                console.log(`📋 Scenario: ${scenario.gameId}`);
                console.log(`👥 Leaders: ${gameEnv.zones.playerId_1.leader.name} vs ${gameEnv.zones.playerId_2.leader.name}`);
                console.log(`🎯 Phase: ${gameEnv.phase}`);
            }
            
            // Validate power calculations
            const validationResults = this.testHelper.validatePowerCalculations(gameEnv, validationPoints);
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Display results
            console.log(`\n📊 Validation Results:`);
            let passed = 0;
            let failed = 0;
            
            for (const validation of validationResults) {
                if (validation.cardFound) {
                    if (validation.passed) {
                        console.log(`✅ ${validation.description}`);
                        console.log(`   Card: ${validation.cardId}, Expected: ${validation.expected}, Actual: ${validation.actual}`);
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
            
            console.log(`\n📈 Summary: ${passed} passed, ${failed} failed (${duration}ms)`);
            
            const testResult = {
                scenario: scenarioFile,
                passed,
                failed,
                duration,
                success: failed === 0,
                validations: validationResults
            };
            
            this.results.push(testResult);
            return testResult;
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            const testResult = {
                scenario: scenarioFile,
                passed: 0,
                failed: 1,
                duration: 0,
                success: false,
                error: error.message
            };
            
            this.results.push(testResult);
            return testResult;
        }
    }

    async runAllScenarios(verbose = false) {
        console.log('🚀 Running all test scenarios...\n');
        
        const scenarioFiles = [
            'leader_s-1_trump_boost.json',
            'leader_s-1_trump_vs_powell_nerf.json',
            'leader_s-2_biden_boost.json',
            'leader_s-3_musk_freedom_boost.json',
            'leader_s-3_musk_doge_boost.json',
            'leader_s-4_harris_leftwing_boost.json',
            'leader_s-4_harris_economy_boost.json',
            'leader_s-4_harris_vs_trump_nerf.json',
            'leader_s-5_vance_boosts.json',
            'leader_s-6_powell_boost.json',
            'leader_s-6_powell_vs_trump_boost.json',
            'leader_s-6_powell_vs_trump_restriction.json'
        ];
        
        for (const scenarioFile of scenarioFiles) {
            await this.runSingleScenario(scenarioFile, verbose);
            
            // Add a small delay between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        this.displaySummary();
    }

    displaySummary() {
        console.log('\n🎯 FINAL SUMMARY');
        console.log('=' .repeat(60));
        
        let totalPassed = 0;
        let totalFailed = 0;
        let totalDuration = 0;
        
        for (const result of this.results) {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${result.scenario}: ${result.passed} passed, ${result.failed} failed (${result.duration}ms)`);
            
            totalPassed += result.passed;
            totalFailed += result.failed;
            totalDuration += result.duration;
        }
        
        console.log('\n📊 Overall Results:');
        console.log(`   Total Tests: ${this.results.length}`);
        console.log(`   Total Validations: ${totalPassed + totalFailed}`);
        console.log(`   Passed: ${totalPassed}`);
        console.log(`   Failed: ${totalFailed}`);
        console.log(`   Success Rate: ${totalPassed + totalFailed > 0 ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100) : 0}%`);
        console.log(`   Total Duration: ${totalDuration}ms`);
    }

    async listAvailableScenarios() {
        console.log('📋 Available Test Scenarios:\n');
        
        try {
            const scenariosPath = path.join(__dirname, '../../../shared/testScenarios/gameStates/LeaderCase');
            const files = await fs.readdir(scenariosPath);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            for (let i = 0; i < jsonFiles.length; i++) {
                const file = jsonFiles[i];
                const filePath = path.join(scenariosPath, file);
                
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    const scenario = JSON.parse(content);
                    const leader1 = scenario.gameEnv.zones.playerId_1.leader.name;
                    const leader2 = scenario.gameEnv.zones.playerId_2.leader.name;
                    
                    console.log(`${i + 1}. ${file}`);
                    console.log(`   Leaders: ${leader1} vs ${leader2}`);
                    console.log(`   Validations: ${Object.keys(scenario.validationPoints).length}`);
                    console.log('');
                } catch (error) {
                    console.log(`${i + 1}. ${file} - Error reading file`);
                    console.log('');
                }
            }
        } catch (error) {
            console.error(`Error listing scenarios: ${error.message}`);
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const verbose = args.includes('--verbose') || args.includes('-v');
    
    const runner = new SingleTestRunner();
    
    try {
        // Start the test server
        await setupTestServer();
        
        switch (command) {
            case 'list':
                await runner.listAvailableScenarios();
                break;
                
            case 'all':
                await runner.runAllScenarios(verbose);
                break;
                
            case 'run':
                const scenarioFile = args[1];
                if (!scenarioFile) {
                    console.error('❌ Please specify a scenario file');
                    console.log('Usage: node runSingleTest.js run <scenario-file> [--verbose]');
                    console.log('Example: node runSingleTest.js run leader_s-1_trump_boost.json --verbose');
                    process.exit(1);
                }
                await runner.runSingleScenario(scenarioFile, verbose);
                break;
                
            default:
                console.log('🧪 Single Test Runner');
                console.log('');
                console.log('Usage:');
                console.log('  node runSingleTest.js list                    # List all available scenarios');
                console.log('  node runSingleTest.js all [--verbose]         # Run all scenarios');
                console.log('  node runSingleTest.js run <file> [--verbose]  # Run single scenario');
                console.log('');
                console.log('Examples:');
                console.log('  node runSingleTest.js list');
                console.log('  node runSingleTest.js run leader_s-1_trump_boost.json');
                console.log('  node runSingleTest.js run leader_s-1_trump_boost.json --verbose');
                console.log('  node runSingleTest.js all --verbose');
                break;
        }
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    } finally {
        // Stop the test server
        await teardownTestServer();
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = SingleTestRunner;