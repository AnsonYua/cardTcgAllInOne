# Triggers (Coverage Cases)

1. AP_REDUCED_BY_ENEMY_EFFECT (GD02-009)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-009 (source). Player B plays a card that reduces AP of A slot1.
- Action: Resolve the enemy effect that reduces AP.
- Expect: The trigger fires after AP reduction and the linked effect resolves.

2. ATTACK_PHASE (ST06-005)

- Setup: GameEnv: currentPlayer = A, phase = ATTACK_PHASE. Player A unit slots: slot1 = ST06-005 (source).
- Action: Advance to ATTACK_PHASE.
- Expect: The trigger fires at attack phase start.

3. ATTACK_REDIRECT (ST07-004)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A unit slots: slot1 = ST07-004 (redirecter), slot2 = ST07-006 (target). Player B unit slots: slot1 = ST07-007 (attacker).
- Action: Player B declares an attack on A slot2.
- Expect: Redirect window opens and the trigger allows redirect effect resolution.

4. BATTLE_DESTROY (ST06-005)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST06-005 (source). Player B unit slots: slot1 = ST06-010 (low HP target).
- Action: Resolve a battle where A slot1 destroys B slot1.
- Expect: The trigger fires after the destroy event.

5. BURST_CONDITION (ST06-009)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A shields: include ST06-009 in shield area. Player B unit attacks A base or shield area to damage a shield card.
- Action: Damage a shield card and reveal ST06-009.
- Expect: Burst effect resolves immediately per burst rules.

6. CUSTOM (GD03-060)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-060 (source) with custom trigger condition.
- Action: Satisfy the custom trigger condition defined by GD03-060.
- Expect: The effect fires only when the custom condition is met.

7. DEFENSE_AREA_BATTLE_DAMAGE (GD03-049)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-049 (defender in defense area). Player B unit slots: slot1 = GD03-002 (attacker).
- Action: Resolve battle damage dealt to the defending unit in defense area.
- Expect: Trigger fires when defense-area battle damage is applied.

8. DESTROYED (ST07-010)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A unit slots: slot1 = ST07-010 (source). Player B unit slots: slot1 = ST07-012 (attacker).
- Action: Destroy A slot1 by battle or effect.
- Expect: The DESTROYED trigger fires after the unit is destroyed.

9. EFFECT_DAMAGE_RECEIVED (GD02-010)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-010 (source). Player B plays an effect that deals damage to A slot1.
- Action: Resolve effect damage to A slot1.
- Expect: Trigger fires after effect damage is received.

10. END_OF_TURN (ST07-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST07-001 (source).
- Action: End Player A's turn.
- Expect: END_OF_TURN trigger fires during end-of-turn processing.

11. ENTERS_PLAY (ST06-002)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [ST06-002]. Player A unit slots: slot1 = empty.
- Action: Play ST06-002 to the field.
- Expect: ENTERS_PLAY trigger fires when the unit enters play.

12. EX_RESOURCE_PLACED (GD02-022)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A has an effect that places EX Resource (e.g., GD02-022 in hand).
- Action: Place an EX Resource via effect.
- Expect: EX_RESOURCE_PLACED trigger fires after placement.

13. PAIRING_COMPLETE (ST06-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [ST06-001, ST06-005 (pilot)]. Player A unit slots: slot1 = ST06-001 unpaired.
- Action: Play pilot to pair with ST06-001.
- Expect: PAIRING_COMPLETE trigger fires after pairing.

14. SHIELD_AREA_CARD_DAMAGED (GD02-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player B has at least 1 shield card; Player A attacks to damage a shield card.
- Action: Deal battle damage to a shield area card.
- Expect: Trigger fires when the shield area card is damaged.

15. continuous (ST07-005)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST07-005 (source).
- Action: Maintain board state that satisfies the continuous condition.
- Expect: Effect remains active while condition holds and ends when it no longer holds.
