module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.tsx?$': '<rootDir>/src/tests/jestTsTransform.js'
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
    testMatch: ['**/src/__tests__/**/*.test.js']
};

