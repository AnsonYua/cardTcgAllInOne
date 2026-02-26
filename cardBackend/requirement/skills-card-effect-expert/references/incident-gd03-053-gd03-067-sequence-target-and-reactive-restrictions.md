# Incident Reference: GD03-053 / GD03-067 sequence target carry-over and reactive continuous restriction propagation

## Incident Summary
- Cards:
  - `GD03-053` (`Gundam Gusion Rebake Full City`)
  - `GD03-067` (`Rouei`)
- Symptoms:
  - `GD03-067` deploy effect could damage one friendly unit and apply `AP+1` to a different friendly unit.
  - `GD03-053` `[During Pair][Once per Turn]` effect could trigger more than once in a turn when implemented via reactive continuous expansion.

## Root Causes

### 1) Sequence pronoun continuity was not encoded in card data for `GD03-067` (P1)
- Card text semantics: "Choose 1 of your Units. Deal 1 damage to it. It gets AP+1..."
- Rule encoded:
  - step 1 `damage` with `player_choice`
  - step 2 `modifyAP` with a fresh `player_choice`
- Result:
  - runtime legally allowed selecting a second target for the AP buff.

### 2) Reactive continuous derived effects dropped `restrictions` metadata (P1)
- `GD03-053` is encoded as `type: "continuous"` + `sequence -> conditional(eventType = EFFECT_DAMAGE_RECEIVED) -> then(rest ...)` with `restrictions: ["once_per_turn"]`.
- `ContinuousConditionalEffectExpander` created a derived `then` effect for the reactive `rest` step but did not copy `restrictions`.
- Result:
  - source JSON looked correct, but runtime derived effect could lose `once_per_turn`.

## Fix Applied

### `GD03-067` data fix
- Changed the `modifyAP` step target to:
  - `target.scope = "previous_target"`
- Removed second player choice for the AP buff.
- Reuses existing engine support in `SequenceEffectManager` for `previous_target`.

### Reactive continuous engine fix (`GD03-053`)
- `ContinuousConditionalEffectExpander` now preserves runtime-critical metadata on derived `then` effects:
  - `restrictions` (required)
  - `optional`
  - `windows`
  - `cost`

## Detection Heuristics (Reusable)

### A) Sequence pronoun continuity (`it`, `that Unit`, `that card`) high-risk check
Treat as high risk when:
1. sequence text describes a later step applied to the same earlier chosen target
2. step 1 uses `player_choice`
3. step 2 also uses a fresh `player_choice`
4. engine already supports `previous_target` scope

Expected fix pattern:
- use `target.scope = "previous_target"` for the dependent step

### B) Reactive continuous expansion metadata loss high-risk check
Treat as high risk when:
1. `type: "continuous"` effect expands `conditional(eventType...) -> then(...)`
2. parent effect has `restrictions` / timing metadata
3. expander constructs a derived effect object manually
4. derived object copies action/target/conditions but not metadata

Expected fix pattern:
- propagate `restrictions` at minimum, plus other runtime-relevant metadata used by trigger/choice processors

## Rule Authoring / Engine Checklist Delta
- For `sequence` rules, when text semantics imply "same target as previous step", encode it explicitly with `target.scope = "previous_target"` instead of repeating `player_choice`.
- For continuous conditional expansion, preserve trigger governance metadata (`restrictions`, etc.) on derived reactive effects; otherwise `once_per_turn`/timing semantics can be silently lost after expansion.

## Risk Classification
- `P1`
  - `GD03-067`: functional targeting mismatch (illegal buff target)
  - `GD03-053`: once-per-turn enforcement risk for a live reactive effect

## Regression Evidence (example)
- `gd03RoueiDeployEffect.test.js`
- `gd03GusionRebakeFullCityEffectDamageTrigger.test.js`
- `gd03FullSetAuditFixes.test.js` (audit assertion for `previous_target`)
