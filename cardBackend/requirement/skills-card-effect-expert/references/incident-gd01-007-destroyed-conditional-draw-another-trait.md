# Incident: GD01-007 Destroyed Conditional Draw (`another` Trait Guard)

## Summary
- Card: `GD01-007` (Noin's Aries)
- Text under review: `[Destroyed]If you have another (OZ) Unit in play, draw 1.`
- Outcome: implementation is functionally aligned with card text.
- Residual risk: only positive card-specific scenarios exist; a negative card-specific scenario is still missing.

## Description-to-Rule Mapping
- `effects.description`:
  - `[Destroyed]If you have another (OZ) Unit in play, draw 1.`
- `effects.rules`:
  - `trigger: "DESTROYED"`
  - `action: "draw"`
  - `parameters.value: 1`
  - `conditions: [{ type: "hasAnotherUnitWithTrait", traits: ["OZ"] }]`

Source:
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/gd01Card.json`

## Runtime Trace Path
1. Rule definition and trigger source:
   - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/gd01Card.json`
2. Condition dispatch for `hasAnotherUnitWithTrait`:
   - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/conditions/EffectConditionEvaluator.ts`
3. Trait lookup + `another` semantics:
   - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/conditions/ConditionEvaluators.ts`
4. Destroyed trigger timing relative to zone transition:
   - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/destruction/UnitSlotDestructionFlow.ts`

## Verified Behavior
- `another` exclusion is enforced through `excludeCarduid` when resolving `hasAnotherUnitWithTrait`, so the source unit is not counted as the "another" unit.
- `DESTROYED` triggered effects are processed before moving the destroyed source card to trash in unit destruction flow.
- Owner binding is correct for this path: the destroyed card's controller is used when evaluating the condition and resolving draw.

## Scenario Coverage
- Positive scenario exists:
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/GD01/GD01-007/destroyed_draw_1_if_another_oz_unit_in_play.json`
- Positive manual battle scenario exists:
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/shared/testScenarios/gameStates/GD01/GD01-007/destroyed_draw_1_if_another_oz_unit_in_play_manual_battle.json`
- Residual gap:
  - No card-specific negative scenario for `GD01-007` where no other `(OZ)` unit is in play (expected: no draw).

## Audit Classification
- Classification: implementation review (no code change required).
- Finding: No functional mismatch found.
- Required callout: test coverage gap (missing negative scenario) should be stated explicitly in review outputs.
