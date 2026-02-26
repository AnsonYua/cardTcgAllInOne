# Incident: Deploy Trigger Debugging, Fixture Canonicality, and Canonical Validator Gap

## Summary
This incident combined three issues that can look like "card effect did not trigger":

1. **Legitimate no-op sequence resolution**
   - Example: `GD03-092 (Nyaan)` linked effect with empty deck (`deckCount = 0`)
   - The sequence triggers, but `moveTopDeckToTrash` moves zero cards (legal no-op), so downstream conditional damage does not happen.

2. **Malformed in-play fixture data**
   - Example: placeholder enemy unit in slot with `carduid` only / missing `cardData`, `originalAP`, `originalHP`
   - Deploy damage targeting may appear to "not trigger", but root cause is invalid slot health state (`maxHp = 0`) during damage application.

3. **Canonical schema validator gap**
   - `review:effects` reported `Issues: 0`, but `validate:effects:canonical` failed because `SEQUENCE_SUPPORTED_STEP_ACTIONS` omitted a valid engine-supported action: `prevent_shield_damage`.
   - Root cause was canonical schema definition drift, not card data drift.

## Root Causes

### A) Empty-deck sequence steps can be legal no-ops
- `moveTopDeckToTrash` returns success with `movedCards = []` when the deck is empty.
- No notification is emitted if no cards were moved.
- Conditional checks like `milledCardHasTraitsAny` then evaluate false.

### B) Slot damage logic requires canonical runtime card fields
- Slot damage/heal uses slot health derivation (`originalHP` / `cardData.hp`) to compute effective slot HP.
- Placeholder/malformed slot units can produce `maxHp = 0`, causing misleading symptoms unless explicitly diagnosed.

### C) Effect schema alignment has two gates with different responsibilities
- `review:effects` detects alignment drift categories and fix-map issues.
- `validate:effects:canonical` validates canonical schema legality using `EffectSchema.ts`.
- It is possible for review drift to be `0` while canonical validation still fails because canonical schema definitions are missing valid actions.

## Fix Pattern

### 1) Add deploy diagnostics for observability
- Emit explicit deploy diagnostic notifications for:
  - `triggered`
  - `resolved`
  - `no_targets` (mandatory no-target fizzle path)
  - `invalid_target_state`
- Include `effectId`, `sourceCarduid`, and error/failure metadata.

### 2) Fail fast on malformed slot health state
- Before slot damage/heal, detect:
  - slot contains a card
  - resolved slot max HP is `0`
- Return a clear error (fixture/state non-canonical) instead of letting it look like a trigger miss.

### 3) Keep fixture policy strict
- Test scenarios and mock game states should use canonical slot unit/pilot payloads:
  - `carduid`
  - `cardData`
  - `originalAP`
  - `originalHP`

### 4) When canonical validator fails but review drift is zero
- Inspect `src/services/effects/schema/EffectSchema.ts` first.
- Verify `SEQUENCE_SUPPORTED_STEP_ACTIONS` includes all engine-supported sequence step actions (e.g. `prevent_shield_damage`).

## Reusable Debug Heuristics
- "No effect happened" != "trigger didn’t fire":
  - verify whether it triggered but resolved as a legal no-op.
- If a deploy/sequence effect targets a slot card and behavior is strange:
  - validate slot fixture canonicality before debugging rule semantics.
- If `review:effects` is clean but canonical validation fails:
  - treat it as schema-definition/tooling gap before editing card data.

## Verification Pattern
- Run:
  - `npm run review:effects`
  - `npm run validate:effects:canonical`
  - `npm run validate:effects:strict`
- Add focused tests for:
  - canonical target fixture deploy resolution
  - malformed fixture invalid-state diagnostic
  - legal no-op deploy/sequence behavior
