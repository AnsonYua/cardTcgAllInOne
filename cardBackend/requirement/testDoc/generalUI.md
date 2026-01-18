General UI test cases for basic play-button gating. Each case points to a JSON game state under `shared/testScenarios/gameStates/BasicUI/` to load for frontend validation.

All BasicUI scenarios include a `notificationQueue` entry of type `CARD_DRAWN`, and `currentPlayer` matches the notification payload `playerId` so the frontend can trigger draw UI.

1) Hand unit: insufficient cost (active energy)

- Scenario: `shared/testScenarios/gameStates/BasicUI/hand_unit_insufficient_cost.json`
- Setup: Player 1 has ST01-001 (cost 3, level 4) in hand. Total energy = 4, active energy = 2.
- Expect: No "Play Unit" button when clicking the card (fails cost check).

2) Hand unit: insufficient level (total energy)

- Scenario: `shared/testScenarios/gameStates/BasicUI/hand_unit_insufficient_level.json`
- Setup: Player 1 has ST01-002 (cost 3, level 5) in hand. Total energy = 4, active energy = 4.
- Expect: No "Play Unit" button when clicking the card (fails level check).

3) Hand command: no available target

- Scenario: `shared/testScenarios/gameStates/BasicUI/hand_command_no_target.json`
- Setup: Player 1 has ST01-012 in hand and enough energy. Opponent has only active units (no rested targets).
- Expect: No "Play Command" button (or disabled) because there is no valid target.

4) Hand pilot: all units already paired with pilots

- Scenario: `shared/testScenarios/gameStates/BasicUI/hand_pilot_no_available_unit.json`
- Setup: Player 1 has ST01-010 in hand. Player 1 has units in slot1+slot2, each already has a pilot.
- Expect: No "Play Pilot" button because there is no available unit without a pilot.

5) Hand command with pilot designation: no available unit

- Scenario: `shared/testScenarios/gameStates/BasicUI/hand_command_pilot_no_unit.json`
- Setup: Player 1 has ST01-012 in hand. Player 1 has no units in play.
- Expect: "Play as Pilot" button is disabled/hidden because there is no available unit.

6) Hand unit: playable with enough cost and level

- Scenario: `shared/testScenarios/gameStates/BasicUI/hand_unit_playable.json`
- Setup: Player 1 has ST01-001 in hand, total energy >= level, active energy >= cost, and at least one empty unit slot.
- Expect: "Play Unit" button is shown.

7) Hand pilot: playable with available unit

- Scenario: `shared/testScenarios/gameStates/BasicUI/hand_pilot_playable.json`
- Setup: Player 1 has ST01-010 in hand, a unit in slot1 with no pilot, and enough energy.
- Expect: "Play Pilot" button is shown.

8) Hand command: playable with valid target

- Scenario: `shared/testScenarios/gameStates/BasicUI/hand_command_playable_with_target.json`
- Setup: Player 1 has ST01-012 in hand and enough energy. Player 2 has a rested unit.
- Expect: "Play Command" button is shown.

9) Hand command as pilot: playable with available unit

- Scenario: `shared/testScenarios/gameStates/BasicUI/hand_command_pilot_playable.json`
- Setup: Player 1 has ST01-012 in hand, a friendly unit with no pilot, and enough energy.
- Expect: "Play as Pilot" button is shown.
