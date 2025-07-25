# Backend API Structure - Frontend Integration Guide

## Overview

This document defines the standardized API response structure for the Revolution and Rebellion card game, ensuring seamless frontend-backend communication.

## Core Principles

1. **Consistent Data Access**: All player data accessible through standardized paths
2. **Centralized State**: Related data grouped logically (players, zones, points)
3. **Frontend-Friendly**: Structure matches frontend GameStateManager expectations
4. **Event-Driven**: Comprehensive event system for real-time updates
5. **Backward Compatible**: Maintains existing functionality while improving structure

## API Response Structure

### Main Polling Endpoint: `GET /player/:playerId?gameId=X`

**Response Format:**
```json
{
  "success": true,
  "gameId": "uuid-string",
  "playerId": "playerId_1",
  "gameEnv": {
    // Game Status
    "phase": "MAIN_PHASE",  // Current game phase
    "currentPlayer": "playerId_1", 
    "currentTurn": 1,
    "round": 1,
    "gameStarted": true,
    "firstPlayer": "playerId_1",
    
    // Centralized Player Data
    "players": {
      "playerId_1": {
        "id": "playerId_1",
        "name": "Player 1",
        "hand": [
          {
            "id": "c-1",
            "name": "總統特朗普",
            "cardType": "character",
            "gameType": "愛國者",
            "power": 100,
            "traits": ["特朗普家族"]
          }
        ],
        "deck": {
          "mainDeck": ["c-2", "c-3"],
          "leader": ["s-1", "s-2"],
          "currentLeaderIdx": 0
        },
        "isReady": true,
        "redraw": 1
      },
      "playerId_2": {
        "id": "playerId_2", 
        "name": "Player 2",
        "hand": [],
        "deck": {
          "mainDeck": ["c-4", "c-5"],
          "leader": ["s-3", "s-4"], 
          "currentLeaderIdx": 0
        },
        "isReady": true,
        "redraw": 0
      }
    },
    
    // Game Zones - Card Placement Areas
    "zones": {
      "playerId_1": {
        "leader": {
          "id": "s-1",
          "name": "特朗普",
          "cardType": "leader",
          "gameType": "右翼",
          "initialPoint": 110,
          "zoneCompatibility": {
            "TOP": ["愛國者", "右翼"],
            "LEFT": ["右翼"],
            "RIGHT": ["愛國者"]
          }
        },
        "TOP": [],
        "LEFT": [],
        "RIGHT": [],
        "HELP": [],
        "SP": []
      },
      "playerId_2": {
        "leader": null,
        "TOP": [],
        "LEFT": [],
        "RIGHT": [],
        "HELP": [],
        "SP": []
      }
    },
    
    // Victory Points Tracking
    "victoryPoints": {
      "playerId_1": 15,
      "playerId_2": 10
    },
    
    // Card Selection Workflows
    "pendingPlayerAction": null,
    "pendingCardSelections": {},
    
    // Real-time Events
    "gameEvents": [
      {
        "id": 1,
        "type": "CARD_PLAYED",
        "playerId": "playerId_1",
        "data": {
          "cardId": "c-1",
          "zone": "TOP",
          "timestamp": "2025-01-14T10:30:00Z"
        },
        "frontendProcessed": false
      }
    ],
    "lastEventId": 1
  },
  "timestamp": "2025-01-14T10:30:00Z"
}
```

## Key Data Structures

### Player Object Structure
```json
{
  "id": "playerId_1",
  "name": "Player Name",
  "hand": [/* full card objects */],
  "deck": {
    "mainDeck": [/* card IDs */],
    "leader": [/* leader card IDs */],
    "currentLeaderIdx": 0
  },
  "isReady": true,
  "redraw": 1
}
```

### Zone Object Structure
```json
{
  "leader": {/* current leader card object or null */},
  "TOP": [/* character cards */],
  "LEFT": [/* character cards */], 
  "RIGHT": [/* character cards */],
  "HELP": [/* help cards */],
  "SP": [/* special power cards */]
}
```

### Game Event Structure
```json
{
  "id": 1,
  "type": "EVENT_TYPE",
  "playerId": "playerId_1",
  "data": {/* event-specific data */},
  "timestamp": "ISO-8601",
  "frontendProcessed": false
}
```

## Event Types

### Core Game Events
- `GAME_CREATED` - Game initialization
- `PLAYER_JOINED` - Player joins game
- `PLAYER_READY` - Player ready status change
- `GAME_STARTED` - Game begins
- `PHASE_CHANGED` - Game phase transition
- `TURN_CHANGED` - Turn switches between players

### Card Events  
- `CARD_PLAYED` - Card placed in zone
- `CARD_REMOVED` - Card removed from zone
- `HAND_UPDATED` - Player hand changes
- `LEADER_SELECTED` - Leader card chosen
- `CARD_FACE_TOGGLED` - Card flipped face up/down

### Battle Events
- `BATTLE_STARTED` - Battle phase begins
- `POWER_CALCULATED` - Zone power calculations
- `COMBO_TRIGGERED` - Card combination bonus
- `BATTLE_RESULT` - Battle winner determined
- `VICTORY_POINTS_UPDATED` - VP changes

### Round Events
- `ROUND_STARTED` - New round begins  
- `ROUND_ENDED` - Round completion
- `GAME_ENDED` - Game completion

## Frontend Integration Requirements

### GameStateManager Methods

The frontend GameStateManager expects these data access patterns:

```javascript
// Player Data Access
getPlayer(playerId = null) {
  const id = playerId || this.gameState.playerId;
  return this.gameState.gameEnv.players[id];
}

getOpponent() {
  const players = Object.keys(this.gameState.gameEnv.players);
  return players.find(id => id !== this.gameState.playerId);
}

// Zone Data Access  
getPlayerZones(playerId = null) {
  const id = playerId || this.gameState.playerId;
  return this.gameState.gameEnv.zones[id] || {};
}

// Victory Points
getVictoryPoints(playerId = null) {
  const id = playerId || this.gameState.playerId;  
  return this.gameState.gameEnv.victoryPoints[id] || 0;
}

// Hand Data
getPlayerHand(playerId = null) {
  const player = this.getPlayer(playerId);
  return player ? player.deck.hand : [];
}
```

### Critical Frontend Requirements

1. **Opponent Detection**: `getOpponent()` must find valid opponent ID
2. **Hand Access**: Player hands must be arrays of full card objects
3. **Zone Access**: Zones must be accessible by playerId key
4. **Victory Points**: Centralized VP tracking by playerId
5. **Event Processing**: Events must be processable and acknowledgeable

## Backend Implementation

### Transform Layer (GameLogic.js)

```javascript
transformGameStateForFrontend(game) {
  const gameEnv = { ...game.gameEnv };
  const playerIds = getPlayerFromGameEnv(gameEnv);
  
  // Create structured players object
  const players = {};
  const zones = {};
  const victoryPoints = {};
  
  playerIds.forEach(playerId => {
    if (gameEnv[playerId]) {
      // Extract and restructure player data
      players[playerId] = {
        id: playerId,
        name: gameEnv[playerId].name || playerId,
        hand: gameEnv[playerId].deck?.hand || [],
        deck: {
          mainDeck: gameEnv[playerId].deck?.mainDeck || [],
          leader: gameEnv[playerId].deck?.leader || [],
          currentLeaderIdx: gameEnv[playerId].deck?.currentLeaderIdx || 0
        },
        isReady: gameEnv.playersReady?.[playerId] || false,
        redraw: gameEnv[playerId].redraw || 0
      };
      
      // Extract zone data
      zones[playerId] = {
        leader: gameEnv[playerId].Field?.leader || null,
        TOP: gameEnv[playerId].Field?.top || [],
        LEFT: gameEnv[playerId].Field?.left || [],
        RIGHT: gameEnv[playerId].Field?.right || [],
        HELP: gameEnv[playerId].Field?.help || [],
        SP: gameEnv[playerId].Field?.sp || []
      };
      
      // Extract victory points
      victoryPoints[playerId] = gameEnv[playerId].playerPoint || 0;
    }
  });
  
  // Add structured data to gameEnv
  gameEnv.players = players;
  gameEnv.zones = zones; 
  gameEnv.victoryPoints = victoryPoints;
  
  return { ...game, gameEnv };
}
```

## Implementation Status

### ✅ Phase 1: Backend Updates - COMPLETED
1. ✅ Updated `transformGameStateForFrontend()` in GameLogic.js
2. ✅ Enhanced structured data extraction (players, zones, victoryPoints)
3. ✅ Maintained backward compatibility with existing structure
4. ✅ Added proper null handling and default values

### 🔄 Phase 2: Frontend Integration - IN PROGRESS  
1. ✅ GameStateManager methods compatible with new structure
2. ✅ Updated opponent detection logic
3. ✅ Enhanced null checking for player/opponent data access
4. 🔄 Testing integration with backend API

### ⏳ Phase 3: Testing - PENDING
1. ⏳ Test online multiplayer scenarios with new API structure
2. ⏳ Verify all UI components update correctly
3. ⏳ Test error scenarios and edge cases
4. ⏳ Validate event processing workflow

## Error Handling

### API Error Responses
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CARD_PLACEMENT",
    "message": "Card cannot be placed in this zone",
    "details": {
      "cardId": "c-1",
      "zone": "TOP",
      "reason": "Zone compatibility mismatch"
    }
  }
}
```

### Event Error Handling
```json
{
  "id": 2,
  "type": "ERROR",
  "playerId": "playerId_1", 
  "data": {
    "errorCode": "INVALID_ACTION",
    "message": "Action not allowed in current phase",
    "originalAction": "PLAY_CARD"
  }
}
```

## Performance Considerations

1. **Data Size**: Keep hand arrays reasonable (max 20 cards)
2. **Event Cleanup**: Auto-remove processed events after 3 seconds
3. **Polling Frequency**: 1-second intervals for real-time feel
4. **Caching**: Frontend should cache card definitions locally

## Next Steps

1. ✅ **Backend Transform Layer**: Updated GameLogic.js with structured data extraction
2. 🔄 **Frontend Integration**: Test new API structure with real backend
3. ⏳ **Event Enhancement**: Implement additional event types as needed  
4. ⏳ **Documentation**: Update API documentation based on testing results
5. ⏳ **Testing**: Comprehensive integration testing with online multiplayer

## Phase Field Consolidation (January 2025)

### Issue Resolution
Previously, both `roomStatus` and `phase` fields existed to track the same information, causing confusion and potential sync issues where the phase indicator could show stale values.

### Solution Implemented
1. **Single Field**: Consolidated to use only `phase` field for game state tracking
2. **Backend Cleanup**: Removed all `roomStatus` references throughout the backend
3. **Frontend Update**: Updated frontend to use only `phase` field
4. **Utility Function**: Added `updatePhase()` helper for consistent phase updates

### Simplified Structure
- **`phase`**: Single source of truth for current game state
- **Values**: `WAITING_FOR_PLAYERS`, `BOTH_JOINED`, `READY_PHASE`, `DRAW_PHASE`, `MAIN_PHASE`, `SP_PHASE`, `BATTLE_PHASE`, etc.
- **No Duplication**: Eliminated redundant field and potential sync issues

## Summary of Changes Made

### Backend Changes (`cardBackend/src/services/GameLogic.js`)
- **Field Consolidation**: Removed all `roomStatus` references, use only `phase`
- **Utility Function**: Added `updatePhase()` helper for consistent phase updates
- **Game Creation**: Updated initial game state to use `phase` field
- **State Transitions**: All phase changes now use single `phase` field
- **Frontend Transform**: Removed `roomStatus` from API responses
- Enhanced `transformGameStateForFrontend()` function
- Added structured `players`, `zones`, and `victoryPoints` objects
- Improved null handling and default values

### Frontend Changes  
- **Single Field Usage**: Updated all code to use only `phase` field
- **Phase Detection**: Simplified phase indicator logic
- **State Checks**: Updated all phase-based conditions to use `gameEnv.phase`
- Enhanced phase indicator to handle all game states properly
- Updated null checking in GameStateManager for robust data access
- Enhanced opponent detection reliability 
- Improved error handling for missing player/hand data

### API Structure Improvements
- **Centralized Player Data**: All player info accessible via `gameEnv.players[playerId]`
- **Zone Organization**: Game zones accessible via `gameEnv.zones[playerId]`
- **Victory Point Tracking**: Centralized VP access via `gameEnv.victoryPoints[playerId]`
- **Frontend Compatibility**: Structure matches GameStateManager expectations

This structure ensures robust frontend-backend communication, resolves the `getOpponent()` null issue, and provides a solid foundation for future enhancements while maintaining full backward compatibility with existing game functionality.