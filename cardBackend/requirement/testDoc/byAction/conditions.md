# Condition Types (Not Yet Implemented)

1. attackTargetCardType (GD01-050)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-050 (attacker with condition). Player B unit slots: slot1 = GD01-012 (Unit), slot2 = GD01-108 (Base or non-Unit target if applicable).
- Action: Declare an attack from A slot1 against B slot1 (Unit) and resolve any condition checks.
- Expect: Condition passes when target cardType matches the required value; effect applies.

2. battleDestroyEvent (GD02-002)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-002 (source). Player B unit slots: slot1 = GD02-010 (enemy with low HP).
- Action: Resolve a battle where A slot1 destroys B slot1 with battle damage.
- Expect: Condition evaluates true only on battle-destroy event; effect triggers once.

3. battleOpponentLevel (GD01-063)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-063 (source). Player B unit slots: slot1 = GD01-009 (Lv<=X), slot2 = GD01-012 (Lv>X).
- Action: Battle A slot1 vs B slot1, then battle A slot1 vs B slot2.
- Expect: Effect applies only in the battle where the opponent level satisfies the condition.

4. cardsInPlay (ST07-004)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST07-004 (source), slot2 = ST07-006 (another unit). Player B unit slots: slot1 = ST07-007 (enemy).
- Action: Set total cards in play to meet the required threshold, then resolve the effect.
- Expect: Condition passes only when the in-play count meets the specified comparison.

5. cardsInTrash (ST07-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A trash: [ST07-003, ST07-008, ST07-010] (count meets condition). Player A unit slots: slot1 = ST07-001 (source).
- Action: Resolve the effect that checks cardsInTrash.
- Expect: Condition passes when trash count meets the threshold.

6. cardsInTrashWithTraitsAny (GD02-061)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A trash: [GD02-020 (trait match), GD02-021 (non-match)]. Player A unit slots: slot1 = GD02-061 (source).
- Action: Resolve the effect that checks traits in trash.
- Expect: Condition passes if any trash card matches the listed traits.

7. hasAnotherLinkedUnit (ST04-009)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST04-009 (source, linked), slot2 = ST04-010 (another linked unit).
- Action: Resolve the effect that checks for another linked unit.
- Expect: Condition passes only when a second linked unit exists.

8. hasAnotherLinkedUnitWithTrait (GD02-033)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-033 (source), slot2 = GD02-034 (linked unit with required trait).
- Action: Resolve the effect that checks linked unit with trait.
- Expect: Condition passes only when the linked unit has the required trait.

9. hasAnotherUnitWithTrait (GD01-007)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-007 (source), slot2 = GD01-009 (unit with required trait).
- Action: Resolve the effect that checks for another unit with trait.
- Expect: Condition passes only when another unit with the trait is in play.

10. noPairedPilot (GD01-023)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-023 (unpaired source).
- Action: Resolve the effect that requires no paired pilot.
- Expect: Condition passes only when the source has no paired pilot.

11. noUnitTokenWithTrait (ST04-012)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST04-012 (source), slot2 = ST04-011 (normal unit). No token with the required trait is in play.
- Action: Resolve the effect that checks for no token with trait.
- Expect: Condition passes only when no unit token with the specified trait exists.

12. opponentHandSize (GD01-097)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player B hand size set to 6 (or required threshold). Player A unit slots: slot1 = GD01-097 (source).
- Action: Resolve the effect that checks opponent hand size.
- Expect: Condition passes only when opponent hand size meets the threshold.

13. pairedPilotColor (GD02-034)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-034 paired with a pilot of the required color.
- Action: Resolve the effect that checks paired pilot color.
- Expect: Condition passes only when the paired pilot color matches the requirement.

14. pairedPilotLevel (ST04-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST04-001 paired with a pilot at the required level.
- Action: Resolve the effect that checks paired pilot level.
- Expect: Condition passes only when the paired pilot level meets the requirement.

15. pairedPilotTrait (GD01-025)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-025 paired with a pilot with the required trait.
- Action: Resolve the effect that checks paired pilot trait.
- Expect: Condition passes only when the paired pilot has the required trait.

16. pairedPilotTraitAny (GD01-044)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-044 paired with a pilot that has one of the listed traits.
- Action: Resolve the effect that checks paired pilot trait any.
- Expect: Condition passes if any listed trait is present on the paired pilot.

17. pairedUnitColor (ST08-011)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A pilot slot: ST08-011 paired to a unit of the required color.
- Action: Resolve the effect that checks paired unit color.
- Expect: Condition passes only when the paired unit color matches the requirement.

18. pairedUnitTrait (ST07-010)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A pilot slot: ST07-010 paired to a unit with the required trait.
- Action: Resolve the effect that checks paired unit trait.
- Expect: Condition passes only when the paired unit has the required trait.

19. playerLevel (GD02-031)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A level set to the required threshold. Player A unit slots: slot1 = GD02-031 (source).
- Action: Resolve the effect that checks player level.
- Expect: Condition passes only when player level meets the requirement.

20. shieldAreaCardDamagedByBattleDamage (GD02-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player B has at least 1 shield card. A battle deals damage to B shield area card.
- Action: Resolve the battle that damages a shield area card.
- Expect: Condition passes only when the shield area card was damaged by battle damage.

21. sourceAP (GD03-042)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-042 with AP set to meet threshold.
- Action: Resolve the effect that checks source AP.
- Expect: Condition passes only if source AP satisfies the requirement.

22. sourceAp (GD01-050)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-050 with AP set to meet threshold.
- Action: Resolve the effect that checks source AP (sourceAp).
- Expect: Condition passes only if source AP satisfies the requirement.

23. sourceDamaged (ST05-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST05-001 with damageReceived > 0.
- Action: Resolve the effect that checks sourceDamaged.
- Expect: Condition passes only if the source unit is damaged.

24. sourceHP (GD03-061)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-061 with current HP set to meet threshold.
- Action: Resolve the effect that checks source HP.
- Expect: Condition passes only if source HP satisfies the requirement.

25. sourceLevel (GD02-095)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-095 with level set to meet threshold.
- Action: Resolve the effect that checks source level.
- Expect: Condition passes only if source level satisfies the requirement.

26. sourceStatus (GD03-070)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-070 set to required status (rested or active).
- Action: Resolve the effect that checks source status.
- Expect: Condition passes only if source status matches required value.

27. unitsInPlayWithFilter (ST06-014)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST06-014 (source), slot2 = ST06-004 (matches filter). Player B unit slots: slot1 = ST06-007 (non-matching if needed).
- Action: Resolve the effect that checks units in play with filter.
- Expect: Condition passes only when filtered count meets the requirement.

28. unitsInPlayWithStatus (GD01-047)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-047 (source), slot2 = GD01-009 (rested).
- Action: Resolve the effect that checks units by status.
- Expect: Condition passes only when required number of units have the specified status.

29. unitsInPlayWithTrait (ST06-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST06-001 (source), slot2 = ST06-004 (has required trait).
- Action: Resolve the effect that checks units by trait.
- Expect: Condition passes only when required number of units with the trait are in play.
