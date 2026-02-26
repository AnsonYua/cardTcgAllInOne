# Incident: `GD03-002` / `GD02-005` Attack Trigger Timing and Ordering

## Summary
- `GD03-002` (`During Pair` attack trigger) and `GD02-005` (`[During Link][Attack]` rest effect) exposed a shared debugging trap: both are "attack effects" in card text, but they execute through different backend pipelines.
- Treating them as a single trigger path hid timing/context bugs and delayed correct fixes.

## Key Lesson: Two Attack Trigger Pipelines
1. Declaration-reactive continuous
- Shape: `type: "continuous"` + `sequence/conditional` + `eventType = UNIT_ATTACK_DECLARED`
- Example: `GD03-002`
- Runtime path: `ContinuousEffectManager.processReactiveContinuousEffects(...)`

2. `ATTACK_PHASE` triggered effects
- Shape: `type: "triggered"`, `trigger: "ATTACK_PHASE"`
- Example: `GD02-005`
- Runtime path: `AttackPhaseEffectManager.processAttackPhaseEffects(...)`

## Bugs/risks observed and fixes/confirmations

### A) `GD03-002` class (declaration-reactive continuous)
- Risk: attacker keyword conditions (`eventAttackerHasKeyword = Repair`) can fail if the attacker only has a dynamically granted keyword in `temporaryEffects`.
- Fix pattern:
  - refresh continuous effects before declaration-time reactive checks
  - keyword detection must include runtime granted keywords (`temporaryEffects.grantedKeywords`)
- Risk: later notifications (`BATTLE_RESOLVED`, `GAME_ENDED`, `PHASE_CHANGED`) can hide attacker context if reactive evaluation uses the latest notification.
- Fix pattern:
  - use exact `attackNotificationId` / `UNIT_ATTACK_DECLARED` notification as event context during attack `PLAYER_ACTION`
- Timing rule:
  - if trigger creates `TARGET_CHOICE`, attack must pause before battle/game-end
  - if trigger auto-applies, state-change notification (e.g. `CARD_RESTED`) must be emitted before `BATTLE_RESOLVED` / `GAME_ENDED`

### B) `GD02-005` class (`ATTACK_PHASE` triggered pre-battle rest)
- Confirmed correct flow after attack ordering hardening:
  - linked source condition enforced
  - `hp <= 2` and `status = active` target filters enforced
  - single valid target => auto-applied `CARD_RESTED` before `BATTLE_RESOLVED`
  - multiple valid targets => `TARGET_CHOICE` before battle resolution
  - unlinked / no-valid-target => clean no-op

## Review Pattern (recommended)
When auditing "attack effect not working / wrong order" reports:
1. Classify pipeline first (declaration-reactive vs `ATTACK_PHASE`)
2. Verify backend ordering:
   - declaration
   - reactive continuous
   - `ATTACK_PHASE`
   - blocker
   - battle/game-end
3. Check event context source (`attackNotificationId` vs queue tail)
4. Validate both chooser and auto-apply paths
5. Confirm notification ordering before blaming frontend visuals

## Frontend follow-up clue (if backend order is correct)
- If backend `notificationQueue` already shows `CARD_RESTED` before `BATTLE_RESOLVED` but visuals still appear late, inspect frontend animation queue filtering for missing handlers (state-change notifications can be dropped from the animation pipeline if unregistered).

