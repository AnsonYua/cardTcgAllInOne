---
name: skills-card-effect-expert
description: Card effect expert workflow for diagnosing and fixing effect.rules semantics, trigger ordering, dynamic level/filter resolution, and frontend/backend parity gaps.
triggers:
  - "card effect expert"
  - "card effect scheme"
  - "sourceLevelScope"
  - "SOURCE_LEVEL bug"
  - "troubleshoot effect rule"
  - "effect.rules bug"
  - "effect.description bug"
  - "frontend/backend effect mismatch"
  - "attack button missing"
  - "allow_attack_target mismatch"
  - "restrict_attack mismatch"
---

# Card Effect Expert Skill

Use this skill when a card effect appears correct in data but gameplay/UI behavior is wrong, or when effect schema semantics need to be clarified/extended safely.

## Scope
- Backend source repo: `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend`
- Frontend source repo: `/Users/hello/Desktop/card/unity/cardGameFrontend`
- Backend card data: `src/data/*.json` (GD/ST sets)
- Frontend rule evaluators: `src/phaser/**`
- Focus: `effects.rules` semantics and how frontend locally interprets them

## Required Workflow
1. Read `references/checklist.md`.
2. Build a quick inventory from backend card data for suspect actions/filters.
3. Identify frontend modules that locally evaluate those rules.
4. Compare backend semantics and frontend semantics for:
   - operators: `<`, `<=`, `>`, `>=`, `==`, `=`, `!=`
   - dynamic placeholders: `SOURCE_AP`, `SOURCE_LEVEL` (and casing variants)
   - stat source: `fieldCardValue.totalAP/totalHP` vs base `cardData`
5. Classify issue severity:
   - `P1`: valid actions hidden or invalid actions shown
   - `P2`: UI target list mismatch but backend safely rejects
   - `P3`: text/UX mismatch only
6. Implement fix with shared utility functions (avoid ad-hoc parser duplication).
7. Add focused regression tests and run frontend tests/build.
8. Update `EFFECT_PARITY_AUDIT.md` with findings and fix status.

## Canonical Rules (from recent fixes)
- Backend is authoritative. Frontend local logic is only UX prediction/gating.
- For `ACTION_STEP` response UI, frontend must prefer backend `currentBattle.actionTargets[].effectIds` and intersect with local activated-effect eligibility.
- Frontend timing checks must normalize phase enum variants (e.g. `ACTION_STEP_PHASE`) to canonical rule tokens (e.g. `ACTION_STEP`) before matching `timing.windows`.
- Do not parse comparison strings in multiple places; use one shared utility.
- Prefer engine-level semantic fixes over card-by-card data hacks when behavior is cross-card.
- Custom `target.scope` strings (for example battle-relative scopes like `opponent_battling_source`) require explicit resolver support in `TargetScopeResolverRegistry`; resolver `[]` must remain `[]` (no fallback to generic target generation).
- Schema-valid does not always mean text-complete:
  - For descriptions containing `If you do` / `Then`, verify rules include matching `stepId` + `stepResolved` + `conditional` flow.
- Pair and Link are different:
  - `paired` = unit + pilot in same slot
  - `linked` = paired AND unit link rules match pilot identity/traits
  - Slot legality invariant:
    - no scenario slot may contain only a pilot card.
    - if `slot.pilot` exists, `slot.unit` must also exist.
    - `slot.unit` must reference a `cardType: "unit"` card (never a pilot id).
- `allow_attack_target` dynamic filters must support:
  - `ap: "<=SOURCE_AP"`
  - `level: "<=SOURCE_LEVEL"`
- Frontend slot action bar must reflect `restrict_attack` semantics:
  - `disallow: "player"` => block Attack Shield button
  - `requires.type: "friendly_unit_deployed_this_turn"` => disable attack if unmet
  - turn-history requirements must include valid same-turn history zones (not just currently-in-play slots)
- Source-level semantics must be explicit and consistent:
  - `sourceLevelScope: "paired_unit"` (default) uses paired unit level for pilot-sourced checks, then safely falls back to source-card level.
  - `sourceLevelScope: "source_card"` forces source-card level (pilot level for pilot source).
  - Applies to both dynamic filters (`<=SOURCE_LEVEL`) and `conditions.type = "sourceLevel"`.
- Sequence ordering rule:
  - For multi-step `sequence` effects, complete parent sequence target-choice flow first.
  - Reactive triggers caused by intermediate step damage (e.g., `EFFECT_DAMAGE_RECEIVED`) should resolve after sequence completion.
  - If sequence resolution spans multiple API calls, deferred reactive trigger buffers must survive `GameEnvironment.toJSON()/fromJSON()` persistence.
- Pairing effect order dialog rule:
  - Show `OPTION_CHOICE` only for effects that may require player decision now (interactive candidates).
  - Hide deterministic non-interactive effects (for example, self/paired-unit `allow_attack_target` that auto-applies without chooser).
  - Hidden auto effects must still resolve in deterministic effect-list order.
  - When dialog options represent a filtered subset, option payload must include stable source index mapping (e.g., `payload.effectOrderIndex`) and backend resolution must use that mapping, not raw displayed index.
- Forced attack target rule (`require_attack_target_if_available`):
  - Treat this action as a battle-targeting constraint, not a normal target-choice effect.
  - Extract it from nested `sequence` structures too, including `conditional -> then/else` branches.
  - Conditional branch extraction must use current-state snapshot evaluation (same condition semantics as runtime checks).
  - `chooser` controls who chooses among multiple forced candidates (`ATTACKER`/`DEFENDER`); it does not disable forced targeting itself.
  - If exactly one forced candidate exists, backend must reject attacks to other targets with deterministic error (e.g., `FORCED_ATTACK_TARGET_REQUIRED`).

## Known Real-World Bugs Captured
See `references/incident-gd03-035.md` for concrete bugs and fixes:
- `GD03-035` active-target button missing because frontend could not parse `<=SOURCE_AP`.
- Attack action gating mismatch for `restrict_attack` rule patterns.
- `GD03-096` scenario had a paired-but-not-linked setup (`GD03-031 + GD03-096`), so `[During Link]` behavior could not trigger until unit changed to `GD03-051` (links `Jamil Neate`).
- `GD03-056` deploy sequence interleaved with `GD03-095` trigger mid-sequence; fixed by deferring `EFFECT_DAMAGE_RECEIVED` reactive processing until sequence completion.
- `GD03-095` trigger disappeared after sequence completion in API flow because deferred entries were stored only in transient runtime keys and lost across save/load between target-choice confirmations; fixed by persisting deferred entries on `GameEnvironment`.
- `GD02-021` and `GD03-064` were schema-valid but sequence-incomplete (text said multi-step `If you do`, rules encoded only a subset of steps); fixed by adding explicit conditional branch semantics.
- `GD03-086`/`GD01-093`/`GD02-095` source-level mismatch: fixed by introducing global effective source-level semantics and explicit `sourceLevelScope` override support (`paired_unit` vs `source_card`).
- `GD03-084` "other Unit" leakage on linked pilot sequence: fixed by explicit target choice + `excludePairedUnit`, plus engine fallback resolution for paired-unit exclusion in sequence contexts without `pairedSlot`.
- `GD03-081` deployed-this-turn restriction incorrectly ignored destroyed units moved to trash in the same turn; fixed by evaluating turn-history evidence from `trashArea` too.
- `GD02-099` pairing order UX mismatch: options that were guaranteed no-op were still selectable; fixed with backend-disabled option metadata + backend rejection + frontend disabled handling.
- `ST04-011` pairing order pollution: non-interactive `allow_attack_target` appeared as selectable order option alongside interactive linked effects; fixed by filtering dialog options to interactive candidates and preserving hidden auto-effect execution order via stable index mapping.
- `GD03-074` forced-target miss on nested sequence/conditional: effect text says enemy must target this rested unit if possible, but attacks could target other units because extractor only handled top-level/direct sequence step actions. Fixed by recursive extraction + conditional branch evaluation for `require_attack_target_if_available`.
- `GD03-073` action-step parity + battle-target scope gap: frontend falsely showed `Trigger Pilot Effect` by checking raw `ACTION_STEP` timing windows instead of activated-effect eligibility + backend `effectIds`; backend also lacked explicit `opponent_battling_source` resolver and incorrectly fell back to generic opponent targeting when specialized resolver produced no targets.
- `GD03-073` follow-up phase-token mismatch: frontend hid a valid activated effect during unit battle because `gameEnv.phase` used `ACTION_STEP_PHASE` while rule `timing.windows` used `ACTION_STEP`; fixed by central phase-name normalization in frontend timing matching.

## Output Requirements
- Provide:
  - root cause summary
  - affected files with exact line references
  - risk classification (`P1/P2/P3`)
  - test evidence (`npm test`, and `npm run build` if UI-affecting)
- If no bug found, explicitly state "No functional mismatch found" and note residual risk.
