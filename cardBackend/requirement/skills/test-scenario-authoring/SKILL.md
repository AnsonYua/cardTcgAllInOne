---
name: test-scenario-authoring
description: Generate or review manual test scenario JSON files under shared/testScenarios/gameStates for this card backend. Use when building scenario setup gameEnv snapshots, burst and attack flow scenarios, and validation-ready Action and Expect notes, especially for attackShieldArea to confirmBattle to confirmBurstChoice flows.
---

# Test Scenario Authoring

Follow this workflow when asked to create or review scenario JSON.

1. Read the core rules in `references/scenario-authoring.md`.
2. If the request is about GD01-125 or similar burst deploy timing, read `references/gd01-125-worked-example.md`.
3. Build the scenario at:
`shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario_name>.json`
4. Default new scenarios to `testType: "action"` unless explicitly asked otherwise.
5. Enforce guardrails:
`processingQueue: []`
`notificationQueue` must include a `CARD_DRAWN` seed where `payload.playerId === currentPlayer`
6. Add compact `notes` with alternating `Action` and `Expect`.
7. Validate shape:
`npm run test:dynamic run <relativeScenarioPath> --verbose`
8. Use `references/checklist.md` before final delivery.
