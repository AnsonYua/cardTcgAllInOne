# Revolution and Rebellion - TCG Backend API

This document describes the REST API endpoints for the Revolution and Rebellion trading card game backend. For a complete overview of the project architecture, data models, and setup instructions, please see the main [README.md](../../README.md) in the root directory.

## Base URL
```
http://localhost:3001/api/game
```

## Main Endpoints

- `POST /player/startGame`: Initializes a new game session.
- `POST /player/joinRoom`: Allows a second player to join an existing game.
- `POST /player/startReady`: Marks a player as ready to start the game.
- `POST /player/playerAction`: Processes a player's game action (e.g., playing a card).
- `POST /player/selectCard`: Completes a pending card selection triggered by a card effect.
- `GET /player/:playerId?gameId=<gameId>`: Retrieves the current game state for a specific player.

For detailed information on the request and response formats, please refer to the main [README.md](../../README.md).

## Play Sequence Tracking (January 2025)

The API now includes enhanced play sequence tracking with card selection information:

### Play Sequence Structure

All game actions are recorded in `gameEnv.playSequence.plays` with detailed information:

```javascript
{
  sequenceId: 5,
  playerId: "playerId_2",
  cardId: "h-2", 
  action: "APPLY_SET_POWER",
  zone: "effect",
  data: {
    selectionId: "playerId_2_setPower_123",
    selectedCardIds: ["c-1"],
    targetPlayerId: "playerId_1",
    effectType: "setPower",
    powerValue: 0,
    sourceCard: "h-2"
  },
  timestamp: "2025-01-01T10:05:00Z",
  turnNumber: 1,
  phaseWhenPlayed: "MAIN_PHASE"
}
```

### Action Types

- `PLAY_LEADER`: Leader card placement during game setup
- `PLAY_CARD`: Regular card placement in zones  
- `APPLY_SET_POWER`: Card selection effect execution for setPower effects
- `APPLY_EFFECT`: Other card effect executions (future enhancement)

### Card Selection Integration

When a card effect requires player selection (like h-2 "Make America Great Again"), the system:

1. Records the initial card play (e.g., h-2 placement)
2. After selection completion, adds an additional `APPLY_SET_POWER` entry
3. The selection entry contains complete target information for replay consistency
4. Both entries are included in the play sequence for complete game history

This ensures that replay simulations have access to all card selection information, maintaining consistency when game states are reconstructed from the play sequence.
