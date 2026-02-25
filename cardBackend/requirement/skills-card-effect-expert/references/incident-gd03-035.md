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

## Additional Runtime Ordering Incident (Sequence vs Reactive Trigger)
- Symptom:
  - During `GD03-056` deploy sequence (`damage self`, then `damage opponent`), `GD03-095` (`EFFECT_DAMAGE_RECEIVED`) target choice appeared between the two sequence dialogs.
- Desired behavior:
  - Finish all `GD03-056` sequence dialogs first, then process `GD03-095` trigger.
- Root cause:
  - `EffectDamageReceivedTriggeredEffectManager.execute` was called immediately inside each `damage` step.
- Fix:
  - Added sequence execution context and deferred buffer for effect-damage-received triggers.
  - Flush deferred triggers only after sequence completes (no remaining steps/choices).
- Key files:
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/sequence/SequenceExecutionContext.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/actions/EffectDamageActions.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/SequenceEffectManager.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/SequenceTargetChoiceHandler.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/__tests__/sequenceEffectDamageTriggerOrdering.test.js`

## Additional Data Parity Incident (Schema Valid, Text Incomplete)
- Symptoms:
  - `GD02-021` description declared: discard EF unit -> if you do place EX resource -> then if Lv.7+ draw 1, but rule encoded only a discard step.
  - `GD03-064` description declared: add `(X-Rounder)` from trash -> if you do discard 1, but rule encoded only discard.
- Root cause:
  - Canonical schema validator passed because rule shape was valid JSON schema, while semantic completeness versus `effect.description` was not encoded.
- Fix:
  - Added explicit sequence branches with `stepId` and `stepResolved` conditionals.
  - Added explicit targets/filters for optional discard and add-to-hand steps.
- Guardrails added:
  - Regression tests in:
    - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/__tests__/cardDataConsistencyRegression.test.js`
    - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/__tests__/cardDataCanonicalPatchPlanRegression.test.js`
- Verification commands:
  - `cd /Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend`
  - `npm test -- cardDataConsistencyRegression`
  - `npm test -- cardDataCanonicalPatchPlanRegression`

## Additional Persistence Boundary Incident (Deferred Trigger Lost Across API Calls)
- Symptoms:
  - In real API flow (`confirmTargetChoice` per step), `GD03-056` completed both damage dialogs, but `GD03-095` did not trigger afterward.
  - Snapshot showed sequence finished and no pending `TARGET_CHOICE` for `GD03-095_pilot_0001`.
- Root cause:
  - Deferred `EFFECT_DAMAGE_RECEIVED` entries were stored on transient runtime key:
    - `__deferredEffectDamageReceivedEntries`
  - Between step confirmations, game state is persisted and reloaded.
  - `GameEnvironment.toJSON()/fromJSON()` did not include deferred entries, so they were dropped before sequence final flush.
- Fix:
  - Added persisted internal field on `GameEnvironment`:
    - `deferredEffectDamageReceivedEntries`
  - Sequence defer/flush now uses persisted field as canonical source.
  - Kept legacy key compatibility by merging legacy entries when present.
- Key files:
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/models/GameEnvironment.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/sequence/SequenceExecutionContext.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/__tests__/sequenceEffectDamageTriggerOrdering.test.js`
- Regression pattern added:
  - Resolve first sequence choice -> `toJSON` -> `fromJSON` -> resolve second choice -> confirm `GD03-095` `TARGET_CHOICE` appears.

## Additional Source-Level Semantics Incident (`this Unit` on Pilot-Sourced Effects)
- Symptoms:
  - `GD03-086` expected level gate to use paired unit level, but runtime treated source as pilot level.
  - Same semantic drift impacted `GD01-093` (`<=SOURCE_LEVEL`) and `GD02-095` (`conditions.type = sourceLevel`).
- Root cause:
  - Level resolution used source-card level uniformly, with no rule-level semantic override.
- Fix:
  - Added global effective source-level resolver behavior with explicit rule-level override:
    - `sourceLevelScope: "paired_unit"` (default)
    - `sourceLevelScope: "source_card"` (opt-in override)
  - Applied to both dynamic filter path and condition path.
  - Preserved fallback: default mode still uses source-card level when pilot is not paired.
- Key files:
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/EventQueue/interfaces/GameEvent.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/models/CardSystem.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/conditions/EffectiveSourceLevelResolver.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/targets/filters/DynamicComparisonFilterResolver.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/targets/TargetResolver.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/conditions/SourceAndSpecialConditionEvaluator.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/conditions/EffectConditionEvaluator.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/attack/AttackConditionEvaluator.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/utils/EffectNormalizationUtils.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/tests/validators/effectSchemaCanonicalValidation.js`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/__tests__/attackSourceLevelTargetFilter.test.js`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/__tests__/effectSchemaCanonicalValidation.test.js`
- Regression coverage added:
  - default omitted scope uses paired-unit semantics
  - explicit `source_card` uses pilot-level semantics
  - default mode unpaired pilot fallback uses source-card level

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
