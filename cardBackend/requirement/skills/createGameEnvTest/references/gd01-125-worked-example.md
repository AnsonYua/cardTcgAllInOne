# GD01-125 Worked Example (Complete Scenario Authoring)

## Card Snapshot
Source:
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/gd01Card.json`

Card:
- `GD01-125` (Zanzibar)

Relevant text:
- `[Burst] Deploy this card.`
- `[Deploy] Add 1 of your Shields to your hand. Then, if it is your turn, you may deploy 1 (Zeon) Unit card that is Lv.4 or lower from your hand.`

## Objective
Opponent turn shield attack reveals `GD01-125` and burst activates.

Expected:
- Burst deploy resolves.
- Shield-to-hand deploy step resolves.
- Optional deploy-from-hand branch does not resolve on opponent turn.

## Requirement-to-Env Mapping
- Opponent turn attack:
  - `currentPlayer = playerId_2`
  - Player 2 has legal attacker in `slot1`.
- Burst target is first shield:
  - `playerId_1.zones.shieldArea[0].cardId = "GD01-125"`.
- Shield add step must have source:
  - Player 1 has at least one additional shield.
- Turn-gate negative proof:
  - Player 1 hand includes one Zeon unit Lv<=4.

## Target Scenario Path
- `shared/testScenarios/gameStates/GD01/GD01-125/burst_deploy_opponent_turn_skip_optional_deploy.json`

## Drafting Method
1. Copy `references/templates/action-scenario-template.json`.
2. Fill turn fields for opponent turn.
3. Place cards in shield/hand/slot zones per mapping.
4. Add Action/Expect notes for attack -> confirmBattle -> confirmBurstChoice.
5. Validate with dynamic validator.

## Manual Action/Expect Script
- Action: Inject scenario.
- Action: Player 2 uses `attackShieldArea` from `slot1` attacker.
- Action: Resolve `confirmBattle` for both players.
- Expect: burst choice appears for Player 1.
- Action: Player 1 confirms burst activation.
- Expect: `GD01-125` moves to Player 1 base.
- Expect: one shield moves to Player 1 hand.
- Expect: no deploy-from-hand choice/effect resolves for Zeon Lv<=4 unit.

## Optional Control Variant
Owner turn control:
- set `currentPlayer = playerId_1`
- keep the same setup

Expected difference:
- optional deploy-from-hand branch can become available.
