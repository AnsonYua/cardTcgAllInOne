# Test Scenario Authoring Guide (Complete GameEnv)

## Purpose and Output Contract
Use this guide to generate a complete scenario JSON for manual/frontend execution.

Required output type:
- Full JSON file with `initialGameEnv` populated (not only notes).

Target path format:
- `shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario_name>.json`

Primary goal:
- Given environment requirements, produce a runnable scenario that can be loaded with `getTestScenario` and injected with `injectGameState`.

## Input Contract (What the Request Must Provide)
At minimum, collect or infer:
- Turn owner and phase.
- Attacker/defender role (if battle/burst scenario).
- Required cards by zone:
  - hand
  - slots
  - base
  - shieldArea
  - energyArea
  - trashArea
- Trigger to execute (play/deploy/attack/confirm burst/confirm battle).
- Expected postconditions.

## Authoring Algorithm
1. Read target card in `src/data/*.json` and identify effect branch to test.
2. Convert requirement into one explicit branch objective.
3. Start from full template (below), not from an empty file.
4. Populate both players:
- `deck.handUids`
- slot/base/shield/energy/trash zones
- queue seed and turn fields
5. Add concise `notes` with alternating `Action` and `Expect` lines.
6. Validate with dynamic validator.
7. Run manual API flow and verify transitions.

## Zone Construction Cookbook

### 1) Hand (`deck.handUids` is required)
```json
"deck": {
  "hand": [
    { "carduid": "GD01-023_hand_0001", "cardId": "GD01-023" }
  ],
  "handUids": ["GD01-023_hand_0001"],
  "mainDeck": []
}
```
Rules:
- Always include `handUids`.
- Keep `hand` aligned with `handUids` when present.

### 2) Unit in slot
```json
"slot1": {
  "unit": {
    "carduid": "GD01-020_unit_0001",
    "cardId": "GD01-020",
    "placedAt": 0,
    "placedBy": "playerId_2",
    "isRested": false,
    "playedThisTurn": false,
    "canAttackOnPlayTurn": false,
    "isFirstPlay": false,
    "damageReceived": 0,
    "continueModifyAP": 0,
    "continueModifyHP": 0
  }
}
```
Rules:
- For attacking unit scenarios: attacker must be in slot, active (`isRested: false`), and not blocked by your intended rule setup.

### 3) Pilot in slot (if needed)
```json
"slot1": {
  "unit": { "carduid": "GD01-001_unit_0001", "cardId": "GD01-001" },
  "pilot": { "carduid": "GD01-087_pilot_0001", "cardId": "GD01-087" }
}
```

### 4) During Pair Effect Setup

**What is "During Pair"?**
- A continuous effect that activates **only when the unit is paired** (unit + pilot in the same slot)
- The effect remains active while the pairing condition is satisfied
- Effect triggers based on specific conditions (e.g., "When one of your other Units with <Repair> attacks")

**GameEnv Setup Requirements:**
| Requirement | Env Encoding |
|-------------|--------------|
| Unit with "During Pair" effect | Unit + pilot in same slot (paired state) |
| Effect trigger condition met | Depends on specific effect (e.g., another unit with keyword attacking) |
| Energy requirement | Based on unit's Level (Level 7 = min 7 energy cards) |

**Example Setup for GD03-002 "During Pair" effect:**
```json
"slot1": {
  "unit": {
    "carduid": "GD03-002_unit_0001",
    "cardId": "GD03-002",
    "level": 7,
    "isRested": false
  },
  "pilot": {
    "carduid": "GD03-084_pilot_0001",
    "cardId": "GD03-084",
    "isRested": false
  }
}
```
Rules:
- Any pilot can be used to pair (not necessarily the card's linked pilot)
- The unit must be paired (unit + pilot in same slot) for the effect to activate
- Continuous "During Pair" effects check conditions continuously while the unit is paired

### 5) Base
```json
"base": [
  {
    "carduid": "GD01-125_base_0001",
    "cardId": "GD01-125",
    "placedAt": 0,
    "placedBy": "playerId_1",
    "isRested": false,
    "damageReceived": 0
  }
]
```

### 5) Shield Area
```json
"shieldArea": [
  { "carduid": "GD01-125_shield_0001", "cardId": "GD01-125" },
  { "carduid": "GD01-001_shield_0002", "cardId": "GD01-001" }
]
```

### 6) Energy Area
```json
"energyArea": [
  {
    "carduid": "energy_basic_p1_0001",
    "cardId": "energy_basic",
    "placedAt": 0,
    "placedBy": "playerId_1",
    "isRested": false,
    "isExtraEnergy": false
  }
]
```

### 7) Trash Area
```json
"trashArea": [
  { "carduid": "GD01-040_trash_0001", "cardId": "GD01-040" }
]
```

### 8) Processing queue (required)
```json
"processingQueue": []
```

### 9) Notification queue seed (required)
```json
"notificationQueue": [
  {
    "id": "card_drawn_seed_example",
    "type": "CARD_DRAWN",
    "metadata": {
      "timestamp": 1768362880422,
      "expiresAt": 1768362883422,
      "requiresAcknowledgment": false,
      "priority": "normal"
    },
    "payload": {
      "playerId": "playerId_2",
      "carduid": "GD01-000_draw_seed",
      "sourceZone": "deck",
      "reason": "draw",
      "timestamp": 1768362880422,
      "drawContext": "turn_start"
    }
  }
]
```
Rule:
- `payload.playerId` must match `currentPlayer`.

## Full Drop-In Template (`testType: action`)
Use this as the default starting point.

```json
{
  "description": "replace_with_scenario_description",
  "gameId": "replace_with_scenario_game_id",
  "testType": "action",
  "category": "ActionCase",
  "tags": ["TAG_1", "TAG_2"],
  "notes": [
    "Action: ...",
    "Expect: ..."
  ],
  "initialGameEnv": {
    "phase": "MAIN_PHASE",
    "playerId_1": "playerId_1",
    "playerId_2": "playerId_2",
    "gameStarted": true,
    "firstPlayer": 0,
    "firstPlayerChooser": null,
    "firstPlayerDecision": null,
    "hasChosenFirstPlayer": true,
    "currentPlayer": "playerId_1",
    "currentTurn": 1,
    "playersReady": {
      "playerId_1": true,
      "playerId_2": true
    },
    "processingQueue": [],
    "processingEnabled": true,
    "maxEventsPerCycle": 50,
    "notificationQueue": [
      {
        "id": "card_drawn_seed",
        "type": "CARD_DRAWN",
        "metadata": {
          "timestamp": 1768362880422,
          "expiresAt": 1768362883422,
          "requiresAcknowledgment": false,
          "priority": "normal"
        },
        "payload": {
          "playerId": "playerId_1",
          "carduid": "DRAW_SEED_CARDUID",
          "sourceZone": "deck",
          "reason": "draw",
          "timestamp": 1768362880422,
          "drawContext": "turn_start"
        }
      }
    ],
    "lastEventId": 0,
    "pendingPhaseTransition": null,
    "currentBattle": null,
    "version": 0,
    "players": {
      "playerId_1": {
        "id": "playerId_1",
        "name": "Player 1",
        "deck": {
          "hand": [],
          "handUids": [],
          "mainDeck": []
        },
        "confirmIsRedraw": false,
        "isRedraw": false,
        "playerPoint": 0,
        "isReady": true,
        "zones": {
          "slot1": {},
          "slot2": {},
          "slot3": {},
          "slot4": {},
          "slot5": {},
          "slot6": {},
          "base": [],
          "shieldArea": [],
          "energyArea": [],
          "trashArea": [],
          "repairAbilitiesCheckedThisCycle": false,
          "endTurnEffectsCheckedThisCycle": false
        }
      },
      "playerId_2": {
        "id": "playerId_2",
        "name": "Player 2",
        "deck": {
          "hand": [],
          "handUids": [],
          "mainDeck": []
        },
        "confirmIsRedraw": false,
        "isRedraw": false,
        "playerPoint": 0,
        "isReady": true,
        "zones": {
          "slot1": {},
          "slot2": {},
          "slot3": {},
          "slot4": {},
          "slot5": {},
          "slot6": {},
          "base": [],
          "shieldArea": [],
          "energyArea": [],
          "trashArea": [],
          "repairAbilitiesCheckedThisCycle": false,
          "endTurnEffectsCheckedThisCycle": false
        }
      }
    }
  }
}
```

## Validation and Manual Runtime Flow
Structural validation:
```bash
npm run test:dynamic run <relativeScenarioPath> --verbose
```

Manual runtime flow:
1. `GET /api/game/test/getTestScenario?scenarioPath=...`
2. `POST /api/game/test/injectGameState`
3. Execute manual actions (`playerAction`, `confirmBattle`, `confirmBurstChoice`, etc.).
4. Poll state and compare with `notes` expectations.

## Common Mistakes and Fixes
- Missing `handUids`:
  - Fix: always include `deck.handUids`, even if `deck.hand` is also present.
- Wrong slot shape:
  - Fix: `slotX` must be object; place unit under `slotX.unit`.
- Invalid attacker setup:
  - Fix: put attacker in slot, set `isRested: false`, align turn ownership.
- Notification seed mismatch:
  - Fix: `notificationQueue[*].payload.playerId === currentPlayer`.
- Wrong path root:
  - Fix: use `shared/testScenarios/gameStates/...`, not legacy paths.
