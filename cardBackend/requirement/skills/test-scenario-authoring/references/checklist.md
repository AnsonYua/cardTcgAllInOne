# Scenario Authoring Checklist

## Pre-Author
- Confirm card ID and effect branch from `src/data/*.json`.
- Confirm destination path pattern:
`shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario_name>.json`
- Confirm scenario intent in one sentence.

## Authoring
- Include required top-level keys.
- Set `testType: "action"` unless explicitly requested otherwise.
- Include `initialGameEnv.processingQueue: []`.
- Include `initialGameEnv.notificationQueue` with valid `CARD_DRAWN` seed:
  - `payload.playerId === currentPlayer`
- Include full player zone structure (`slot1..slot6`, base/shield/energy/trash).
- Keep minimal board state to trigger only the target branch.
- Add `notes` using alternating Action/Expect lines.

## Structural Validation
- Run:
`npm run test:dynamic run <relativeScenarioPath> --verbose`
- Confirm no shape errors.

## Manual Runtime Verification
- Load scenario: `GET /api/game/test/getTestScenario?scenarioPath=...`
- Inject state: `POST /api/game/test/injectGameState`
- Perform target actions (attack/play/confirm choices).
- Poll game state and verify all expected postconditions.

## Final Sanity
- No contradictory instructions vs:
  - `src/tests/testScenarioUtils.js`
  - `src/controllers/gameController.ts`
- No unrelated cards/zones that can trigger side effects.
- Filename and gameId clearly reflect scenario behavior.

