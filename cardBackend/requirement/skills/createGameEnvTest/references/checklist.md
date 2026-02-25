# Scenario Authoring Checklist

## Pre-Author
- Confirm card branch from `src/data/*.json`.
- Confirm output path:
`shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario_name>.json`
- Confirm requested trigger and expected postconditions.

## Template Start
- Start from:
`references/templates/action-scenario-template.json`
- Use zone snippets from:
`references/gameenv-zone-cookbook.md`

## Authoring Checks
- `testType` is `action`.
- `processingQueue` exists and is `[]`.
- `notificationQueue` includes `CARD_DRAWN` seed with `payload.playerId === currentPlayer`.
- For action-effect scenarios:
  - `initialGameEnv` is not pre-set to battle/action step (`phase` should remain pre-battle, usually `MAIN_PHASE`).
  - `currentBattle` is `null` at scenario start unless explicitly required.
  - No pre-seeded confirmations/events that auto-enter action step.
- If notes/effect say "During Link" or source condition is `linked`:
  - verify setup is truly linked, not only paired
  - verify pilot identity matches unit `link` requirements (name/trait, or `designate_pilot` when command is played as pilot)
  - sanity example: `GD03-099 + GD03-083` is only paired; `GD03-099 + GD03-079` is linked
- Slot legality:
  - no slot may contain only a pilot card.
  - if `zones.slotX.pilot` exists, `zones.slotX.unit` must also exist.
  - `zones.slotX.unit.cardId` must be a unit card id (not pilot/command).
- Both players include:
  - `deck.handUids`
  - `zones.slot1..slot6`
  - `zones.base`, `zones.shieldArea`, `zones.energyArea`, `zones.trashArea`
- If attack scenario:
  - attacker exists in slot
  - attacker is active (`isRested: false`)
  - attacker/turn setup matches intended action
- Notes alternate `Action` / `Expect`.

## Validation Checks
- Run:
`npm run test:dynamic run <relativeScenarioPath> --verbose`
- Fix any schema issues before handoff.

## Manual Runtime Checks
- Load with `getTestScenario`.
- Inject with `injectGameState`.
- Execute notes exactly.
- Verify postconditions in game state and notifications.

## Final Sanity
- No unrelated board clutter.
- Filename and gameId reflect behavior under test.
- No contradiction against:
  - `src/tests/testScenarioUtils.js`
  - `src/controllers/gameController.ts`
  - `src/services/BattlePhaseManager.ts`
