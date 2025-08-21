# Game Controller API Documentation

This document provides detailed analysis of the core game controller functions, their logic flows, and operational details.

## Overview

The GameController class (`src/controllers/gameController.ts`) serves as the primary HTTP API interface for the "Revolution and Rebellion" card game backend. It handles all client-server interactions and delegates business logic to the GameLogic service layer.

## Core Functions Analysis

### 1. startGame() - Game Creation Endpoint

**Endpoint:** `POST /api/game/start`  
**Purpose:** Initialize a new game instance for a player

#### Logic Flow:
1. **Input Validation**
   - Validates `playerId` is provided in request body
   - Returns 400 error if validation fails

2. **Game Creation**
   - Calls `gameLogic.createGame(playerId)` to initialize game state
   - Creates unique gameId and initializes game environment

3. **Response Formatting**
   - Extracts `gameId` to root level for API compatibility
   - Returns structured response with `success`, `gameId`, and `gameEnv`

4. **Error Handling**
   - Comprehensive error logging with stack traces
   - Development vs production error response formatting
   - Includes timestamp and context for debugging

#### Key Implementation Details:
- Single player starts a game and becomes the first player
- Game state immediately persisted to file system
- Returns complete game environment for frontend initialization
- Error responses include contextual information for debugging

#### Response Structure:
```json
{
  "success": true,
  "gameId": "generated-uuid",
  "gameEnv": {
    // Complete game environment object
  }
}
```

---

### 2. joinRoom() - Game Joining Endpoint

**Endpoint:** `POST /api/game/join`  
**Purpose:** Add second player to an existing game

#### Logic Flow:
1. **Input Validation**
   - Validates both `gameId` and `playerId` are provided
   - Returns 400 error if either parameter missing

2. **Game Join Process**
   - Calls `gameLogic.joinGame(gameId, playerId)` 
   - Adds player to existing game state
   - Triggers game initialization once both players joined

3. **Response Formatting**
   - Maintains same response structure as startGame
   - Includes complete updated game environment

4. **Error Handling**
   - Enhanced logging includes request body for debugging
   - Handles game not found, full game, or other join failures

#### Key Implementation Details:
- Requires existing game to join (created via startGame)
- Automatically progresses game to "BOTH_JOINED" phase when second player joins
- Both players receive identical game state structure
- File-based persistence ensures game survives server restarts

#### Typical Flow:
1. Player 1 calls `startGame()` → game created, waiting for player 2
2. Player 2 calls `joinRoom()` → game moves to "BOTH_JOINED" phase
3. Both players can proceed to ready phase

---

### 3. startReady() - Ready Phase Processing

**Endpoint:** `POST /api/game/ready`  
**Purpose:** Handle player readiness and optional hand redraw

#### Logic Flow:
1. **Input Validation**
   - Validates `gameId` and `playerId` are provided
   - Validates and converts `isRedraw` parameter to boolean

2. **Redraw Logic Processing**
   - Converts various truthy values to boolean (`true`, `'true'` → true)
   - Passes redraw preference to GameLogic layer

3. **Ready State Processing**
   - Calls `gameLogic.startReady(gameId, playerId, wantRedraw)`
   - Handles individual player readiness tracking
   - Processes hand redraw if requested

4. **Game Progression**
   - When both players ready → advances to MAIN_PHASE
   - Triggers initial leader reveals and first player determination

#### Key Implementation Details:
- Each player calls this endpoint independently
- Redraw decision is permanent once submitted
- Game automatically progresses when both players ready
- Leader cards revealed and first player determined randomly
- Initial hands dealt based on redraw preferences

#### Request Body:
```json
{
  "gameId": "game-uuid",
  "playerId": "player-uuid", 
  "isRedraw": true  // optional hand redraw
}
```

---

### 4. playerAction() - Card Play Processing

**Endpoint:** `POST /api/game/action`  
**Purpose:** Process card placement actions during gameplay

#### Logic Flow:
1. **Input Validation**
   - Validates `gameId`, `playerId`, and `action` parameters
   - Ensures action object contains required fields

2. **Action Type Filtering**
   - **Only supports "PlayCard" actions** - all other types rejected
   - This endpoint is specialized for card placement only

3. **PlayCard Validation**
   - Validates `cardUID` - unique identifier for the card
   - Validates `zone` - target placement zone (TOP/LEFT/RIGHT/HELP/SP)
   - Both parameters required, no legacy fallbacks

4. **Card Play Execution**
   - Calls `gameLogic.playCard(gameId, playerId, cardUID, zone, faceDown)`
   - `faceDown` parameter optional (defaults to false)

5. **Response Processing**
   - Returns updated game environment
   - Includes `requiresCardSelection` flag for search effects

#### Key Implementation Details:
- **Modern UID-based system** - no support for legacy index-based card references
- **Zone-based placement** - specific zones must be specified
- **Face-down support** - strategic face-down placement available
- **Search effect handling** - response indicates when card selection required
- **Automatic turn switching** - triggers turn change after successful card play

#### Request Body:
```json
{
  "gameId": "game-uuid",
  "playerId": "player-uuid",
  "action": {
    "type": "PlayCard",
    "cardUID": "card-unique-id",
    "zone": "TOP",  // TOP/LEFT/RIGHT/HELP/SP
    "faceDown": false  // optional
  }
}
```

#### Response Indicators:
- `requiresCardSelection: true` - player must complete card selection workflow
- Game may block further actions until selection completed

---

### 5. selectCard() - Card Selection Processing

**Endpoint:** `POST /api/game/player/selectCard`  
**Purpose:** Process card selection for search effects and special abilities

#### Logic Flow:
1. **Input Validation**
   - Validates `gameId`, `playerId`, `selectionId`, and `selectedCardUIds`
   - Ensures `selectedCardUIds` is an array of card identifiers

2. **Selection Context Processing**
   - `selectionId` links to pending selection in game state
   - `selectedCardUIds` contains array of chosen card unique identifiers

3. **Selection Execution**
   - Calls `gameLogic.selectCard(gameId, playerId, selectionId, selectedCardIdentifiers)`
   - Processes the selection based on the original card effect context

4. **Game State Update**
   - Updates game state based on selection results
   - May trigger additional effects or phase transitions

#### Key Implementation Details:
- **Unified UID system** - uses card unique identifiers throughout
- **Selection context tracking** - selections linked to triggering effects
- **Multiple card support** - can handle single or multiple card selections
- **Effect completion** - completes the card effect that triggered selection
- **Automatic placement** - selected cards placed according to effect rules

#### Typical Selection Scenarios:
1. **Search Effects**: Cards like Edward Coristine search deck, player selects cards
2. **SP Zone Effects**: Selected SP cards placed directly in SP zone
3. **Conditional Effects**: Luke Farritor's conditional Help zone placement

#### Request Body:
```json
{
  "gameId": "game-uuid",
  "playerId": "player-uuid", 
  "selectionId": "selection-uuid",
  "selectedCardUIds": ["card-uid-1", "card-uid-2"]
}
```

---

### 6. acknowledgeEvents() - Event System Management

**Endpoint:** `POST /api/game/player/acknowledgeEvents`  
**Purpose:** Mark frontend events as processed to prevent re-processing

#### Logic Flow:
1. **Input Validation**
   - Validates `gameId` is provided
   - Validates `eventIds` is provided as an array

2. **Event Acknowledgment**
   - Calls `gameLogic.acknowledgeEvents(gameId, eventIds)`
   - Marks specified events as processed in game state

3. **Event Cleanup**
   - Acknowledged events removed from active event queue
   - Prevents memory buildup from unprocessed events

4. **Response Confirmation**
   - Returns count of acknowledged events
   - Confirms successful processing

#### Key Implementation Details:
- **Event System Integration** - part of real-time game state change tracking
- **Memory Management** - prevents event queue buildup
- **Frontend Coordination** - ensures frontend polling system works correctly
- **Batch Processing** - can acknowledge multiple events in single call

#### Event Lifecycle:
1. Game action generates events → stored in `gameEnv.gameEvents`
2. Frontend polls and receives unprocessed events
3. Frontend processes events and updates UI
4. Frontend calls `acknowledgeEvents()` to mark events processed
5. Events automatically expire and cleanup after acknowledgment

#### Request Body:
```json
{
  "gameId": "game-uuid",
  "eventIds": ["event-id-1", "event-id-2", "event-id-3"]
}
```

#### Response:
```json
{
  "success": true,
  "gameId": "game-uuid",
  "acknowledgedEvents": 3,
  "message": "Events acknowledged successfully",
  "timestamp": "2025-01-21T..."
}
```

---

## Common Patterns and Architecture

### Error Handling Strategy
All functions follow consistent error handling pattern:

1. **Input Validation** - Parameter validation with specific error messages
2. **Business Logic Delegation** - Actual processing in GameLogic service layer  
3. **Response Formatting** - Consistent response structure across endpoints
4. **Error Context** - All errors include timestamp and context information
5. **Development Support** - Stack traces included in development environment

### Response Structure Standardization
All endpoints return consistent response format:

```json
{
  "success": boolean,
  "gameId": "uuid",
  "gameEnv": { /* complete game state */ },
  "error": "error message",  // on failure
  "timestamp": "ISO timestamp",
  "context": "endpoint context"
}
```

### Logging and Debugging
- Comprehensive console logging with emoji prefixes for easy identification
- Request body logging for debugging complex interactions
- Stack trace preservation for development environments
- Context-aware error messages for rapid issue identification

### GameLogic Service Integration
Controller layer acts as thin API wrapper around GameLogic service:
- **Validation** - Parameter validation in controller
- **Business Logic** - All game rules and state management in GameLogic  
- **Response Formatting** - API-specific response formatting in controller
- **Error Handling** - Error translation from service to HTTP responses

This separation ensures clean architecture and enables easy testing of business logic independent of HTTP layer.

## API Flow Summary

### Typical Game Flow:
1. **Game Creation**: `startGame()` → Player 1 creates game
2. **Game Joining**: `joinRoom()` → Player 2 joins game
3. **Ready Phase**: `startReady()` → Both players confirm readiness (optional redraw)
4. **Main Phase**: `playerAction()` → Players place cards alternately
5. **Card Selection**: `selectCard()` → Handle search effects when triggered
6. **Event Management**: `acknowledgeEvents()` → Frontend acknowledges processed events
7. **Repeat 4-6** until game completion

### Real-time Integration:
- Frontend polls `GET /player/:playerId?gameId=X` for game state updates
- Event system provides precise change notifications
- Acknowledgment system prevents event buildup and ensures reliability