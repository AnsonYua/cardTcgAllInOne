---
name: createGameEnvTest
description: Generate or review full manual test scenario JSON files under shared/testScenarios/gameStates for this card backend, including complete initialGameEnv zone setup for slots, hand, base, shield, energy, trash, and queue seeds.
triggers:
  - "this is my test gameEnv requirement"
  - "please use createGameEnvTest skill"
  - "create game environment test"
  - "test scenario authoring"
  - "gameenv requirement"
  - "game environment requirement"
  - "create test scenario"
---

# Create Game Environment Test

Use this skill when you need to create or review a complete action scenario JSON based on game environment requirements.

## Required Workflow
1. Read `createGameEnvTest/references/scenario-authoring.md` for contract and process.
2. Read `createGameEnvTest/references/gameenv-zone-cookbook.md` for exact zone snippets.
3. Start from `createGameEnvTest/references/templates/action-scenario-template.json`.
4. Fill the template from user environment requirements.
5. If card is GD01-125 (or similar burst-turn gating), read `createGameEnvTest/references/gd01-125-worked-example.md`.
6. Write the scenario JSON file to `shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario_name>.json`.
7. **IMPORTANT**: After creating the scenario file, update `cardGameFrontend/src/phaser/controllers/DebugControls.ts` by adding the new scenario path to `SCENARIO_PRESET_GROUPS` in the appropriate card set group (e.g., GD01, GD02, etc.).
8. Return full JSON draft plus Action/Expect notes plus validation command.

## Output Requirements
- Default `testType: "action"` for new scenarios.
- Include complete `initialGameEnv` for both players.
- Include `processingQueue: []`.
- Include `notificationQueue` with a `CARD_DRAWN` seed where `payload.playerId === currentPlayer`.
- Include `notes` with alternating `Action` and `Expect` lines.
- **CRITICAL: Energy Requirements**
  - Card `Level` determines minimum energy cards required in energy area
  - Level 1 → 1 energy card, Level 2 → 2 energy cards, Level 3 → 3 energy cards
  - Level 4 → 4 energy cards, Level 5 → 5 energy cards, Level 6 → 6 energy cards, Level 7 → 7 energy cards
  - Example: GD03-038 (Level 4) requires at least 4 energy cards in player's energy area
  - Card `Cost` is the number of energy cards tapped/activated to pay for playing the card
- **Energy Configuration Rule**
  - Unless there's a specific test requirement for rested energy, all energy cards in the energy area should be **active** (`isRested: false`)
  - Energy cards are consumed when playing a card, turning them from active to rested
  - Only set `isRested: true` if the scenario specifically requires testing with pre-rested energy
  - Example: A scenario testing "cannot play due to insufficient active energy" might have some rested cards

- **"During Pair" Effects** (Common Effect Type)
  - "During Pair" is a continuous effect that activates **only when the unit is paired** (unit + pilot in same slot)
  - The effect remains active while the pairing condition is satisfied
  - Any pilot can be used to pair (not necessarily the card's linked pilot)
  - **Setup Requirements**:
    - Unit + pilot in the same slot (paired state)
    - Additional units/cards to satisfy effect trigger conditions (e.g., "When one of your other Units with <Repair> attacks")
    - Enemy targets that match the effect's criteria (e.g., Lv. ≤ attacker's Lv.)
  - **Example**: GD03-002 "The-O" - "【During Pair】When one of your other Units with <Repair> attacks, choose 1 enemy Unit whose Lv. is equal to or lower than that Unit. Rest it."
    - Setup: GD03-002 + pilot (paired), GD01-001 + pilot (grants Repair, can attack), enemy unit with Lv. ≤ GD01-001's Lv.
    - Action: Player 1 attacks with GD01-001 (has Repair)
    - Expect: Effect triggers, player chooses enemy unit to rest

## Scenario Path Format
The scenario path to add to `SCENARIO_PRESET_GROUPS` should match the file path structure:
- Format: `<SET>/<CARD_ID>/<scenario_name>.json`
- Example: `GD01/GD01-125/burst_deploy_opponent_turn_skip_optional_deploy.json`

## DebugControls.ts Update
After creating the scenario file:
1. Read `cardGameFrontend/src/phaser/controllers/DebugControls.ts`
2. Find the appropriate `SCENARIO_PRESET_GROUPS` key based on card set (GD01, GD02, GD03, ST01, etc.)
3. Add the new scenario path to the array, maintaining alphabetical order
4. Update the file with the new entry

## Validation
Run:
`npm run test:dynamic run <relativeScenarioPath> --verbose`

Before finalizing, run `createGameEnvTest/references/checklist.md`.
