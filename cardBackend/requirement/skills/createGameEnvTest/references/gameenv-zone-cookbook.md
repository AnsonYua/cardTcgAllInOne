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
