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
