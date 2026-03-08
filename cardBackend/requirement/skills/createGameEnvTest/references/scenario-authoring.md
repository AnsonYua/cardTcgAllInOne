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
4. Fill both player states with the minimal stable preconditions needed to trigger the branch.
5. Use exact zone snippets from `references/gameenv-zone-cookbook.md`.
6. Add concise notes with alternating Action/Expect lines.
7. Validate and run manual flow.

## Hard Environment Rules
- `initialGameEnv` should represent the last stable precondition before the tested behavior.
- Runtime-derived state should be created by gameplay actions in notes, not embedded directly into the fixture.
- Do **not** hard-code engine-generated transient state unless the scenario is explicitly about persistence, resume, migration, or compatibility of serialized runtime state.
- By default, do **not** author into the fixture:
  - generated choice events in `processingQueue`
  - generated notifications beyond the required harness seed
  - battle/action-step progress that should come from runtime actions
  - resolved effect results or post-choice state
- If transient runtime state is intentionally hard-coded, the scenario description or notes must explain why trigger-first authoring is required to be bypassed.
- Always include `processingQueue: []`. This is the default because choice/flow events should usually be created by runtime, not authored into the fixture.
- Always include at least one `CARD_DRAWN` seed in `notificationQueue`.
- Seed rule: `notificationQueue[*].payload.playerId === currentPlayer`.
- For action-effect scenarios, do **not** initialize directly in battle/action step. This is one example of the broader trigger-first rule.
  - Keep `initialGameEnv` before manual battle entry (default `phase: "MAIN_PHASE"` and `currentBattle: null` unless explicitly required otherwise).
  - Do not pre-seed action-step confirmations or queued events that skip user-driven battle entry.
- Always include all six slot objects and explicit arrays for `base`, `shieldArea`, `energyArea`, `trashArea`.
- Always include `deck.handUids` for each player.
- If `deck.hand` is included, keep it aligned with `handUids`.
- Linked/paired terminology must match engine behavior:
  - `paired`: slot has both `unit` and `pilot`.
  - `linked`: `paired` + link match (`LinkUtils.isLinkedPair`) succeeds.
  - Slot legality invariant: do not encode pilot-only slots.
    - if a slot has `pilot`, that slot must also have `unit`.
    - pilot-only slot setup is invalid test data and must be fixed.
    - `slot.unit.cardId` must resolve to `cardType: "unit"` (never pilot ids like `GD03-099`).
  - For `sourceConditions: [{ "type": "linked" }]`, setup must satisfy true linked state, not just unit+pilot occupancy.
  - If unit link list requires a specific pilot identity (name/trait), use a matching pilot (or command played as pilot with `designate_pilot`).
  - Example mismatch: `GD03-099 + GD03-083` is paired only (`GD03-083` has `link: []`), so linked effects must not be expected.
  - Example valid link: `GD03-099 + GD03-079` is linked via `AEUG` trait match.
- **ENERGY REQUIREMENTS CRITICAL:**
  - Card `Level` = minimum energy cards required in energy area
  - Level 1→1, 2→2, 3→3, 4→4, 5→5, 6→6, 7→7 energy cards
  - Example: GD03-038 (Level 4) requires 4 energy cards minimum
  - Example: GD02-058 (Level 2) requires 2 energy cards minimum

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
- **Insufficient energy for card level:**
  - Fix: ensure `energyArea` has at least `Level` number of energy cards
  - Example: Level 4 card requires 4 energy cards minimum
  - Example: Level 2 card requires 2 energy cards minimum
