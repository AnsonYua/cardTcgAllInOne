# Incident Reference: GD03-035 / GD03-092 Link Effect Parity

## Incident Summary
- Symptom: Frontend did not show `Attack Unit` button after linked effect should allow active target selection.
- Scenario context: `GD03-035` linked with `GD03-092`.
- Rule intent:
  - `allow_attack_target` with `parameters.ap: "<=SOURCE_AP"` and `status: "active"`.

## Additional Scenario Setup Incident (Pair vs Link)
- Symptom: A `[During Link]` scenario for `GD03-096` did not trigger expected behavior.
- Root setup bug:
  - Scenario used `GD03-031 + GD03-096` in same slot.
  - This is paired but not linked (`GD03-031` does not link to `Jamil Neate`).
- Corrected setup:
  - Switched slot unit to `GD03-051`, whose `link` includes `Jamil Neate`.
  - Scenario file:
    - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/GD03/GD03-096/during_link_attack_optional_discard_1_then_draw_1.json`

## Root Cause 1 (P1)
- Frontend `attackTargetPolicy` used local parser that only handled numeric RHS.
- It failed on dynamic token expression `<=SOURCE_AP`.
- Result: valid active targets filtered out; attack button disappeared.

## Root Cause 2 (P1/P2)
- Frontend action bar gating did not fully mirror backend `restrict_attack` semantics.
- Missing parity for:
  - `disallow: "player"` (attack player/shield restriction)
  - dynamic `requires.type: "friendly_unit_deployed_this_turn"`
- Result: UI could enable actions that backend later rejects or should hide.

## Fix Pattern Applied
1. Introduced shared comparison utility for all local evaluators:
   - operators: `<`, `<=`, `>`, `>=`, `==`, `=`, `!=`
   - dynamic tokens: `SOURCE_AP`, `SOURCE_LEVEL`, plus casing variants
2. Migrated `attackTargetPolicy` to shared evaluator.
3. Added restriction parity in slot action bar provider.
4. Added regression tests for both dynamic comparison and restrict-gating behavior.
5. Added parity audit doc for historical tracking.

## Alignment Scheme Used
- Backend remains source of truth for game legality.
- Frontend local evaluators provide UX prediction only.
- Any local evaluator must:
  - use shared comparison utility
  - support dynamic placeholders
  - source stats from correct effective values (`fieldCardValue` when needed)
  - keep UI action gating aligned with backend restrictions.

## Commands Used for Audit/Verification
```bash
# inventory dynamic placeholders in card data
rg -n "SOURCE_AP|SOURCE_LEVEL|sourceAp|sourceLevel" /Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/*.json

# inspect local parser/evaluator sites in frontend
rg -n "parse|comparison|allow_attack_target|restrict_attack" /Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser -S

# run regression validation
cd /Users/hello/Desktop/card/unity/cardGameFrontend
npm test
npm run build
```

## Reuse Guidance
- If future symptom is "button missing" or "target choice wrong", start with:
  - dynamic filter support
  - stat-source mismatch
  - restriction gating mismatch.
