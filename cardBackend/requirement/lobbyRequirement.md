# Lobby Requirement

## Purpose

Provide a lobby list of joinable rooms and allow one-click join from frontend without manual token entry.

## Backend Requirements

### 1. Room persistence

File: `src/gameData/rooms.json`

Room schema:

```json
{
  "gameId": "string",
  "createdAt": "ISO string",
  "joinToken": "string | null"
}
```

Rules:

1. `startGame` (non-AI flow) must create seat2 `joinToken`.
2. Room record must be written with `joinToken`.
3. AI host flow should not create a joinable room entry for human join.

### 2. Lobby list API

Endpoint: `GET /api/game/lobbylist`

Response:

```json
{
  "success": true,
  "rooms": [
    {
      "gameId": "string",
      "createdAt": "ISO string",
      "joinToken": "string | null"
    }
  ],
  "timestamp": "ISO string"
}
```

Behavior:

1. Prune expired/invalid rooms before returning list.
2. Sort by `createdAt` descending (newest first).
3. Return only rooms still present in valid game files.

### 3. Expiry policy

Current policy:

1. Solo room expiry uses `LOBBY_SOLO_EXPIRY_MS` (default 60s).
2. Active room expiry uses `LOBBY_ACTIVE_EXPIRY_MS` (default 30min) based on game file update time.

## Join Security Requirements

1. `POST /api/game/player/joinRoom` must require:
- `gameId`
- `joinToken`

2. `gameId` alone is never sufficient to join.

3. Join token outcomes:
- missing -> `JOIN_TOKEN_REQUIRED`
- invalid -> `JOIN_TOKEN_INVALID`
- expired -> `JOIN_TOKEN_EXPIRED`

4. After successful join:
- consume join token
- invalidate remaining join tokens for same game

## Frontend Requirements

### 1. Lobby list rendering

1. Poll `/api/game/lobbylist` periodically.
2. Display room items sorted by newest first.
3. Join button state:
- `joinToken` exists -> enabled (`Join`)
- `joinToken` missing/null -> disabled (`Locked`)

### 2. Join action

On room click:

1. Build URL `/game?mode=join&gameId=<id>&joinToken=<token>&isAutoPolling=true&automation=1`
2. Redirect directly.
3. No manual `prompt()` token entry in lobby flow.

### 3. Error UX

If backend rejects join, session-init dialog mapping handles user-facing message:

1. invalid/missing token -> `Invalid Invite Link`
2. room full -> `Room Already Full`
3. match started -> `Match Already Started`
4. room missing -> `Room Not Found`

## Compatibility Notes

1. Old `rooms.json` records created before `joinToken` support may have null token.
2. Those legacy rows should appear as `Locked` in lobby until they expire.
3. Host share link and debug tools can still expose tokenized join links for manual sharing.

## QA Checklist

1. Create room in normal host flow -> lobby row includes `joinToken`.
2. Click `Join` in lobby -> no prompt, joins successfully.
3. Tamper/remove token -> backend rejects with token error.
4. Legacy room with null token -> UI shows `Locked`.
5. Expired room -> removed from lobby list on next poll.
