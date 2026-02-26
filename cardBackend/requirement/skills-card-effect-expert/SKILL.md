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
- `ACTION_STEP` off-turn response legality is a backend concern too:
  - frontend may correctly show a legal response target, but backend turn validators must allow off-turn `activateCardAbility` / `useCommandCard` only during actionable response windows (`currentBattle.status === "ACTION_STEP"`, awaiting player confirmation, and non-empty `actionTargets[playerId]`).
- After resolving an activated effect during `ACTION_STEP`, backend must refresh action-step targets and advance/confirm battle flow when no actions remain; otherwise the game can stall with `confirmations = true/true` and empty `actionTargets`.
- Link detection for command cards used as pilots must not depend solely on runtime `playedAs === "pilot"` flags:
  - if a card in `slot.pilot` has `designate_pilot.parameters.pilotName`, use that pilot identity for link checks even when `playedAs` is missing in persisted/runtime payloads.
- Stat modifiers may be dynamic:
  - `modifyAP` / `modifyHP` can use `parameters.valuePer` (for example trash-count scaling) instead of direct `value`.
  - Stat-effect execution must resolve `valuePer` with the same condition/counting semantics used elsewhere (e.g. `cardsInTrashWithTraitsAny` + `filters.cardType`).
- `type: "continuous"` effects can encode event-gated reactive behavior via `sequence/conditional` (e.g. `eventType = END_OF_TURN`, `SET_ACTIVE_BY_EFFECT`):
  - do not assume continuous-effect expanders should only keep stat/keyword-like actions.
  - unsupported `then` actions (e.g. `setActive`, `returnToHand`, `rest`, `draw`, `damage`) must not be silently dropped if gated by `eventType`.
  - register them as event-reactive continuous entries and execute them only in matching event contexts.
- Event-condition semantics for linked pilot reactions:
  - `eventTarget = self` may need effective self resolution to the paired unit for pilot/command sources (not literal pilot carduid).
  - state-change event notifications (e.g. `CARD_SET_ACTIVE`) should include enough prior-state metadata (e.g. `wasRested`) for conditions like `eventTargetWasRested`.
- Source-special conditions may omit `scope` in card data:
  - source-specific conditions like `sourcePairedWithPilot` should treat omitted scope as source-scoped unless card data explicitly requires otherwise.
  - prefer a centralized default in condition evaluation (`type.startsWith("source") => scope: "source"`) instead of patching each source condition handler ad hoc.
- Deploy provenance conditions require runtime metadata:
  - conditions like `sourceDeployedFrom` depend on source card instance state (e.g. `sourceCard.deployedFrom`), so deploy flows must persist `fromZone` onto the deployed runtime card, not only in notifications.
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
  - Deferred reactive buffers that depend on event-target conditions must persist per-event notification context (not just player ids), or later flush may evaluate against the wrong notification queue tail.
- `EFFECT_DAMAGE_RECEIVED` data scoping rule:
  - Text like "when this Unit receives effect damage" should encode explicit `conditions: [{ type: "eventTarget", value: "self" }]`.
  - Do not narrow engine dispatch to source-self globally; observer cards (e.g. "one of your friendly Units receives effect damage") rely on broader event dispatch plus explicit event-target conditions.
- `conditionalTokenDeploy` condition-evaluation rule:
  - If a `conditionalTokenDeploy` effect uses event/source conditions (e.g. `eventTarget=self`), runtime condition checks must pass the source card context into `validateEffectConditions`; evaluating with only `playerId` can silently fail valid self-target triggers.
- Trigger-context architecture rule:
  - When adding deferred/reactive trigger metadata (e.g. damaged card uid + notification snapshot), centralize the payload type and notification lookup/snapshot helpers in shared modules.
  - Avoid duplicating payload shapes and queue-tail scanning logic across action handlers, trigger managers, sequence buffers, and `GameEnvironment` serialization.
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
- Deploy `payCost` target-choice UX rule:
  - For `deploy` effects with `parameters.payCost = true`, target lists should be filtered by current affordability (effective level/cost after applicable modifiers), not just target filters (`cardType`, `level`, traits, etc.).
  - Keep existing target-choice policy behavior after filtering:
    - `0` affordable targets => no-op / optional flow handling (no misleading chooser)
    - `1` affordable target => auto-apply (no dialog)
    - `>1` affordable targets => create `TARGET_CHOICE`
  - Use one shared affordability/effective-cost path for both:
    - pre-choice `availableTargets` filtering
    - deploy resolution/payment validation
  - For trash deploys, review self-scoped continuous modifiers on the target card (e.g. `modifyCost` with `target.scope = self_trash`) when computing affordability.

## Known Real-World Bugs Captured
See `references/incident-gd03-035.md` for concrete bugs and fixes:
- `GD03-035` active-target button missing because frontend could not parse `<=SOURCE_AP`.
- Attack action gating mismatch for `restrict_attack` rule patterns.
- `GD03-096` scenario had a paired-but-not-linked setup (`GD03-031 + GD03-096`), so `[During Link]` behavior could not trigger until unit changed to `GD03-051` (links `Jamil Neate`).
- `GD03-056` deploy sequence interleaved with `GD03-095` trigger mid-sequence; fixed by deferring `EFFECT_DAMAGE_RECEIVED` reactive processing until sequence completion.
- `GD03-095` trigger disappeared after sequence completion in API flow because deferred entries were stored only in transient runtime keys and lost across save/load between target-choice confirmations; fixed by persisting deferred entries on `GameEnvironment`.
- `GD03-060` false token deploy (`T-015`) on unrelated friendly effect damage: `EFFECT_DAMAGE_RECEIVED` dispatch scans all in-play sources for the damaged player, so self-worded cards without `eventTarget=self` can trigger on another unit's damage. Fixed by data hardening (`GD02-010`, `GD03-060`, `GD03-095`) plus preserving per-damage notification snapshots in deferred trigger replay.
- Follow-up architecture hardening for the same incident: centralized `EFFECT_DAMAGE_RECEIVED` deferred payload type and notification context helpers to reduce duplication between damage action execution, trigger replay, and serialization code.
- `GD02-021` and `GD03-064` were schema-valid but sequence-incomplete (text said multi-step `If you do`, rules encoded only a subset of steps); fixed by adding explicit conditional branch semantics.
- `GD03-086`/`GD01-093`/`GD02-095` source-level mismatch: fixed by introducing global effective source-level semantics and explicit `sourceLevelScope` override support (`paired_unit` vs `source_card`).
- `GD03-084` "other Unit" leakage on linked pilot sequence: fixed by explicit target choice + `excludePairedUnit`, plus engine fallback resolution for paired-unit exclusion in sequence contexts without `pairedSlot`.
- `GD03-081` deployed-this-turn restriction incorrectly ignored destroyed units moved to trash in the same turn; fixed by evaluating turn-history evidence from `trashArea` too.
- `GD02-099` pairing order UX mismatch: options that were guaranteed no-op were still selectable; fixed with backend-disabled option metadata + backend rejection + frontend disabled handling.
- `ST04-011` pairing order pollution: non-interactive `allow_attack_target` appeared as selectable order option alongside interactive linked effects; fixed by filtering dialog options to interactive candidates and preserving hidden auto-effect execution order via stable index mapping.
- `GD03-074` forced-target miss on nested sequence/conditional: effect text says enemy must target this rested unit if possible, but attacks could target other units because extractor only handled top-level/direct sequence step actions. Fixed by recursive extraction + conditional branch evaluation for `require_attack_target_if_available`.
- `GD03-073` action-step parity + battle-target scope gap: frontend falsely showed `Trigger Pilot Effect` by checking raw `ACTION_STEP` timing windows instead of activated-effect eligibility + backend `effectIds`; backend also lacked explicit `opponent_battling_source` resolver and incorrectly fell back to generic opponent targeting when specialized resolver produced no targets.
- `GD03-073` follow-up phase-token mismatch: frontend hid a valid activated effect during unit battle because `gameEnv.phase` used `ACTION_STEP_PHASE` while rule `timing.windows` used `ACTION_STEP`; fixed by central phase-name normalization in frontend timing matching.
- `GD03-073` follow-up backend turn/flow/link issues:
  - backend initially rejected valid off-turn `ACTION_STEP` `activateCardAbility` with `Not your turn`; fixed by narrow response-window exception in action validation.
  - command-as-pilot link checks could fail when runtime `slot.pilot` payload omitted `playedAs`; fixed by deriving pilot identity from `designate_pilot.pilotName` for cards in pilot slots.
  - battle could stall after successful `ACTION_STEP` activated ability (`confirmations` all true, `actionTargets` empty, still in `ACTION_STEP`); fixed by post-ability action-step target refresh + confirmation/auto-progress handling.
- `GD03-071` dynamic AP reduction gap: card used `modifyAP.parameters.valuePer` (per `(AEUG)` unit card in trash) but backend stat applier only accepted flat numeric `value`; fixed by adding `valuePer` resolution in stat modifier execution and regression test coverage.
- `GD03-069` / `GD03-098` reactive continuous conditional gap: end-turn set-active and linked bounce were encoded as `type: continuous` + `conditional(eventType...)`, but backend continuous expansion dropped unsupported `then` actions (`setActive`, `returnToHand`). Fixed by introducing event-reactive continuous registry handling, plus event-condition fixes (`sourcePairedWithPilot` omitted scope, pilot effective-self event target, `wasRested` metadata on `CARD_SET_ACTIVE`).
- `GD03-062` / `GD02-091` source-condition default/provenance gap:
  - `GD03-062` (`sourceDeployedFrom`) silently failed because deploy flow did not persist `deployedFrom` onto the deployed unit and card data omitted `scope`.
  - `GD02-091` (`sourceColor`) omitted `scope`, but backend defaulted missing scope to `player`, causing source-color conditional failure.
  - Fixed by persisting `UnitZoneCard.deployedFrom` in deploy service and defaulting missing `scope` to `"source"` for `source*` conditions in `EffectConditionEvaluator`.
- `GD03-051` linked deploy chooser affordability UX gap (and same pattern for `GD02-096`/`GD02-110`/`GD03-130`):
  - text/rules correctly encoded `Pay its cost to deploy it` (`payCost: true`), but chooser `availableTargets` was generated from target filters only and did not exclude unaffordable deploy candidates.
  - Result: backend could show a target in dialog that would fail at resolution-time energy payment (`P2` UX/backend-parity mismatch).
  - Fixed by shared deploy affordability evaluator used for both chooser pre-filtering and deploy payment (effective cost/level, including self-trash cost modifiers).
  - Preserve target-choice policy after affordability filtering: single remaining target auto-applies (no dialog).

## Output Requirements
- Provide:
  - root cause summary
  - affected files with exact line references
  - risk classification (`P1/P2/P3`)
  - test evidence (`npm test`, and `npm run build` if UI-affecting)
- If no bug found, explicitly state "No functional mismatch found" and note residual risk.
