#!/usr/bin/env node

/**
 * Interactive Test Runner
 * Allows you to select and run test scenarios interactively
 */

const readline = require('readline');
const SingleTestRunner = require('./runSingleTest');

class InteractiveTestRunner {
    constructor() {
        this.runner = new SingleTestRunner();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.scenarios = [
            { file: 'leader_s-1_trump_boost.json', name: 'Trump Standard Boost (Right-Wing & Patriot +45)', leaders: 'Trump vs Biden' },
            { file: 'leader_s-1_trump_vs_powell_nerf.json', name: 'Trump vs Powell (Economy → 0)', leaders: 'Trump vs Powell' },
            { file: 'leader_s-2_biden_boost.json', name: 'Biden Universal Boost (All cards +40)', leaders: 'Biden vs Trump' },
            { file: 'leader_s-3_musk_freedom_boost.json', name: 'Musk Freedom Boost (Freedom +50)', leaders: 'Musk vs Biden' },
            { file: 'leader_s-3_musk_doge_boost.json', name: 'Musk Doge Boost (Doge name +20)', leaders: 'Musk vs Biden' },
            { file: 'leader_s-4_harris_leftwing_boost.json', name: 'Harris Left-Wing Boost (Left-Wing +40)', leaders: 'Harris vs Biden' },
            { file: 'leader_s-4_harris_economy_boost.json', name: 'Harris Economy Boost (Economy +20)', leaders: 'Harris vs Biden' },
            { file: 'leader_s-4_harris_vs_trump_nerf.json', name: 'Harris vs Trump (Right zone → 0)', leaders: 'Harris vs Trump' },
            { file: 'leader_s-5_vance_boosts.json', name: 'Vance Multiple Boosts (Right-Wing +40, Freedom +20, Economy +10)', leaders: 'Vance vs Biden' },
            { file: 'leader_s-6_powell_boost.json', name: 'Powell Standard Boost (Freedom & Economy +30)', leaders: 'Powell vs Biden' },
            { file: 'leader_s-6_powell_vs_trump_boost.json', name: 'Powell vs Trump (Economy +50 total)', leaders: 'Powell vs Trump' },
            { file: 'leader_s-6_powell_vs_trump_restriction.json', name: 'Powell vs Trump (Right-Wing restriction)', leaders: 'Powell vs Trump' }
        ];
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    async displayMenu() {
        console.clear();
        console.log('🧪 Interactive Test Runner');
        console.log('=' .repeat(60));
        console.log('');
        
        for (let i = 0; i < this.scenarios.length; i++) {
            const scenario = this.scenarios[i];
            console.log(`${i + 1}. ${scenario.name}`);
            console.log(`   Leaders: ${scenario.leaders}`);
            console.log('');
        }
        
        console.log('0. Run all scenarios');
        console.log('q. Quit');
        console.log('');
    }

    async runSelectedScenario(index, verbose = false) {
        if (index === 0) {
            console.log('🚀 Running all scenarios...');
            await this.runner.runAllScenarios(verbose);
        } else if (index >= 1 && index <= this.scenarios.length) {
            const scenario = this.scenarios[index - 1];
            console.log(`🧪 Running: ${scenario.name}`);
            await this.runner.runSingleScenario(scenario.file, verbose);
        } else {
            console.log('❌ Invalid selection');
        }
    }

    async askForOptions() {
        const verbose = await this.question('Run with verbose output? (y/n) [n]: ');
        return {
            verbose: verbose.toLowerCase() === 'y' || verbose.toLowerCase() === 'yes'
        };
    }

    async waitForContinue() {
        console.log('\n');
        await this.question('Press Enter to continue...');
    }

    async run() {
        console.log('🚀 Starting test server...');
        
        try {
            // Import and start server
            const { setupTestServer, teardownTestServer } = require('./setup');
            await setupTestServer();
            
            console.log('✅ Test server started successfully!\n');
            
            while (true) {
                await this.displayMenu();
                
                const choice = await this.question('Select a test scenario (1-12, 0 for all, q to quit): ');
                
                if (choice.toLowerCase() === 'q' || choice.toLowerCase() === 'quit') {
                    console.log('👋 Goodbye!');
                    break;
                }
                
                const index = parseInt(choice);
                
                if (isNaN(index) || index < 0 || index > this.scenarios.length) {
                    console.log('❌ Invalid selection. Please try again.');
                    await this.waitForContinue();
                    continue;
                }
                
                // Ask for options
                const options = await this.askForOptions();
                
                console.clear();
                
                // Run the selected scenario
                await this.runSelectedScenario(index, options.verbose);
                
                // Wait for user to continue
                await this.waitForContinue();
            }
            
            await teardownTestServer();
            
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
        } finally {
            this.rl.close();
        }
    }
}

// Start the interactive runner
if (require.main === module) {
    const runner = new InteractiveTestRunner();
    runner.run().catch(console.error);
}

module.exports = InteractiveTestRunner;