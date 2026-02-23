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
- **CRITICAL: Linked vs Paired Definition (Engine-Accurate)**
  - `paired`: unit and pilot both exist in the same slot.
  - `linked`: paired **and** `LinkUtils.isLinkedPair(unit, pilot)` is true.
  - Link match rule:
    - Unit `cardData.link` must include pilot identity.
    - Pilot identity is pilot `cardData.name` or (for command cards played as pilot) `designate_pilot.parameters.pilotName`.
    - Trait-based linking is also allowed when unit link entries match pilot traits.
  - Do not write "linked" in notes/setup unless link match is actually satisfied.
  - Example: `GD03-078` has `link: ["Sergei Smirnov"]`; pairing it with `GD03-096 (Jamil Neate)` is paired-only, **not linked**.
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

- **"During Link" Effects** (Common Effect Type)
  - "During Link" effects require `sourceConditions: [{ "type": "linked" }]` to be true at runtime.
  - Pairing alone is not enough; link compatibility must match unit `link` entries.
  - Setup requirement:
    - Use a pilot (or command played as pilot) that satisfies the unit's link identity.
  - Failure pattern:
    - Unit + non-matching pilot is only paired, so During Link effects must not be expected to trigger.

- **"Exile" Effects** (Common Effect Type)
  - "Exile" removes cards from the game permanently - they **disappear from gameEnv**
  - Exiled cards cannot be recovered (different from trash/discard where cards can potentially be retrieved)
  - **Setup Requirements**:
    - Cards in `trashArea` (usually with specific traits like "(Titans)")
    - Effect may have trait filters (e.g., "choose 2 Titans cards")
  - **Exile Behavior**:
    - Cards are removed from `trashArea` and **do not go to any specific zone**
    - They are removed from gameEnv entirely (no "exileArea" zone at this moment)
    - The effect often has a conditional second part (e.g., "If you do, choose 1 enemy Unit and rest it")
  - **Example**: GD03-009 "Palace Athene" - "【Deploy】You may choose 2 (Titans) cards from your trash. Exile them from the game. If you do, choose 1 enemy Unit that is Lv.4 or lower. Rest it."
    - Setup: Player has 2 Titans cards in trash (GD03-002, GD03-003)
    - Action: Player deploys GD03-009, chooses to exile 1-2 Titans cards
    - Expect: Chosen Titans cards disappear from trash (removed from gameEnv)
    - Expect: Rest enemy unit effect triggers only if Titans cards are exiled

- **"Grant Ability on Deploy" Effects** (Common Effect Type)
  - Effects that grant abilities to your units when deployed from hand
  - **Example**: GD03-021 "Gundam Deathscythe Hell" - "【Deploy】Choose 1 of your (Operation Meteor)/(G Team) Units. During this turn, it may choose an active enemy Unit as its attack target."
  - **Effect Type**: Deploy triggered effect that grants attack targeting ability to 1 unit
  - **Setup Requirements**:
    - Deploying card in hand (GD03-021)
    - 2+ units with specific traits already in play (to choose from)
    - Effect grant ability to 1 of your units (player choice)
  - **Effect Behavior**:
    - Chosen unit can choose any active enemy unit as attack target (until end of turn)
    - Effect bypasses normal blocking rules (can attack through blockers)
    - Duration: Effect lasts only for this turn (`UNTIL_END_OF_TURN`)
  - **Target Filter**: Only units with specified traits can be chosen
  - **Manual Steps**:
    1. Load scenario → inject
    2. Action: Player 1 deploys GD03-021
    3. Expect: Effect triggers - choose 1 unit to gain ability
    4. Manual: Player 1 selects GD03-018 (has G Team trait)
    5. Action: GD03-018 attacks enemy unit (can target even with blockers)
    6. Expect: Attack successful

- **"Attacking Rested Units" Scenarios**
  - Scenarios where a unit attacks a rested enemy unit with AP high enough to destroy itself
  - **Purpose**: Test battle damage calculations and AP mechanics
  - **Battle Damage Formula**: `Damage = Attacker AP - Defender HP` (or `AP > HP = destroyer`)
  - **Example Setup**:
    - GD03-021 in play (AP 6, HP 5) vs rested enemy (AP 6, HP 3)
    - Battle calculation: 6 - 3 = 3 damage → Enemy destroyed with 0 HP remaining
  - **Verification**:
    - Attacker with higher AP can destroy lower HP units
    - Rested units have same AP but cannot battle (normal rules apply)

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
