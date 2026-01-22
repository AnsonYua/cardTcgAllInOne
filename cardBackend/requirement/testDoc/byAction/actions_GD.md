# GD Actions (Not Yet Implemented)

1. applyStatusEffect (GD03-120)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [GD03-120]. Player A unit slots: slot1 = GD03-069 (active attacker, Superpower Bloc), slot2 = GD03-069 (rested, Superpower Bloc). Player B unit slots: slot1 = GD03-001 (enemy unit with low HP). Player A shields: 5 GD03 cards. Player B shields: 5 GD03 cards.
- Action: Player A plays GD03-120 (pay cost). In battle, GD03-069 destroys B slot1. When delayed trigger resolves, choose A slot2 as the target.
- Expect: A slot2 becomes active and gains status restriction cannot_attack until end of turn; gameEnv reflects the status flag.

2. deploy_from_hand (GD01-028)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [GD01-028, GD01-005 (unit to deploy)]. Player A unit slots: slot1 = empty, slot2 = GD01-007 (active). Player B unit slots: slot1 = GD01-010 (active).
- Action: Resolve GD01-028 and select GD01-005 from hand to deploy.
- Expect: GD01-005 moves from hand to slot1; hand size decreases by 1.

3. deploy_from_top_deck (GD01-045)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = empty. Player A deck top: [GD01-009 (unit eligible for deploy)].
- Action: Resolve GD01-045.
- Expect: GD01-009 is deployed to slot1 (or revealed then deployed if required by rules).

4. draw_then_discard (GD01-074)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [GD01-074, GD01-012]. Player A deck top: [GD01-015].
- Action: Player A plays GD01-074 and resolves draw_then_discard.
- Expect: A draws GD01-015, then discards 1 card to trash; net hand count reflects draw then discard.

5. exileFromTrash (GD02-111)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [GD02-111]. Player A trash: [GD02-020, GD02-021].
- Action: Player A resolves GD02-111 and selects GD02-020 to exile from trash.
- Expect: GD02-020 is removed from trash (exiled/removed-from-game zone), and is no longer in trash.

6. grant_keyword (GD01-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-001 (source), slot2 = GD01-007 (target). Player B unit slots: slot1 = GD01-010 (enemy).
- Action: Resolve GD01-001 effect to grant the keyword to A slot2.
- Expect: A slot2 gains the keyword (e.g., Repair) in gameEnv for the defined duration.

7. modifyCost (GD01-016)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [GD01-016, GD01-012 (cost-modified card)]. Player A resources: enough for modified cost but not original cost.
- Action: Resolve GD01-016, then attempt to play GD01-012.
- Expect: GD01-012 is playable at the modified cost for the defined duration.

8. moveTopDeckToTrash (GD02-127)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A deck top: [GD02-015, GD02-016]. Player A unit slots: slot1 = GD02-127 (source).
- Action: Resolve GD02-127 effect to move top cards to trash.
- Expect: GD02-015 and GD02-016 move to A trash in order; deck size decreases by 2.

9. pair_from_trash (GD01-023)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-023 (unit that will pair). Player A trash: [GD01-040 (pilot)].
- Action: Resolve GD01-023 to pair with GD01-040 from trash.
- Expect: GD01-040 moves from trash to pair with GD01-023; pairing is reflected in gameEnv.

10. prevent_battle_damage (GD02-006)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-006 (protected). Player B unit slots: slot1 = GD02-010 (attacker).
- Action: Player B attacks A slot1 and resolves battle damage.
- Expect: Battle damage to GD02-006 is prevented for the effect duration; damageReceived unchanged.

11. prevent_damage (GD02-064)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-064 (protected). Player B uses an effect that deals damage to A slot1.
- Action: Apply effect damage to GD02-064.
- Expect: Effect damage is prevented; damageReceived does not increase.

12. prevent_set_active_next_turn (GD02-004)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-004 (rested, affected).
- Action: End A's turn and advance to A's next ready step.
- Expect: GD02-004 remains rested during the ready step.

13. redirect_attack (GD01-065)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A unit slots: slot1 = GD01-065 (redirecting), slot2 = GD01-007 (original target). Player B unit slots: slot1 = GD01-012 (attacker).
- Action: Player B declares attack on A slot2; Player A uses redirect effect to change target to slot1.
- Expect: Attack target becomes A slot1 if redirect is legal.

14. registerDelayedTrigger (GD03-120)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [GD03-120]. Player A unit slots: slot1 = GD03-069 (active attacker), slot2 = GD03-069 (rested). Player B unit slots: slot1 = GD03-001 (enemy).
- Action: Player A plays GD03-120 to register the delayed trigger, then destroys B slot1 in battle.
- Expect: The delayed trigger fires once; A chooses a rested unit to set active and apply cannot_attack.

15. replace_cost (GD03-079)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [GD03-079]. Player A resources: enough for replacement cost only.
- Action: Attempt to play GD03-079 using the replaced cost defined by the effect.
- Expect: Play is accepted using the replaced cost; normal cost is not required.

16. require_attack_target_if_available (GD03-019)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-019 (affected attacker). Player B unit slots: slot1 = GD03-001 (valid target), slot2 = GD03-002 (another valid target).
- Action: Player A declares an attack with GD03-019.
- Expect: Attack must select one of the available enemy targets; cannot attack base or skip if targets exist.

17. restrict_pairing (T-021)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-010 (unit). Player A hand: [T-021 (applies restriction), GD03-050 (pilot to attempt pairing)].
- Action: Player A resolves T-021, then attempts to pair GD03-050 with GD03-010.
- Expect: Pairing is rejected if it violates the restriction; legal pairings still succeed.

18. restrict_set_active (T-021)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD03-010 (rested, restricted by T-021). Player A hand: [T-021].
- Action: Resolve T-021, then advance to ready step or use an effect that sets active.
- Expect: GD03-010 remains rested while the restriction applies.

19. returnToHand (GD01-005)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [GD01-005]. Player B unit slots: slot1 = GD01-010 (enemy target).
- Action: Player A plays GD01-005 and targets B slot1.
- Expect: B slot1 unit returns to B hand; slot1 becomes empty.

20. tutor_top_deck (GD01-048)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [GD01-048]. Player A deck contains GD01-009 not on top.
- Action: Player A resolves GD01-048 and selects GD01-009 from deck.
- Expect: GD01-009 is placed on top of A deck; deck order updated.
