# Incident: `BATTLE_DESTROY` attacker/defender semantics and mutual-destruction timing

## Symptom
- Card text says: "when this Unit destroys an enemy Unit with battle damage ..."
- Runtime effect is encoded with `eventAttacker = self` and `BATTLE_DESTROY`.
- Effect may:
  - false-trigger when attacker dies but defender survives, or
  - fail to trigger on mutual destruction if implemented as reactive continuous and source leaves play before reactive pass.

## Root Cause
- `eventType = BATTLE_DESTROY` engine semantics can mean "battle resolved with at least one unit destroyed" (attacker or defender).
- `eventAttacker = self` only proves source was the attacker, not that it destroyed the defender.
- Reactive continuous execution may run after post-battle destruction flush removes the source from field/registry.

## Data/Engine Fix Pattern
- For text "this Unit destroys an enemy Unit with battle damage", require:
  - `eventAttacker = self`
  - `eventDefenderDestroyed = true`
- If source is the battle participant and can be destroyed in the same battle, prefer:
  - `type: "triggered"`
  - `trigger: "BATTLE_DESTROY"`
  over reactive `continuous + conditional(eventType = BATTLE_DESTROY)`.

## Regression Coverage
- Positive: `defenderDestroyed = true`
- Negative: `attackerDestroyed = true`, `defenderDestroyed = false`
- Mutual destruction: `attackerDestroyed = true`, `defenderDestroyed = true` (should still trigger if text conditions are met)

## Example Cards
- `GD03-022` (also required timing change to triggered `BATTLE_DESTROY`)
- `GD02-093`
- `GD03-097`
