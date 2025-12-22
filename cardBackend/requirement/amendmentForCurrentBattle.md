Help me update `gameEnv.currentBattle`.

Existing structure:

```
{
    "actionType": "attackUnit",
    "attackingPlayerId": "playerId_2",
    "defendingPlayerId": "playerId_1",
    "pendingEvent": { ... },
    "attackerCarduid": "ST01-005_b35d1d0f-72ae-4388-8808-7656341c25bd",
    "targetCarduid": "ST01-006_ba54a530-2fcc-4b9d-adb5-b9b89e152578",
    "targetPlayerId": "playerId_1",
    "status": "ACTION_STEP",
    "fromBurst": false,
    "openedAt": 1766418230777,
    "confirmations": {
        "playerId_2": false,
        "playerId_1": false
    }
}
```

Requirements / amendments:

1. Remove `pendingEvent` entirely. Frontend already relies on `currentBattle.confirmations` and the processingQueue to know when a new action is required.
2. Add `forcedTarget` (same semantics as the notificationQueue payload: `{ carduid, zone, playerId }`). When a blocker redirects the attack we will populate `forcedTarget` so the frontend can summarise the battle using the forced target instead of `targetCarduid`.
3. Add `actionTargets.{playerId}` where each entry lists cards (hand, base, pilot, unit only) that contain an `effect.rules[].timing.windows` entry for `"ACTION_STEP"`. The UI will use this list to decide which cards stay clickable during the action window.
4. add one more logic, if actionTargets.{playerId} = empty , currentBattle.confirmations = true as user have nothing to action.