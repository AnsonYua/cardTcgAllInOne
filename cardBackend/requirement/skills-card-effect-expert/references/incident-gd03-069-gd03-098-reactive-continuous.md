# Incident Reference: GD03-069 / GD03-098 reactive continuous conditional effects dropped

## Incident Summary
- Cards:
  - `GD03-069` (`Graham's Union Flag Custom`)
  - `GD03-098` (`Graham Aker`)
- Symptoms:
  - `GD03-069` did not become active at end turn while linked and rested.
  - `GD03-098` linked follow-up bounce did not trigger when `GD03-069` was set active by an effect.
- Snapshot evidence:
  - Link state was valid (`High-Maneuver` continuous keyword granted).
  - `GD03-069` / `GD03-098` effects were encoded as `type: "continuous"` with `sequence -> conditional(eventType) -> then(action)`.

## Root Causes

### 1) Continuous conditional expander silently dropped event-gated non-continuous actions (P1)
- Backend continuous expansion only registered `then` steps when `isSupportedContinuousAction(step.action)` was true.
- Supported actions were limited to stat/keyword/prevention-style continuous actions.
- `GD03-069` `then: setActive` and `GD03-098` `then: returnToHand` were skipped entirely.
- Result:
  - no registry entry for the reactive behavior, so effects never executed.

### 2) `sourcePairedWithPilot` condition default-scope mismatch (P1 false negative)
- `GD03-069` condition used:
  - `{ "type": "sourcePairedWithPilot", "value": true }`
  - no explicit `scope`
- `EffectConditionEvaluator` defaulted missing scope to `"player"`.
- `SourceAndSpecialConditionEvaluator.sourcePairedWithPilot` only accepted `scope === "source"`.
- Result:
  - condition evaluated false even in valid linked/paired states.

### 3) Event-condition semantics gap for linked pilot `eventTarget = self` (P1 false negative)
- `GD03-098` reacts to `SET_ACTIVE_BY_EFFECT` on "this Unit" (the paired unit).
- `eventTarget = self` was evaluated against the pilot carduid literally.
- Actual event target for `CARD_SET_ACTIVE` is the unit carduid.
- Result:
  - `GD03-098` condition failed even after `GD03-069` was set active.

### 4) `eventTargetWasRested` relied on current state instead of prior state (P1 false negative)
- `GD03-098` requires the unit to have been rested before being set active.
- Evaluator fell back to checking current card state, which is already active after resolution.
- `CARD_SET_ACTIVE` notification lacked prior-state metadata.
- Result:
  - `eventTargetWasRested = true` could fail.

## Fix Applied

### Backend engine
1. Added event-reactive continuous registry handling for `type: continuous` conditional branches with `eventType` conditions.
   - Event-gated `then` actions (including non-continuous actions like `setActive` / `returnToHand`) are registered instead of dropped.
2. Added `ContinuousEffectManager.processReactiveContinuousEffects(gameEnv)`:
   - executes reactive continuous entries only in active event contexts
   - skips normal continuous application pass
   - de-duplicates per event (`lastReactiveEventKey`)
   - supports short chained reactions in the same event context (e.g. `GD03-069` -> `GD03-098`)
3. Hooked reactive continuous execution after successful event execution in `StaticEventProcessor`.

### Backend condition semantics
4. `sourcePairedWithPilot` now treats omitted scope as source-scoped behavior.
5. `eventTarget = self` uses effective self resolution for pilot/command sources (paired unit carduid).
6. `CARD_SET_ACTIVE` notifications now include `wasRested`, and `eventTargetWasRested` consumes it when present.

## Detection Heuristic (Reusable)
Treat as high risk when all are true:
1. card rule is `type: "continuous"` with `sequence -> conditional`
2. `conditional.if` includes `eventType`
3. `conditional.then` includes actions outside continuous stat/keyword/prevention families
4. engine continuous expander has an allowlist of supported continuous actions

Also treat as high risk when:
1. a source-specific condition (e.g. `sourcePairedWithPilot`) omits `scope`
2. evaluator defaults missing scope to `"player"`
3. source-special evaluator expects `"source"`

Also treat as high risk for linked pilot reactions when:
1. pilot text refers to "this Unit"
2. conditions include `eventTarget = self`
3. event target is actually the paired unit carduid

## Rule Authoring / Engine Checklist Delta
- `type: continuous` does not always mean "recalculate every pass only":
  - some continuous rules encode event-gated reactive branches via `conditional(eventType...)`
  - these require event-time execution support, not just registry stat application
- Event notifications should include prior-state metadata when card text depends on "was X before effect" semantics.
- Condition evaluators for pilot-linked effects should use effective paired-unit identity when card text/event semantics target the unit.

## Risk Classification
- `P1`:
  - core card effects (`GD03-069`, `GD03-098`) silently nonfunctional in valid linked states
