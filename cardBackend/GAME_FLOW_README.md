# Game Flow and API Usage Guide

This document explains the game flow logic in `processAction` and provides a complete API usage guide from game start to battle completion.

## ProcessAction Logic Overview

The `processAction` function in `src/mozGame/mozGamePlay.js` is the core game engine that handles all player actions. Here's how it works:

### 1. Blocking Logic (Lines 115-131)
```javascript
// Check for pending player actions that block normal gameplay
if (gameEnv.pendingPlayerAction) {
    // Block all actions until pending selection is completed
    // Only the player with pending action can complete it
}
```

**Purpose**: Ensures game integrity by preventing actions when a player needs to make a selection (e.g., card search effects).

### 2. Card Play Validation (Lines 134-220)
```javascript
if (action["type"] == "PlayCard" || action["type"] == "PlayCardBack") {
    // Validate position, hand index, card existence
    // Check zone compatibility and card placement rules
    // Validate card type vs phase restrictions
}
```

**Flow**:
1. **Position validation**: Ensure field position exists (top/left/right/help/sp)
2. **Hand validation**: Check card index is valid in player's hand
3. **Zone compatibility**: Use `CardEffectManager.checkSummonRestriction()` for leader/zone rules
4. **Phase restrictions**: SP cards only in SP_PHASE, characters/help in MAIN_PHASE
5. **Zone occupancy**: One card per zone, face-down rules for help zone

### 3. Card Placement (Lines 221-257)
```javascript
// Remove card from hand and place on field
// Process card effects immediately after placement
// Handle card selection if effects require user input
```

**Flow**:
1. **Move card**: Remove from hand, add to field with proper structure
2. **Effect processing**: Call appropriate effect handler based on card type
3. **Selection handling**: If effect requires user input, return selection prompt
4. **Point calculation**: Recalculate player points with new card effects

### 4. Effect Processing System
Card effects are processed based on card type:

- **Character cards**: `processCharacterCardEffects()` - Immediate "onSummon" effects
- **Help/SP cards**: `processUtilityCardEffects()` - Various utility effects
- **Leader cards**: Effects are processed continuously during point calculation

### 5. Turn Management (Lines 258-268)
```javascript
// Check if current turn is complete
// Advance to next turn or next phase
// Handle phase transitions (MAIN_PHASE → SP_PHASE → BATTLE_PHASE)
```

## Game Phases and Card Restrictions

### MAIN_PHASE
- **Character Cards**: ✅ Can be placed in top/left/right zones
- **Help Cards**: ✅ Can be placed in help zone (one per player)
- **SP Cards**: ❌ Cannot be played during MAIN_PHASE

### SP_PHASE (after all character zones filled)
- **SP Cards**: ✅ Can be placed in SP zone (one per player)
- **Character/Help Cards**: ❌ Cannot be played during SP_PHASE

### BATTLE_PHASE
- **No card placement**: Only battle resolution and scoring

## Complete API Flow: Game Start to Battle End

Here's the complete sequence of API calls for both players from game initialization to completing one battle:

### Phase 1: Game Setup
```javascript
// 1. Player 1 starts the game
POST /player/startGame
{
  "playerId": "playerId_1",
  "players": ["playerId_1", "playerId_2"]
}
// Returns: { success: true, gameId: "uuid", gameEnv: {...} }
// Game state: Both players receive initial hands, but game hasn't started yet

// 2. Both players ready up (with optional hand redraw)
POST /player/startReady
{
  "playerId": "playerId_1",
  "gameId": "uuid",
  "redraw": false    // Keep current hand
}
// Returns: { success: true, gameEnv: {...} }

POST /player/startReady  
{
  "playerId": "playerId_2",
  "gameId": "uuid", 
  "redraw": true     // Redraw hand (shuffle current hand back and draw new cards)
}
// Returns: { success: true, gameEnv: {...} }
// After both ready: Game enters MAIN_PHASE with final hands
```

#### Redraw Mechanic Explanation:
The `redraw` parameter allows players to mulligan (redraw) their starting hand once before the game begins:

- **redraw: false** - Keep the current hand as dealt
- **redraw: true** - Shuffle current hand back into deck and draw a fresh hand

**Redraw Rules:**
1. Each player can redraw **only once** during the ready phase
2. Redraw happens **before** the game officially starts
3. If a player redraws, their entire hand is shuffled back into their deck
4. They then draw a new hand of the same size
5. The game only begins after **both players** have marked ready (regardless of redraw choice)

**Strategic Considerations:**
- Use redraw if your starting hand lacks character cards or has poor synergy
- Consider your leader's zone compatibility when deciding to redraw
- Redraw if you have too many SP cards (can't play until late game)
- Keep hands with good character/help card balance

### Phase 2: MAIN_PHASE - Character and Help Card Placement
Players alternate turns placing cards until all character zones (3) + help zone (1) are filled.

```javascript
// Turn 1: Player 1 places character card (face-up)
POST /player/playerAction
{
  "gameId": "uuid",
  "playerId": "playerId_1",
  "action": {
    "type": "PlayCard",       // Face-up placement
    "card_idx": 0,            // Index in hand
    "field_idx": 0            // 0=top, 1=left, 2=right, 3=help, 4=sp
  }
}

// Alternative: Play card face-down (strategic/bluffing)
POST /player/playerAction
{
  "gameId": "uuid",
  "playerId": "playerId_1", 
  "action": {
    "type": "PlayCardBack",   // Face-down placement
    "card_idx": 2,            // Any card from hand
    "field_idx": 1            // Can place in any zone (with phase restrictions)
  }
}

// If card has search effect, might return:
{
  "requiresCardSelection": true,
  "cardSelection": {
    "selectionId": "playerId_1_timestamp",
    "eligibleCards": ["43", "44", "45"],
    "selectCount": 1,
    "prompt": "Select 1 card(s) from 3 available cards"
  },
  "gameEnv": { /* updated game state */ }
}

// Complete card selection:
POST /player/selectCard
{
  "gameId": "uuid",
  "selectionId": "playerId_1_timestamp", 
  "selectedCardIds": ["43"],
  "playerId": "playerId_1"
}

// Turn 2: Player 2 places character card
POST /player/playerAction
{
  "gameId": "uuid", 
  "playerId": "playerId_2",
  "action": {
    "type": "PlayCard",
    "card_idx": 1,
    "field_idx": 1        // left zone
  }
}

// Continue alternating until each player has:
// - 3 character cards (top, left, right zones)
// - 1 help card (help zone, can be face-down if no help effect desired)
```

### Phase 3: SP_PHASE - Special Card Placement
Game automatically transitions to SP_PHASE when all character+help zones are filled.

```javascript
// Player 1 SP card - MUST be played face-down
POST /player/playerAction
{
  "gameId": "uuid",
  "playerId": "playerId_1", 
  "action": {
    "type": "PlayCardBack",  // MUST be face-down in SP zone
    "card_idx": 2,
    "field_idx": 4           // 4 = SP zone
  }
}

// Player 2 SP card - MUST be played face-down
POST /player/playerAction
{
  "gameId": "uuid",
  "playerId": "playerId_2",
  "action": {
    "type": "PlayCardBack",  // MUST be face-down in SP zone
    "card_idx": 0,
    "field_idx": 4
  }
}

// After both SP zones filled, game automatically:
// 1. Reveals both SP cards
// 2. Executes SP effects in priority order (leader initialPoint)
// 3. Calculates battle results (power + combos)
// 4. Applies post-combo SP effects
// 5. Returns final battle results in BATTLE_PHASE
```

### Phase 4: BATTLE_PHASE - Battle Resolution
Game automatically calculates battle results and victory points.

```javascript
// Check battle results (automatically calculated after SP phase)
GET /player/playerId_1?gameId=uuid
// Returns game state with:
// - battleResults: {
//     playerId_1: { power: 250, combos: { totalBonus: 150 }, totalPoints: 400 },
//     playerId_2: { power: 180, combos: { totalBonus: 200 }, totalPoints: 380 },
//     winner: { playerId: "playerId_1", totalPoints: 400 }
//   }
// - spRevealComplete: true
// - Final victory points awarded
// - Overall game winner (if 50+ points reached)

// Start next round (if game continues)
POST /player/nextRound
{
  "gameId": "uuid"
}
// Returns: { success: true, gameEnv: {...} } // New round with next leaders
```

### Phase 5: Next Round (if game continues)
If no player has reached 50 victory points, the game continues to the next round:

```javascript
// Game automatically:
// 1. Advances to next leader (currentLeaderIdx++)
// 2. Clears all field zones
// 3. Resets to MAIN_PHASE
// 4. Players draw new hands and repeat the cycle
```

## Face-Down Card Mechanics

The game supports strategic face-down card placement for bluffing and zone filling:

### Face-Down Rules:
- **Any card type** can be played face-down in **any zone** (with phase restrictions)
- **Opponent cannot see** the card type or details when played face-down
- **Bypass all restrictions**: Face-down cards ignore leader zone compatibility and card effect restrictions
- **No power contribution**: Face-down cards contribute 0 power to battle calculations
- **No effects**: Face-down cards do not trigger their effects while face-down
- **No combos**: Face-down cards do not count toward combo bonuses
- **Permanent**: Most face-down cards stay face-down throughout the game

### Special Cases:
- **SP Zone Enforcement**: During SP_PHASE, cards MUST be played face-down in SP zone
- **SP Zone Reveal**: SP zone cards are revealed automatically after both players fill SP zones
- **SP Phase Restriction**: No cards can be played in SP zone during MAIN_PHASE (phase restriction)
- **Zone Filling**: Players can use face-down cards to fill required zones when lacking appropriate card types

### Strategic Uses:
1. **Zone Filling**: Play SP/Help cards face-down in character zones when you need to fill all zones
2. **Bluffing**: Play weak cards face-down to hide information from opponent
3. **Hand Management**: Use unwanted cards face-down instead of keeping them in hand
4. **Resource Conservation**: Save strong cards for later rounds while still filling zones

### Action Types:
- `"type": "PlayCard"` - Place card face-up (normal placement)
- `"type": "PlayCardBack"` - Place card face-down (strategic placement)

## Card Selection Flow
When cards trigger search effects during placement:

```javascript
// 1. Normal card play triggers search effect
POST /player/playerAction → Returns requiresCardSelection: true

// 2. Game blocks all other actions until selection completed
POST /player/playerAction → Returns "You must complete your card selection first"

// 3. Player completes selection  
POST /player/selectCard → Game resumes normal flow

// 4. Selected cards added to hand, remaining cards to deck bottom
```

## AI Opponent Integration
For games against AI, use the AI action endpoint:

```javascript
// After human player's turn, trigger AI
POST /player/playerAiAction
{
  "gameId": "uuid",
  "playerId": "playerId_2"  // AI player ID
}
// AI automatically selects and plays appropriate cards
```

## Game State Checking
Monitor game progress:

```javascript
// Get current state
GET /player/{playerId}?gameId={gameId}

// Response includes:
{
  "gameEnv": {
    "phase": "MAIN_PHASE|SP_PHASE|BATTLE_PHASE",
    "currentPlayer": "playerId_1",
    "pendingPlayerAction": null | { type: "cardSelection", selectionId: "..." },
    "playerId_1": {
      "Field": { /* placed cards */ },
      "deck": { "hand": [...] },
      "playerPoint": 25
    }
  }
}
```

## Error Handling
Common error scenarios:

- **Wrong phase**: "SP cards can only be played during SP phase"
- **Zone occupied**: "Character already in this position"  
- **Pending selection**: "You must complete your card selection first"
- **Invalid position**: "position out of range"
- **Zone compatibility**: "Leader does not allow [type] cards in [zone] field"

## Turn Skipping Logic
The game automatically skips turns when:

- All character zones (3) AND help zone (1) are filled for a player
- Search effects pre-place cards in zones, filling them early
- Player has no valid moves in current phase

This ensures smooth progression through game phases regardless of how cards are placed.