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
- Do not parse comparison strings in multiple places; use one shared utility.
- Prefer engine-level semantic fixes over card-by-card data hacks when behavior is cross-card.
- Schema-valid does not always mean text-complete:
  - For descriptions containing `If you do` / `Then`, verify rules include matching `stepId` + `stepResolved` + `conditional` flow.
- Pair and Link are different:
  - `paired` = unit + pilot in same slot
  - `linked` = paired AND unit link rules match pilot identity/traits
- `allow_attack_target` dynamic filters must support:
  - `ap: "<=SOURCE_AP"`
  - `level: "<=SOURCE_LEVEL"`
- Frontend slot action bar must reflect `restrict_attack` semantics:
  - `disallow: "player"` => block Attack Shield button
  - `requires.type: "friendly_unit_deployed_this_turn"` => disable attack if unmet
- Source-level semantics must be explicit and consistent:
  - `sourceLevelScope: "paired_unit"` (default) uses paired unit level for pilot-sourced checks, then safely falls back to source-card level.
  - `sourceLevelScope: "source_card"` forces source-card level (pilot level for pilot source).
  - Applies to both dynamic filters (`<=SOURCE_LEVEL`) and `conditions.type = "sourceLevel"`.
- Sequence ordering rule:
  - For multi-step `sequence` effects, complete parent sequence target-choice flow first.
  - Reactive triggers caused by intermediate step damage (e.g., `EFFECT_DAMAGE_RECEIVED`) should resolve after sequence completion.
  - If sequence resolution spans multiple API calls, deferred reactive trigger buffers must survive `GameEnvironment.toJSON()/fromJSON()` persistence.

## Known Real-World Bugs Captured
See `references/incident-gd03-035.md` for concrete bugs and fixes:
- `GD03-035` active-target button missing because frontend could not parse `<=SOURCE_AP`.
- Attack action gating mismatch for `restrict_attack` rule patterns.
- `GD03-096` scenario had a paired-but-not-linked setup (`GD03-031 + GD03-096`), so `[During Link]` behavior could not trigger until unit changed to `GD03-051` (links `Jamil Neate`).
- `GD03-056` deploy sequence interleaved with `GD03-095` trigger mid-sequence; fixed by deferring `EFFECT_DAMAGE_RECEIVED` reactive processing until sequence completion.
- `GD03-095` trigger disappeared after sequence completion in API flow because deferred entries were stored only in transient runtime keys and lost across save/load between target-choice confirmations; fixed by persisting deferred entries on `GameEnvironment`.
- `GD02-021` and `GD03-064` were schema-valid but sequence-incomplete (text said multi-step `If you do`, rules encoded only a subset of steps); fixed by adding explicit conditional branch semantics.
- `GD03-086`/`GD01-093`/`GD02-095` source-level mismatch: fixed by introducing global effective source-level semantics and explicit `sourceLevelScope` override support (`paired_unit` vs `source_card`).

## Output Requirements
- Provide:
  - root cause summary
  - affected files with exact line references
  - risk classification (`P1/P2/P3`)
  - test evidence (`npm test`, and `npm run build` if UI-affecting)
- If no bug found, explicitly state "No functional mismatch found" and note residual risk.
