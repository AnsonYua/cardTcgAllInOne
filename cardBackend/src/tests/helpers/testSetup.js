// Global test setup file that runs before each test

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '8080';

// Set longer timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
    // Helper to wait for async operations
    waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    // Helper to retry operations
    retry: async (operation, maxRetries = 3, delay = 1000) => {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await global.testUtils.waitFor(delay);
            }
        }
    },
    
    // Helper to generate unique test IDs
    generateTestId: () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    
    // Helper to clean up test data
    cleanupTestData: async (testHelper, gameIds) => {
        // Implementation would depend on how you want to clean up test data
        // For now, this is a placeholder
        console.log(`Cleaning up test data for games: ${gameIds.join(', ')}`);
    }
};

// Mock console methods for cleaner test output (optional)
if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    // Keep console.error for debugging
}

// Add custom matchers
expect.extend({
    toHaveValidCardStructure(received) {
        const pass = received && 
                     typeof received.id === 'string' &&
                     typeof received.name === 'string' &&
                     typeof received.cardType === 'string' &&
                     typeof received.power === 'number';
        
        if (pass) {
            return {
                message: () => `Expected card not to have valid structure`,
                pass: true
            };
        } else {
            return {
                message: () => `Expected card to have valid structure (id, name, cardType, power)`,
                pass: false
            };
        }
    },
    
    toHaveValidGameEnvStructure(received) {
        const pass = received &&
                     received.phase &&
                     received.players &&
                     received.zones &&
                     received.victoryPoints;
        
        if (pass) {
            return {
                message: () => `Expected gameEnv not to have valid structure`,
                pass: true
            };
        } else {
            return {
                message: () => `Expected gameEnv to have valid structure (phase, players, zones, victoryPoints)`,
                pass: false
            };
        }
    }
});