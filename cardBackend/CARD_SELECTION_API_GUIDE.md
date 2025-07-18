# Card Selection API Workflow Guide

## Overview

When certain cards are played, they trigger effects that require player interaction to select which cards to target. This includes:

**Search Effects**: Character cards like c-9 (艾利茲), c-10 (爱德华), c-12 (盧克) search deck for cards
**Targeting Effects**: Utility cards like h-1 (Deep State) target specific opponent cards for neutralization

This guide explains the complete API workflow for both types of card selection.

## Step-by-Step API Workflow

### Step 1: Card Play Triggers Selection Effect

**API Call**: `POST /api/game/player/playCard`

```json
{
  "gameId": "game123", 
  "playerId": "playerId_1",
  "action": "PlayCard",
  "card_idx": 2,
  "play_pos": "top"
}
```

**What Happens**:
1. Card is placed on the field
2. Card effects are processed based on card type:
   - **Character Cards**: `processCharacterSummonEffects()` → `searchCardEffect()`
   - **Utility Cards**: `processUtilityCardEffects()` → `neutralizeEffectSelection()`
3. Selection requirement is created
4. Game state is updated with pending selection

### Step 2: Backend Response with Selection Required

**Response Status**: `200 OK`

```json
{
  "success": true,
  "gameEnv": {
    "phase": "MAIN_PHASE",
    "currentTurn": "playerId_1",
    "pendingPlayerAction": {
      "type": "cardSelection",
      "selectionId": "playerId_1_1640995200001"
    },
    "pendingCardSelections": {
      "playerId_1_1640995200001": {
        "playerId": "playerId_1",
        "eligibleCards": ["sp-1", "sp-2", "h-1"],
        "selectCount": 1,
        "effect": {
          "type": "searchCard",
          "searchCount": 7,
          "selectCount": 1,
          "destination": "conditionalHelpZone",
          "filters": [{"type": "cardType", "value": "help"}]
        }
      }
    },
    "gameEvents": [
      {
        "id": "event_1640995200001",
        "type": "CARD_SELECTION_REQUIRED",
        "data": {
          "playerId": "playerId_1",
          "selectionId": "playerId_1_1640995200001",
          "availableCards": [
            {"id": "h-1", "name": "Deep State"},
            {"id": "h-2", "name": "Make America Great Again"}
          ],
          "selectCount": 1,
          "description": "Select 1 HELP card"
        }
      }
    ]
  }
}
```

### Step 3: Frontend Detects Selection Required

**Frontend Logic**:
```javascript
// Check for pending selection in game state
if (gameEnv.pendingPlayerAction?.type === 'cardSelection') {
  const selectionId = gameEnv.pendingPlayerAction.selectionId;
  const selectionData = gameEnv.pendingCardSelections[selectionId];
  
  // Show card selection UI
  showCardSelectionModal({
    cards: selectionData.eligibleCards,
    selectCount: selectionData.selectCount,
    onSelect: (selectedCards) => completeCardSelection(selectionId, selectedCards)
  });
}
```

### Step 4: Player Makes Selection

**Frontend UI**:
- Display available cards to player
- Allow selection of required number of cards
- Validate selection count
- Send selection to backend

### Step 5: Complete Card Selection

**API Call**: `POST /api/game/player/selectCard`

```json
{
  "gameId": "game123",
  "playerId": "playerId_1",
  "selectionId": "playerId_1_1640995200001",
  "selectedCardIds": ["h-1"]
}
```

**Backend Processing**:
1. Validates selection
2. Removes selected cards from deck
3. Places cards in appropriate destination
4. Puts remaining searched cards at bottom of deck
5. Clears pending selection
6. Continues game flow

### Step 6: Backend Response with Updated State

**Response Status**: `200 OK`

```json
{
  "success": true,
  "gameEnv": {
    "phase": "MAIN_PHASE",
    "currentTurn": "playerId_2",
    "pendingPlayerAction": null,
    "pendingCardSelections": {},
    "zones": {
      "playerId_1": {
        "help": [
          {
            "card": ["h-1"],
            "cardDetails": [{"id": "h-1", "name": "Deep State", "cardType": "help"}],
            "isBack": [false]
          }
        ]
      }
    },
    "gameEvents": [
      {
        "id": "event_1640995200002",
        "type": "CARD_SELECTION_COMPLETED",
        "data": {
          "playerId": "playerId_1",
          "selectedCards": [{"id": "h-1", "name": "Deep State"}],
          "destination": "conditionalHelpZone",
          "actualDestination": "helpZone"
        }
      }
    ]
  }
}
```

## API Endpoints

### 1. Complete Card Selection

**Endpoint**: `POST /api/game/player/selectCard`

**Request Body**:
```json
{
  "gameId": "string",
  "playerId": "string", 
  "selectionId": "string",
  "selectedCardIds": ["string"]
}
```

**Response**:
```json
{
  "success": boolean,
  "gameEnv": { /* updated game state */ },
  "error": "string" // if error occurs
}
```

### 2. Get Current Game State

**Endpoint**: `GET /api/game/player/:playerId?gameId=:gameId`

**Response** (when selection pending):
```json
{
  "success": true,
  "gameEnv": {
    "pendingPlayerAction": {
      "type": "cardSelection",
      "selectionId": "string"
    },
    "pendingCardSelections": {
      "selectionId": {
        "eligibleCards": ["string"],
        "selectCount": number,
        "effect": { /* effect details */ }
      }
    }
  }
}
```

## Card-Specific Examples

### c-9 (艾利茲) - Search Any Card to Hand

**Effect**: Look at 4 cards, select 1 to add to hand

**Selection Process**:
1. Search triggered on summon
2. Show 4 cards from top of deck
3. Player selects 1 card
4. Selected card goes to hand
5. Remaining 3 cards go to bottom of deck

**API Example**:
```json
{
  "effect": {
    "type": "searchCard",
    "searchCount": 4,
    "selectCount": 1,
    "destination": "hand",
    "filters": []
  }
}
```

### c-10 (爱德华) - Search SP Card to SP Zone

**Effect**: Look at 7 cards, select 1 SP card to place in SP zone

**Selection Process**:
1. Search triggered on summon
2. Show only SP cards from 7 cards viewed
3. Player selects 1 SP card
4. Selected SP card placed face-down in SP zone
5. Remaining cards go to bottom of deck

**API Example**:
```json
{
  "effect": {
    "type": "searchCard",
    "searchCount": 7,
    "selectCount": 1,
    "destination": "spZone",
    "filters": [{"type": "cardType", "value": "sp"}]
  }
}
```

### c-12 (盧克) - Conditional Help Zone Placement

**Effect**: Look at 7 cards, select 1 Help card. If Help zone empty, place there; otherwise add to hand.

**Selection Process**:
1. Search triggered on summon
2. Show only Help cards from 7 cards viewed
3. Player selects 1 Help card
4. **If Help zone empty**: Place Help card in Help zone (face-up), trigger its effects
5. **If Help zone occupied**: Add Help card to hand
6. Remaining cards go to bottom of deck

**API Example**:
```json
{
  "effect": {
    "type": "searchCard",
    "searchCount": 7,
    "selectCount": 1,
    "destination": "conditionalHelpZone",
    "filters": [{"type": "cardType", "value": "help"}]
  }
}
```

## Error Handling

### Common Errors

1. **Invalid Selection ID**
```json
{
  "success": false,
  "error": "Invalid or expired card selection"
}
```

2. **Wrong Selection Count**
```json
{
  "success": false,
  "error": "Must select exactly 1 cards"
}
```

3. **Invalid Card Selection**
```json
{
  "success": false,
  "error": "Invalid card selection: sp-3"
}
```

4. **No Pending Selection**
```json
{
  "success": false,
  "error": "No pending card selection for this player"
}
```

## Frontend Implementation Guide

### 1. Detect Selection Required

```javascript
function checkForPendingSelection(gameEnv) {
  if (gameEnv.pendingPlayerAction?.type === 'cardSelection') {
    const selectionId = gameEnv.pendingPlayerAction.selectionId;
    const selectionData = gameEnv.pendingCardSelections[selectionId];
    
    showCardSelectionUI(selectionId, selectionData);
    return true;
  }
  return false;
}
```

### 2. Show Selection UI

```javascript
function showCardSelectionUI(selectionId, selectionData) {
  const { eligibleCards, selectCount, effect } = selectionData;
  
  // Create selection modal
  const modal = document.createElement('div');
  modal.className = 'card-selection-modal';
  
  // Add title based on effect
  const title = getSelectionTitle(effect);
  modal.innerHTML = `
    <h3>${title}</h3>
    <p>Select ${selectCount} card(s):</p>
    <div class="card-grid">
      ${eligibleCards.map(cardId => `
        <div class="selectable-card" data-card-id="${cardId}">
          <img src="/images/cards/${cardId}.png" alt="${cardId}">
        </div>
      `).join('')}
    </div>
    <button id="confirm-selection" disabled>Confirm Selection</button>
  `;
  
  // Add selection logic
  setupCardSelectionLogic(modal, selectionId, selectCount);
  
  document.body.appendChild(modal);
}
```

### 3. Handle Selection Logic

```javascript
function setupCardSelectionLogic(modal, selectionId, selectCount) {
  const cards = modal.querySelectorAll('.selectable-card');
  const confirmButton = modal.querySelector('#confirm-selection');
  let selectedCards = [];
  
  cards.forEach(card => {
    card.addEventListener('click', () => {
      const cardId = card.dataset.cardId;
      
      if (selectedCards.includes(cardId)) {
        // Deselect
        selectedCards = selectedCards.filter(id => id !== cardId);
        card.classList.remove('selected');
      } else if (selectedCards.length < selectCount) {
        // Select
        selectedCards.push(cardId);
        card.classList.add('selected');
      }
      
      // Update confirm button
      confirmButton.disabled = selectedCards.length !== selectCount;
    });
  });
  
  confirmButton.addEventListener('click', () => {
    completeCardSelection(selectionId, selectedCards);
    modal.remove();
  });
}
```

### 4. Complete Selection

```javascript
async function completeCardSelection(selectionId, selectedCardIds) {
  try {
    const response = await fetch('/api/game/player/selectCard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: currentGameId,
        playerId: currentPlayerId,
        selectionId: selectionId,
        selectedCardIds: selectedCardIds
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Update game state
      updateGameState(result.gameEnv);
    } else {
      showError(result.error);
    }
  } catch (error) {
    showError('Failed to complete card selection');
  }
}
```

## Backend Implementation Details

### Key Methods

#### `searchCardEffect(gameEnv, playerId, effect)`
- Creates pending card selection
- Filters cards based on effect filters
- Stores selection data in game environment
- Returns selection prompt information

#### `completeCardSelection(gameEnv, selectionId, selectedCardIds)`
- Validates selection
- Places cards in appropriate destinations
- Cleans up pending selection
- Updates game state

#### `processCharacterSummonEffects(gameEnv, playerId, cardDetails)`
- Calls search effects when characters are summoned
- Handles requiresCardSelection return values
- Integrates with game flow

### Event Integration

All card selection actions generate appropriate game events:
- `CARD_SELECTION_REQUIRED` - When selection is needed
- `CARD_SELECTION_COMPLETED` - When selection is completed
- `CARD_PLACED` - When cards are placed in zones
- `CARD_EFFECT_TRIGGERED` - When effects are activated

## Testing the Implementation

### Manual Testing Steps

1. **Start Game**: Create a game with players
2. **Get c-12 in Hand**: Ensure Luke card is available
3. **Play c-12**: Summon Luke to trigger search effect
4. **Verify Selection**: Check that pendingPlayerAction is set
5. **Complete Selection**: Call completeCardSelection API
6. **Verify Result**: Check that Help card is placed correctly

### API Testing with cURL

```bash
# 1. Play Luke card
curl -X POST http://localhost:8080/api/game/player/playCard \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "test123",
    "playerId": "playerId_1", 
    "action": "PlayCard",
    "card_idx": 0,
    "play_pos": "top"
  }'

# 2. Complete card selection
curl -X POST http://localhost:8080/api/game/player/selectCard \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "test123",
    "playerId": "playerId_1",
    "selectionId": "playerId_1_1640995200001",
    "selectedCardIds": ["h-1"]
  }'
```

## Summary

The card selection system provides a robust workflow for interactive card effects:

1. **Trigger**: Card summon triggers search effect
2. **Pending**: Backend creates pending selection state
3. **Display**: Frontend shows selection UI to player
4. **Select**: Player chooses cards through UI
5. **Complete**: Backend processes selection and updates game state
6. **Continue**: Game flow continues normally

This system supports all search card effects (c-9, c-10, c-12) and targeting effects (h-1 Deep State) and can be extended for future interactive effects.

## Example: Targeting Effect (h-1 Deep State)

### Step 1: Play h-1 Deep State

**API Call**: `POST /api/game/player/playCard`

```json
{
  "gameId": "game123",
  "playerId": "playerId_1", 
  "action": "PlayCard",
  "card_idx": 0,
  "play_pos": "help"
}
```

### Step 2: Backend Response - Target Selection Required

```json
{
  "success": true,
  "gameEnv": {
    "phase": "MAIN_PHASE",
    "currentPlayer": "playerId_2",
    "pendingPlayerAction": {
      "type": "cardSelection",
      "selectionId": "playerId_1_neutralize_1640995200001",
      "description": "Select 1 opponent card(s) to neutralize"
    },
    "pendingCardSelections": {
      "playerId_1_neutralize_1640995200001": {
        "playerId": "playerId_1",
        "eligibleCards": [
          {
            "cardId": "h-5",
            "zone": "help",
            "name": "失智老人",
            "cardType": "help"
          },
          {
            "cardId": "sp-2",
            "zone": "sp", 
            "name": "華爾街之狼",
            "cardType": "sp"
          }
        ],
        "selectCount": 1,
        "effectType": "neutralizeEffect",
        "targetPlayerId": "playerId_2"
      }
    }
  }
}
```

### Step 3: Player Makes Selection

**API Call**: `POST /api/game/player/selectCard`

```json
{
  "gameId": "game123",
  "playerId": "playerId_1",
  "selectionId": "playerId_1_neutralize_1640995200001",
  "selectedCards": ["h-5"]
}
```

### Step 4: Backend Response - Selection Completed

```json
{
  "success": true,
  "gameEnv": {
    "phase": "MAIN_PHASE",
    "currentPlayer": "playerId_2",
    "pendingPlayerAction": null,
    "pendingCardSelections": {},
    "neutralizedEffects": {
      "playerId_2": {
        "specificCards": [
          {
            "cardId": "h-5",
            "zone": "help",
            "name": "失智老人",
            "cardType": "help"
          }
        ]
      }
    }
  }
}
```

---

*Implementation Status: Complete and Production Ready*