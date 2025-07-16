# Backend Unit Tests

This directory contains comprehensive unit and integration tests for the card game backend, focusing on leader effects and game mechanics.

## Test Structure

### Test Files

#### Integration Tests
- **`leaderEffectsIntegration.test.js`** - Integration tests using the `injectGameState` endpoint
- **`leaderEffects.test.js`** - Legacy integration tests (keep for reference)

#### Unit Tests
- **`cardEffectManager.test.js`** - Unit tests for CardEffectManager logic

#### Helper Files
- **`helpers/testHelper.js`** - Main test utility class
- **`helpers/testSetup.js`** - Jest setup and custom matchers
- **`setup.js`** - Test server setup
- **`teardown.js`** - Test server teardown

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Specific Test File
```bash
npm test -- --testNamePattern="leaderEffects"
```

### With Verbose Output
```bash
VERBOSE_TESTS=true npm test
```

## Test Scenarios

The tests use JSON scenario files from `shared/testScenarios/gameStates/` to validate leader effects:

### Trump (s-1) Tests
- **Standard boost**: Right-Wing and Patriot cards get +45 power
- **vs Powell**: Economy cards set to 0 power

### Biden (s-2) Tests
- **Universal boost**: All cards get +40 power

### Musk (s-3) Tests
- **Freedom boost**: Freedom cards get +50 power
- **Doge boost**: Cards with "Doge" in name get additional +20 power

### Harris (s-4) Tests
- **Left-Wing boost**: Left-Wing cards get +40 power
- **Economy boost**: Economy cards get +20 power
- **vs Trump**: Right zone cards set to 0 power

### Vance (s-5) Tests
- **Multiple boosts**: Right-Wing +40, Freedom +20, Economy +10

### Powell (s-6) Tests
- **Standard boost**: Freedom and Economy cards get +30 power
- **vs Trump boost**: Economy cards get additional +20 power
- **vs Trump restriction**: Cannot summon Right-Wing cards

## Test Architecture

### TestHelper Class

The `TestHelper` class provides utilities for:
- Loading test scenarios from JSON files
- Making HTTP requests to the backend
- Injecting game states via the test endpoint
- Validating power calculations
- Finding cards in game environments

### Key Methods

#### `runTestScenario(scenarioFile)`
Loads a scenario file, injects it into the backend, and returns the result.

#### `validatePowerCalculations(gameEnv, validationPoints)`
Validates that card power calculations match expected values.

#### `calculateActualPower(card, gameEnv, playerId)`
Calculates the actual power of a card considering all effects.

#### `findCardInGameEnv(gameEnv, cardId)`
Locates a card in the game environment and returns its details.

### Custom Jest Matchers

- **`toHaveValidCardStructure()`** - Validates card object structure
- **`toHaveValidGameEnvStructure()`** - Validates gameEnv object structure

## Test Data

### Scenario Files
Test scenarios are located in `shared/testScenarios/gameStates/` and follow this structure:

```json
{
  "gameId": "scenario_name",
  "gameEnv": {
    "phase": "MAIN_PHASE",
    "players": { /* player data */ },
    "zones": { /* zone data */ },
    "victoryPoints": { /* victory points */ }
  },
  "validationPoints": {
    "validation_id": {
      "description": "What to validate",
      "expected": {
        "cardId": "c-1",
        "finalPower": 155
      }
    }
  }
}
```

### Validation Points
Each test scenario includes validation points that specify:
- **cardId**: The card to validate
- **finalPower**: Expected final power after all effects
- **description**: Human-readable description of what's being tested

## Configuration

### Jest Configuration
- **Test timeout**: 30 seconds for integration tests
- **Test environment**: Node.js
- **Setup/teardown**: Automatic server start/stop
- **Coverage**: Configured for src/ directory

### Environment Variables
- **NODE_ENV**: Set to 'test' during testing
- **PORT**: Test server runs on port 8080
- **VERBOSE_TESTS**: Enable verbose output for debugging

## Debugging Tests

### Enable Verbose Output
```bash
VERBOSE_TESTS=true npm test
```

### Run Single Test
```bash
npm test -- --testNamePattern="Trump standard boost"
```

### Debug Test Server
The test server output can be enabled with `VERBOSE_TESTS=true` to see backend logs during testing.

## Test Coverage

The tests cover:
- ✅ All 6 leader effects (Trump, Biden, Musk, Harris, Vance, Powell)
- ✅ Power boost calculations
- ✅ Conditional effects (leader vs leader)
- ✅ Zone restrictions
- ✅ Card filtering logic
- ✅ Error handling
- ✅ Performance validation

## Adding New Tests

### For New Leader Effects
1. Create a new test scenario JSON file in `shared/testScenarios/gameStates/`
2. Add the scenario to `leaderEffectsIntegration.test.js`
3. Add validation points to verify expected behavior

### For New Game Mechanics
1. Add unit tests to the appropriate test file
2. Use the `TestHelper` class for common operations
3. Add integration tests if the feature affects the API

## Troubleshooting

### Common Issues
- **Port conflicts**: Make sure port 8080 is available
- **Test timeout**: Increase timeout in Jest config if needed
- **Server startup**: Check that all dependencies are installed
- **Scenario loading**: Verify JSON files are valid and in correct location

### Debug Steps
1. Check test server logs with `VERBOSE_TESTS=true`
2. Verify scenario files exist and are valid JSON
3. Check that backend server starts correctly
4. Validate test data matches expected format