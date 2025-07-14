# Revolution and Rebellion TCG

This repository contains the full-stack implementation of the "Revolution and Rebellion" strategic trading card game. It includes a Node.js/Express backend that manages game logic and a Phaser 3 frontend for client-side gameplay.

## Repository Structure

This project is a monorepo containing two main applications:

```
/
├── cardBackend/     # Node.js API server and game logic
└── cardFrontend/    # Phaser 3 web client
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm

### 1. Backend Setup

The backend server handles all game logic, state management, and API requests.

```bash
# Navigate to the backend directory
cd cardBackend

# Install dependencies
npm install

# Run the development server (with hot-reloading)
npm run dev
```
The backend API will be running at `http://localhost:3001`.

### 2. Frontend Setup

The frontend is a Phaser 3 game that runs in the browser and communicates with the backend.

```bash
# Navigate to the frontend directory
cd cardFrontend

# Install dependencies
npm install

# Run the development server
npm run dev
```
The game will be accessible at `http://localhost:3000`.

## Core Architecture

### Backend
- **Framework**: Node.js with Express.js.
- **Game Logic**: The core game mechanics are managed by modules in `src/mozGame/`, which handle phases, player actions, and card effects.
- **State Management**: Game state is persisted as JSON files in `src/gameData/`. This file-based approach ensures that games are not lost if the server restarts.
- **API**: A RESTful API provides endpoints for the frontend to create games, perform actions, and poll for state updates.

### Frontend
- **Framework**: Phaser 3.
- **Scene Management**: The game is divided into multiple Phaser scenes (`MenuScene`, `GameScene`, `BattleResultScene`, etc.) to manage different parts of the game flow.
- **State Synchronization**: The `GameStateManager` polls the backend API every second for the latest `gameEnv`.
- **API Communication**: The `APIManager` handles all HTTP requests to the backend.

## Game Flow

### Game Start Sequence
The game follows a specific sequence when starting:

1. **Game Creation**: Player 1 calls `POST /player/startGame` to create a new game room
2. **Player Join**: Player 2 calls `POST /player/joinRoom` to join the game room
3. **Player Ready**: Both players call `POST /player/startReady` with optional redraw parameter
   - Players receive 7 cards initially
   - Can choose to redraw their hand once
4. **Draw Phase**: First turn player automatically draws 1 card (total: 8 cards)
5. **Main Phase**: Game enters main phase for card placement

### Turn Flow
Each player's turn follows this sequence:

1. **Draw Phase**: Current player draws 1 card from deck
2. **Draw Acknowledgment**: Player must acknowledge the draw to proceed
3. **Main Phase**: Player places cards from hand to zones
4. **End Turn**: Turn switches to next player
5. **Repeat**: Next player enters Draw Phase

### Phase Types
- **DRAW_PHASE**: Player draws a card and must acknowledge
- **MAIN_PHASE**: Player places cards in zones (TOP/LEFT/RIGHT/HELP/SP)
- **SP_PHASE**: Special Power cards are revealed and executed
- **BATTLE_PHASE**: Power calculation and winner determination
- **END_PHASE**: Cleanup and next round preparation

### Event System
The game uses a comprehensive event system for real-time updates:

- **DRAW_PHASE_COMPLETE**: Triggered when a player draws a card
- **PHASE_CHANGE**: Triggered when game phase changes
- **TURN_SWITCH**: Triggered when turn changes to next player
- **CARD_PLAYED**: Triggered when a card is placed in a zone

Events require acknowledgment via `POST /player/acknowledgeEvents` to maintain synchronization.

## API Data Model

The backend provides a clean, non-redundant data structure to the frontend. The primary endpoint for fetching game state is `GET /api/game/player/:playerId?gameId=<gameId>`.

### Clean `gameEnv` Structure

The `gameEnv` object is the single source of truth for the game's state, with a clear separation of data. Redundant top-level player objects have been removed to avoid confusion.

**Example API Response:**
```json
{
  "gameId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "gameEnv": {
    "roomStatus": "MAIN_PHASE",
    "phase": "MAIN_PHASE",
    "currentPlayer": "playerId_1",
    "currentTurn": 1,
    "round": 1,
    "gameStarted": true,
    "firstPlayer": "playerId_1",
    
    "players": {
      "playerId_1": {
        "id": "playerId_1",
        "name": "Player One",
        "hand": ["c-1", "h-1", "c-5"],
        "deck": {
          "mainDeck": ["c-2", "c-3", "..."],
          "leader": ["s-1", "s-2", "..."],
          "currentLeaderIdx": 0
        },
        "isReady": true,
        "redraw": 0,
        "turnAction": []
      },
      "playerId_2": {
        "id": "playerId_2",
        "name": "Player Two",
        "hand": ["c-10", "h-5", "c-12"],
        "deck": {
          "mainDeck": ["c-11", "c-14", "..."],
          "leader": ["s-5", "s-6", "..."],
          "currentLeaderIdx": 0
        },
        "isReady": true,
        "redraw": 0,
        "turnAction": []
      }
    },
    
    "zones": {
      "playerId_1": {
        "leader": { "id": "s-1", "name": "Leader One", "..." },
        "TOP": [],
        "LEFT": [],
        "RIGHT": [],
        "HELP": [],
        "SP": []
      },
      "playerId_2": {
        "leader": { "id": "s-5", "name": "Leader Five", "..." },
        "TOP": [],
        "LEFT": [],
        "RIGHT": [],
        "HELP": [],
        "SP": []
      }
    },
    
    "victoryPoints": {
      "playerId_1": 0,
      "playerId_2": 0
    },
    
    "gameEvents": [
      {
        "id": "event_12345_1",
        "type": "TURN_SWITCH",
        "data": { "newPlayer": "playerId_1" },
        "..."
      }
    ],

    "pendingPlayerAction": null,
    "pendingCardSelections": {}
  },
  "lastUpdate": "2025-07-14T10:00:00.000Z"
}
```
This structure ensures that all player-specific data is nested under the `players`, `zones`, and `victoryPoints` objects, keyed by player ID, providing a clear and maintainable data model for the frontend.