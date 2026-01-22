# Timing Windows and Durations

1. Window: ACTION_STEP (ST06-011)

- Setup: GameEnv: currentPlayer = A, phase = ACTION_STEP. Player A hand: [ST06-011].
- Action: Attempt to play ST06-011 during ACTION_STEP, then attempt again during MAIN_PHASE.
- Expect: Action is allowed in ACTION_STEP and rejected outside the window.

2. Window: MAIN_PHASE (ST06-003)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [ST06-003].
- Action: Attempt to play ST06-003 during MAIN_PHASE, then during ACTION_STEP.
- Expect: Action is allowed only in MAIN_PHASE.

3. Duration: CONTINUOUS (GD02-023)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-023 (continuous source).
- Action: Apply the effect and advance turns without removing the source.
- Expect: Effect persists while the source remains valid.

4. Duration: UNTIL_END_OF_BATTLE (GD01-058)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-058 (source), Player B unit slots: slot1 = GD01-012 (enemy).
- Action: Resolve the effect, then complete the battle.
- Expect: Effect applies during battle and expires after battle resolution.

5. Duration: UNTIL_END_OF_TURN (ST06-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST06-001 (source).
- Action: Resolve the effect, then end the turn.
- Expect: Effect applies during the turn and is removed after end of turn.

6. Duration: continuous (ST07-005)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST07-005 (source).
- Action: Maintain the board state that satisfies the continuous condition.
- Expect: Effect persists while the condition holds and ends when it does not.

7. Duration: instant (ST01-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [ST01-001].
- Action: Resolve the instant effect once.
- Expect: Effect applies immediately and does not persist.
