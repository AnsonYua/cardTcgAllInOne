# Incident Reference: GD03-073 ACTION_STEP UI false-positive + battle target scope gap

## Incident Summary
- Card: `GD03-073` (`Graze Ein`)
- Symptoms:
  - Frontend showed `Trigger Pilot Effect` during `ACTION_STEP` for a slot whose pilot card was a command with an `ACTION_STEP` **play** rule, not an activated ability.
  - Backend `GD03-073` activated effect (`AP-3 during this battle`) could target a generic opponent unit because `target.scope: "opponent_battling_source"` had no specialized resolver.
  - Frontend still hid `GD03-073` activated effect in a valid unit battle because runtime phase string was `ACTION_STEP_PHASE` while rule timing window used `ACTION_STEP`.

## Root Causes

### 1) Frontend action-step button false positive (P1 UX/action mismatch)
- `ActionStepCoordinator` used a broad heuristic:
  - "does this card have any rule with `timing.windows` containing `ACTION_STEP`?"
- This did **not** check:
  - `rule.type === "activated"`
  - server-provided `currentBattle.actionTargets[playerId][].effectIds`
- Result:
  - pilot command cards with `type: "play"` + `ACTION_STEP` timing incorrectly surfaced as `Trigger Pilot Effect`.

### 1b) Frontend timing-window phase-name mismatch (P1 valid action hidden)
- Frontend timing checks in `actionEligibility` compared phase strings by exact equality.
- Runtime state used enum-like values such as:
  - `ACTION_STEP_PHASE`
- Card rules used canonical timing window names such as:
  - `ACTION_STEP`
- Result:
  - `getActivatedEffectOptions(...)` returned no activated effects even when backend `actionTargets[].effectIds` correctly allowed `activate_effect`.

### 2) Backend battle-scope target resolution gap (P1 functional mismatch)
- `GD03-073` effect uses:
  - `target.scope: "opponent_battling_source"`
- `TargetScopeResolverRegistry` lacked a resolver for that scope.
- Generic `TargetResolver` treated `opponent_*` as opponent player slots and returned normal opponent units.
- Additional subtle bug:
  - specialized resolver returning `[]` was collapsed to `null`, which triggered fallback to generic target generation.

## Fix Applied

### Frontend
1. Added `effectIds` support to action-step target payload typing.
2. Centralized action-step slot effect eligibility in shared helper:
   - intersect frontend activated-effect options with server `effectIds`.
3. Updated `ActionStepCoordinator` to use centralized slot-level availability summary.
4. Implemented `Trigger Unit Effect` / `Trigger Pilot Effect` handlers:
   - direct activation for one effect
   - filtered ability-choice dialog for multiple effects
5. Normalized phase names in frontend timing checks (`*_PHASE` -> base phase token) for:
   - activated-effect timing
   - command timing-window checks

### Backend
1. Added `BattleOpponentOfSourceTargetResolver` for `opponent_battling_source`.
2. Registered resolver in `TargetScopeResolverRegistry`.
3. Preserved empty resolver results (`[]`) instead of falling back to generic target generation.
4. Added regression tests for:
   - only battling enemy gets AP-3
   - shield attack no-op (no battling enemy unit target)

## Detection Heuristic (Reusable)
Treat as high risk when all are true:
1. frontend action-step UI builds buttons from local card rules
2. server sends action-step target payload with `effectIds`
3. frontend ignores `effectIds` and/or ignores `rule.type`
4. card/pilot has any `ACTION_STEP` rule that is not an activated ability

Treat as high risk when:
1. backend/gameEnv phase names use enum variants (e.g. `ACTION_STEP_PHASE`)
2. effect `timing.windows` uses canonical tokens (e.g. `ACTION_STEP`)
3. frontend uses exact string equality for timing checks

Also treat as high risk when:
1. card data introduces custom `target.scope` (e.g. `*_battling_source`)
2. no dedicated resolver exists in `TargetScopeResolverRegistry`
3. registry converts resolver `[]` into `null` (accidental fallback)

## Rule Authoring / Engine Checklist Delta
- Frontend `ACTION_STEP` effect buttons:
  - must use `activated` rule semantics, not raw timing-window presence
  - should prefer backend-authoritative `actionTargets[].effectIds` to avoid false positives
- Frontend timing-window matching:
  - normalize phase names before comparing (e.g. `ACTION_STEP_PHASE` -> `ACTION_STEP`)
  - apply same normalization to both command play timing checks and activated-effect timing checks
- Backend target scopes:
  - custom semantic scopes (battle-relative, paired-relative, etc.) require explicit resolver support
  - resolver returning `[]` is a valid outcome and must not silently fall back to generic scope behavior

## Risk Classification
- `P1`:
  - invalid UI action surfaced (`Trigger Pilot Effect`)
  - battle-only targeting semantics could affect wrong opponent unit
