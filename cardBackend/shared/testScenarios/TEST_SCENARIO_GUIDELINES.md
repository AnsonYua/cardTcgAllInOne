# Test Scenario Creation Guidelines

## Card Energy Requirements

### Level
The **Level** of a card determines the minimum number of energy cards required in your energy area to play it.

| Card Level | Minimum Energy Cards Required |
|------------|----------------------------|
| Level 1    | 1 energy card               |
| Level 2    | 2 energy cards              |
| Level 3    | 3 energy cards              |
| Level 4    | 4 energy cards              |
| Level 5    | 5 energy cards              |
| Level 6    | 6 energy cards              |
| Level 7    | 7 energy cards              |

### Cost
The **Cost** of a card is the number of energy cards you must tap/activate to pay for playing it.

When setting up test scenarios:
- Ensure the player has **at least** `Level` number of energy cards
- Ensure there are enough active (isRested: false) energy cards to pay the `Cost`

**Example:**
- Card: GD03-038 (Level 4, Cost 3)
- Required: At least 4 energy cards in energy area
- Cost to pay: 3 energy cards (will become rested when played)

## JSON Structure for Test Scenarios

### Required Top-Level Fields
```json
{
  "description": "Brief description of the test",
  "gameId": "unique_game_id",
  "testType": "action" | "battle" | "deploy",
  "category": "ActionCase" | "BasicCase" | "BasicUI" | etc,
  "tags": ["cardId", "trigger_type", "action_type", ...],
  "notes": [
    "Setup: Describe initial board state",
    "Action: What action the test performs",
    "Expect: Expected behavior/result"
  ],
  "initialGameEnv": { ... }
}
```

### Unit Card Structure (Simplified)
When placing units on the board, use the minimal required structure:

```json
{
  "unit": {
    "carduid": "unique_uid",
    "cardId": "CARD-ID",
    "isRested": false,
    "damageReceived": 0,
    "continueModifyAP": 0,
    "continueModifyHP": 0,
    "originalAP": <AP value>,
    "originalHP": <HP value>,
    "canAttackThisTurn": true,
    "temporaryEffects": []
  }
}
```

**Note:** Do not include full `cardData` object in test scenarios - the backend will load card data automatically.

### Energy Card Structure
```json
{
  "carduid": "energy_uid",
  "cardId": "energy_basic",
  "placedAt": 0,
  "placedBy": "playerId_X",
  "isRested": false,  // false = active/upright, true = used/rested
  "isExtraEnergy": false
}
```

### Hand Card Structure
```json
{
  "hand": [
    {
      "carduid": "unique_uid",
      "cardId": "CARD-ID"
    }
  ],
  "handUids": ["unique_uid_1", "unique_uid_2", ...]
}
```

## Common Test Scenario Setup Checklist

- [ ] **Energy Count**: Verify player has at least `Level` energy cards
- [ ] **Cost Coverage**: Ensure enough energy to cover `Cost` of cards in hand
- [ ] **Player Turn**: Set `currentPlayer` to the player who will act
- [ ] **Phase**: Set correct `phase` (MAIN_PHASE, BATTLE_PHASE, etc.)
- [ ] **Cards in Hand**: Include `cardData` for hand cards if testing card effects
- [ ] **Units on Board**: Simplified structure for deployed units
- [ ] **Opponent Setup**: If testing interactions, include opponent units
- [ ] **JSON Validity**: Validate JSON before committing

## File Location

Test scenarios should be placed in:
```
/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/
```

Organize by card set and card ID:
```
shared/testScenarios/gameStates/
├── GD01/
│   └── GD01-118/
│       └── test_scenario.json
├── GD03/
│   └── GD03-038/
│       └── rest_trigger_ap_boost.json
└── ST01/
    └── ST01-001/
        └── burst_test.json
```

## Updating DebugControls.ts

After creating a test scenario, add it to `DebugControls.ts`:

```typescript
GD03: [
  "GD03/GD03-038/test_scenario_name",
  // ... other scenarios
],
```

File location:
```
/Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/controllers/DebugControls.ts
```
