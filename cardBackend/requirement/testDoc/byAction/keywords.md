# Keywords (Coverage Cases)

1. Blocker (GD01-019)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-019 (Blocker, active), slot2 = GD01-007 (original target). Player B unit slots: slot1 = GD01-012 (attacker).
- Action: Player B declares an attack on A slot2; A uses Blocker redirect window.
- Expect: Attack target can be redirected to A slot1 per Blocker rules.

2. Breach (GD03-088)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-088 (has Breach). Player B unit slots: slot1 = GD03-001 (low HP target). Player B base in play or 5 shields if no base.
- Action: A slot1 destroys B slot1 in battle.
- Expect: Breach applies to base damage or removes shield as per rules.

3. Breach 1 (GD02-089)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-089 (Breach 1). Player B unit slots: slot1 = GD02-010 (low HP target). Player B base in play or 5 shields.
- Action: A slot1 destroys B slot1 in battle.
- Expect: Exactly 1 breach damage is applied to base or shields.

4. Breach 4 (GD03-015)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-015 (Breach 4). Player B unit slots: slot1 = GD03-002 (low HP target). Player B base in play or 5 shields.
- Action: A slot1 destroys B slot1 in battle.
- Expect: Exactly 4 breach damage is applied to base or shields.

5. First Strike (ST06-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST06-001 with First Strike. Player B unit slots: slot1 = ST06-010 (defender).
- Action: Resolve battle between A slot1 and B slot1.
- Expect: A slot1 deals battle damage before B slot1 due to First Strike.

6. High-Maneuver (GD01-009)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-009 (High-Maneuver). Player B unit slots: slot1 = GD01-012 (attacker).
- Action: Player B attempts to target A slot1 with restricted attack/effect.
- Expect: Targeting is prevented when High-Maneuver restriction applies.

7. Repair (GD01-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-001 with damageReceived = 2. Player B board can be empty for this test.
- Action: End A turn to trigger repair timing.
- Expect: GD01-001 heals the Repair amount at end of turn; damageReceived decreases.

8. Repair 2 (GD03-008)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-008 with damageReceived = 3.
- Action: End A turn to trigger repair timing.
- Expect: GD03-008 heals 2 damage at end of turn (or to 0).

9. Suppression (ST05-001)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A unit slots: slot1 = ST05-001 with Suppression. Player B unit slots: slot1 = ST05-004 (would be restricted).
- Action: Player B attempts the action restricted by Suppression (attack or activate).
- Expect: The restricted action is prevented while Suppression applies.
