# Worked Example: GD01-125 Opponent-Turn Burst Scenario

## 1) Rule Snapshot and Objective
Source card:
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/gd01Card.json`

Card text:
- `[Burst] Deploy this card.`
- `[Deploy] Add 1 of your Shields to your hand. Then, if it is your turn, you may deploy 1 (Zeon) Unit card that is Lv.4 or lower from your hand.`

Objective:
- On opponent turn shield attack, burst is activated.
- Base deploy happens.
- Shield-to-hand happens.
- Optional deploy-from-hand does not execute (not owner's turn).

## 2) Requirement-to-Env Mapping
| Requirement | Env Encoding |
|---|---|
| Opponent attacks | `currentPlayer = playerId_2` and attacker in `playerId_2.zones.slot1.unit` |
| Burst card is first shield | `playerId_1.zones.shieldArea[0].cardId = "GD01-125"` |
| Shield-to-hand can resolve | `playerId_1.zones.shieldArea` has at least 2 cards |
| Verify optional deploy is skipped | `playerId_1.deck.handUids` includes one Zeon unit Lv<=4 |
| No pre-existing base | `playerId_1.zones.base = []` |
| Scenario shape valid | include `processingQueue: []` and valid `CARD_DRAWN` seed |

## 3) Complete Example Scenario Draft
Target path:
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/GD01/GD01-125/burst_deploy_opponent_turn_skip_optional_deploy.json`

```json
{
  "description": "gd01-125_burst_deploy_opponent_turn_skip_optional_deploy",
  "gameId": "gd01-125_burst_deploy_opponent_turn_skip_optional_deploy",
  "testType": "action",
  "category": "ActionCase",
  "tags": ["GD01-125", "Burst", "Deploy", "TurnGate"],
  "notes": [
    "Action: Player 2 attacks Player 1 shield with slot1 attacker.",
    "Expect: Burst choice appears for Player 1.",
    "Action: Player 1 confirms burst activation.",
    "Expect: GD01-125 is deployed to Player 1 base.",
    "Expect: One remaining shield moves from Player 1 shieldArea to hand.",
    "Expect: No Zeon unit is deployed from Player 1 hand because it is not Player 1 turn."
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
    "currentPlayer": "playerId_2",
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
        "id": "card_drawn_1768362880422_gd01125_seed",
        "type": "CARD_DRAWN",
        "metadata": {
          "timestamp": 1768362880422,
          "expiresAt": 1768362883422,
          "requiresAcknowledgment": false,
          "priority": "normal"
        },
        "payload": {
          "playerId": "playerId_2",
          "carduid": "GD01-000_draw_seed_0001",
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
          "hand": [
            {
              "carduid": "GD01-023_hand_0001",
              "cardId": "GD01-023"
            }
          ],
          "handUids": ["GD01-023_hand_0001"],
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
          "shieldArea": [
            { "carduid": "GD01-125_shield_0001", "cardId": "GD01-125" },
            { "carduid": "GD01-001_shield_0002", "cardId": "GD01-001" }
          ],
          "energyArea": [
            {
              "carduid": "energy_basic_p1_0001",
              "cardId": "energy_basic",
              "placedAt": 0,
              "placedBy": "playerId_1",
              "isRested": false,
              "isExtraEnergy": false
            }
          ],
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
          },
          "slot2": {},
          "slot3": {},
          "slot4": {},
          "slot5": {},
          "slot6": {},
          "base": [],
          "shieldArea": [
            { "carduid": "GD01-040_shield_0001", "cardId": "GD01-040" }
          ],
          "energyArea": [
            {
              "carduid": "energy_basic_p2_0001",
              "cardId": "energy_basic",
              "placedAt": 0,
              "placedBy": "playerId_2",
              "isRested": false,
              "isExtraEnergy": false
            }
          ],
          "trashArea": [],
          "repairAbilitiesCheckedThisCycle": false,
          "endTurnEffectsCheckedThisCycle": false
        }
      }
    }
  }
}
```

## 4) Manual Action/Expect Flow
1. Action: Load scenario via `getTestScenario` and inject via `injectGameState`.
2. Action: Player 2 calls `playerAction` with `actionType: attackShieldArea` and attacker `GD01-020_unit_0001`.
3. Action: Both players resolve action-step confirmations (`confirmBattle`) until shield damage resolves.
4. Expect: `BURST_EFFECT_CHOICE` appears for Player 1.
5. Action: Player 1 calls `confirmBurstChoice` with `confirmed: true`.
6. Expect: `GD01-125` leaves shield and enters Player 1 base.
7. Expect: one remaining shield moves to Player 1 hand.
8. Expect: no `(Zeon)` Lv<=4 unit from hand is deployed.

## 5) Postcondition Checklist
- Base deploy happens.
- Shield-to-hand happens.
- Optional deploy-from-hand is skipped on opponent turn.
- No leftover deploy target-choice branch for the skipped optional effect.
