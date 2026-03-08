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
2. Classify the task first:
   - implementation review (verify card text -> rule JSON -> runtime path)
   - behavior bug (runtime mismatch)
   - frontend/backend parity bug (UI prediction mismatch)
3. Build a quick inventory from backend card data for suspect actions/filters.
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

## Review-Only Audit Pattern (Implementation Correctness)
Use this when the user asks "is this effect properly implemented?" and does not request a code change yet.

1. Rule-to-text mapping (backend truth):
   - Map every clause in `effects.description` to a specific `effects.rules` field.
   - Confirm hidden semantics are encoded explicitly (`other`, `paired`, target count, dynamic comparator).
2. Runtime path trace (static):
   - Trace rule shape through condition evaluators, target filter resolvers, and the final executor path.
   - For `type: "continuous"` `sequence/conditional(eventType...)`, verify expansion into reactive continuous entries (not dropped during continuous registry build).
3. Targeted runtime evidence (non-mutating):
   - Prefer existing tests + existing fixtures/scenarios.
   - If no card-specific test exists, use nearby regression tests to validate the relevant engine surfaces and report residual risk.
4. Findings format:
   - If no mismatch found, explicitly say "No functional mismatch found" and list coverage gaps.
   - If mismatch found, report file + line + repro + minimal fix direction.

## Canonical Rules (from recent fixes)
- Backend is authoritative. Frontend local logic is only UX prediction/gating.
- For `ACTION_STEP` response UI, frontend must prefer backend `currentBattle.actionTargets[].effectIds` and intersect with local activated-effect eligibility.
- Frontend timing checks must normalize phase enum variants (e.g. `ACTION_STEP_PHASE`) to canonical rule tokens (e.g. `ACTION_STEP`) before matching `timing.windows`.
- Do not parse comparison strings in multiple places; use one shared utility.
- Prefer engine-level semantic fixes over card-by-card data hacks when behavior is cross-card.
- `another`-condition review rule (`hasAnotherUnitWithTrait` and similar):
  - verify explicit self exclusion via `excludeCarduid` (source must not satisfy its own "another" requirement)
  - verify condition ownership binding uses the source card controller (not current turn player)
  - verify trigger timing against zone transition (evaluate conditions before source leaves play when card text implies in-play state checks at trigger time)
- `prevent_battle_damage` continuous-application guardrail:
  - unit-targeted continuous prevention with `parameters.from = "enemy_units"` is a valid unconditional shape even without `enemyLevel` / `enemyAp` / `maxEnemyAp` / `enemyHp`.
  - do not require comparator filters before applying continuous temporary prevention, or effects can register but silently never apply (e.g. `GD03-020`).
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
- `During Pair` / `During Link` text audit rule:
  - treat pair/link wording as a source-state requirement first (`sourceConditions`) before debugging event conditions.
  - `paired` and `linked` are not interchangeable; verify the card text matches the encoded source condition exactly.
  - for "one of your other Units ..." wording, require explicit non-self event/source exclusion (e.g. `eventAttackerIsNotSource = true`), not an implicit assumption from target scope.
- Pairing-condition coverage rule:
  - `pairedUnitColor` must be supported in `PairingConditionEvaluator` for `PAIRING_COMPLETE` checks (missing support breaks GD02-087 rest-Blocker behavior).
- Event-reactive continuous review rule:
  - For `continuous -> sequence -> conditional(eventType=...) -> then(action)` designs, verify the branch becomes a derived reactive registry entry and is executed through `processReactiveContinuousEffects`, not only present in static card JSON.
  - Confirm duplicate suppression for the same event (`lastReactiveEventKey`) when reviewing once-per-event triggers.
- Attack-trigger pipeline split rule:
  - Do not audit all "attack" text through one path.
  - There are two distinct backend pipelines with different timing risks:
    - declaration-reactive continuous effects (event-gated via `eventType = UNIT_ATTACK_DECLARED`, executed by `ContinuousEffectManager.processReactiveContinuousEffects`)
    - `triggered` `ATTACK_PHASE` effects (executed by `AttackPhaseEffectManager.processAttackPhaseEffects`)
  - When debugging timing/order bugs, identify which pipeline the card uses before tracing notifications.
- Attack declaration ordering rule (backend timing):
  - Attack declaration flow should be reviewed in this order:
    1. `recordAttackDeclaration(...)`
    2. refresh continuous effects (so dynamic grants like `<Repair>` exist on attacker)
    3. immediate reactive continuous pass
    4. `ATTACK_PHASE` triggered effects
    5. blocker/battle/game-end resolution
  - If a declaration/reactive or `ATTACK_PHASE` effect creates `TARGET_CHOICE`, attack resolution must pause and resume later (no battle/game-end first).
- Attack auto-apply ordering rule:
  - For attack-triggered effects that auto-apply (exactly one valid target, no chooser), state-change notifications (e.g. `CARD_RESTED`, damage/destroy notifications) should be emitted before `BATTLE_RESOLVED` / `GAME_ENDED`.
  - If backend notification order is correct but frontend visuals are late, check whether the frontend animation queue drops the state-change notification (missing handler) before changing backend timing.
- Dynamic comparator review rule:
  - When card text compares target stats/level to the attacking/triggering unit ("Lv equal to or lower than that Unit"), verify the rule uses a dynamic comparator token (e.g. `<=eventAttackerLevel`) and the resolver supports that token in runtime target generation.
- Attack notification context rule:
  - For attack-triggered condition/target evaluation during `PLAYER_ACTION`, prefer the exact `UNIT_ATTACK_DECLARED` notification context (via `attackNotificationId`) over "latest notification" heuristics.
  - This is especially important when later notifications (`PHASE_CHANGED`, `BATTLE_RESOLVED`, `GAME_ENDED`) exist in the same queue and can hide attacker context.
- Repair keyword review rule:
  - Backend `eventAttackerHasKeyword = Repair` may be satisfied by keyword text OR by semantic detection of an end-turn `heal` rule; when auditing Repair interactions, verify both the card data and keyword detection path.
  - Also verify runtime keyword detection includes temporary granted keywords (`temporaryEffects.grantedKeywords`), not only base card keyword text/rule shape.
- End-turn heal condition rule:
  - `END_OF_TURN` `heal` effects are executed via `RepairEffectManager`, not `EndTurnTriggeredEffectManager`.
  - Ensure `RepairEffectManager` evaluates full `effects.rules[].conditions` with `EffectConditionEvaluator` (not just `sourceHp` / `sourceAp`).
  - If a card uses `cardsInPlayWithFilter` (e.g., “friendly white Base in play”), confirm end-phase execution path honors it.
  - Beware tests that directly call `DeployTargetManager.processEffectWithTargetChoice`; they can pass even when end-phase `RepairEffectManager` would skip the effect.
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
- `scry_top_deck` UI-branching audit rule:
  - do not assume one chooser layout for all `scry_top_deck` effects
  - classify the effect by `count`, `keep`, `choice`, and actual looked-card count before debugging frontend display
  - verify whether the effect should create `OPTION_CHOICE` at all before debugging the dialog
  - expected mapping:
    - `count = 1` + `choice = "top_or_bottom"` + looked count `1` => backend emits text options, frontend shows one-card top/bottom layout
    - looked count `> 1` + `keep = 1` => backend emits card options, frontend shows multi-card choose-one layout
    - all other shapes => backend likely auto-resolves with no chooser
  - fast reference cards:
    - single-card top/bottom: `GD01-039`, `GD02-025`, `ST06-010`
    - multi-card choose-one: `GD03-097`, `GD02-104`, `ST02-015`
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
- Choice-notification source-of-truth rule:
  - Frontend choice/dialog flow must be derived from `notificationQueue` only; `processingQueue` is internal execution state and non-authoritative for UI.
  - When returning player views, keep `processingQueue` sanitized/non-authoritative and ensure actionable choice payloads (`TARGET_CHOICE`, `BLOCKER_CHOICE`, `BURST_EFFECT_CHOICE`, etc.) are present in `notificationQueue`.
- Choice persistence-serializer rule:
  - Never persist game state with client-filtered queue serialization.
  - Use persistence serialization that keeps full internal `processingQueue` (including declared blocking choices), even if client serialization hides those entries when `BATTLE_RESOLVED` is present.
- Choice notification durability rule:
  - All interactive choice notifications (`TARGET_CHOICE`, `BLOCKER_CHOICE`, `BURST_EFFECT_CHOICE`, token/option/prompt choices) should be persistent (`requiresAcknowledgment=true`, far-future `expiresAt`) until acknowledged.
- Choice submit failure UX parity rule:
  - On confirm API failure, do not close/clear choice dialogs as if resolution succeeded.
  - Keep the choice UI active/recoverable and log request context (`gameId`, `playerId`, `eventId`) + error payload for debugging.
- Sequence target continuity rule:
  - If later sequence text refers to the same chosen target from an earlier step ("it", "that Unit"), encode dependent steps with `target.scope = "previous_target"` rather than a second `player_choice`.
- Reactive continuous expansion metadata rule:
  - When expanding `type: "continuous"` `conditional(eventType...) -> then(...)` branches into derived reactive effects, preserve runtime-governing metadata from the parent effect (at minimum `restrictions`, especially `once_per_turn`).
- `EFFECT_DAMAGE_RECEIVED` data scoping rule:
  - Text like "when this Unit receives effect damage" should encode explicit `conditions: [{ type: "eventTarget", value: "self" }]`.
  - Do not narrow engine dispatch to source-self globally; observer cards (e.g. "one of your friendly Units receives effect damage") rely on broader event dispatch plus explicit event-target conditions.
- `BATTLE_DESTROY` semantics rule:
  - `eventType = BATTLE_DESTROY` currently means a battle resolved with at least one unit destroyed (attacker or defender), not automatically "this unit destroyed an enemy unit".
  - For text like "when this Unit destroys an enemy Unit with battle damage", require explicit attacker + defender checks (for example `eventAttacker = self` and `eventDefenderDestroyed = true`).
  - If the source can be removed during the same battle (mutual destruction), prefer a `triggered` `BATTLE_DESTROY` effect over reactive `continuous + conditional(eventType=BATTLE_DESTROY)` so the effect resolves before post-battle destruction flush removes the source.
- `conditionalTokenDeploy` condition-evaluation rule:
  - If a `conditionalTokenDeploy` effect uses event/source conditions (e.g. `eventTarget=self`), runtime condition checks must pass the source card context into `validateEffectConditions`; evaluating with only `playerId` can silently fail valid self-target triggers.
- Trigger-context architecture rule:
  - When adding deferred/reactive trigger metadata (e.g. damaged card uid + notification snapshot), centralize the payload type and notification lookup/snapshot helpers in shared modules.
  - Avoid duplicating payload shapes and queue-tail scanning logic across action handlers, trigger managers, sequence buffers, and `GameEnvironment` serialization.
- Multi-shield shield-damage timing rule:
  - If card text/effect semantics treat multiple shield hits as simultaneous (e.g. `<Suppression>` hitting first 2 shields), do not fire per-shield follow-up triggers immediately inside the shield-resolution loop.
  - Batch shield outcomes first (including burst-choice-delayed shields), then flush `SHIELD_AREA_CARD_DAMAGED` / `DEFENSE_AREA_BATTLE_DAMAGE` in deterministic order after the batch completes.
- `shield-area card` coverage rule:
  - Card text referring to enemy "shield-area card" may map to `shield` and `base` in engine semantics.
  - Encode the intended coverage explicitly in `parameters.defenseAreas` (for example `['shield']` vs `['shield', 'base']`) and test both paths when base should qualify.
- Pairing effect order dialog rule:
  - Show `OPTION_CHOICE` only for effects that may require player decision now (interactive candidates).
  - Hide deterministic non-interactive effects (for example, self/paired-unit `allow_attack_target` that auto-applies without chooser).
  - Hidden auto effects must still resolve in deterministic effect-list order.
  - When dialog options represent a filtered subset, option payload must include stable source index mapping (e.g., `payload.effectOrderIndex`) and backend resolution must use that mapping, not raw displayed index.
- Attack effect order dialog rule (`ATTACK_PHASE`):
  - When multiple attack effects are simultaneously interactive/orderable (for example attacker-unit effect + paired-pilot effect), enqueue `OPTION_CHOICE` (`action = attack_effect_order`) before any `ATTACK_PHASE_EFFECT_TRIGGERED` event.
  - `OPTION_CHOICE` context must carry full ordered queue (`allEffects`) plus displayed subset mapping and original attack event data (`ATTACK_EFFECT_ORDER` context), so chosen option can rehydrate the exact next queued attack effect.
  - Option payload must use stable original queue mapping (`payload.effectOrderIndex`) and resolution must map by payload index, not visible option index.
  - Disabled options are valid and should include backend-derived reasons (source missing, source/attack condition failed, once-per-turn used, no legal targets, cost cannot be paid).
  - If multiple effects exist but `<=1` option is currently enabled, skip dialog and auto-queue the only enabled effect (or first fallback), preserving deterministic chain order.
  - After the chosen effect resolves (including cost/target choices), remaining attack effects must continue through attack-chain continuation and only then enqueue final battle resume (`skipAttackPhaseEffects=true`).
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
- `GD03-053` / `GD03-067` sequence/reactive metadata parity gap:
  - `GD03-067` deploy text required buffing the same unit damaged in step 1, but rule data used a second `player_choice`; fixed by `target.scope = "previous_target"` on the `modifyAP` step.
  - `GD03-053` `[Once per Turn]` reactive continuous trigger risked losing `once_per_turn` because `ContinuousConditionalEffectExpander` did not propagate `restrictions` to derived `then` effects; fixed by metadata propagation on derived reactive effects.
- `GD03-062` / `GD02-091` source-condition default/provenance gap:
  - `GD03-062` (`sourceDeployedFrom`) silently failed because deploy flow did not persist `deployedFrom` onto the deployed unit and card data omitted `scope`.
  - `GD02-091` (`sourceColor`) omitted `scope`, but backend defaulted missing scope to `player`, causing source-color conditional failure.
  - Fixed by persisting `UnitZoneCard.deployedFrom` in deploy service and defaulting missing `scope` to `"source"` for `source*` conditions in `EffectConditionEvaluator`.
- `GD03-039` deploy no-target semantic mismatch + sequence failure metadata loss:
  - card play should succeed and Deploy should fizzle when no other active friendly `(Clan)` unit exists, but backend surfaced a post-placement `DEPLOY_EFFECT_TRIGGERED` error.
  - root cause was generic failure bubbling from nested sequence step targeting, plus loss of structured failure classification through `SequenceEffectManager`.
  - fixed with structured `failureKind` propagation (`NO_TARGETS_REQUIRED`) and `DeployEffectManager` downgrade for `ENTERS_PLAY` no-target-required failures.
  - See `references/incident-gd03-039-deploy-no-target-fizzle-sequence-failurekind.md`.
- `GD03-051` linked deploy chooser affordability UX gap (and same pattern for `GD02-096`/`GD02-110`/`GD03-130`):
  - text/rules correctly encoded `Pay its cost to deploy it` (`payCost: true`), but chooser `availableTargets` was generated from target filters only and did not exclude unaffordable deploy candidates.
  - Result: backend could show a target in dialog that would fail at resolution-time energy payment (`P2` UX/backend-parity mismatch).
  - Fixed by shared deploy affordability evaluator used for both chooser pre-filtering and deploy payment (effective cost/level, including self-trash cost modifiers).
  - Preserve target-choice policy after affordability filtering: single remaining target auto-applies (no dialog).
- `GD03-049` suppression shield-damage timing mismatch:
  - `<Suppression>` text implies first 2 shield hits are simultaneous, but backend processed shield follow-up triggers sequentially per shield (`SHIELD_AREA_CARD_DAMAGED` / `DEFENSE_AREA_BATTLE_DAMAGE`) inside the loop.
  - Fixed by batching shield outcomes per `SHIELD_CARD_ATTACKED` event (including burst-choice-delayed shields), then flushing all shield-damage notifications first and effect triggers second after batch completion.
  - Follow-up data alignment: `GD03-049` `DEFENSE_AREA_BATTLE_DAMAGE` rule now explicitly encodes `parameters.defenseAreas = ['shield', 'base']` so base qualifies as a shield-area card per intended semantics.
  - See `references/incident-gd03-049-suppression-batch-shield-damage.md`.
- `GD03-022` / `GD02-093` / `GD03-097` `BATTLE_DESTROY` over-trigger + mutual-destruction timing gap:
  - cards with text "when this Unit destroys an enemy Unit with battle damage" were encoded with `eventAttacker=self` only, but `BATTLE_DESTROY` semantics also include attacker death; this can over-trigger when the source attacks and dies without destroying the defender.
  - fix data by adding `conditions: [{ type: "eventDefenderDestroyed", value: true }]` alongside `eventAttacker=self`.
  - for `GD03-022`, reactive continuous encoding also missed valid mutual-destruction triggers because source left play before reactive continuous pass; fixed by converting to `triggered` `BATTLE_DESTROY`.
- `GD03-020` continuous battle-damage prevention silent no-op:
  - data was correct (`continuous prevent_battle_damage` + `parameters.from = "enemy_units"` with Ad Balloon name-in-play condition), but runtime continuous application rejected the unconditional shape because no comparator filter keys were present.
  - direct `EffectExecutor.applyEffectToTargets(...)` tests still passed, masking the issue; the bug existed only in the continuous manager guard path.
  - fix at engine level (continuous manager guard), plus add regression tests for both direct continuous-manager invocation and end-to-end `GD03-020` action-step battle resolution.
- Deploy diagnostics / fixture canonicality / schema-validator-gap pattern:
  - apparent "Deploy / Pair / Link effect didn't trigger" can be caused by legal no-op sequence resolution (e.g. empty-deck `moveTopDeckToTrash`) or malformed in-play fixture cards missing canonical runtime fields (`cardData`, `originalAP`, `originalHP`), not card data bugs.
  - add/inspect deploy diagnostics (`triggered`, `resolved`, `no_targets`, `invalid_target_state`) before changing `effects.rules`.
  - if `npm run review:effects` reports `Issues: 0` but `validate:effects:canonical` fails, inspect canonical schema definitions in `src/services/effects/schema/EffectSchema.ts` (for example missing sequence step actions like `prevent_shield_damage`) before patching card JSON.
  - See `references/incident-deploy-diagnostics-fixture-canonicality-and-schema-validator-gap.md`.
- `GD01-007` destroyed conditional draw implementation-review capture:
  - verified text/rule/runtime alignment for `[Destroyed] If you have another (OZ) Unit in play, draw 1.`
  - confirms `another` exclusion via `excludeCarduid` and pre-trash destroyed-trigger timing in runtime path
  - implementation is correct; residual gap is missing card-specific negative scenario coverage (`no other OZ in play => no draw`)
  - See `references/incident-gd01-007-destroyed-conditional-draw-another-trait.md`.
- `GD03-002` / `GD02-005` attack-trigger timing and ordering pattern:
  - `GD03-002` (`During Pair`, reactive continuous on `UNIT_ATTACK_DECLARED`) and `GD02-005` (`ATTACK_PHASE` rest while linked) exposed that "attack text" spans two backend trigger pipelines with different timing/context risks.
  - Fixes/lessons:
    - refresh continuous effects before declaration-time reactive checks so dynamically granted attacker keywords (e.g. `<Repair>`) are available
    - resolve reactive event context from the exact `attackNotificationId` / `UNIT_ATTACK_DECLARED` notification during attack `PLAYER_ACTION`
    - ensure auto-applied attack-triggered effects emit state-change notifications before `BATTLE_RESOLVED`/`GAME_ENDED`
- `GD02-057` + paired pilot (`ST04-010`) attack trigger truncation:
  - Root cause: attack-trigger processing stopped after first attack effect opened a cost choice, then resumed battle with `skipAttackPhaseEffects=true`, dropping remaining attack triggers (pilot never executed).
  - Fix pattern:
    - queue attack effects as internal events (`ATTACK_PHASE_EFFECT_TRIGGERED`) and execute one-at-a-time
    - carry remaining effects in attack-chain continuation through all cost/target choice contexts
    - introduce attack effect order `OPTION_CHOICE` (`ATTACK_EFFECT_ORDER`) for multi-interactive cases
    - resolve chosen option via stable `effectOrderIndex` mapping into full queue (`allEffects`)
    - only enqueue battle resume after attack effect chain is exhausted
  - Regression coverage should include:
    - unit-first and pilot-first order choices
    - optional attack cost decline still preserves later pilot trigger
    - only-one-enabled case skips order dialog
    - treat `TARGET_CHOICE` from attack triggers as an interrupt that pauses attack progression before battle opens
  - Review takeaway: always classify the card as declaration-reactive vs `ATTACK_PHASE` first, then verify ordering with notification timestamps/types.
- Battle-resolve destroy choice desync pattern (`Target choice event not found`):
  - symptom: player selects a valid card in dialog, but hand/board state does not change and confirm endpoint returns "event not found".
  - root cause class:
    - persisted game snapshots used client-filtered serialization (`toJSON`) that hid declared blocking choices after `BATTLE_RESOLVED`.
    - confirm endpoints look up unresolved choice events from internal `processingQueue`, so reload lost the target event id.
    - in parallel, frontend submit flows could swallow confirm errors and close dialogs, creating false-success UX.
  - hardening:
    - add and use `toPersistenceJSON()` for save/version snapshot paths (full `processingQueue` retained)
    - keep frontend choice source strictly notification-based
    - make `BLOCKER_CHOICE` notification persistence parity explicit
    - keep dialogs open on submit failure and require successful confirm before close/clear
    - add consistency tests: unresolved choice notifications map to persisted processing events by id
  - See `references/incident-battle-resolve-destroy-choice-persistence-and-notification-contract.md`.

## Output Requirements
- Provide:
  - root cause summary
  - affected files with exact line references
  - risk classification (`P1/P2/P3`)
  - test evidence (`npm test`, and `npm run build` if UI-affecting)
- If no bug found, explicitly state "No functional mismatch found" and note residual risk.
