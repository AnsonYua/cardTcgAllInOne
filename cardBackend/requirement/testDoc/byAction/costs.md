# Cost Keys (Not Yet Implemented)

1. destroyFriendlyUnit (GD02-057)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = GD02-057 (source), slot2 = GD02-010 (sacrifice).
- Action: Activate the effect and choose A slot2 to destroy as the cost.
- Expect: A slot2 is destroyed (moved to trash); effect resolves only if cost paid.

2. discardFromHand (GD01-023)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [GD01-023, GD01-009 (discard fodder)].
- Action: Activate the effect and discard GD01-009 from hand as cost.
- Expect: GD01-009 moves to trash; effect resolves only if cost paid.

3. exileFromTrash (GD03-054)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A trash: [GD03-010, GD03-011]. Player A hand: [GD03-054].
- Action: Activate the effect and exile GD03-010 from trash as cost.
- Expect: GD03-010 is removed from trash (exiled); effect resolves only if cost paid.

4. moveFromHandToDeckBottom (ST08-006)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A hand: [ST08-006, ST08-004 (card to place on bottom)]. Player A deck has at least 1 card.
- Action: Activate the effect and move ST08-004 from hand to bottom of deck as cost.
- Expect: ST08-004 becomes the bottom card of A deck; effect resolves only if cost paid.

5. moveFromTrashToDeck (GD01-003)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A trash: [GD01-009, GD01-012, GD01-015] (enough for cost). Player A hand: [GD01-003].
- Action: Activate the effect and move required cards from trash to deck as cost.
- Expect: Cards move from trash to deck (and shuffle if specified); effect resolves only if cost paid.

6. restSelf (ST06-014)

- Setup: GameEnv: currentPlayer = A, phase = MAIN_PHASE. Player A unit slots: slot1 = ST06-014 (active source).
- Action: Activate the effect and rest the source unit as the cost.
- Expect: ST06-014 becomes rested; effect resolves only if cost paid.
