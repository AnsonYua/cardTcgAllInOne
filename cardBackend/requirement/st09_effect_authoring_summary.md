# ST09 Effect Authoring Summary

## 1. Scope
The planned ST09 runtime file will include only:
- `ST09-001`
- `ST09-002`
- `ST09-003`
- `ST09-004`
- `ST09-005`
- `ST09-006`
- `ST09-007`
- `ST09-008`
- `ST09-009`
- `ST09-010`

These are excluded for now:
- `R-030`
- `EXB-002`
- `EXR-002`

Reason:
- current runtime set JSONs only use `unit`, `pilot`, `command`, and `base`

## 2. Reused Authoring Patterns
ST09 should reuse these existing authoring patterns:
- burst add-to-hand for pilots
- innate `Blocker` via `redirect_attack`
- innate `Breach N` via `damageShield` on `BATTLE_DESTROY`
- deploy triggers via `ENTERS_PLAY`
- trash-origin deploy checks via `sourceDeployedFrom: "trash"`
- paired trait checks via `paired` plus `pairedUnitTrait`
- linked checks via `sourceConditions: [{ type: "linked" }]`
- base-in-play checks via `cardsInPlayWithFilter`
- top-deck look/keep/trash via `scry_top_deck`
- command `[Main]/[Action]` as `type: "play"` with both `MAIN_PHASE` and `ACTION_STEP`

## 3. New Authored-Schema Additions
Only two new source-authoring additions are expected:
- `action: "returnToDeckBottom"` for `ST09-001`
- `filters.nameExcludes` for `ST09-002`

These are source-data design additions only.
Runtime implementation correctness is out of scope for this task.

## 4. Card-by-Card ST09 Design
- `ST09-001 Impulse Gundam`: activated main effect; pay 2; return self to bottom of owner deck; deploy 1 unit from trash with `"Impulse Gundam"` in name and level `>=4`.
- `ST09-002 Force Impulse Gundam`: destroyed trigger; add 1 `(Minerva Squad)` unit from trash to hand; exclude cards with `"Force Impulse Gundam"` in name.
- `ST09-003 Saviour Gundam`: innate `Breach 3`; linked trigger; if 5 or more purple cards in trash; deal 2 damage to all units with `AP <= 5`.
- `ST09-004 Freedom Gundam`: innate `Blocker`; continuous `Suppression` while a friendly base is in play.
- `ST09-005 Zaku Warrior`: no effects.
- `ST09-006 Sword Impulse Gundam`: deploy trigger; if deployed from trash; destroy 1 enemy unit with `Lv <= 3`.
- `ST09-007 Blast Impulse Gundam`: innate `Blocker`.
- `ST09-008 Shinn Asuka`: burst add to hand; attack once per turn; if paired unit has `(Minerva Squad)`; choose 1 of your resources and set it active.
- `ST09-009 Giant Killing`: play effect in `MAIN_PHASE` and `ACTION_STEP`; destroy 1 active enemy unit with `AP <= 4`.
- `ST09-010 Minerva`: burst deploy; on deploy add 1 shield to hand; then if it is your turn; look at top 2 cards, return 1 to top, place the other into trash.

## 5. Validation Notes
After authoring `st09Card.json`, run the repo effect validation and review scripts.

If validation fails only because of `action: "returnToDeckBottom"` or `filters.nameExcludes`, update schema allowlists only enough to accept those authored fields.

Do not rewrite existing set JSON files as part of this summary task.
