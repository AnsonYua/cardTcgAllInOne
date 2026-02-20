# Scenario Authoring Reference

## Purpose
Author scenario JSON files for manual/frontend testing only.

Output target:
- `shared/testScenarios/gameStates/...`

Out of scope:
- Engine implementation changes
- API contract changes

## Canonical Sources
- Card definitions and effect rules:
`/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/*.json`
- Scenario endpoints:
`/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/controllers/gameController.ts`
- Attack/battle flow:
`/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/BattlePhaseManager.ts`
- Action-scenario shape validation:
`/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/tests/testScenarioUtils.js`

## Path Convention
Use:
- `shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario_name>.json`

Example:
- `shared/testScenarios/gameStates/GD01/GD01-125/burst_deploy_opponent_turn_skip_optional_deploy.json`

## Required Scenario Contract
Top-level required keys:
- `description` (string)
- `gameId` (string)
- `testType` (string)
- `category` (string)
- `tags` (string[])
- `initialGameEnv` (object)

Recommended default for new scenarios:
- `testType: "action"`

Required `initialGameEnv` fields for robust manual use:
- `phase`
- `currentPlayer`
- `currentTurn`
- `playerId_1`
- `playerId_2`
- `players`
- `playersReady`
- `processingQueue`
- `notificationQueue`

## Hard Quality Rules
- Always include `processingQueue: []`.
- Always include at least one `notificationQueue` item:
  - `type: "CARD_DRAWN"`
  - `payload.playerId === currentPlayer`
- Always include full zone structure for each player:
  - `slot1..slot6`
  - `base`, `shieldArea`, `energyArea`, `trashArea`
- Ensure attacker legality when attack flow is expected:
  - attacker exists in a slot
  - attacker is not rested
  - attacker is not blocked by turn/attack restrictions for the intended action

## Burst Flow Primer
Typical manual burst flow:
1. `playerAction` with `actionType: "attackShieldArea"`
2. Action step confirmations (`confirmBattle`) by both players
3. Shield damage resolves
4. Burst choice appears (`BURST_EFFECT_CHOICE`)
5. Resolve via `confirmBurstChoice`

## Authoring Workflow
1. Read target card `effects.description` and `effects.rules`.
2. Split each behavior branch into a separate scenario.
3. Encode minimum required board state.
4. Include concise `notes` with alternating Action/Expect.
5. Keep scenario focused; avoid unrelated board clutter.

## Validation Workflow
Structural validation for `testType: action`:

```bash
npm run test:dynamic run <relativeScenarioPath> --verbose
```

Runtime/manual validation:
1. `getTestScenario`
2. `injectGameState`
3. Execute manual actions
4. Poll game env and verify expected transitions

## Common Failure Patterns
- Using wrong path root (legacy `shared/GD01` instead of `shared/testScenarios/gameStates/...`).
- Missing `CARD_DRAWN` seed.
- Seed payload player mismatch with `currentPlayer`.
- Missing `processingQueue`.
- Missing zone keys (`slot1..slot6`, base/shield/energy/trash).
- Invalid attacker setup.
- Missing second shield when asserting deploy-shield-to-hand effects.
- Using legacy non-`action` `testType` for newly authored scenarios.

