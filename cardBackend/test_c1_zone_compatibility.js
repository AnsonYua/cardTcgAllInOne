#!/usr/bin/env node

/**
 * Test Script for c-1 Zone Compatibility Test Case
 * Tests zone restriction error and power calculation
 */

const { execSync } = require('child_process');
const path = require('path');

async function runTest() {
    console.log('🚀 Running c-1 Zone Compatibility Test');
    console.log('=' .repeat(50));
    
    const scenarioFile = 'character_c-1_trump_zone_compatibility.json';
    
    try {
        console.log(`📝 Test Scenario: ${scenarioFile}`);
        console.log('📍 Location: shared/testScenarios/gameStates/CharacterCase/');
        console.log('');
        console.log('🧪 Test Cases:');
        console.log('  1. c-1 (愛國者) → TOP zone → Should ERROR (zone restriction)');
        console.log('  2. c-1 (愛國者) → LEFT zone → Should SUCCEED with 155 power');
        console.log('');
        
        // Run the dynamic test
        const command = `npm run test:dynamic run ${scenarioFile} --verbose`;
        
        console.log(`🔧 Running: ${command}`);
        console.log('=' .repeat(50));
        
        execSync(command, { 
            stdio: 'inherit', 
            cwd: path.resolve(__dirname)
        });
        
        console.log('=' .repeat(50));
        console.log('✅ Test execution completed!');
        
    } catch (error) {
        console.error('❌ Test execution failed:');
        console.error(error.message);
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    runTest().catch(console.error);
}

module.exports = { runTest };