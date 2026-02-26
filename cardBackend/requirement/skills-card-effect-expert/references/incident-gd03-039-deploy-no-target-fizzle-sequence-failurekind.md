# Incident: `GD03-039` Deploy No-Target Fizzle Semantics and Sequence Failure Metadata Propagation

## Summary
- `GD03-039` (`【Deploy】Choose 1 other active friendly (Clan) Unit...`) returned backend error:
  - `No eligible targets found for rest_other_friendly_clan_unit`
- Rule intent (confirmed): card play should still succeed when no legal `(Clan)` target exists; the Deploy effect should fizzle.

Root cause was **not** card data. It was backend error propagation for `ENTERS_PLAY` sequence effects.

## Root Causes

### 1) Deploy no-target mandatory step was treated as a hard event failure
- `DeployTargetManager.processEffectWithTargetChoice(...)` correctly detected no legal targets and returned `success: false`.
- `DeployEffectManager.executeDeployEffect(...)` treated all such failures as fatal and bubbled error to event processing.
- Result: `DEPLOY_EFFECT_TRIGGERED` failed, which made `PLAY_CARD` API flow return an error even though the card had already entered play.

### 2) Sequence wrapper dropped nested failure classification
- `GD03-039` deploy rule is `action: "sequence"`.
- The mandatory no-target happened inside a nested sequence step (`rest_other_friendly_clan_unit`).
- `SequenceEffectManager` returned `{ success: false, error }` but **discarded structured failure metadata** from the nested `DeployTargetResult`.
- Result: top-level Deploy handler could not distinguish:
  - intended/no-target fizzle vs
  - real execution failure

## Fix Pattern

### A) Add structured failure kind for target-processing results
- Extend `DeployTargetResult` with machine-readable `failureKind`
- Example value:
  - `NO_TARGETS_REQUIRED`

### B) Preserve failure metadata through sequence wrappers
- When a nested sequence step delegates to `DeployTargetManager`, propagate `failureKind` back out of `SequenceEffectManager`.
- Do this for generic step execution and specialized sequence paths (e.g. discard helper) to avoid future silent loss.

### C) Downgrade only `ENTERS_PLAY` no-target-required failures to fizzle
- In `DeployEffectManager.executeDeployEffect(...)`:
  - if `trigger === "ENTERS_PLAY"` and `failureKind === "NO_TARGETS_REQUIRED"`
  - log informationally and treat as success (fizzle)
  - do **not** add to deploy failures list
- Keep strict failure semantics for non-Deploy usages of `failIfNoTargets` (e.g. activated/main/attack effects).

## Why This Matters (Debug Heuristic)
- If a card is already placed on board but `/playCard` still returns an error, inspect **queued post-placement events** (especially `DEPLOY_EFFECT_TRIGGERED`) before blaming play legality.
- For sequence effects, verify error classification survives wrapper layers; otherwise top-level handlers cannot apply timing-specific semantics.

## Regression Coverage Pattern
- Add three tests:
  1. `DeployTargetManager` returns `failureKind = NO_TARGETS_REQUIRED` for `GD03-039` mandatory step with no other Clan unit
  2. `DeployEffectManager` treats `GD03-039` no-target `ENTERS_PLAY` as success/fizzle
  3. Full `PLAY_CARD` event processing succeeds and card remains in play when deploy fizzles

## Reusable Audit Heuristic
- Scan card data for `ENTERS_PLAY` rules using `failIfNoTargets: true`.
- For each such card:
  - confirm intended semantics (`cannot play` vs `play succeeds, effect fizzles`)
  - verify backend timing handler (Deploy/Triggered/etc.) implements that semantic explicitly
  - verify sequence wrappers propagate structured failure metadata if the rule is encoded as `sequence`
