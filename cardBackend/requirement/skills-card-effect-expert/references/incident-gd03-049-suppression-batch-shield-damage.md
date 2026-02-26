# Incident Reference: GD03-049 Suppression shield damage batch timing

## Incident Summary
- Card: `GD03-049` (`Gundam Exia (Trans-Am)`)
- Text includes:
  - `<Suppression>`: damage to shields by an attack is dealt to the first 2 cards simultaneously
  - shield battle-damage trigger that destroys the lowest-HP enemy Unit if `CB >= 10` in trash
- Symptom:
  - Engine processed 2 shield hits sequentially and immediately fired `SHIELD_AREA_CARD_DAMAGED` / `DEFENSE_AREA_BATTLE_DAMAGE` per shield, which could interleave follow-up destroy effects inside a single `<Suppression>` attack.

## Root Cause (P2 semantics/order mismatch)
- `BurstEffectManager.processShieldCardAttack(...)` loop removed each shield and immediately:
  - dispatched `SHIELD_AREA_CARD_DAMAGED`
  - processed `DEFENSE_AREA_BATTLE_DAMAGE`
- For `<Suppression>` attacks (`2` shields), this created per-shield sequential trigger timing instead of batch timing implied by "simultaneously."
- Burst-choice shield cards made the gap worse because one shield could resolve immediately while the other waited on `BURST_EFFECT_CHOICE`.

## Fix Applied
- Introduced internal shield-damage batch state in `BurstEffectManager`, keyed by shield attack event id.
- Deferred follow-up processing until all targeted shields in the attack batch were resolved (including burst `ACTIVATE` / `DECLINE` paths).
- Preserved trigger cardinality:
  - still process `DEFENSE_AREA_BATTLE_DAMAGE` once per destroyed shield card
  - only timing changed (batched flush after batch completion)
- Flushed in two phases for deterministic ordering:
  1. emit all `SHIELD_AREA_CARD_DAMAGED` notifications/events for destroyed shields (original shield order)
  2. process `DEFENSE_AREA_BATTLE_DAMAGE` triggers for each destroyed shield
- Added internal metadata on burst choice events (`shieldAttackSourceEventId`) to reconnect asynchronous burst resolution back to the original shield-attack batch.
- Follow-up data alignment for `GD03-049`:
  - clarified/encoded enemy defense-area coverage explicitly via `parameters.defenseAreas = ["shield", "base"]`
  - aligns with engine `DEFENSE_AREA_BATTLE_DAMAGE` routing and existing `shield-area card` precedent (e.g. `ST03-001`)

## Validation Evidence
- Added/updated tests:
  - `src/__tests__/gd03_049_suppression_batch_semantics.test.js`
  - `src/__tests__/notificationOrderShieldDamage.test.js`
- Verified:
  - `GD03-049` rule schema fields remain aligned (`suppression_2`, `DEFENSE_AREA_BATTLE_DAMAGE`, `YOUR_TURN`, `cardsInTrashWithTraitsAny >=10`, `LOWEST_HP`, `CONTROLLER_CHOICE`, `defenseAreas: ['shield', 'base']`)
  - `<Suppression>` first-2 shield ordering remains intact
  - burst + non-burst mixed shield batches defer follow-up triggers until batch completion
  - both `SHIELD_AREA_CARD_DAMAGED` notifications appear before `UNIT_DESTROYED_BY_EFFECT` notifications in suppression multi-shield scenarios
  - base battle damage path also triggers `GD03-049` effect when `CB >= 10`, and still respects `YOUR_TURN` / `LOWEST_HP` / tie-choice behavior

## Reusable Heuristic
Treat as high risk when all are true:
1. card text says shield damage hits multiple shields "simultaneously" (or equivalent wording)
2. engine resolves shield cards in a loop with immediate per-shield follow-up triggers
3. triggered effects depend on shield battle damage/destruction (`SHIELD_AREA_CARD_DAMAGED`, `DEFENSE_AREA_BATTLE_DAMAGE`)
4. one or more targeted shields can pause on asynchronous burst choice resolution

## Rule / Engine Checklist Delta
- For multi-shield battle damage semantics (e.g. `<Suppression>`):
  - separate "shield cards removed/damaged" from "follow-up trigger processing"
  - batch shield outcomes first, then flush dependent triggers
  - preserve original shield order in batched notification emission
  - if burst choices split resolution across API calls/events, persist enough batch linkage metadata to flush at batch completion
- For text mentioning "shield-area card":
  - do not assume `shield` only; verify set precedent and intended semantics
  - encode area coverage explicitly in rule data (`parameters.defenseAreas`) as `["shield"]` vs `["shield", "base"]`
  - add regression tests for both shield and base paths when card text/intent allows base
