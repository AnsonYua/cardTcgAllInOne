# Card Effect Expert Checklist

## 1) Reproduce and Frame
- Confirm repo roots:
  - backend: `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend`
  - frontend: `/Users/hello/Desktop/card/unity/cardGameFrontend`
- Confirm exact card/scenario path.
- Confirm expected behavior from `effects.rules` and `effects.description`.
- Capture current incorrect UI/backend behavior.
- Verify whether expected trigger needs `paired` or `linked`:
  - `paired`: same slot unit + pilot exists
  - `linked`: paired and unit `link` matches pilot name/trait

## 2) Data Inventory (Backend Truth)
- Scan all relevant set files in `cardBackend/src/data/*.json`.
- Extract suspect action families:
  - `allow_attack_target`
  - `restrict_attack`
  - related `conditions`/`sourceConditions`
- Capture dynamic filters:
  - `<=SOURCE_AP`, `<=SOURCE_LEVEL`, etc.
- Capture source-level semantic controls:
  - rule-level `sourceLevelScope` (`paired_unit` default, `source_card` explicit override)
  - verify both dynamic filter and condition paths:
    - `target.filters.level: "<=SOURCE_LEVEL"`
    - `conditions: [{ type: "sourceLevel", ... }]`
- For link-dependent effects, validate scenario slot composition against unit `link` entries.
- Validate slot legality before effect debugging:
  - A slot must never contain only `pilot` without `unit`.
  - If `slot.pilot` exists, `slot.unit` must also exist in the same slot.
  - `slot.unit.cardId` must be a unit card id (not pilot/command card ids).
  - Treat pilot-only slot fixtures as invalid test data and fix scenario first.
- For text with `If you do` / `Then`, verify rule flow has explicit branch semantics:
  - preceding step has stable `stepId`
  - dependent branch checks `type: "stepResolved"` for that `stepId`
  - resulting steps are encoded in `conditional.parameters.then` (not only in free-text `parameters.text`)
- For text with "choose ... your other Unit(s)" on pair/link effects:
  - do not rely on implicit `scope: "self"` normalization
  - require explicit selection + exclusion (`excludePairedUnit`, `excludeSource`, or `filters.excludeSelf` as appropriate)
  - if later steps use `previousTarget*` conditions, confirm step-1 target cannot leak to linked/paired source by default.

## 3) Frontend Evaluator Inventory
- Check local evaluator modules (not backend-driven execution):
  - `src/phaser/controllers/attackTargetPolicy.ts`
  - `src/phaser/controllers/actionBar/slotAttackProvider.ts`
  - `src/phaser/controllers/ActionStepCoordinator.ts`
  - `src/phaser/controllers/ActionStepTriggerHandler.ts`
  - `src/phaser/game/actionEligibility.ts`
  - `src/phaser/game/activatedEffectAvailability.ts`
  - any module discovered by `rg` for parser/comparison logic.

## 4) Parity Checks
- Operator parity includes `!=` and alias `=`.
- Dynamic token parity includes:
  - uppercase and camel/lower variants.
- Stat source parity:
  - Use field totals when required (e.g., `fieldCardValue.totalAP`).
- Restriction parity:
  - `restrict_attack` must gate UI actions consistently.
  - For `requires.type = "friendly_unit_deployed_this_turn"`, treat as turn-history semantics:
    verify evaluator includes same-turn deployed units even if they moved zones (e.g., destroyed to trash).
- `ACTION_STEP` parity:
  - Do not infer "triggerable effect" from `timing.windows` alone.
  - Intersect frontend activated-effect options with backend `currentBattle.actionTargets[playerId][].effectIds` when present.
  - Ensure slot-level UI gating and button rendering use the same shared helper to avoid drift.
  - Normalize phase names before timing-window comparisons (e.g. `ACTION_STEP_PHASE` vs `ACTION_STEP`).
  - Verify both activated-effect checks and command play timing checks use the same phase normalization.
- Source-level parity:
  - pilot-sourced `"this Unit"` logic should use effective source-level semantics.
  - if rule sets `sourceLevelScope: "source_card"`, verify pilot-level is used even when paired.
  - if omitted, verify default `paired_unit` and unpaired fallback behavior.
- Choice parity:
  - For `OPTION_CHOICE` flows (especially pairing/deploy effect order), ensure options include explicit availability flags.
  - If an option is guaranteed no-op now, it should be disabled with a reason, not just allowed then no-op.
  - Backend must reject disabled option selections to prevent stale/manual invalid picks.
  - Frontend must map backend disabled state to non-selectable UI and timeout/default selection must skip disabled options.
  - For pairing effect-order dialogs, do not include deterministic non-interactive effects as options.
  - Resolve hidden auto effects in deterministic effect-list order while dialog options represent only interactive candidates.
  - If options are filtered, include stable option-to-effect mapping (for example `payload.effectOrderIndex`) and enforce selection via mapped index.
  - For forced-attack rules (`require_attack_target_if_available`), verify extractor supports nested `sequence` + `conditional` branches (not only top-level actions).
  - Confirm conditional snapshot is evaluated before collecting branch actions (`if` true => `then`, otherwise `else`).
  - For custom target scopes (e.g., `opponent_battling_source`), verify:
    - a specialized resolver exists in `TargetScopeResolverRegistry`
    - resolver `[]` remains a terminal no-target result (no accidental fallback to generic `TargetResolver`)
  - Validate enforcement contract:
    - one forced candidate => backend rejects attack to other unit (`FORCED_ATTACK_TARGET_REQUIRED`)
    - multiple forced candidates => backend opens forced target chooser for configured `chooser`.

## 4.1) Fast Debug Heuristic for Forced Target Bugs
- If battle notification shows `UNIT_ATTACK_DECLARED` to a non-forced target while a continuous forced-target effect is active:
  - inspect defending side continuous rule shape for nested `sequence/conditional`.
  - inspect forced-target extractor path (`ForcedAttackTargetManager`) for recursion support.
  - verify candidate resolution filters (`status: rested/active`) match current board state.

## 5) Fix Strategy
- Centralize comparison parsing/evaluation in shared util.
- Remove duplicated ad-hoc parser logic.
- Add debug guardrails for unknown rule parameter keys.

## 6) Validation
- Add focused tests for each mismatch class.
- For source-level incidents, include both modes:
  - default omitted scope (`paired_unit`)
  - explicit `source_card`
  - unpaired pilot fallback under default mode
- For sequence + reactive trigger incidents, include a persistence-boundary regression:
  - resolve first sequence choice
  - serialize via `toJSON`
  - restore via `fromJSON`
  - resolve remaining choice(s)
  - assert deferred trigger choice appears only after sequence completion
- Run:
  - `npm test`
  - `npm run build`
- Document findings and fix status in `EFFECT_PARITY_AUDIT.md`.
