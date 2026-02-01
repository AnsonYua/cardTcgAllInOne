In shield area, if player has no shield cards and opponent attacks shield area, allow the attack, then after battle
resolves (and damage is applied), if the attack succeeds, the attacker wins.

Backend state updates:
- Set `gameEnv.gameEnded = true`
- Set `gameEnv.winnerId = attacker playerId`
- Set `gameEnv.endReason = "no_shields_remaining"`
- Set `gameEnv.endedAt = <timestamp>`
- Emit a persistent `GAME_ENDED` notification (never expires until acknowledged):
  - `type: "GAME_ENDED"`
  - `metadata.requiresAcknowledgment: true`
  - `metadata.expiresAt: 9007199254740991`
  - payload:
      - `winnerId: string`
      - `loserId: string | null` (opponent of winner, if available)
      - `reason: string`
      - `endedAt: number` (ms timestamp)
      - `timestamp: number` (ms timestamp, same as endedAt)
- Invoke `gameEnv.gameEndCallback` if provided (placeholder for future win logic)

Frontend handling:
- `winnerId` is a playerId (e.g. `playerId_1` / `playerId_2`), map to display name.
- On `GAME_ENDED` or `gameEnv.gameEnded === true && gameEnv.winnerId is set`, disable all actions and show a game-over modal.
- If `BATTLE_RESOLVED.result.gameEnded === true`, show the game-over UI immediately even if `GAME_ENDED` arrives later.
- After showing the game-over UI, acknowledge the `GAME_ENDED` notification id via `/player/acknowledgeEvents` (so it is removed from `notificationQueue`).


  - Trigger: After resolving a shield attack, backend may emit GAME_ENDED with reason no_shields_remaining.
  - Notification handling:
      - Listen for type === "GAME_ENDED" in notificationQueue.
      - When received, set local UI state gameEnded = true, store winnerId, endReason, endedAt.
      - `winnerId` is a playerId (e.g. `playerId_1` / `playerId_2`), map to display name.
  - UI behavior when gameEnded:
      - Disable all inputs (hand clicks, action buttons, attack buttons).
      - Stop auto-advance timers or polling that would trigger new actions.
      - Show a Game Over modal/banner with:
          - For Winner show you win the game  dialog, and click there is is ok button go back to lobby
          - For Winner show you lost the game  dialog, and click there is is ok button go back to lobby. make the ui same as other dialog
  - Battle UI:
      - If BATTLE_RESOLVED.result.gameEnded === true, immediately show the Game Over modal even if GAME_ENDED arrives slightly later (use
        whichever comes first).
  - State rendering:
      - Always prioritize gameEnv.gameEnded === true if present, even if currentBattle is still set.
