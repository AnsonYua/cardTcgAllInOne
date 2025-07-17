# Dynamic Testing Framework

## Overview

The Dynamic Testing Framework enables **action-based testing** where tests execute actual player actions and validate state changes, rather than just validating static pre-computed states.

## Key Differences

### Old Static Testing (`quickTest.js`)
```
Load Scenario → Inject State → Get State → Validate
```

### New Dynamic Testing (`dynamicTest.js`)
```
Load Scenario → Inject Initial State → Execute Actions → Validate Changes → Test Errors
```

## Test Scenario Structure

### Dynamic Scenario Format
```json
{
  "gameId": "test_scenario_id",
  "description": "Test description",
  "testType": "dynamic",
  "initialGameEnv": { /* Starting game state */ },
  "playerActions": [
    {
      "step": 1,
      "description": "Action description",
      "playerId": "playerId_1",
      "action": {
        "actionType": "PlayCard",
        "cardId": "c-1",
        "zone": "top"
      },
      "expectedResult": {
        "success": true,
        "noError": true
      }
    }
  ],
  "expectedStateChanges": {
    "zones.playerId_1.TOP.length": 1,
    "players.playerId_1.hand.length": 4
  },
  "validationPoints": {
    "card_power_check": {
      "description": "Validate card power after effects",
      "expected": { "cardId": "c-1", "finalPower": 145 }
    }
  },
  "errorCases": [
    {
      "description": "Test invalid placement",
      "playerId": "playerId_1",
      "action": { "actionType": "PlayCard", "cardId": "c-1", "zone": "invalid" },
      "expectedError": "INVALID_ZONE"
    }
  ]
}
```

## Usage

### Run Dynamic Test
```bash
# Basic execution
npm run test:dynamic run leader_s-1_trump_boost_corrected_dynamic.json

# With verbose output
npm run test:dynamic run leader_s-1_trump_boost_corrected_dynamic.json --verbose

# Step-by-step debugging
npm run test:dynamic run leader_s-1_trump_boost_corrected_dynamic.json --step-by-step
```

### Commands
- `npm run test:dynamic run <scenario>` - Run specific dynamic scenario
- `npm run test:dynamic run <scenario> --verbose` - Show detailed results
- `npm run test:dynamic run <scenario> --step-by-step` - Pause between actions

## Test Flow

1. **Setup**: Inject initial game state
2. **Execute**: Run each player action in sequence
3. **Validate**: Check state changes and power calculations
4. **Error Testing**: Test error cases and validation
5. **Report**: Generate comprehensive test report

## Example: Trump Boost Test

The `leader_s-1_trump_boost_corrected_dynamic.json` test:

1. **Initial State**: Empty board with Trump as leader
2. **Action 1**: Place President Trump (c-1) in TOP zone
3. **Action 2**: Place Former President Trump (c-2) in LEFT zone
4. **Action 3**: Place help card to complete phase
5. **Validation**: 
   - c-1 power = 155 (100 base + 45 leader + 10 family)
   - c-2 power = 145 (80 base + 45 leader + 10 family + 10 self)
6. **Error Cases**: Test invalid placements and zone restrictions

## Benefits

### Proper Unit Testing
- **Action-based**: Tests actual game logic flow
- **State Changes**: Validates before/after state differences
- **Real Behavior**: Tests what players actually experience
- **Error Handling**: Validates error cases and edge conditions

### Better Coverage
- **Multi-step Workflows**: Tests complete game sequences
- **Effect Interactions**: Validates card effect interactions
- **Phase Transitions**: Tests game phase management
- **Zone Management**: Validates zone restrictions and compatibility

### Debugging Support
- **Step-by-step**: Pause between actions for debugging
- **State History**: Track state changes after each action
- **Action History**: Record all executed actions
- **Detailed Reports**: Comprehensive test result analysis

## Creating New Dynamic Tests

1. **Start with Initial State**: Define clean starting game state
2. **Plan Action Sequence**: Design logical player actions
3. **Define Expectations**: Specify expected state changes
4. **Add Error Cases**: Test invalid actions and edge cases
5. **Validate Power**: Check card power calculations
6. **Test Phases**: Validate phase transitions if relevant

## Migration from Static Tests

To convert existing static tests:

1. **Extract Initial State**: Remove pre-placed cards from zones
2. **Add Actions**: Create playerActions array for card placement
3. **Define Changes**: Specify expectedStateChanges
4. **Keep Validation**: Maintain existing validationPoints
5. **Add Errors**: Include error case testing

This framework provides the proper unit testing flow you were looking for: **inject initial state → execute actions → validate changes**.