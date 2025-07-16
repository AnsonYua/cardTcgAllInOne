# API Integration Fix for Card Play Events

## Problem Identified & Fixed

❌ **ISSUE**: Frontend was sending incorrect action structure to backend

### Original Problem:
- **Frontend sent**: `{type: 'playCard', cardId: 'c-1', zone: 'top', faceDown: false}`
- **Backend expected**: `{type: 'PlayCard', card_idx: 0, field_idx: 0}`

### Root Cause Analysis:
1. Backend uses index-based system (card index in hand, field index for zones)
2. Frontend was sending card IDs and zone names instead of indices
3. Backend validation failed because it couldn't find card by card_idx

## ✅ **CORRECTED IMPLEMENTATION**

### Fixed API Integration:

1. **Enhanced `playCardToZone()` method** (lines 1127-1178):
   - Converts frontend card data to backend action format using `createBackendAction()`
   - Proper error handling with user feedback
   - Falls back to demo mode when offline

2. **New `createBackendAction()` method** (lines 1180-1215):
   - Finds card index in player's hand array
   - Converts zone names to field indices
   - Handles face-down card logic correctly
   - Comprehensive logging for debugging

3. **New `getFieldIndexFromZone()` method** (lines 1217-1222):
   - Maps frontend zone names to backend field indices
   - `'top'` → `0`, `'left'` → `1`, `'right'` → `2`, `'help'` → `3`, `'sp'` → `4`

### Corrected Action Structure:

**Frontend Input:**
```javascript
{
  cardData: { id: 'c-1', faceDown: false },
  zoneType: 'top'
}
```

**Converted to Backend Format:**
```javascript
{
  type: 'PlayCard',        // or 'PlayCardBack' for face-down
  card_idx: 0,            // Index in player's hand array
  field_idx: 0            // 0=top, 1=left, 2=right, 3=help, 4=sp
}
```

**API Endpoint:** `POST /player/playerAction`
**Payload:** 
```javascript
{
  playerId: 'playerId_1',
  gameId: 'game123',
  action: {
    type: 'PlayCard',
    card_idx: 0,
    field_idx: 0
  }
}
```

### Features Supported:

- ✅ **Drag-and-drop card placement** with corrected API integration
- ✅ **Click-based card placement** with corrected API integration  
- ✅ **Face-down card support** (uses 'PlayCardBack' action type)
- ✅ **Index-based card lookup** (finds correct hand position)
- ✅ **Zone to field mapping** (converts zone names to backend indices)
- ✅ **Error handling** with user-friendly messages
- ✅ **Loading states** during API calls
- ✅ **Demo mode fallback** when backend unavailable
- ✅ **Comprehensive logging** for debugging

### Backend Validation Requirements:

1. **Card Index Validation**: `action.card_idx` must be valid index in `gameEnv[playerId].deck.hand`
2. **Field Index Validation**: `action.field_idx` must be 0-4 (top/left/right/help/sp)
3. **Phase Validation**: Cards can only be played in appropriate phases
4. **Zone Compatibility**: Cards must match leader's zone restrictions
5. **Turn Validation**: Must be current player's turn

## Testing Instructions:

### Backend Action Format Verification:
```javascript
// Expected action in browser console:
{
  type: 'PlayCard',      // or 'PlayCardBack' 
  card_idx: 0,          // Index in hand array
  field_idx: 0          // Zone index (0=top, 1=left, 2=right, 3=help, 4=sp)
}
```

### Testing Steps:
1. **Start Backend**: `npm run dev` in cardBackend
2. **Start Frontend**: `npm run dev` in cardFrontend  
3. **Create Game**: Use frontend UI to create game
4. **Join Game**: Add second player
5. **Test Card Play**: Drag card to zone and check console logs
6. **Verify Action**: Look for "Created backend action" logs with correct indices

### Debug Information:
The frontend now logs detailed action creation:
```
Created backend action for card c-1:
  - Frontend hand index: 0
  - Zone: top -> field_idx: 0
  - Face down: false -> type: PlayCard
```

### Expected API Flow:
```
1. User drags card to zone
2. Frontend calls createBackendAction()
3. Finds card index in hand array
4. Maps zone to field index  
5. Creates {type: 'PlayCard', card_idx: 0, field_idx: 0}
6. Sends to backend via playerAction API
7. Backend validates and processes action
8. Game state updates via polling
```

## Key Integration Points:

### Frontend Conversion Logic:
- **Hand Index**: `hand.findIndex(card => card.id === cardData.id)`
- **Zone Mapping**: `{'top': 0, 'left': 1, 'right': 2, 'help': 3, 'sp': 4}`
- **Face-down**: `cardData.faceDown ? 'PlayCardBack' : 'PlayCard'`

### Backend Processing:
- **Validation**: `checkIsPlayOkForAction(gameEnv, playerId, action)`
- **Processing**: `processAction(gameEnv, playerId, action)`
- **Hand Access**: `gameEnv[playerId].deck.hand[action.card_idx]`

The corrected implementation now properly aligns frontend card interactions with backend expectations, using the index-based system that the backend requires for validation and processing.