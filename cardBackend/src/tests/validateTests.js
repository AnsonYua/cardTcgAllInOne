#!/usr/bin/env node

/**
 * Test validation script
 * This script validates that our test files can be loaded and basic structure is correct
 */

const fs = require('fs').promises;
const path = require('path');

async function validateTestScenarios() {
    console.log('🧪 Validating test scenarios...');
    
    const scenariosPath = path.join(__dirname, '../../../shared/testScenarios/gameStates');
    
    try {
        const files = await fs.readdir(scenariosPath);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        console.log(`📁 Found ${jsonFiles.length} test scenario files`);
        
        for (const file of jsonFiles) {
            try {
                const content = await fs.readFile(path.join(scenariosPath, file), 'utf8');
                const scenario = JSON.parse(content);
                
                // Validate structure
                const errors = [];
                
                if (!scenario.gameId) errors.push('Missing gameId');
                if (!scenario.gameEnv) errors.push('Missing gameEnv');
                if (!scenario.gameEnv.players) errors.push('Missing players');
                if (!scenario.gameEnv.zones) errors.push('Missing zones');
                if (!scenario.validationPoints) errors.push('Missing validationPoints');
                
                if (errors.length > 0) {
                    console.log(`❌ ${file}: ${errors.join(', ')}`);
                } else {
                    console.log(`✅ ${file}: Valid structure`);
                }
                
            } catch (error) {
                console.log(`❌ ${file}: JSON parsing error - ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error(`❌ Error reading scenarios directory: ${error.message}`);
    }
}

async function validateTestFiles() {
    console.log('\n🔍 Validating test files...');
    
    const testFiles = [
        'leaderEffects.test.js',
        'leaderEffectsIntegration.test.js',
        'cardEffectManager.test.js',
        'helpers/testHelper.js',
        'helpers/testSetup.js',
        'setup.js',
        'teardown.js'
    ];
    
    for (const file of testFiles) {
        try {
            const filePath = path.join(__dirname, file);
            await fs.access(filePath);
            console.log(`✅ ${file}: Exists`);
        } catch (error) {
            console.log(`❌ ${file}: Missing or inaccessible`);
        }
    }
}

async function validatePackageJson() {
    console.log('\n📦 Validating package.json test configuration...');
    
    try {
        const packagePath = path.join(__dirname, '../../package.json');
        const content = await fs.readFile(packagePath, 'utf8');
        const packageJson = JSON.parse(content);
        
        const checks = [
            { check: 'jest', getter: () => packageJson.devDependencies?.jest },
            { check: 'test script', getter: () => packageJson.scripts?.test },
            { check: 'test:watch script', getter: () => packageJson.scripts?.['test:watch'] },
            { check: 'babel-jest', getter: () => packageJson.devDependencies?.['babel-jest'] }
        ];
        
        for (const { check, getter } of checks) {
            try {
                const value = getter();
                if (value) {
                    console.log(`✅ ${check}: Configured`);
                } else {
                    console.log(`❌ ${check}: Missing`);
                }
            } catch (error) {
                console.log(`❌ ${check}: Missing`);
            }
        }
        
    } catch (error) {
        console.error(`❌ Error reading package.json: ${error.message}`);
    }
}

async function validateJestConfig() {
    console.log('\n⚙️  Validating Jest configuration...');
    
    try {
        const jestConfigPath = path.join(__dirname, '../../jest.config.js');
        await fs.access(jestConfigPath);
        console.log('✅ jest.config.js: Exists');
        
        // Try to require it to validate syntax
        try {
            const jestConfig = require(jestConfigPath);
            console.log('✅ jest.config.js: Valid syntax');
            
            // Check key configurations
            const requiredConfigs = [
                'testEnvironment',
                'testMatch',
                'globalSetup',
                'globalTeardown',
                'testTimeout'
            ];
            
            for (const config of requiredConfigs) {
                if (jestConfig[config]) {
                    console.log(`✅ ${config}: Configured`);
                } else {
                    console.log(`❌ ${config}: Missing`);
                }
            }
            
        } catch (error) {
            console.log(`❌ jest.config.js: Syntax error - ${error.message}`);
        }
        
    } catch (error) {
        console.log(`❌ jest.config.js: Missing`);
    }
}

async function main() {
    console.log('🚀 Starting test validation...\n');
    
    await validateTestScenarios();
    await validateTestFiles();
    await validatePackageJson();
    await validateJestConfig();
    
    console.log('\n✨ Test validation complete!\n');
    console.log('💡 To run tests:');
    console.log('   npm test                    # Run all tests');
    console.log('   npm run test:watch          # Run in watch mode');
    console.log('   VERBOSE_TESTS=true npm test # Run with verbose output');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    validateTestScenarios,
    validateTestFiles,
    validatePackageJson,
    validateJestConfig
};