Frontend Requirements: Burst Choice Notifications (single + grouped)

1) Listen & render

- Poll `gameEnv.notificationQueue` and detect:
  - `type: "BURST_EFFECT_CHOICE"` (single)
  - `type: "BURST_EFFECT_CHOICE_GROUP"` (grouped; multiple burst choices triggered by one source event, e.g. Suppression attacking 2 shields)

2) Single burst choice

- Use `event.id` (notification id) as `eventId` for confirmation.
- Render UI from `event.payload.event.data.availableTargets` (and any snapshot data in `event.payload.event.data`).
- `event.payload.event.data.burstSource` provides a compact summary of the card that triggered burst (name/cardId/carduid/etc.) for quick UI display.
- Confirm via:
  - `POST /api/game/player/confirmBurstChoice`
  - Body: `{ gameId, playerId, eventId, confirmed }`

3) Grouped burst choices (new)

- Render the list from `event.payload.events[]` (each entry is a normal `BURST_EFFECT_CHOICE` processing event object).
- Each `event.payload.events[i].data.burstSource` contains the burst card summary for that entry.
- `event.payload.resolvedEventIds[]` accumulates confirmed burst eventIds; `event.payload.isCompleted` is true when all entries are resolved.
- For confirmation, use `event.payload.events[i].id` as `eventId` (NOT the notification id).
- Frontend may let the player pick the resolution order by choosing which `events[i]` to confirm first; backend will process the confirmed burst choice next.

4) Resolution notifications

- Backend still emits `BURST_EFFECT_CHOICE_RESOLVED` per resolved burst choice (id: `${eventId}_resolved`).
- After each confirm, rely on the next poll to reflect updated `processingQueue` / board state.
- BURST choice notifications do not expire; call `/player/acknowledgeEvents` with the notification `id` (or the group id) when your UI is done with it.
