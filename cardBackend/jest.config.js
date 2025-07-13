module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    testMatch: ['**/src/tests/**/*.test.js'],
    verbose: true,
    testTimeout: 30000, // 30 seconds timeout for async tests
    globalSetup: '<rootDir>/src/tests/setup.js',
    globalTeardown: '<rootDir>/src/tests/teardown.js'
}; 