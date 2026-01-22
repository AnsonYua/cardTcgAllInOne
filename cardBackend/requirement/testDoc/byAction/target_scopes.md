# Target Scopes (Not Yet Implemented)

1. all (GD03-041)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-041 (source), slot2 = GD03-010. Player B unit slots: slot1 = GD03-001, slot2 = GD03-002.
- Action: Resolve the effect that targets scope 'all'.
- Expect: Targets include all valid cards from both players that meet filters.

2. any_all_unit (GD01-108)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-108 (source), slot2 = GD01-009. Player B unit slots: slot1 = GD01-012, slot2 = GD01-010.
- Action: Resolve the effect that targets any_all_unit.
- Expect: All units from both players that meet filters are targetable.

3. battle_opponent (GD02-073)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-073 (source), Player B unit slots: slot1 = GD02-010 (battle opponent).
- Action: Resolve the effect during battle that targets battle_opponent.
- Expect: Target resolves to the opponent unit currently engaged in the battle.

4. previous_target (GD01-069)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-069 (source). Player B unit slots: slot1 = GD01-012 (target).
- Action: Resolve a sequence: step1 selects B slot1, step2 uses previous_target.
- Expect: Step2 applies to the same card selected in step1.

5. source_paired_pilot (GD01-005)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-005 paired with pilot GD01-040.
- Action: Resolve an effect that targets source_paired_pilot.
- Expect: Target resolves to the paired pilot card; effect applies to the pilot.

6. source_paired_unit (ST07-009)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A pilot slot: ST07-009 paired to unit ST07-006.
- Action: Resolve an effect that targets source_paired_unit.
- Expect: Target resolves to the paired unit card; effect applies to the unit.
