# Testing Architecture Documentation

## Overview

The "Revolution and Rebellion" card game implements a comprehensive testing architecture that supports both frontend interactive testing and backend automated validation using complete GameEnv scenarios. This architecture enables thorough testing of card effects, game states, and edge cases across the entire application.

## Architecture Components

### 1. Shared Test Scenarios

**Location**: `shared/testScenarios/`

**Structure**:
```
shared/testScenarios/
├── effectTests/        # Card effect scenarios
├── gameStates/         # Game progression scenarios  
├── edgeCases/          # Edge case scenarios
└── testUtils/          # Shared utilities
```

**Purpose**: Provides complete game environments that can be used by both frontend and backend testing systems for consistency.

### 2. Frontend Scenario Testing

**Location**: `cardFrontend/src/mock/`

**Key Components**:
- `testConfig.json` - Configuration for available scenarios
- `scenarioLoader.js` - Loads and validates scenarios
- Enhanced `GameStateManager.js` - Scenario testing methods
- Demo UI controls - Interactive scenario testing

**Features**:
- Load complete game environments in demo mode
- Visual validation of card effects
- Interactive scenario switching
- Real-time effect validation
- Export current game state as scenarios

### 3. Backend Scenario Validation

**Location**: `cardBackend/src/tests/testUtils/`

**Key Components**:
- `CompleteScenarioRunner.js` - Executes and validates scenarios
- `completeScenarios.test.js` - Comprehensive test suite
- `ScenarioLoader.js` - Shared scenario loading utility

**Features**:
- Automated scenario execution
- Effect simulation validation
- Performance testing
- Comprehensive reporting
- Test cleanup and management

## Scenario Format

### Complete GameEnv Scenario Structure

```json
{
  "id": "scenario_identifier",
  "name": "Human Readable Name",
  "description": "Detailed description of what this scenario tests",
  "gameEnv": {
    "phase": "BATTLE_PHASE",
    "currentPlayer": "player1",
    "currentTurn": 1,
    "gameStarted": true,
    "playerId_1": "player1",
    "playerId_2": "player2",
    "playersReady": { "player1": true, "player2": true },
    "player1": {
      "deck": { /* deck data */ },
      "Field": { /* field data */ },
      "turnAction": [],
      "playerPoint": 0,
      "fieldEffects": { /* field effects */ }
    },
    "player2": { /* similar structure */ },
    "playSequence": { /* play sequence data */ },
    "computedState": { /* computed state data */ }
  },
  "validationPoints": {
    "test_id": {
      "description": "What this validation tests",
      "expected": {
        "card-id": {
          "originalPower": 100,
          "finalPower": 145,
          "boost": 45
        }
      }
    }
  }
}
```

### Validation Points

Each scenario includes validation points that define expected results:
- **Card Power Values**: Original and final power after effects
- **Effect Applications**: Which effects should be active
- **Zone Restrictions**: Expected zone compatibility changes
- **Game State Consistency**: Overall game state validation

## Testing Workflows

### 1. Frontend Interactive Testing

**Steps**:
1. Start demo mode in frontend
2. Select scenario from dropdown
3. Click "Set Environment" to load scenario
4. Observe visual game state and UI
5. Click "Validate" to check results
6. Export current state if needed

**UI Controls**:
- Scenario dropdown (grouped by category)
- "Set Environment" button
- "Validate Results" button  
- "Export State" button
- Real-time validation feedback

### 2. Backend Automated Testing

**Test Commands**:
```bash
# Run all scenario tests
npm test -- --testNamePattern="completeScenarios"

# Run specific scenario
npm test -- --testNamePattern="trump_boost_complete"

# Run scenarios by category
npm test -- --testNamePattern="Card Effect Tests"
```

**Test Output**:
- Detailed validation results
- Performance metrics
- Effect simulation verification
- Comprehensive reporting

### 3. Cross-Platform Validation

**Process**:
1. Create scenario in shared directory
2. Test in frontend demo mode
3. Validate with backend automated tests
4. Ensure consistent results
5. Document any discrepancies

## Scenario Categories

### Effect Tests
- **Trump Boost**: Tests Trump's +45 boost to right-wing/patriot cards
- **Biden Universal**: Tests Biden's +40 boost to all cards
- **Conditional Effects**: Tests leader vs leader interactions
- **Complex Interactions**: Tests multiple effects on same cards

### Game States
- **Mid-Game**: Complex states with multiple effects active
- **Round Transitions**: States at round boundaries
- **Battle Phase**: Ready-to-battle states
- **Victory Conditions**: Near-victory game states

### Edge Cases
- **Face-Down Cards**: SP phase mechanics
- **Disabled Cards**: Power nullification effects
- **Zone Restrictions**: Dynamic zone compatibility
- **Error Conditions**: Invalid states and recovery

## Development Workflow

### Creating New Scenarios

1. **Identify Test Need**: Determine what needs testing
2. **Design Game State**: Create complete game environment
3. **Define Validation**: Set expected results
4. **Create JSON File**: Place in appropriate category directory
5. **Test Frontend**: Load in demo mode and validate
6. **Test Backend**: Run automated validation
7. **Document Results**: Update test documentation

### Scenario Validation Process

```javascript
// Backend validation
const result = await scenarioRunner.runCompleteScenario('scenario_id');
expect(result.passed).toBe(true);

// Frontend validation
const validation = gameStateManager.validateCompleteScenario();
expect(validation.passed).toBe(true);
```

### Best Practices

1. **Complete Scenarios**: Always use full game environments
2. **Realistic Data**: Use actual card IDs and realistic game states
3. **Comprehensive Validation**: Test all aspects of the scenario
4. **Clear Documentation**: Document what each scenario tests
5. **Consistent Naming**: Use descriptive, consistent scenario names

## Implementation Examples

### Example 1: Trump Boost Scenario

Tests Trump's leader effect that boosts right-wing and patriot cards by +45 power.

**Frontend Test**:
1. Load `trump_boost_complete` scenario
2. Visually verify card powers in UI
3. Validate computed state matches expected

**Backend Test**:
```javascript
test('Trump boost effects', async () => {
  const result = await scenarioRunner.runCompleteScenario('trump_boost_complete');
  expect(result.validation.results.player1_trump_boost.cards['c-001'].actual).toBe(145);
});
```

### Example 2: Complex Effect Interaction

Tests multiple effects on the same card to ensure proper stacking.

**Scenario Design**:
- Multiple leaders with overlapping effects
- Cards that match multiple effect criteria
- Validation of final computed power

## Performance Considerations

### Backend Performance
- Scenario execution: <5 seconds per scenario
- Memory usage: Efficient cleanup of test games
- Parallel testing: Support for concurrent scenarios

### Frontend Performance
- Scenario loading: <1 second for complete scenarios
- UI updates: Smooth transitions when loading scenarios
- Memory management: Proper cleanup of scenario data

## Error Handling

### Scenario Loading Errors
- Missing scenario files
- Invalid JSON format
- Incomplete scenario structure
- Validation failures

### Testing Errors
- Effect simulation failures
- Validation mismatches
- Performance timeouts
- Resource cleanup issues

## Future Enhancements

### Planned Features
1. **Scenario Editor**: GUI for creating scenarios
2. **Automated Generation**: Generate scenarios from real gameplay
3. **Performance Benchmarking**: Automated performance testing
4. **Visual Regression Testing**: Screenshot comparison
5. **Integration Testing**: End-to-end gameplay scenarios

### Extensibility
- **Custom Validators**: Add new validation types
- **Scenario Templates**: Templates for common scenarios
- **Batch Testing**: Run multiple scenarios automatically
- **Report Generation**: Enhanced reporting and analytics

## Conclusion

This testing architecture provides comprehensive coverage for card effects, game states, and edge cases while maintaining consistency between frontend and backend implementations. The use of complete GameEnv scenarios ensures realistic testing conditions and enables thorough validation of the game's complex card effect system.

The architecture supports both interactive development testing and automated validation, making it suitable for both development workflows and continuous integration processes.