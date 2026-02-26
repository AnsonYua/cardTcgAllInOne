# Incident Reference: `EFFECT_DAMAGE_RECEIVED` self-scope leakage + deferred event-context replay

## Incident Summary
- Symptom: `GD03-060` ("when this Unit receives effect damage, deploy `T-015`") deployed a token when a different friendly unit received effect damage.
- Repro context:
  - `GD03-056` deploy effect dealt 1 effect damage to another friendly unit and 1 enemy unit.
  - `GD03-060` (not damaged) still triggered and deployed `T-015`.

## Root Cause A (Data scoping gap)
- `EFFECT_DAMAGE_RECEIVED` dispatch intentionally scans all in-play cards for the damaged player.
- Some cards are observers (correctly broad), but self-worded cards relied on implicit semantics and had no explicit event-target condition.
- Affected self-worded rules (in requested audit set):
  - `GD02-010`
  - `GD03-060`
  - `GD03-095`

## Root Cause B (Deferred replay event-context gap)
- Deferred `EFFECT_DAMAGE_RECEIVED` replay stored only `damagedPlayerId/sourcePlayerId`.
- During flush, event conditions could be evaluated against the latest notification queue tail instead of the original `CARD_DAMAGED` notification for that specific damage event.
- This risks wrong event-target matching in multi-damage sequences.

## Fix Applied
1. Data hardening for self-worded cards:
   - Added `conditions: [{ "type": "eventTarget", "value": "self" }]` to:
     - `GD02-010`
     - `GD03-060`
     - `GD03-095`
2. Deferred replay event snapshot preservation:
   - Capture exact `CARD_DAMAGED` notification snapshot after each damage application.
   - Persist snapshot + `damagedCarduid` in deferred entries.
   - Replay `EFFECT_DAMAGE_RECEIVED` using stored notification override, not queue-tail inference.
3. `conditionalTokenDeploy` runtime condition evaluation fix:
   - Pass source-card context into `validateEffectConditions` so `eventTarget=self` works for token deploy triggers.
4. Follow-up refactor (no logic change):
   - Centralized deferred `EFFECT_DAMAGE_RECEIVED` payload shape in a shared type module.
   - Centralized notification lookup/snapshot/resolve logic in a shared helper used by both damage application and trigger replay.

## Key Files
- Engine trigger replay/context:
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/actions/EffectDamageActions.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/EffectDamageReceivedTriggeredEffectManager.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/sequence/SequenceExecutionContext.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/models/GameEnvironment.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/models/EffectDamageReceivedTriggerContext.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/EffectDamageReceivedNotificationContext.ts`
- Token deploy condition evaluation:
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/ConditionalTokenDeployManager.ts`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/services/effects/actions/EffectTokenActions.ts`
- Card data:
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/gd02Card.json`
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/gd03Card.json`

## Regression Coverage
- New:
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/__tests__/effectDamageReceivedSelfScopeRegression.test.js`
    - `GD03-060` does not trigger on unrelated friendly effect damage
    - `GD03-060` does trigger on self effect damage
    - `GD02-010` draw triggers only on self enemy-effect damage
    - `GD03-095` pilot self-target semantics use paired unit (`eventTarget=self`)
    - data audit assertions for self-target conditions
- Extended:
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/__tests__/sequenceEffectDamageTriggerOrdering.test.js`
    - deferred entries survive `toJSON()/fromJSON()`
    - serialized deferred entry includes notification snapshot for correct event-target replay
- Observer-card safety regression:
  - `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/__tests__/gd03129TekkadanEffectDamageBaseTrigger.test.js`
    - `GD03-129` still triggers on friendly `(Tekkadan)/(Teiwaz)` unit effect damage

## Reuse Guidance
- Do not “fix” self-scope leaks by globally restricting `EFFECT_DAMAGE_RECEIVED` dispatch to the damaged card only; that breaks observer cards.
- Encode text intent explicitly in card data:
  - self-only => `eventTarget=self`
  - observer => `eventTargetController`, traits, and/or other event-target filters
- Any deferred event-trigger buffer that supports event-target/event-attacker conditions should preserve per-event notification snapshots (or equivalent immutable event context) across persistence boundaries.
