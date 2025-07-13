# Revolution and Rebellion - TCG Backend API

This document describes the REST API endpoints for the Revolution and Rebellion trading card game backend.

## Base URL
```
http://localhost:3000/api
```

## Health Check

### GET /health
Check if the API server is running.

**Response:**
```json
{
  "status": "ok"
}
```

## Game Management

### POST /player/startGame
Initialize a new game session.

**Request Body:**
```json
{
  "playerId": "string",
  "gameConfig": {
    // Game configuration options
  }
}
```

**Response:**
```json
{
  "gameId": "string",
  "gameEnv": {
    // Complete game state
  },
  "success": true
}
```

### POST /player/startReady
Mark a player as ready to start the game.

**Request Body:**
```json
{
  "playerId": "string",
  "gameId": "string"
}
```

**Response:**
```json
{
  "gameEnv": {
    // Updated game state
  },
  "success": true
}
```

## Player Actions

### POST /player/playerAction
Process a player's game action (card placement, etc.).

**Request Body:**
```json
{
  "playerId": "string",
  "gameId": "string",
  "action": {
    "type": "string",        // "PlayCard" (face-up) or "PlayCardBack" (face-down)
    "card_idx": "number",    // Index of card in hand
    "field_idx": "number"    // Target field/zone index (0=top, 1=left, 2=right, 3=help, 4=sp)
  }
}
```

**Response (Normal Action):**
```json
{
  "gameEnv": {
    // Updated game state after action
    "pendingPlayerAction": null  // No pending actions
  },
  "success": true
}
```

**Response (SP Phase Complete - Battle Results):**
```json
{
  "gameEnv": {
    "phase": "BATTLE_PHASE",
    "battleResults": {
      "playerId_1": {
        "power": 250,
        "combos": { "totalBonus": 150 },
        "totalPoints": 400
      },
      "playerId_2": {
        "power": 180, 
        "combos": { "totalBonus": 200 },
        "totalPoints": 380
      },
      "winner": { "playerId": "playerId_1", "totalPoints": 400 }
    },
    "spRevealComplete": true
  },
  "success": true
}
```

**Response (Card Selection Required):**
```json
{
  "requiresCardSelection": true,
  "cardSelection": {
    "selectionId": "string",           // Unique selection ID
    "eligibleCards": ["card1", "card2"], // Cards player can select from
    "selectCount": 2,                  // Number of cards to select
    "cardTypeFilter": "character",     // Filter applied (if any)
    "prompt": "Select 2 card(s) from 5 available cards"
  },
  "gameEnv": {
    // Current game state with pending selection
    "pendingPlayerAction": {
      "type": "cardSelection",
      "playerId": "player1",
      "selectionId": "player1_1640995200000",
      "description": "Waiting for player1 to select 2 card(s)",
      "timestamp": 1640995200000
    }
  }
}
```

### POST /player/selectCard
Complete a pending card selection triggered by a card effect.

**Request Body:**
```json
{
  "selectionId": "string",              // ID from the card selection prompt
  "selectedCardIds": ["card1", "card2"], // Selected card IDs
  "playerId": "string",
  "gameId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "gameEnv": {
    // Updated game state after selection
  }
}
```

### POST /player/acknowledgeEvents
Mark frontend events as processed to prevent re-processing and allow cleanup.

**Request Body:**
```json
{
  "gameId": "string",
  "eventIds": ["event_1640995200001", "event_1640995200002"]  // Array of event IDs to acknowledge
}
```

**Response:**
```json
{
  "success": true,
  "eventsAcknowledged": 2,              // Number of events successfully marked as processed
  "remainingEvents": 3                  // Number of unprocessed events still in queue
}
```

### POST /player/nextRound
Start the next round after battle completion (if game continues).

**Request Body:**
```json
{
  "gameId": "string"
}
```

**Response:**
```json
{
  "gameEnv": {
    "phase": "MAIN_PHASE",
    "currentLeaderIdx": 1,  // Next leader
    // All field zones cleared, new hands drawn
  },
  "success": true
}
```

### POST /player/playerAiAction
Trigger AI to make an action.

**Request Body:**
```json
{
  "playerId": "string",
  "gameId": "string"
}
```

**Response:**
```json
{
  "gameEnv": {
    // Game state after AI action
  },
  "success": true
}
```

## Player Data Management

### GET /player/:playerId?gameId=gameId
Get current game state for a specific player.

**URL Parameters:**
- `playerId`: Unique identifier for the player

**Query Parameters:**
- `gameId`: Unique identifier for the game (required)

**Response:**
```json
{
  "gameEnv": {
    "players": [],
    "currentPhase": "string",
    "turnPlayer": "string",
    // ... complete game state
  }
}
```

### PUT /player/:playerId/score
Update a player's score.

**URL Parameters:**
- `playerId`: Unique identifier for the player

**Request Body:**
```json
{
  "score": "number",
  "gameId": "string"
}
```

**Response:**
```json
{
  "gameEnv": {
    // Updated game state with new score
  },
  "success": true
}
```


## Deck Management

### POST /player/:playerId/deck
Get available decks for a player.

**URL Parameters:**
- `playerId`: Unique identifier for the player

**Request Body:**
```json
{
  // Deck query parameters (optional)
}
```

**Response:**
```json
{
  "decks": [
    {
      "deckId": "string",
      "name": "string",
      "cards": [],
      "leaderCards": []
    }
  ]
}
```

## Testing Endpoints

### POST /test/setCase
Set up a specific test case scenario.

**Request Body:**
```json
{
  "caseId": "string",
  "scenario": {
    // Test scenario configuration
  }
}
```

**Response:**
```json
{
  "success": true,
  "caseId": "string"
}
```

### POST /test/injectGameState
Inject a specific game state for testing purposes.

**Request Body:**
```json
{
  "gameId": "string",
  "gameEnv": {
    // Complete game environment state
    "players": [],
    "currentPhase": "string",
    "turnPlayer": "string"
  }
}
```

**Response:**
```json
{
  "success": true,
  "gameId": "string"
}
```

## Error Handling

All endpoints return errors in the following format:

```json
{
  "error": "Error message description",
  "stack": "Error stack trace (in development)"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing required parameters)
- `403`: Forbidden (test endpoint in production)
- `500`: Internal Server Error

## Game Event System

The API includes a comprehensive event system that tracks all game state changes and provides clear indicators for frontend actions.

### Event Structure
All game events are stored in `gameEnv.gameEvents` array with the following structure:

```json
{
  "id": "event_1640995200001",          // Unique event identifier
  "type": "CARD_PLAYED",                // Event type (see complete list below)
  "data": {                             // Event-specific data
    "playerId": "playerId_1",
    "card": { "cardId": "43", "name": "Card Name", "power": 150 },
    "zone": "top",
    "isFaceDown": false
  },
  "timestamp": 1640995200001,           // When event occurred
  "expiresAt": 1640995203001,           // When event expires (3 seconds later)
  "frontendProcessed": false            // Whether frontend has acknowledged this event
}
```

### Complete Event Types

**Game Setup Events:**
- `GAME_STARTED` - Initial game creation with leader reveals
- `INITIAL_HAND_DEALT` - Player received starting hand
- `PLAYER_READY` - Individual player ready status
- `HAND_REDRAWN` - Player chose to redraw hand
- `GAME_PHASE_START` - Transition to MAIN_PHASE after both ready
- `CARD_DRAWN` - Card drawn to hand

**Turn & Phase Events:**
- `TURN_SWITCH` - Player turn changed
- `PHASE_CHANGE` - Game phase transition
- `ALL_MAIN_ZONES_FILLED` - Player filled character+help zones
- `ALL_SP_ZONES_FILLED` - Both players filled SP zones

**Card Events:**
- `CARD_PLAYED` - Card placed (with full card details)
- `ZONE_FILLED` - Specific zone occupied
- `CARD_EFFECT_TRIGGERED` - Card effect activated
- `CARD_SELECTION_REQUIRED` - Search effect needs input
- `CARD_SELECTION_COMPLETED` - Player completed selection

**SP & Battle Events:**
- `SP_CARDS_REVEALED` - Both SP cards revealed
- `SP_EFFECTS_EXECUTED` - SP effects processed
- `BATTLE_CALCULATED` - Power+combo calculation
- `VICTORY_POINTS_AWARDED` - Round winner determined
- `NEXT_ROUND_START` - New leader battle

**Error Events:**
- `ERROR_OCCURRED` - Any validation error or failed action
- `CARD_SELECTION_PENDING` - Blocked action due to pending selection
- `WAITING_FOR_PLAYER` - Waiting for other player
- `ZONE_COMPATIBILITY_ERROR` - Card placement restriction violation
- `PHASE_RESTRICTION_ERROR` - Wrong phase for action
- `ZONE_OCCUPIED_ERROR` - Zone already filled

### Event Lifecycle

1. **Creation**: Events are created when game state changes occur
2. **Persistence**: Events persist for 3 seconds (3 polling cycles at 1s intervals)
3. **Processing**: Frontend detects events via polling and takes appropriate actions
4. **Acknowledgment**: Frontend calls `/player/acknowledgeEvents` to mark events as processed
5. **Cleanup**: Processed and expired events are automatically removed

### Frontend Integration

**Polling with Event Detection:**
```javascript
// Poll every 1 second for game state updates
setInterval(async () => {
  const response = await fetch(`/api/player/${playerId}?gameId=${gameId}`);
  const data = await response.json();
  
  // Process new events
  if (data.gameEnv.gameEvents && data.gameEnv.gameEvents.length > 0) {
    const unprocessedEvents = data.gameEnv.gameEvents.filter(event => !event.frontendProcessed);
    
    for (const event of unprocessedEvents) {
      handleGameEvent(event);
    }
    
    // Acknowledge processed events
    const eventIds = unprocessedEvents.map(e => e.id);
    await fetch('/api/player/acknowledgeEvents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, eventIds })
    });
  }
}, 1000);

function handleGameEvent(event) {
  switch(event.type) {
    case 'TURN_SWITCH':
      highlightCurrentPlayer(event.data.newPlayer);
      break;
    case 'CARD_PLAYED':
      animateCardPlacement(event.data.card, event.data.zone);
      break;
    case 'CARD_SELECTION_REQUIRED':
      showCardSelectionModal(event.data);
      break;
    case 'PHASE_CHANGE':
      animatePhaseTransition(event.data.newPhase);
      break;
    case 'SP_CARDS_REVEALED':
      animateCardReveal(event.data.cards);
      break;
    case 'BATTLE_CALCULATED':
      showBattleResults(event.data.battleResults);
      break;
    case 'ERROR_OCCURRED':
      showErrorNotification(event.data.message);
      break;
  }
}
```

## Game Flow Example

1. **Start Game**: POST `/player/startGame`
2. **Player Ready**: POST `/player/startReady`
3. **Main Phase Actions**: POST `/player/playerAction` (character and help cards only)
4. **Card Selection** (if triggered): POST `/player/selectCard`
5. **SP Phase Actions**: POST `/player/playerAction` (SP cards only, after all character zones filled)
6. **Event Acknowledgment**: POST `/player/acknowledgeEvents` (mark processed events)
7. **AI Actions**: POST `/player/playerAiAction` (if playing against AI)
8. **Check State**: GET `/player/:playerId`

## Card Selection Flow

When certain card effects are triggered (e.g., search deck, draw specific cards), the game may require player input:

1. **Player Action**: POST `/player/playerAction` with card that has search effect
2. **Check Game State**: API returns normal game data with `pendingPlayerAction` and `pendingCardSelections` populated
3. **Player Selection**: POST `/player/selectCard` with chosen cards (using data from `pendingCardSelections`)
4. **Continue Game**: Normal game flow resumes with pending states cleared

**Key Change**: Instead of separate `requiresCardSelection` and `cardSelection` fields, clients detect card selection requirements by checking if `gameEnv.pendingPlayerAction` exists and looking up details in `gameEnv.pendingCardSelections`.

### Client Usage Example
```javascript
// After calling /player/playerAction
const response = await fetch('/api/player/playerAction', { ... });
const gameData = await response.json();

// Check if card selection is required
if (gameData.gameEnv.pendingPlayerAction?.type === 'cardSelection') {
    const selectionId = gameData.gameEnv.pendingPlayerAction.selectionId;
    const selectionData = gameData.gameEnv.pendingCardSelections[selectionId];
    
    // Show card selection UI
    showCardSelection({
        eligibleCards: selectionData.eligibleCards,
        selectCount: selectionData.selectCount,
        cardTypeFilter: selectionData.cardTypeFilter,
        onSelect: (selectedCards) => selectCard(selectionId, selectedCards)
    });
} else {
    // Normal game flow continues
    updateGameUI(gameData.gameEnv);
}
```

## Game State Management

The game tracks pending actions that require player input. When a player action is required:

### Pending Player Action Object (Simplified Structure)
```json
{
  "pendingPlayerAction": {
    "type": "cardSelection",              // Type of action required
    "selectionId": "player1_1640995200000" // Reference ID linking to pendingCardSelections
  }
}
```

### Pending Card Selections Object (Detailed Data)
```json
{
  "pendingCardSelections": {
    "player1_1640995200000": {
      "playerId": "player1",              // Which player needs to act
      "eligibleCards": ["43", "44", "45"], // Cards available for selection
      "searchedCards": ["43", "44", "45", "46"], // All cards that were searched
      "selectCount": 1,                   // Number of cards to select
      "cardTypeFilter": null,             // Optional filter (e.g., "sp", "help")
      "effect": { /* original effect data */ },
      "timestamp": 1640995200000          // When the action was initiated
    }
  }
}
```

### Blocking Behavior
- When `pendingPlayerAction` exists, normal card play is blocked
- The specified player must complete their required action first
- Other players receive "waiting" messages if they try to act
- Actions are unblocked when the required action is completed

### Data Storage Pattern
The system uses a **dual-state approach** for efficiency:
- `pendingPlayerAction`: Lightweight indicator with just type and reference ID
- `pendingCardSelections`: Complete selection data keyed by selection ID
- This eliminates data duplication while maintaining clean separation of concerns

### Error Responses During Blocking
```json
{
  "error": "You must complete your card selection first. Select 1 card(s)."
}
```

```json
{
  "error": "Waiting for player1 to complete card selection. Please wait."
}
```

## Game Phases and Card Types

The game follows a strict phase-based system:

### MAIN_PHASE
- **Character Cards**: Can be placed in top/left/right zones (one per zone)
- **Help Cards**: Can be placed in help zone (one per player)
- **SP Cards**: ❌ Cannot be played during MAIN_PHASE

### SP_PHASE (triggered when all character zones are filled)
- **All Cards**: MUST be played face-down in SP zone (`"type": "PlayCardBack"`)
- **Auto-reveal**: Cards automatically revealed after both players fill SP zones
- **SP Effect Execution**: SP cards execute in priority order (leader initialPoint)
- **Battle Calculation**: Automatic power + combo calculation after SP effects
- **Character/Help Cards**: ❌ Cannot be played during SP_PHASE

### Card Types:
- **Leader Cards**: Determine zone compatibility and provide bonuses (set at game start)
- **Character Cards**: Combat units with power values  
- **Help Cards**: Utility effects to support your strategy  
- **SP Cards**: Special powerful effects that execute before battle resolution

### Zone Compatibility Rules:
- Character placement is validated using the card's `gameType` field against the leader's `zoneCompatibility`
- **IMPORTANT**: Zone checking uses `cardDetails.gameType` (string), NOT `cardDetails.traits` (array)
- `traits` are used for card effects and abilities; `gameType` determines placement restrictions
- Leaders with `"all"` in their zone compatibility can place any character type in that zone
- **Face-down bypass**: Face-down cards ignore ALL zone compatibility restrictions

### Face-Down Card Rules:
- **Complete restriction bypass**: Face-down cards ignore leader zone compatibility and all card effect restrictions
- **Power/combo exclusion**: Face-down cards contribute 0 power and don't count for combos
- **No effects**: Face-down cards don't trigger their effects while face-down
- **SP zone enforcement**: During SP_PHASE, all cards MUST be played face-down in SP zone
- **Permanent status**: Face-down cards stay face-down (except SP zone auto-reveal)

### Correct Zone Compatibility Access Pattern:
```javascript
// CORRECT: Access via zoneCompatibility object
const allowedTypes = leader.zoneCompatibility[zone]; // e.g., ["右翼", "自由", "經濟"]

// INCORRECT: Direct leader property access
const allowedTypes = leader[zone]; // This will be undefined
```

**Common Mistake Prevention**: Always access zone compatibility through `leader.zoneCompatibility[zone]`, never directly via `leader[zone]`. The leader object structure contains the zone rules under the `zoneCompatibility` property as defined in `leaderCards.json`.

## Common Development Pitfalls

### ❌ Zone Compatibility Errors
```javascript
// WRONG: Direct access to leader properties
const allowedTypes = leader[zone]; // Undefined!

// CORRECT: Access via zoneCompatibility object  
const allowedTypes = leader.zoneCompatibility[zone];
```

### ❌ Card Type vs Traits Confusion
```javascript
// WRONG: Using traits for zone placement
if (allowedTypes.includes(cardDetails.traits[0])) { ... }

// CORRECT: Using gameType for zone placement
if (allowedTypes.includes(cardDetails.gameType)) { ... }
```

### ❌ GameEnv Structure Mixing (Fixed)
```javascript
// OLD APPROACH: Separate API response fields (eliminated)
return { requiresCardSelection: true, cardSelection: {...}, gameEnv: actualGameState };

// NEW APPROACH: All data in gameEnv (simplified)
gameData.gameEnv = actualGameState; // Contains pendingPlayerAction & pendingCardSelections
return gameData; // Client derives selection state from gameEnv
```

Common action types:
- `"PlayCard"`: Place a card face-up (normal placement, triggers effects)
- `"PlayCardBack"`: Place a card face-down (strategic placement, bypasses restrictions)
- **SP Phase Rule**: During SP_PHASE, only `"PlayCardBack"` allowed in SP zone

## Program Architecture

### Game State Storage
The backend uses **file-based game state management** instead of in-memory storage:

```
src/gameData/
├── {gameId1}.json
├── {gameId2}.json
└── ...
```

### Data Flow Pattern
All game operations follow this consistent pattern:

```javascript
// 1. Read game state from file
const gameData = await this.readJSONFileAsync(gameId);

// 2. Perform game logic modifications
const actionResult = await this.mozGamePlay.processAction(gameData.gameEnv, playerId, action);

// 3. Always update gameEnv and save (simplified flow)
gameData.gameEnv = actionResult.requiresCardSelection ? actionResult.gameEnv : actionResult;
const updatedGameData = this.addUpdateUUID(gameData);
await this.saveOrCreateGame(updatedGameData, gameId);

// 4. Return updated game data - client derives card selection state from gameEnv
return updatedGameData;
```

### File Structure
Each game file contains:
```json
{
  "gameId": "uuid-string",
  "gameEnv": {
    "playerId_1": { /* player 1 data */ },
    "playerId_2": { /* player 2 data */ },
    "firstPlayer": 0,
    "phase": "MAIN_PHASE", 
    "currentPlayer": "playerId_1",
    "currentTurn": 0,
    "pendingPlayerAction": {
      "type": "cardSelection",
      "selectionId": "playerId_1_1640995200000"
    },
    "pendingCardSelections": {
      "playerId_1_1640995200000": { /* selection details */ }
    }
  },
  "updateUUID": "uuid-string",
  "lastUpdate": "2024-01-01T00:00:00.000Z"
}
```

**Important**: The `gameEnv` contains ONLY game state data. There are no separate API response fields - all card selection information is embedded within the game state via `pendingPlayerAction` and `pendingCardSelections`.

### Key Benefits
- **Persistence**: Games survive server restarts
- **Scalability**: No memory limitations for concurrent games
- **Debugging**: Direct file inspection possible
- **Consistency**: Single pattern across all operations

## Development Notes

- The API includes comprehensive error handling with stack traces in development
- Test endpoints are available for scenario injection and testing
- All game state is managed server-side via JSON files
- The API supports both human players and AI opponents