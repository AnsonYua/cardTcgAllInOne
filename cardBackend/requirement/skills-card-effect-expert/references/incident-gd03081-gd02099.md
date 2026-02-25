# Incident Reference: GD03-081 turn-history + GD02-099 pairing option eligibility

## Incident A: GD03-081 `friendly_unit_deployed_this_turn` after destruction

### Symptom
- `GD03-081` attack restriction blocked attacks even when a required trait unit was deployed this turn and then destroyed.
- Snapshot showed the deployed unit in `trashArea` with `playedThisTurn: true`, but attack still failed.

### Root cause (P1)
- Restriction evaluator for `requires.type = "friendly_unit_deployed_this_turn"` only scanned current field slots (`slot1..slot6`).
- It did not treat "deployed this turn" as turn-history state.

### Fix
- Extended evaluator to include `trashArea` entries with `playedThisTurn: true`.
- Kept trait filtering logic identical for both in-play and trash checks.

### Regression added
- Test case: deployed-this-turn matching unit moved to trash still satisfies attack requirement.

---

## Incident B: Pairing effect order should disable guaranteed no-op options

### Symptom
- `PAIRING_EFFECT_ORDER` dialog showed all options as selectable even when one option could not activate now.
- Example: `GD02-099` pair effect needed `>=4` `(Gjallarhorn)` cards in trash, current state had only 2.

### Root cause (P1/P2)
- Pairing option generation did not compute per-option eligibility.
- `confirmOptionChoice` only validated option index presence, not availability.
- Frontend option mapping respected `enabled`, but backend had no disabled state to send.

### Fix
1. Backend option metadata:
   - Added optional `disabled` and `disabledReason` on option entries.
2. Pairing option eligibility preview:
   - Mark option disabled when guaranteed no-op now:
     - no legal targets
     - source/conditions not met
     - sequence conditional-only branch cannot execute now
3. Backend enforcement:
   - `confirmOptionChoice` rejects disabled selection.
   - defensive rejection also in `PairingEffectOrderManager`.
4. Frontend parity:
   - Option mapping treats `disabled: true` as non-selectable.
   - timeout/default auto-selection skips disabled choices.

### Regression added
- Pairing order option disabled when conditional gate is false.
- Disabled option rejected in confirmation.
- Defensive manager rejection for disabled selected option.

---

## Reusable Rule
- For "turn-history" requirements (e.g., deployed this turn), never assume "currently in play".
- For any multi-option dialog, option selectability must be explicit in payload and enforced by backend.
