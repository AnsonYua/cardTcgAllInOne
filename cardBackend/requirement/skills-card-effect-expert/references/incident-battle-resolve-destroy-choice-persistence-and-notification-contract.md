# Incident: Battle-Resolve Destroy Choice Persistence + Notification Contract

## Symptom
- During battle-resolve -> destroy flows, player could select a valid discard/target in dialog, but card stayed in hand/zone.
- Confirm endpoint returned:
  - `Target choice event not found`
  - or equivalent missing-choice errors.

## Root Cause
1. Internal choice resolution uses `processingQueue` event lookup by `eventId` in confirm endpoints.
2. Persistence path saved client-filtered serialization (`toJSON`) where declared blocking choices were hidden when `BATTLE_RESOLVED` was present.
3. Reloaded game state lost unresolved choice events, so confirm lookup failed.
4. Some frontend choice flows swallowed submit errors and cleared/closed UI, creating false-success UX.

## Fixed Contract
- Frontend:
  - choice/dialog source of truth is `notificationQueue` only.
  - never depend on `processingQueue` for dialog availability or ownership.
- Backend:
  - persistence uses `toPersistenceJSON()` (full internal `processingQueue` retained).
  - client/player view may sanitize `processingQueue`, but actionable choice data must remain in `notificationQueue`.
- Notification durability:
  - all interactive choices should be persistent until explicit acknowledge:
    - `TARGET_CHOICE`
    - `BLOCKER_CHOICE`
    - `BURST_EFFECT_CHOICE`
    - token/option/prompt choices.
- Submit failure UX:
  - on confirm API error, keep dialog active and retryable; do not clear/close as success.

## Required Regression Checks
1. Save/load with `BATTLE_RESOLVED` + unresolved `TARGET_CHOICE`:
  - reloaded `processingQueue` still contains the choice event id.
2. Confirm after reload:
  - confirm endpoint finds event and resolves successfully.
3. Player view contract:
  - `notificationQueue` contains actionable choice payload.
  - `processingQueue` can be sanitized without breaking frontend choice flow.
4. Choice-notification consistency:
  - every unresolved choice notification id maps to a live processing choice event id after persistence round-trip.
5. Failure-path UX:
  - forced 400/validation error keeps burst/blocker/target dialogs open for retry.

## Card-Effect Review Focus for This Class
- Prioritize `DESTROYED` and `BATTLE_DESTROY` effects that enqueue choice semantics (direct or sequence step).
- Verify choice-creating steps preserve:
  - stable `event.id`
  - notification payload `event.id` parity
  - persistence across API round-trips.
