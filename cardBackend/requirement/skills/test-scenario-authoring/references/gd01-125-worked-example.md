# GD01-125 Worked Example

## Card Snapshot
Source:
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/gd01Card.json`

Card:
- `GD01-125` (Zanzibar)

Relevant text:
- `[Burst] Deploy this card.`
- `[Deploy] Add 1 of your Shields to your hand. Then, if it is your turn, you may deploy 1 (Zeon) Unit card that is Lv.4 or lower from your hand.`

## Scenario Objective
On opponent turn shield attack:
- Burst deploy resolves
- Shield-to-hand deploy step resolves
- Optional deploy-from-hand branch does not execute (not owner turn)

## Target Scenario Path
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/GD01/GD01-125/burst_deploy_opponent_turn_skip_optional_deploy.json`

## Initial Environment Constraints
- `currentPlayer = playerId_2` (attacker/opponent)
- `phase = MAIN_PHASE`
- Player 1 base empty (`zones.base = []`)
- Player 1 `shieldArea[0]` is `GD01-125`
- Player 1 has at least one additional shield card
- Player 1 hand includes one `(Zeon)` unit with `level <= 4`
- Player 2 has one legal attacker in `slot1`
- `processingQueue = []`
- `notificationQueue` includes valid `CARD_DRAWN` seed aligned to `currentPlayer`

## Action / Expect Script
- Action: Load scenario using `getTestScenario` and inject using `injectGameState`.
- Action: Player 2 calls `playerAction` with `actionType: attackShieldArea` from slot1 attacker.
- Action: Resolve action step confirmations (`confirmBattle`) for both players.
- Expect: Burst choice appears for Player 1.
- Action: Player 1 calls `confirmBurstChoice` with `confirmed: true`.
- Expect: `GD01-125` moves from shield to Player 1 base.
- Expect: One remaining Player 1 shield card moves to Player 1 hand.
- Expect: No `(Zeon)` unit deploys from Player 1 hand.
- Expect: No leftover `TARGET_CHOICE` for `deploy_from_hand`.

## Control Variant (Optional)
Owner-turn variant:
- Set `currentPlayer = playerId_1`
- Keep same core setup

Expected difference:
- Optional deploy-from-hand branch may become available/resolvable.

