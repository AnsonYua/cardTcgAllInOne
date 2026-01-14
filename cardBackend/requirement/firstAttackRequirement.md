Requirement:
- A unit played this turn cannot attack.
- If a pilot is played in the same turn and the slot becomes linked (unit + pilot), the unit may attack immediately.
- If the unit is rested, it still cannot attack even if play-turn attack is allowed.

Backend response updates:
- `gameEnv.players[playerId].zones.slotX.unit.playedThisTurn` indicates whether the unit entered play this turn.
- `gameEnv.players[playerId].zones.slotX.unit.canAttackThisTurn` is computed for the frontend:
  - `true` only when the unit is not rested and either it was not played this turn or it has a play-turn attack override.

Code implementation:
- Create unit fields and defaults: `src/models/CardSystem.ts`
  - `playedThisTurn` set `true` on unit creation.
  - `canAttackOnPlayTurn` default `false`.
- Link formation now grants a play-turn attack override: `src/services/PlayerCardManager.ts`
  - `canAttackOnPlayTurn = true` when a pilot + unit are linked.
- Turn reset clears play-turn flags: `src/models/Player.ts`
  - `playedThisTurn = false`, `canAttackOnPlayTurn = false`.
- Response serialization adds `canAttackThisTurn` and removes legacy `isFirstPlay`: `src/models/Player.ts`
  - `canAttackThisTurn = !isRested && (!playedThisTurn || canAttackOnPlayTurn)`.
