# Session Handling and Join Flow

## Scope

This document captures the current session and room-join architecture across backend and frontend.

Goals:

1. Host can continue controlling the same seat using a valid session token.
2. Join flow is protected by invite token (joinToken), not by gameId alone.
3. Frontend shows deterministic user-facing dialogs for join/session failures.

## Terms

1. `sessionToken`
- Per-player auth token used for protected game APIs.
- Validated by backend middleware (`requirePlayerSession`).

2. `joinToken`
- Invite token for joining room seat2.
- Required by `POST /api/game/player/joinRoom`.

## Backend logic

### Token storage and validation

Implemented in `src/services/SessionManager.ts`:

1. Session APIs:
- `createSession(gameId, playerId)`
- `validateSession(token)`
- `touchSession(token)`
- `invalidateSession(token)`

2. Join token APIs:
- `createJoinToken(gameId, seat)`
- `validateJoinToken(gameId, token)`
- `consumeJoinToken(gameId, token)`
- `invalidateJoinTokensForGame(gameId)`

### Error codes

Declared in `src/constants/ErrorCodes.ts`:

1. `SESSION_MISSING`
2. `SESSION_EXPIRED`
3. `SESSION_MISMATCH`
4. `JOIN_TOKEN_REQUIRED`
5. `JOIN_TOKEN_INVALID`
6. `JOIN_TOKEN_EXPIRED`
7. `ROOM_FULL`
8. `MATCH_ALREADY_STARTED`
9. `ROOM_NOT_FOUND`
10. `SEAT_SWITCH_DISABLED`
11. `INTERNAL_ERROR`

All structured errors follow:

```json
{
  "errorCode": "SOME_CODE",
  "error": "Human readable message",
  "timestamp": "ISO timestamp",
  "context": "optional endpoint context"
}
```

### Start game

Endpoint: `POST /api/game/player/startGame`

Behavior:

1. Create game and host session token.
2. For non-AI flow, generate `joinToken` for seat2 and return it.
3. For AI flow, `joinToken` remains `null` (no human join seat).

### Join room

Endpoint: `POST /api/game/player/joinRoom`

Required body:

```json
{
  "gameId": "string",
  "joinToken": "string"
}
```

Validation and status mapping:

1. Missing token:
- HTTP 400, `JOIN_TOKEN_REQUIRED`

2. Invalid token or wrong seat:
- HTTP 403, `JOIN_TOKEN_INVALID`

3. Expired token:
- HTTP 403, `JOIN_TOKEN_EXPIRED`

4. Room not found:
- HTTP 404, `ROOM_NOT_FOUND`

5. Room full:
- HTTP 409, `ROOM_FULL`

6. Match already started / room not joinable:
- HTTP 409, `MATCH_ALREADY_STARTED`

On success:

1. Create join player session token.
2. Consume join token.
3. Invalidate remaining join tokens for that game.

### Session auth middleware

Middleware: `src/middleware/sessionAuth.ts`

Rules:

1. Missing auth token -> `SESSION_MISSING` (401)
2. Invalid/expired session -> `SESSION_EXPIRED` (401)
3. Token does not match requested game/player -> `SESSION_MISMATCH` (403)
4. On success, request body/query/params `gameId` and `playerId` are normalized to session owner values.

### Test seat session endpoint

Route: `POST /api/game/test/resolveSeatSession`

If disabled by env flag, returns:

1. HTTP 403
2. `SEAT_SWITCH_DISABLED`

## Frontend logic

### Join/session parameter parsing

Implemented in `src/phaser/game/SessionParams.ts`.

Parsed fields:

1. `mode`
2. `gameId`
3. `joinToken`
4. `player`
5. `hasPlayerOverride`
6. `allowSeatSessionFallback`
7. `playerName`
8. `isAutoPolling`
9. `aiMode`

### Join token propagation

Flow chain:

1. `SessionController`
2. `runJoinFlow`
3. `MatchStateMachine.joinRoom(gameId, joinToken)`
4. `GameSessionService.joinRoom(gameId, joinToken)`
5. `ApiManager.joinRoom(gameId, joinToken)`

### Fallback seat-session policy

`runJoinFlow` only uses `resolveSeatSession` fallback when both are true:

1. `hasPlayerOverride == true`
2. `allowSeatSessionFallback == true`

This avoids accidental bypass in normal shared links.

### Session init error mapping

Implemented in `src/phaser/controllers/SessionErrorMapper.ts`.

Maps backend `errorCode` (or legacy message heuristic) into:

1. `headerText`
2. `message`
3. `actions[]`
4. `allowOfflineFallback`

Dialog wiring:

1. `SessionController` calls `onSessionInitError(spec)` for user-fixable 4xx errors.
2. `BoardScene` renders dialog via `ErrorDialog`.
3. Action mapping is centralized in `src/phaser/controllers/SessionInitDialogActions.ts`.

Network/5xx behavior:

1. Dialog header: `Connection Problem`
2. `allowOfflineFallback = true`
3. Session controller continues to existing offline fallback path.

### Lobby and debug join behavior

1. Lobby room rows carry backend `joinToken`; `Join` is one-click and uses that token automatically.
2. Rooms without joinToken are shown as locked in lobby UI.
3. Debug test join uses context `joinToken` first; prompts if missing.

## Dialog mapping (source of truth)

1. `SESSION_MISSING`, `SESSION_EXPIRED`, `SESSION_MISMATCH`
- Header: `Can't Reconnect Session`
- Message: `Your saved game session is no longer valid on this browser.`
- Actions: `Go Lobby`, `Create New Room`

2. `JOIN_TOKEN_REQUIRED`, `JOIN_TOKEN_INVALID`, `JOIN_TOKEN_EXPIRED`
- Header: `Invalid Invite Link`
- Message: `This join link is missing or has an invalid invite token.`
- Actions: `Go Lobby`

3. `ROOM_FULL`
- Header: `Room Already Full`
- Message: `Two players are already in this room.`
- Actions: `Go Lobby`

4. `MATCH_ALREADY_STARTED`
- Header: `Match Already Started`
- Message: `This room is locked because the match is already in progress.`
- Actions: `Go Lobby`

5. `SEAT_SWITCH_DISABLED`
- Header: `Seat Switch Blocked`
- Message: `Seat override links are disabled for normal games.`
- Actions: `Go Lobby`

6. `ROOM_NOT_FOUND`
- Header: `Room Not Found`
- Message: `This room no longer exists or has expired.`
- Actions: `Go Lobby`

7. network/5xx/unreachable
- Header: `Connection Problem`
- Message: `Couldn't reach the game server.`
- Actions: `Retry`, `Go Lobby`
- `allowOfflineFallback = true`

## Regression checklist

1. Host create room returns `joinToken`.
2. Join without token fails with `JOIN_TOKEN_REQUIRED`.
3. Invalid token fails with `JOIN_TOKEN_INVALID`.
4. Expired token fails with `JOIN_TOKEN_EXPIRED`.
5. Full room fails with `ROOM_FULL`.
6. Started room fails with `MATCH_ALREADY_STARTED`.
7. Session auth failures include standardized errorCode.
8. Lobby join requires invite token prompt.
9. Session init 4xx errors show dialog instead of silent offline fallback.
10. Network/5xx still uses offline fallback path.
