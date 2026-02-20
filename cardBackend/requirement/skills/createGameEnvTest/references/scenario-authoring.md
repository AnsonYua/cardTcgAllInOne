# Scenario Authoring Reference

## Purpose and Scope
Generate complete scenario JSON for manual/frontend execution.

In scope:
- Full `initialGameEnv` authoring (players, zones, queues, turn state).
- Action/Expect notes for manual runtime flow.

Out of scope:
- Runtime logic changes.
- API/interface changes.

## Canonical Source Map
- Card rules: `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/*.json`
- Scenario endpoints: `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/controllers/gameController.ts`
- Attack/burst flow: `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/BattlePhaseManager.ts`
- Action scenario validator: `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/tests/testScenarioUtils.js`

## Output Path Convention
- `shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario_name>.json`

Example:
- `shared/testScenarios/gameStates/GD01/GD01-125/burst_deploy_opponent_turn_skip_optional_deploy.json`

## Required Top-Level Schema
Required keys:
- `description` (string)
- `gameId` (string)
- `testType` (string, default `action`)
- `category` (string)
- `tags` (string[])
- `initialGameEnv` (object)

Required `initialGameEnv` fields:
- `phase`
- `currentPlayer`
- `currentTurn`
- `playerId_1`
- `playerId_2`
- `players`
- `playersReady`
- `processingQueue`
- `notificationQueue`

## Authoring Algorithm
1. Parse requirement into one branch objective.
2. Read target card `effects.description` + `effects.rules`.
3. Start from `references/templates/action-scenario-template.json`.
4. Fill both player states with minimal cards needed to trigger the branch.
5. Use exact zone snippets from `references/gameenv-zone-cookbook.md`.
6. Add concise notes with alternating Action/Expect lines.
7. Validate and run manual flow.

## Hard Environment Rules
- Always include `processingQueue: []`.
- Always include at least one `CARD_DRAWN` seed in `notificationQueue`.
- Seed rule: `notificationQueue[*].payload.playerId === currentPlayer`.
- Always include all six slot objects and explicit arrays for `base`, `shieldArea`, `energyArea`, `trashArea`.
- Always include `deck.handUids` for each player.
- If `deck.hand` is included, keep it aligned with `handUids`.

## Burst Flow Primer
Typical burst-from-shield flow:
1. `playerAction` with `actionType: attackShieldArea`
2. `confirmBattle` by both players
3. Shield damage resolves
4. Burst choice appears
5. `confirmBurstChoice`

## Validation Workflow
Structural validation:
```bash
npm run test:dynamic run <relativeScenarioPath> --verbose
```

Manual runtime validation:
1. `GET /api/game/test/getTestScenario?scenarioPath=...`
2. `POST /api/game/test/injectGameState`
3. Execute manual actions.
4. Compare transitions with notes.

## Common Failure Patterns and Fixes
- Missing `handUids`:
  - Fix: always populate `deck.handUids`.
- Wrong slot encoding:
  - Fix: place units under `zones.slotX.unit`, not directly in `slotX`.
- Invalid attacker setup:
  - Fix: attacker in slot, active, and requirement-compatible.
- Missing queue seed:
  - Fix: add `CARD_DRAWN` seed with matching `currentPlayer`.
- Wrong scenario root:
  - Fix: always use `shared/testScenarios/gameStates/...`.
