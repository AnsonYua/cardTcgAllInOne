# GameEnv Zone Cookbook

Use these snippets directly when filling `initialGameEnv`.

## Hand
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
- `handUids` is required for reliable runtime behavior.
- If `hand` exists, align it to `handUids`.

## Slot Unit
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

## Slot Pilot
```json
"slot1": {
  "unit": { "carduid": "GD01-001_unit_0001", "cardId": "GD01-001" },
  "pilot": { "carduid": "GD01-087_pilot_0001", "cardId": "GD01-087" }
}
```

### Linked vs Paired (Important)
- `paired` means `slot.unit` and `slot.pilot` both exist.
- `linked` means `paired` plus link compatibility is satisfied by engine link rules.
- For command cards used as pilots, include `"playedAs": "pilot"` on the pilot card so `designate_pilot` identity can be used for link checks.
- If a scenario expects a "During Link" effect, do not assume any pilot works; verify the unit `link` list is matched.

## Base
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

## Shield Area
```json
"shieldArea": [
  { "carduid": "GD01-125_shield_0001", "cardId": "GD01-125" },
  { "carduid": "GD01-001_shield_0002", "cardId": "GD01-001" }
]
```

## Energy Area
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

### Energy Requirements by Card Level
When setting up test scenarios, ensure the player has sufficient energy cards based on the card's **Level**:

| Card Level | Minimum Energy Cards Required |
|------------|----------------------------|
| Level 1    | 1 energy card               |
| Level 2    | 2 energy cards              |
| Level 3    | 3 energy cards              |
| Level 4    | 4 energy cards              |
| Level 5    | 5 energy cards              |
| Level 6    | 6 energy cards              |
| Level 7    | 7 energy cards              |

**Rule:**
- `Level` = minimum number of energy cards required in energy area to play the card
- `Cost` = number of energy cards tapped/activated to pay for playing the card

**Example:**
- Card: GD03-038 (Level 4, Cost 3)
- Required: At least 4 energy cards in energy area (because it's Level 4)
- Cost to pay: 3 energy cards (will become rested when played)

## Trash Area
```json
"trashArea": [
  { "carduid": "GD01-040_trash_0001", "cardId": "GD01-040" }
]
```

## Processing Queue
```json
"processingQueue": []
```

## Notification Queue Seed
```json
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
]
```
Rule:
- `payload.playerId` must equal `currentPlayer`.
