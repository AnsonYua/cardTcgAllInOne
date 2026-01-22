# ST Actions (Not Yet Implemented)

1. choose_one_then_deploy_token (ST04-012)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [ST04-012]. Player A unit slots: slot1 = ST04-010 (active), slot2 = empty (open slot for token). Player A base: none. Shields: 5 cards from ST04. Player B unit slots: slot1 = ST04-011 (active). Base: none. Shields: 5 cards from ST04.
- Action: Player A plays ST04-012 from hand, resolves the effect, and chooses token option A.
- Expect: A token with the chosen cardId is deployed into A slot2; no other tokens are created.

2. deploy_from_hand (ST03-010)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [ST03-010, ST03-005 (unit to deploy)]. Player A unit slots: slot1 = empty, slot2 = ST03-006 (active). Player B unit slots: slot1 = ST03-007 (active).
- Action: Player A resolves ST03-010 and selects ST03-005 from hand to deploy.
- Expect: ST03-005 moves from hand to slot1; hand size decreases by 1; slot1 now contains ST03-005.

3. draw_if_moved_cards_match_traits (ST07-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST07-001 (active). Player A deck top (in order): [ST07-004 (matches trait), ST07-006 (non-match)]. Player B board can be empty for this test.
- Action: Resolve ST07-001 effect that mills/moves top cards to trash.
- Expect: Top cards move to A trash; because at least one moved card matches the trait, A draws the specified number of cards.

4. draw_then_discard (ST04-002)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [ST04-002, ST04-006]. Player A deck top: [ST04-008]. Player B board can be empty for this test.
- Action: Player A plays ST04-002 and resolves draw_then_discard.
- Expect: A draws ST04-008 into hand, then discards 1 card to trash; net hand count reflects draw then discard.

5. grant_keyword (ST06-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST06-001 (active), slot2 = ST06-004 (active target). Player B unit slots: slot1 = ST06-007 (active).
- Action: Resolve the ST06-001 effect that grants the keyword to the target unit.
- Expect: ST06-004 gains the keyword in gameEnv (e.g., keyword list or status flag) for the defined duration.

6. modifyCost (ST08-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [ST08-001, ST08-004 (card with cost to modify)]. Player A resources: enough to pay modified cost, but not the original cost. Player B board can be empty for this test.
- Action: Player A resolves ST08-001, then attempts to play ST08-004.
- Expect: ST08-004 is playable using the modified cost for the defined duration.

7. modifyLevel (ST08-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST08-003 (target). Player A hand: [ST08-001]. Player B unit slots: slot1 = ST08-006 (for level comparison if needed).
- Action: Player A resolves ST08-001 targeting ST08-003.
- Expect: ST08-003 level is modified in gameEnv for the defined duration and affects level-based checks.

8. moveTopDeckToTrash (ST07-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST07-001 (active). Player A deck top (in order): [ST07-003, ST07-008].
- Action: Resolve the moveTopDeckToTrash effect.
- Expect: ST07-003 and ST07-008 move to trash in order; deck size decreases by 2.

9. prevent_battle_damage (ST06-013)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST06-013 (protected), slot2 = ST06-004. Player B unit slots: slot1 = ST06-010 (attacker).
- Action: Player B attacks A slot1 and resolves battle damage.
- Expect: Battle damage to ST06-013 is prevented for the effect duration; damageReceived unchanged.

10. prevent_damage (ST07-015)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST07-015 (protected). Player B prepares an effect that deals damage (e.g., ST07-012 if applicable).
- Action: Apply effect damage to ST07-015.
- Expect: Effect damage is prevented; ST07-015 damageReceived does not increase.

11. prevent_set_active_next_turn (ST08-009)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST08-009 (rested, affected). Player A hand: [ST08-005] if needed to apply the effect. Player B board can be empty for this test.
- Action: End A's turn and advance to A's next turn ready step.
- Expect: ST08-009 remains rested during the next ready step (does not become active).

12. redirect_attack (ST07-004)

- Setup: GameEnv: currentPlayer = B, phase = MAIN_PHASE. Player A unit slots: slot1 = ST07-004 (redirecting unit, active), slot2 = ST07-006 (original target). Player B unit slots: slot1 = ST07-007 (attacker).
- Action: Player B declares an attack on A slot2; Player A uses redirect_attack during redirect window.
- Expect: Attack target changes to A slot1 if redirect is legal.

13. returnToHand (ST04-001)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [ST04-001]. Player B unit slots: slot1 = ST04-006 (enemy target).
- Action: Player A plays ST04-001 and targets B slot1.
- Expect: B slot1 unit is returned to B hand; slot1 becomes empty.

14. tutor_top_deck (ST06-009)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [ST06-009]. Player A deck contains an eligible unit (e.g., ST06-004) not on top.
- Action: Player A resolves ST06-009 and selects ST06-004 from deck.
- Expect: ST06-004 is placed on top of A deck; deck order updated.
