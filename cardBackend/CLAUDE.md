# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Node.js backend for "Revolution and Rebellion", a trading card game where leaders summon characters to compete based on power and combinations rather than direct combat. The game features a unique round-based system where judges award points to the most impressive rosters.

## Development Commands

```bash
# Start development server with hot reload
npm run dev

# Start production server  
npm start

# Run all tests
npm test

# Run tests in watch mode
npm test:watch

# Run specific test file
npm test -- --testNamePattern="cardEffects"

# Run custom test scenarios (full game flow validation)
npm run run-test
npm run run-testcase1
```

## Architecture Overview

### Core Game Flow
The game follows a specific battle flow managed by `mozGamePlay.js`:
1. **REDRAW_PHASE** - Initial hand management and redraw decisions
2. **DRAW_PHASE** - Card drawing 
3. **MAIN_PHASE** - Character/card placement
4. **BATTLE_PHASE** - Power calculation and winner determination
5. **END_PHASE** - Cleanup and next round preparation

### Key Modules

**Game Logic Layer:**
- `src/services/GameLogic.js` - Main game coordinator, handles game creation and flow
- `src/mozGame/mozGamePlay.js` - Core gameplay mechanics and phase management
- `src/mozGame/mozPhaseManager.js` - Game phase state management
- `src/services/CardEffectManager.js` - Card placement validation and effect processing

**Data Management:**
- `src/services/DeckManager.js` - Deck loading and player deck management
- `src/services/CardInfoUtils.js` - Card data utilities and queries
- `src/mozGame/mozDeckHelper.ts` - Deck preparation for games (TypeScript with comprehensive interfaces)
- `src/data/` - JSON files containing card definitions (cards.json, decks.json, etc.)

**API Layer:**
- `src/controllers/gameController.js` - HTTP request handlers
- `src/routes/gameRoutes.js` - Route definitions
- `server.js` - Express server setup with CORS and error handling

**Event System:**
- Real-time game state change tracking for frontend integration
- Comprehensive event types covering all game actions and errors
- Event persistence, acknowledgment, and automatic cleanup
- Polling-based frontend integration with precise change indicators

### Game Concepts

**Leaders/Summoners:** Each player has 4 leader cards that fight in sequence. Leaders have zone compatibility rules determining which character types can be summoned to their top/left/right zones.

**Character Cards:** Have power values and types/attributes. Must match leader's zone compatibility. Some have special effects or traits.

**Game Zones:** 
- Character zones (top, left, right) - for summoned characters
- Help card zone - for utility cards  
- Special (SP) card zone - for powerful special effects

**Victory:** First team to 50 victory points wins. Points awarded based on power totals and combos.

### Testing Structure

Tests are located in `src/tests/` with Jest configuration. The test system uses:
- **Jest tests** (`*.test.js`) - Unit tests for game logic components
- **Test scenarios** (`src/tests/scenarios/`) - JSON definitions for complex game situations
- **Setup/teardown** - Automatic server start/stop for integration tests (`setup.js`, `teardown.js`)
- **Test helpers** (`testHelpers.js`) - Utilities for API calls and test data management
- **Custom test scripts** (`test.cjs`, `test_case1.cjs`) - Full game flow validation and debugging tools

### Data Files

Game data is stored in JSON format with a new extensible structure:
- `src/data/characterCards.json` - Character card definitions with combo rules
- `src/data/leaderCards.json` - Leader/summoner card definitions with zone compatibility  
- `src/data/utilityCards.json` - Help and SP card definitions
- `src/data/decks.json` - Predefined deck configurations
- `src/gameData/` - Test scenario data files

#### New JSON Structure Features
**Unified Effect System:**
- Effect types: `continuous`, `triggered`
- Trigger events: `always`, `onSummon`, `onPlay`, `spPhase`, `finalCalculation`
- Advanced targeting with filters for game types and traits
- Priority system and unremovable effects for complex interactions

**Card Structure:**
- **Character Cards**: `gameType` (single), `traits` (array), `power`, `effects.rules[]`
- **Leader Cards**: `zoneCompatibility` object, `initialPoint`, `level`, `effects.rules[]`
- **Utility Cards**: Help and SP cards with unified effect system

**Combo System:**
Character card JSON includes combo rules:
- All same type: +250 points
- Two same type: +50 points  
- Freedom + Economy: +170 points
- Right-wing + Patriot: +150 points
- Left-wing + Economy: +120 points

#### Migration Notes
The previous JSON structure has been replaced:
- `cards.json` → `characterCards.json` (enhanced with combo rules)
- `summonerCards.json` → `leaderCards.json` (enhanced with zone compatibility)
- `spCard.json` → `utilityCards.json` (combined help and SP cards)

The new structure provides better type safety, extensibility, and programmer-friendly effect definitions.

## Recent Major Updates (January 2025)

### Card Structure Migration
- **Completed:** Full migration from old card structure to new extensible JSON format
- **Updated field mappings:**
  - `card["type"]` → `card["cardType"]` 
  - `card["value"]` → `card["power"]`
  - `card["attribute"]` → `card["traits"]`
  - `"monster"` → `"character"`
  - `"sky"` → `"top"`

### New Game Features Implemented
- **SP_PHASE:** Added to TurnPhase enum for special card execution
- **Card Effect System:** Complete implementation with continuous and triggered effects
- **Combo System:** 5 different combo types with point calculations
- **Priority System:** SP cards execute based on leader initial points (highest first)
- **Victory Conditions:** Round-based scoring with 50 victory points to win
- **Character Effects:** Process immediately on summon
- **Leader Effects:** Apply continuously throughout game

### Effect System
The game now supports complex card effects with:
- **Continuous effects:** Always active (e.g., power modifications)
- **Triggered effects:** Activate on specific events (e.g., onSummon, spPhase)
- **Targeting system:** Can target self, opponent, or both players' cards
- **Filtering system:** Target cards by type, traits, power, etc.
- **Priority system:** Effects execute in order of leader initial points
- **Two-phase SP execution:** Before combo calculation and after combo calculation
- **Face-down bypass:** Face-down cards don't trigger effects until revealed

### Phase Skipping System
Automatic phase skipping for pre-occupied zones:
- **Help Phase Skipping:** When Help zone is already occupied via search effects, players cannot play additional Help cards during MAIN_PHASE
- **SP Phase Skipping:** When SP zones are pre-occupied via search effects, the game automatically skips SP_PHASE if no players can play SP cards
- **Smart Phase Management:** The game checks all players' zones and hand contents to determine if phases should be skipped
- **Implementation:** `advanceToSpPhaseOrBattle()` function handles automatic phase progression with skipping logic

### SP Phase Complete System
Automatic SP reveal and battle calculation:
- **Face-down Enforcement:** All cards in SP zone must be played face-down during SP_PHASE
- **Auto-reveal Trigger:** When both players fill SP zones, cards automatically reveal
- **Priority Execution:** SP effects execute in leader initialPoint order (higher first, first player breaks ties)
- **Two-phase Effects:** Effects marked with combo keywords execute after combo calculation
- **Battle Results:** Complete power + combo calculation excluding face-down cards
- **Next Round API:** `POST /player/nextRound` advances to next leader after battle

### Main Phase Completion Logic
Enhanced main phase completion requirements:
- **Character Zone Requirement:** All 3 character zones (top, left, right) must be filled for each player
- **Help Zone Requirement:** Each player must have placed 1 card in Help zone (any card face-up or face-down)
- **Face-Down Card Mechanic:** Players can play any card face-down in Help zone if they don't want to use a Help card effect
- **Turn Skipping:** Players automatically skip turns when all character zones AND Help zone are occupied
- **Implementation:** `checkIsMainPhaseComplete()` validates both character and Help zone requirements before advancing to SP phase
- **Normal Flow:** Players typically have 4 turns (3 character cards + 1 card in Help zone) before SP phase
- **Card Effect Flow:** When search effects pre-place cards, players may skip turns and advance to SP phase early
- **Calculation:** Face-down cards in Help zone have no effect during power calculation

### Card Selection System
Interactive card selection for search effects:
- **Search Effects**: Cards can search deck for specific cards and prompt player selection
- **Destination Options**: 
  - `"hand"` - Selected cards go to hand (default)
  - `"spZone"` - Selected cards placed directly in SP zone
  - `"helpZone"` - Selected cards placed directly in Help zone
  - `"conditionalHelpZone"` - Conditional placement based on Help zone status
- **Card Examples**: 
  - **Edward Coristine (c-10)**: Search 7 cards, select 1 SP card to SP zone
  - **Luke Farritor (c-12)**: Search 7 cards, select 1 Help card → Help zone if empty, otherwise hand
  - **Elijah (c-9)**: Search 4 cards, select 1 card to hand
- **Conditional Logic**: 
  - Luke Farritor's effect always triggers the search
  - Selected Help card placement depends on Help zone availability at completion time
  - If Help zone empty → place in Help zone (triggers Help card effects)
  - If Help zone occupied → place in hand (no zone effects)
- **Implementation**: `completeCardSelection()` in `mozGamePlay.js` handles destination routing and conditional logic

### Automatic Target Selection (targetCount Effects)
Automatic target selection for single-target effects:
- **Target Count Logic**: When `targetCount: 1` is specified, automatically selects first valid target
- **No Player Interaction**: These effects do not require player selection UI
- **Character Card Examples**:
  - **c-21 (奧巴馬)**: Automatically boosts first ally character by +50
  - **c-20 (巴飛特)**: Automatically boosts first ally 富商 card by +50
- **Utility Card Examples**:
  - **h-2 (Make America Great Again)**: Requires player selection to set chosen opponent character power to 0
  - **h-14 (聯邦法官)**: Automatically nerfs first opponent 特朗普家族 card by -60
- **Implementation**: `getEffectTargets()` method in `mozGamePlay.js` handles automatic target selection
- **Processing**: Character effects processed in Step 2.5, utility effects in Step 3 of `calculatePlayerPoint`

### Test Suite Status
⚠️ **Note:** Test scenarios require updating to use new card IDs and structure
- Old test scenarios use deprecated card IDs (s47, S051, etc.)
- Test field references need updating from "sky" to "top"
- Card structure in test scenarios needs migration to new JSON format

### Data Structure
- **characterCards.json:** Character cards with combo rules and effects
- **leaderCards.json:** Leader cards with zone compatibility and continuous effects  
- **utilityCards.json:** Combined help/SP cards with priority and effect rules

When modifying game logic, ensure compatibility with the phase-based system and validate against existing test scenarios after updating them to the new structure.

## Face-Down Card Implementation
Strategic face-down placement system:
- **Complete restriction bypass:** Face-down cards ignore zone compatibility and card effect restrictions
- **Power/combo exclusion:** Face-down cards contribute 0 power and don't count toward combos  
- **Action types:** `"PlayCard"` (face-up) vs `"PlayCardBack"` (face-down)
- **SP zone enforcement:** During SP_PHASE, only face-down placement allowed in SP zone
- **Permanent status:** Face-down cards stay face-down except SP zone auto-reveal
- **Strategic uses:** Zone filling, bluffing, hand management, resource conservation

## Game Event System (January 2025)
Comprehensive real-time game state tracking for frontend integration:

### Event Architecture
- **Event Storage:** All events stored in `gameEnv.notificationQueue` array within game state
- **Event Persistence:** Events persist for 3 seconds (matching 1-second frontend polling)
- **Automatic Cleanup:** Expired and acknowledged events automatically removed
- **Unique IDs:** Each event has timestamp-based unique identifier

### ⚠️ CRITICAL: Event Acknowledgment Pattern for Phase Transitions
**Every card play triggers turn switch → DRAW_PHASE → requires acknowledgment → MAIN_PHASE**

**The Problem:** When a player plays a card, the game automatically switches to the next player in DRAW_PHASE. The phase will remain DRAW_PHASE until the `CARD_DRAWN` event is acknowledged.

**The Solution:** Always include acknowledgment steps in test scenarios and frontend flows:

```javascript
// 1. Player plays card (turns switch to DRAW_PHASE)
await testHelper.executePlayerAction('playerId_1', gameId, {
    type: 'PlayCard', card_idx: 0, field_idx: 1
});

// 2. MANDATORY: Acknowledge card draw event to proceed to MAIN_PHASE
await testHelper.acknowledgeEvents(gameId, eventIds);

// 3. Now player 2 can proceed with MAIN_PHASE actions
```

**Test Scenario Pattern:**
- Step N: Player plays card → phase becomes DRAW_PHASE
- Step N.5: Acknowledge CARD_DRAWN → phase becomes MAIN_PHASE  
- Step N+1: Next player can proceed with actions

**Backend API:**
- `POST /player/acknowledgeEvents` - Acknowledge specific event IDs
- `testHelper.acknowledgeEvents(gameId, eventIds)` - Helper for tests

### Event Categories
**Setup Events:**
- `GAME_STARTED` - Game creation with leader reveals and first player determination
- `INITIAL_HAND_DEALT` - Player receives starting hand
- `PLAYER_READY` - Individual player ready status with optional redraw
- `HAND_REDRAWN` - Player chose to redraw starting hand
- `GAME_PHASE_START` - Transition to MAIN_PHASE after both players ready
- `CARD_DRAWN` - Card drawn to hand during game

**Turn & Phase Events:**
- `TURN_SWITCH` - Player turn changed with old/new player data
- `PHASE_CHANGE` - Game phase transition with reason
- `ALL_MAIN_ZONES_FILLED` - All character and help zones complete
- `ALL_SP_ZONES_FILLED` - Both players filled SP zones, triggering reveal

**Card Action Events:**
- `CARD_PLAYED` - Card placed with full card details and zone
- `ZONE_FILLED` - Specific zone occupied (top/left/right/help/sp)
- `TRIGGER_HEALING` - Healing effect triggered (repair abilities)
- `CARD_SELECTION_REQUIRED` - Search effect needs player input
- `CARD_SELECTION_COMPLETED` - Player completed card selection

**SP & Battle Events:**
- `SP_CARDS_REVEALED` - Both SP cards revealed automatically  
- `SP_EFFECTS_EXECUTED` - SP effects processed in priority order
- `BATTLE_CALCULATED` - Power + combo calculation complete
- `VICTORY_POINTS_AWARDED` - Round winner determined and points awarded
- `NEXT_ROUND_START` - New leader battle begins

**Error & Validation Events:**
- `ERROR_OCCURRED` - Any validation error or failed action
- `CARD_SELECTION_PENDING` - Action blocked due to pending selection
- `WAITING_FOR_PLAYER` - Waiting for other player action
- `ZONE_COMPATIBILITY_ERROR` - Card placement restriction violation
- `PHASE_RESTRICTION_ERROR` - Wrong phase for attempted action
- `ZONE_OCCUPIED_ERROR` - Attempted to place card in occupied zone

### Frontend Integration
**Polling Strategy:**
- Frontend polls GET `/player/:playerId?gameId=X` every 1 second
- Detects unprocessed events in `gameEnv.notificationQueue` array
- Processes events based on type and triggers appropriate UI actions
- Calls POST `/player/acknowledgeEvents` to mark events as processed

**Event Structure:**
```json
{
  "id": "event_1640995200001",
  "type": "CARD_PLAYED", 
  "data": {
    "playerId": "playerId_1",
    "card": { "cardId": "43", "name": "Card Name", "power": 150 },
    "zone": "top"
  },
  "timestamp": 1640995200001,
  "expiresAt": 1640995203001,
  "frontendProcessed": false
}
```

**API Endpoints:**
- `POST /player/acknowledgeEvents` - Mark event IDs as processed
- All existing endpoints automatically generate appropriate events
- Event cleanup happens on every API call to prevent memory growth

### Implementation Benefits
- **Precise Change Detection:** Frontend knows exactly what changed instead of comparing entire game state
- **Efficient Updates:** Only process events when actual changes occur
- **Error Handling:** All validation failures generate specific error events
- **Reliability:** Event persistence prevents missed updates during network issues
- **Performance:** Automatic cleanup prevents memory growth

## Unified Effect System (January 2025) - SINGLE SOURCE OF TRUTH ARCHITECTURE

### Overview
**ARCHITECTURAL BREAKTHROUGH**: The field effects system has achieved complete unification by eliminating dual data structures. All effects now work directly on `gameEnv.players[playerId].fieldEffects` - a true single source of truth.

**What Changed:**
- ✅ **Eliminated dual data structures** - No more `computedState` vs `fieldEffects` separation
- ✅ **Removed merge operations** - No manual copying between data structures
- ✅ **Single source of truth** - All effects stored in `gameEnv.players[].fieldEffects`
- ✅ **Immediate availability** - Effects accessible to game logic and API without merge
- ✅ **Simplified codebase** - Eliminated 300+ lines of merge logic and dual processing

### Why This Change Was Necessary
The previous system had critical architectural issues:
- **Data Duplication**: Separate `computedState` and `fieldEffects` structures
- **Manual Synchronization**: Required merge operations to copy effects between structures
- **Multiple Sources of Truth**: Effects could exist in one structure but not the other
- **Complexity**: 200+ lines of merge logic throughout the codebase
- **Bug-Prone**: Easy to forget merge steps, causing effects to disappear

### New Single Source of Truth Architecture
```
BEFORE (Dual Data Structures):
┌─────────────────────┐    ┌─────────────────────┐
│    computedState    │    │    fieldEffects     │
│ - activeRestrictions│    │ - zoneRestrictions  │
│ - playerPowers      │ ➜  │ - activeEffects     │
│ - disabledCards     │    │ (needs manual merge)│
│ - victoryPointMods  │    └─────────────────────┘
└─────────────────────┘         Manual sync ❌

AFTER (Single Source of Truth):
┌─────────────────────────────────────────────┐
│      gameEnv.players[].fieldEffects         │
│ ✅ zoneRestrictions (immediate access)      │
│ ✅ activeEffects (immediate access)         │  
│ ✅ specialEffects (immediate access) 🆕     │
│ ✅ calculatedPowers (immediate access)      │
│ ✅ disabledCards (immediate access)         │
│ ✅ victoryPointModifiers (immediate access) │
│     No merge needed! Single source! 🎯     │
└─────────────────────────────────────────────┘
```

### Core Components

**Backend Implementation:**
- `EffectSimulator` - SINGLE service class handling ALL effect logic with direct gameEnv updates
- `gameEnv.players[].fieldEffects` - THE ONLY source of truth for all effect data
- `PlaySequenceManager` - Records all actions including `PLAY_LEADER` for unified replay
- No separate data structures - everything works on the same unified structure

**Frontend Integration:**
- Zero changes required - same API responses now with immediate effect availability
- Real-time effect data via existing polling system (effects already in response)
- All effect calculations happen transparently in single source of truth

### Enhanced fieldEffects Structure (Single Source of Truth)

**Complete Data Structure:**
```javascript
gameEnv.players[playerId].fieldEffects = {
  // Zone restrictions from leaders (immediate access)
  zoneRestrictions: {
    TOP: ["右翼", "自由", "經濟"],    // Trump's restrictions
    LEFT: ["右翼", "自由", "愛國者"],
    RIGHT: ["右翼", "愛國者", "經濟"],
    HELP: "ALL",
    SP: "ALL"
  },
  
  // Active effects from leaders and cards (immediate access)
  activeEffects: [
    {
      effectId: "s-1_powerBoost",
      source: "s-1",
      type: "powerBoost", 
      target: { scope: "SELF", gameTypes: ["右翼", "愛國者"] },
      value: 45
    }
  ],
  
  // NEW: Special gameplay effects (unified structure - January 2025)
  specialEffects: {
    zonePlacementFreedom: true,        // h-5 (失智老人) zone freedom
    immuneToNeutralization: true       // h-5 immunity to h-1 neutralization
  },
  
  // NOTE: Calculated powers now stored directly in zone cards as currentPower field
  // No longer need separate calculatedPowers storage
  
  // NEW: Disabled cards (no more computedState!)
  disabledCards: [],
  
  // NEW: Victory point modifiers (no more computedState!)
  victoryPointModifiers: 0
}
```

**Immediate Availability:**
- ✅ **Zone Restrictions**: Available instantly for card placement validation
- ✅ **Power Calculations**: Stored directly in fieldEffects.calculatedPowers
- ✅ **Effect Tracking**: All active effects in fieldEffects.activeEffects
- ✅ **API Responses**: Already included in gameEnv.players structure
- ✅ **Game Logic**: Direct access without any merge operations

### Integration Guide

**Accessing Effect Data (Single Source of Truth):**
```javascript
// Zone restrictions for card placement validation
const restrictions = gameEnv.players[playerId].fieldEffects.zoneRestrictions;

// Card powers now stored directly in zone cards (NEW - January 2025)
const leftCard = gameEnv.zones[playerId].left[0];
const cardPower = leftCard.currentPower; // Direct access to final power!

// Active effects for game logic
const effects = gameEnv.players[playerId].fieldEffects.activeEffects;

// Special gameplay effects (NEW - replaces specialStates)
const hasZoneFreedom = gameEnv.players[playerId].fieldEffects.specialEffects?.zonePlacementFreedom;
const isImmune = gameEnv.players[playerId].fieldEffects.specialEffects?.immuneToNeutralization;

// Disabled cards check
const isDisabled = gameEnv.players[playerId].fieldEffects.disabledCards.includes(cardId);
```

**Enhanced Zone Card Access (NEW - January 2025):**
```javascript
// Direct access to card power through zone cards - no separate lookup needed!
const getCardCurrentPower = (gameEnv, playerId, zone, cardIndex = 0) => {
  const zoneCard = gameEnv.zones[playerId][zone][cardIndex];
  return zoneCard?.currentPower || zoneCard?.cardData?.power || 0;
};

// Zone restrictions and other effects still accessed through fieldEffects
const getZoneRestrictions = (gameEnv, playerId) => gameEnv.players[playerId].fieldEffects.zoneRestrictions;
const getActiveEffects = (gameEnv, playerId) => gameEnv.players[playerId].fieldEffects.activeEffects;
const isCardDisabled = (gameEnv, playerId, cardId) => gameEnv.players[playerId].fieldEffects.disabledCards.includes(cardId);
```

**Benefits for Developers:**
- ✅ **No Merge Logic**: Never worry about copying data between structures
- ✅ **Immediate Access**: All effect data available instantly after simulation
- ✅ **Single Source**: One place to check for all effect-related data
- ✅ **API Ready**: Data already in format expected by frontend
- ✅ **Simplified Debugging**: Single location for all effect state

### Integration Points

**Game Setup:**
- `initializePlayerFieldEffects()` - Initialize field effects structure for compatibility
- EffectSimulator handles ALL leader effects through unified play sequence replay
- Leaders recorded as `PLAY_LEADER` actions for consistent effect processing
- Called during initial game setup and leader changes

**Card Placement:**
- `validateCardPlacementWithFieldEffects()` - Check zone restrictions
- Integrated into `processAction()` card placement validation
- Prevents invalid card placements based on leader restrictions

**Power Calculation:**
- EffectSimulator handles all power modifications through `calculateCardPowerWithLeaderEffects()`
- Integrated into `calculateFinalState()` during simulation
- Processes effects in order: power boosts, then nullifications
- All leader effects applied through unified play sequence system

**Leader Changes:**
- Leaders recorded as new `PLAY_LEADER` actions in play sequence
- EffectSimulator automatically handles leader effect transitions through replay
- No manual clearing needed - unified system manages all leader effects

### Migration from Dual System (January 2025)

**REMOVED Functions (No Longer Needed):**
- ❌ `processLeaderFieldEffects()` - Functionality moved to EffectSimulator
- ❌ `processAllFieldEffects()` - Replaced by unified play sequence replay
- ❌ `clearPlayerLeaderEffects()` calls in mozGamePlay - Automatic through replay
- ❌ Manual field effect initialization in various places

**REMOVED Data Structures (January 2025):**
- ❌ `gameEnv.specialStates` - Special gameplay effects moved to `fieldEffects.specialEffects`
- ❌ Dual storage for zone placement freedom - Now unified in single location

**NEW Unified Processing:**
- ✅ `processCompleteLeaderEffects()` - Complete leader processing in EffectSimulator
- ✅ `calculateCardPowerWithLeaderEffects()` - Unified power calculation
- ✅ `PLAY_LEADER` actions in play sequence - Leaders treated like any other card play
- ✅ Automatic effect transitions - No manual synchronization needed
- ✅ `fieldEffects.specialEffects` - Unified storage for zone freedom and immunity effects

**Developer Impact:**
- **No API Changes**: Frontend continues to work without modification
- **Simplified Logic**: Single point of truth for all effect processing
- **Better Performance**: Single simulation pass instead of multiple systems
- **Easier Debugging**: All effects traceable through play sequence replay
- **Future Extensions**: Easy to add new effect types to unified system

**Testing Impact:**
- All existing tests continue to work
- `injectGameState` automatically handles leader effects through play sequence
- Dynamic tests now properly apply leader restrictions without manual setup

### Leader Card Examples

**S-1 (特朗普):**
```javascript
"fieldEffects": [
  {
    "type": "ZONE_RESTRICTION",
    "target": { "scope": "SELF", "zones": ["TOP", "LEFT", "RIGHT"] },
    "restriction": {
      "TOP": ["右翼", "自由", "經濟"],
      "LEFT": ["右翼", "自由", "愛國者"],
      "RIGHT": ["右翼", "愛國者", "經濟"]
    }
  },
  {
    "type": "powerBoost",
    "target": { "scope": "SELF", "zones": "ALL", "gameTypes": ["右翼", "愛國者"] },
    "value": 45
  }
]
```

**Powell (鮑威爾):**
```javascript
"fieldEffects": [
  {
    "type": "POWER_NULLIFICATION",
    "target": { "scope": "OPPONENT", "zones": "ALL", "traits": ["經濟"] },
    "value": 0
  }
]
```

### Frontend Integration

**GameStateManager Methods:**
- `getPlayerFieldEffects(playerId)` - Access player's field effects
- `getZoneRestrictions(playerId, zone)` - Get zone restrictions
- `canPlayCardInZone(card, zone, playerId)` - Validate card placement
- `getModifiedCardPower(card, playerId)` - Calculate modified power

**API Response:**
- Field effects included in `gameEnv.players[playerId].fieldEffects`
- Real-time updates via polling system
- Automatic field effect updates when leaders change

### Error Handling

**New Error Types:**
- `FIELD_EFFECT_RESTRICTION` - Card placement blocked by leader restriction
- Error events generated when players attempt invalid placements
- Clear error messages indicating which restriction was violated

### Performance Considerations

- Field effects calculated on-demand during validation and battle
- Efficient targeting system filters effects by scope and card properties
- Automatic cleanup when leaders change to prevent memory leaks
- Minimal impact on existing game flow and performance

## Phase Field Consolidation (January 2025)

### Issue Resolved
The `gameEnv` object previously contained two redundant phase-related fields:
- `roomStatus` - Used by GameLogic.js for API flow control
- `phase` - Used by mozGamePlay.js for game mechanics

Having duplicate fields caused confusion and potential sync issues.

### Solution Implemented
**Field Consolidation:**
- **Eliminated `roomStatus`** - Removed all references throughout the backend
- **Single Source**: Use only `gameEnv.phase` for all game state tracking
- **Utility Function**: Added `updatePhase(gameEnv, newPhase)` helper in GameLogic.js
- **Consistent Updates**: All phase transitions use the utility function
- **Logging**: Added phase update logging for debugging

**Simplified Structure:**
- **`phase`** - Single field for current game state
- **Values**: `WAITING_FOR_PLAYERS`, `BOTH_JOINED`, `REDRAW_PHASE`, `DRAW_PHASE`, `MAIN_PHASE`, `SP_PHASE`, `BATTLE_PHASE`
- **No Duplication** - Eliminated redundant field and sync complexity

**Usage Guidelines:**
- Always use `updatePhase(gameEnv, newPhase)` for phase changes
- Check `gameEnv.phase` for current game state
- Frontend uses single `phase` field for all phase-related logic

## Turn Mechanics System (January 2025)

### Core Turn Rules
The game implements strict turn-based mechanics where each card placement automatically ends the current player's turn:

**Turn Switching Logic:**
- Every card placement (PlayCard/PlayCardBack) triggers `shouldUpdateTurn()`
- Turn ends immediately after successful card placement
- System automatically switches to next player via `startNewTurn()`
- New player enters DRAW_PHASE and draws 1 card automatically

**Turn Counter System:**
- Uses integer-based turn counter (`currentTurn + 1`)
- Odd turns (1,3,5...) = first player, Even turns (2,4,6...) = second player
- Eliminates complex fractional math for better reliability and debugging

**Implementation Flow:**
1. `processAction()` → Card placement validation and execution
2. `shouldUpdateTurn()` → Check if player played a card this turn
3. `startNewTurn()` → Switch players, increment turn, draw card, set DRAW_PHASE
4. Player must acknowledge draw before proceeding to MAIN_PHASE

## Code Architecture Refactoring (January 2025)

### Service Layer Reorganization
**MAJOR REFACTORING**: Completed comprehensive reorganization of service layer classes to improve code organization, maintainability, and separation of concerns.

### PlayerCardManager.ts - Card Management Hub
**NEW CENTRALIZED CARD OPERATIONS**: All card-related operations moved to dedicated PlayerCardManager class.

**Moved Methods from GameEngine.ts:**
- `drawCards(deck, count)` - Card drawing functionality
- `findSlotByCarduid(player, carduid)` - Card location utilities
- `findFirstEmptySlot(playerZones)` - Empty slot finder
- `createUniqueCardId(originalCardId)` - Card ID generation with UUID
- `moveCardToTrash(gameEnv, playerId, carduid, cardId, cardData)` - Card movement to trash
- `moveCardToTrashFromSlot(gameEnv, playerId, slotName, card, cardType)` - Card movement from slot to trash
- `updateUnitHP(unit, newHP)` - Unit HP management
- `updatePilotHP(pilot, newHP)` - Pilot HP management
- `checkForDeployEffects(carduid)` - Deploy effect detection

**Benefits Achieved:**
- ✅ **Centralized Card Logic**: All card operations in single manager class
- ✅ **Reduced GameEngine Complexity**: GameEngine focuses on game flow, not card details
- ✅ **Improved Maintainability**: Card-related functionality easier to find and modify
- ✅ **Consistent API**: All card operations accessible through PlayerCardManager
- ✅ **Better Testing**: Card operations can be tested independently

### DeployEffectManager.ts - Deploy Effect Processing
**DEPLOY EFFECT CONSOLIDATION**: All deploy effect functionality moved to dedicated DeployEffectManager class.

**Moved Methods from GameEngine.ts:**
- `applyDeployEffectToTarget(gameEnv, deployEffect, target, playerId)` - Apply deploy effects to targets
- `executeDeployEffect(event, gameEnv)` - Execute deploy effect triggered events
- `executeDeployTargetChoice(event, gameEnv)` - Handle deploy target selection events

**Enhanced Functionality:**
- ✅ **Complete Deploy Processing**: All deploy effect logic in one place
- ✅ **Target Selection**: Automatic and manual target selection support
- ✅ **Effect Application**: Damage, rest, AP/HP modification effects
- ✅ **Event Integration**: Full integration with game event system

### GameEventFactory.ts - Event Creation Hub
**NEW EVENT FACTORY**: Created dedicated GameEventFactory class to centralize all event creation logic.

**Event Creation Methods:**
- `createPairingEffectEvent(eventData, pairingEffects, placementResult)` - Pairing effect events
- `createDeployEffectEvent(eventData, deployEffects)` - Deploy effect events
- `createBurstDeployEvent(playerId, carduid, cardData, burstEffect)` - Burst deploy 

**Utility Methods:**
- `generateEventId(prefix, suffix?)` - Unique event ID generation
- `createBaseEvent(type, playerId, data, options?)` - Base event structure creation

**Benefits Achieved:**
- ✅ **Centralized Event Creation**: All general event creation in one place
- ✅ **Consistent Event Structure**: Events created with consistent patterns and IDs
- ✅ **Reduced Code Duplication**: Common event creation patterns reused
- ✅ **Better Separation of Concerns**: GameEngine focuses on execution, not event creation
- ✅ **Easier Maintenance**: Event creation logic easier to find and modify

### Updated Reference Architecture
**Before Refactoring:**
```
GameEngine.ts (2000+ lines)
├── Game execution logic
├── Card management operations ❌
├── Deploy effect processing ❌
├── Event creation methods ❌
├── HP/stats calculations ❌
└── Utility functions ❌
```

**After Refactoring:**
```
GameEngine.ts (Focused - ~1500 lines)
├── Game execution logic ✅
├── Event dispatching ✅
└── Core game flow ✅

PlayerCardManager.ts (New)
├── Card placement operations ✅
├── Card movement (hand/trash) ✅
├── HP/stats calculations ✅
├── Card location utilities ✅
└── Deploy effect detection ✅

DeployEffectManager.ts (Enhanced)
├── Deploy effect processing ✅
├── Target selection logic ✅
├── Effect application ✅
└── Deploy event execution ✅

GameEventFactory.ts (New)
├── Event creation methods ✅
├── Event ID generation ✅
├── Base event structures ✅
└── Consistent event patterns ✅
```

### Migration Impact
**Zero Breaking Changes:**
- ✅ All existing functionality preserved
- ✅ All API endpoints continue to work
- ✅ All tests pass without modification
- ✅ Frontend integration unchanged

**Updated References:**
- **12 references** in GameEngine.ts updated to use PlayerCardManager
- **4 references** updated to use DeployEffectManager
- **4 references** updated to use GameEventFactory
- All method calls properly reference new manager classes

**Cleanup Completed:**
- ✅ Removed unused imports (v4 as uuidv4, SLOT_ZONES, createZoneCard)
- ✅ Fixed TypeScript warnings with unused parameter prefixes
- ✅ Removed duplicate method definitions
- ✅ All TypeScript compilation errors resolved

### CardSystem.ts - Card Database Management Hub
**CARD DATABASE MIGRATION**: Moved all card database functionality from GameEngine.ts to CardSystem.ts for better organization.

**New CardDatabaseManager Class:**
- `getCardDetails(cardId)` - Get card data from database
- `cardExists(cardId)` - Check if card exists in database
- `getAllCards()` - Get all cards from database
- `getCardsByType(cardType)` - Filter cards by type
- `searchCards(criteria)` - Advanced card search with filters
- `reloadDatabase()` - Reload database (useful for testing)
- `getDatabaseStats()` - Get database statistics and card counts

**Migration Benefits:**
- ✅ **Logical Organization**: Card database now in CardSystem.ts where it belongs
- ✅ **Enhanced Functionality**: Added utility methods for card searching and management
- ✅ **Better Separation of Concerns**: GameEngine no longer handles data access
- ✅ **Centralized Card Operations**: All card-related functionality in CardSystem.ts
- ✅ **Zero Breaking Changes**: All existing functionality preserved

**Updated References (9 files):**
- GameEngine.ts, PlayerCardManager.ts, ShieldCardManager.ts, BaseCardManager.ts
- CardEffect.ts, StateBasedActionEngine.ts, Player.ts
- All files now import `CardDatabaseManager` from `../models/CardSystem`

### Developer Guidelines
**When Working with Card Data:**
- Use `CardDatabaseManager` from CardSystem.ts for all card database operations
- Card data retrieval, existence checks, database searches
- Database statistics and management operations

**When Working with Card Operations:**
- Use `PlayerCardManager` for all card-related operations
- Card placement, movement, HP updates, stats calculations
- Card location utilities and unique ID generation

**When Working with Deploy Effects:**
- Use `DeployEffectManager` for all deploy effect processing
- Effect application, target selection, event execution
- Deploy effect validation and processing

**When Creating Events:**
- Use `GameEventFactory` for general event creation
- Consistent event structure and ID generation
- Specialized events (shield attacks, burst choices) still use existing EventFactory

**Code Organization Benefits:**
- **Easier Debugging**: Related functionality grouped together
- **Better Testing**: Isolated functionality easier to test
- **Improved Maintainability**: Clear separation of concerns
- **Scalable Architecture**: Easy to add new functionality to appropriate managers
- **Logical Data Access**: Card database operations in CardSystem.ts where they belongASE

**Critical Rule**: Players cannot place multiple cards in a single turn. Each card placement immediately ends the turn and switches to the opponent.

## Testing Infrastructure & Game State Injection

### Game State Injection System (January 2025)

**Important Fix for Field Effects and Play Sequence Initialization:**
The `injectGameState` method (`POST /test/injectGameState`) now properly initializes both field effects and play sequence when injecting test scenarios. This critical fix addresses issues where test scenarios would skip leader restrictions and effect simulation.

**Fixed Injection Process:**
1. **Play Sequence Setup**: Initializes play sequence if not present
2. **Leader Play Recording**: Automatically records leader plays in proper first-player order if leaders exist in zones but not in sequence
3. **Unified Effect Simulation**: Runs `simulateCardPlaySequence()` to process all plays including leaders
4. **State Persistence**: Saves the fully initialized game state with complete play history

**Impact:**
- Test scenarios with leaders now properly apply zone restrictions and power effects
- Leader plays are correctly recorded in play sequence for effect simulation
- Dynamic tests no longer skip validation steps or field effect processing
- Injected scenarios work identically to normal game flow with unified effect system
- Leader power boosts, zone compatibility, and cross-player effects work in injected scenarios

**Usage in Testing:**
```javascript
// The injection now includes proper play sequence and field effects setup
await testHelper.injectGameState(gameId, gameEnv);
// Leader plays are automatically recorded and effects simulated - no manual initialization needed
```

**Technical Details:**
- Detects leaders in `gameEnv.zones` but missing from `gameEnv.playSequence.plays`
- Records `PLAY_LEADER` actions in first-player order matching normal game startup
- Uses unified `simulateCardPlaySequence()` approach eliminating duplicate field effect processing
- Maintains consistency with consolidated field effects system

**Background:**
Previously, `injectGameState` bypassed both the play sequence recording and field effects initialization that occurs during normal game setup, causing test scenarios to run with default "ALL" zone permissions and missing effect simulation.

## Game Constants Configuration (January 2025)

### Centralized Slot Zone Constants
**Single Source of Truth for Game Zones** - All slot zone references now use centralized constants:

**Core Configuration:**
- **`src/config/gameConstants.ts`** - Central location for all game constants
- **SLOT_ZONES constant**: `['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']` as const
- **Type safety**: SlotZone type definition for TypeScript validation
- **Additional constants**: ZONE_TYPES, GAME_PHASES, CONTINUOUS_EFFECT_TYPES

**Complete Configuration Structure:**
```typescript
// Slot zones for continuous effects processing
export const SLOT_ZONES = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'] as const;
export type SlotZone = typeof SLOT_ZONES[number];

// Zone types for game mechanics
export const ZONE_TYPES = {
    BASE: 'base',
    SHIELD_AREA: 'shieldArea', 
    ENERGY_AREA: 'energyArea',
    TRASH_AREA: 'trashArea',
    LEADER: 'leader'
} as const;
```

**Benefits:**
- **📍 Single Source of Truth** - All slot zone references point to one location
- **🔧 Easy Maintenance** - Changes to slot zones only need to be made in one file
- **⚡ Type Safety** - TypeScript SlotZone type prevents invalid slot references
- **🧹 Code Cleanup** - Eliminated 7+ redundant array declarations across codebase
- **📈 Extensibility** - Easy to add more game constants in the same location
- **🔄 Consistency** - All continuous effects processing uses same slot definitions

**Usage Example:**
```typescript
import { SLOT_ZONES } from '../config/gameConstants';

// Before: Hardcoded arrays scattered throughout codebase
// const slotZones = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];

// After: Centralized constant
for (const slotName of SLOT_ZONES) {
  const slot = player.zones[slotName];
  // Process slot for continuous effects...
}
```

**Files Updated with Centralized Constants:**
- `src/services/CardEffect.ts` - 4 occurrences replaced (main effects processing)
- `src/services/GameEngine.ts` - 2 occurrences replaced (card lookup methods)
- `src/services/EventQueue/StateBasedActionEngine.ts` - 1 occurrence replaced (repair ability processing)

**Impact:**
- Eliminated duplicate hardcoded arrays across 7+ locations in codebase
- Improved maintainability for future slot zone modifications
- Enhanced type safety for slot zone references
- Simplified debugging and code readability

## Unified Effect Value Structure (January 2025)

### Overview
**Simplified Effect Processing Architecture** - All card effects now use a unified `value` parameter structure, eliminating complex string parsing and inconsistent parameter naming across the system.

**Key Benefits:**
- **🎯 Single Parameter Name**: All numeric effects use `value` instead of mixed `modifier`/`amount`/`count`
- **⚡ Performance**: Eliminated string parsing overhead (`"+1"` → `1`)
- **🔒 Type Safety**: Always numeric values, no string/number confusion
- **🧹 Code Simplicity**: Reduced effect processing from 15+ lines to 3 lines
- **🔮 Future-Proof**: Easy to add new effect types without parameter complexity

### Unified Card Data Structure

**Before: Complex Mixed Structure**
```json
// Multiple parameter names requiring different processing
{
    "effect": {
        "action": "modifyAP",
        "parameters": { "modifier": "+1" }  // String parsing needed
    }
},
{
    "effect": {
        "action": "heal", 
        "parameters": { "amount": 2 }       // Different parameter name
    }
},
{
    "effect": {
        "action": "addToHand",
        "parameters": { "count": 1 }        // Yet another parameter name
    }
}
```

**After: Unified Simple Structure**
```json
// Single parameter name for all numeric effects
{
    "effect": {
        "action": "modifyAP",
        "parameters": { "value": 1 }        // Direct numeric value
    }
},
{
    "effect": {
        "action": "heal",
        "parameters": { "value": 2 }        // Same parameter name
    }
},
{
    "effect": {
        "action": "addToHand", 
        "parameters": { "value": 1 }        // Consistent across all effects
    }
}
```

### Effect Processing Simplification

**Before: Complex Multi-Case Processing**
```typescript
static getEffectValue(action: string, parameters: any): number {
    switch (action) {
        case 'modifyAP':
        case 'modifyHP':
            return parameters.modifier ? CardEffect.parseModifier(parameters.modifier) : 0;
        case 'heal':
        case 'damage':
            return parameters.amount || 0;
        case 'addToHand':
            return parameters.count || 1;
        case 'restrict_attack':
        case 'rest':
        case 'deploy':
            return 0;
        default:
            console.log(`⚠️ Unknown action type: ${action}`);
            return 0;
    }
}

static parseModifier(modifier: string | number): number {
    if (typeof modifier === 'number') return modifier;
    if (typeof modifier !== 'string') return 0;
    
    const cleanValue = modifier.replace(/[^\d\-\+]/g, '');
    return parseInt(cleanValue, 10) || 0;
}
```

**After: Single-Line Processing**
```typescript
static getEffectValue(action: string, parameters: any): number {
    // Unified structure: all numeric effects use 'value' parameter
    return parameters.value || 0;
}

// parseModifier method completely removed!
```

### Positive and Negative Effects

**Positive Effects (Buffs)**
```json
{
    "effect": {
        "action": "modifyAP",
        "parameters": { "value": 1 }        // +1 AP boost
    }
},
{
    "effect": {
        "action": "heal",
        "parameters": { "value": 3 }        // Heal 3 HP
    }
}
```

**Negative Effects (Debuffs)**
```json
{
    "effect": {
        "action": "modifyAP", 
        "parameters": { "value": -2 }       // -2 AP reduction
    }
},
{
    "effect": {
        "action": "modifyHP",
        "parameters": { "value": -1 }       // -1 HP reduction
    }
}
```

### Real Card Examples

**ST01-001 "Gundam" Effects**
```json
{
    "effects": {
        "rules": [
            {
                "effectId": "repair_2",
                "effect": {
                    "action": "heal",
                    "parameters": { "value": 2 }    // Repair 2 HP
                }
            },
            {
                "effectId": "pair_ap_boost_all", 
                "effect": {
                    "action": "modifyAP",
                    "parameters": { "value": 1 }    // +1 AP to all units
                }
            }
        ]
    }
}
```

### Performance Impact

**Processing Comparison:**
```typescript
// Before: Complex parsing with potential errors
const modifier = "+1";
const cleanValue = modifier.replace(/[^\d\-\+]/g, '');  // Regex processing
const value = parseInt(cleanValue, 10) || 0;           // String conversion
card.currentAP += value;                                // Final application

// After: Direct numeric operation
const value = parameters.value || 0;                   // Direct access
card.currentAP += value;                                // Immediate application
```

**Performance Benefits:**
- **🚀 No String Parsing**: Eliminated regex processing and parseInt calls
- **⚡ Reduced CPU**: Direct numeric operations instead of string manipulation
- **🔒 Compile-Time Safety**: TypeScript can validate numeric types
- **🧪 Easier Testing**: Predictable numeric values, no parsing edge cases

### Developer Guidelines

**Adding New Effect Types:**
```typescript
// All new effects follow the same pattern
{
    "action": "newEffectType",
    "parameters": { 
        "value": 5,                     // Always use 'value' for numeric effects
        "additionalParam": "specific"   // Use specific names for non-numeric params
    }
}

// Processing remains the same
const numericValue = CardEffect.getEffectValue(action, parameters);  // Always works
```

**Validation Rules:**
- ✅ **Always use `value`** for numeric effect parameters
- ✅ **Use numeric types** in JSON (not strings like `"+1"`)
- ✅ **Positive/negative** values indicate buff/debuff naturally
- ✅ **Zero values** for non-numeric effects or default states

### Migration Notes

**Files Updated in Migration:**
- **`st01Card.json`**: All effect parameters converted to unified structure
- **`CardEffect.ts`**: Simplified getEffectValue method and removed parseModifier
- **`GameEngine.ts`**: Updated heal effect processing to use `value` parameter
- **`StateBasedActionEngine.ts`**: Updated repair ability processing
- **Instance methods**: Updated executeHeal and executeAddToHand methods

**Backward Compatibility:**
- **Breaking Change**: Old parameter names (`modifier`, `amount`, `count`) no longer supported
- **Migration Required**: All card data must use new `value` structure
- **Code Simplification**: Significant reduction in processing complexity

## Continuous Effects System (January 2025)

### Overview
**Enhanced Three-Phase Architecture** - Complete continuous effects processing with intelligent cleanup, source tracking, and future-proof method naming:

**Core Components:**
- **`src/services/CardEffect.ts`** - SINGLE FILE containing all continuous effects logic
- **`src/config/gameConstants.ts`** - Unified slot zone constants (`SLOT_ZONES`) for consistency
- **Array-based storage** with duplicate prevention using `effectId + sourceCarduid` keys
- **Three-phase processing**: Phase 0 (cleanup), Phase 1 (storage), Phase 2 (application)
- **Switch-case architecture** for different effect types (ALWAYS_ACTIVE, PAIR_TRIGGERED, LINK_TRIGGERED)

### Enhanced Three-Phase Effect Flow
```
🧹 PHASE 0: Clean up stale effects (removes effects from cards no longer in field)
💾 PHASE 1: Add new continuous effects to cards  
✅ PHASE 2: Apply stored effects to cards
```

**Complete Processing Flow:**
1. **`processAllContinuousEffects(gameEnv)`** - Main orchestration entry point
2. **PHASE 0 (Cleanup):** `cleanupStaleEffectsForPlayer()` - Remove effects from cards no longer in field
3. **PHASE 1 (Storage):** `updatePlayerSlotsContinuousEffects()` - Process each player's slots for new effects
4. **Slot Detection:** `detectSlotState()` - Determine slot conditions (paired, linked, etc.)
5. **Effect Processing:** `updateCardContinuousEffects()` - Extract and classify effects from individual cards
6. **Effect Storage:** `addContinuousEffect()` - Store effects (Phase 1 - no immediate application)
7. **PHASE 2 (Application):** `applyContinuousEffects()` - Apply stored effects (activate and apply values)

### Phase 0 Cleanup System (NEW - January 2025)
**Intelligent Stale Effect Removal:**

**Problem Solved:**
- Prevents "ghost effects" from cards no longer in the field
- Eliminates effect accumulation that could break game balance
- Ensures effect source validation for consistent game state

**Implementation:**
```typescript
// Phase 0: Clean up stale effects for each player
console.log(`🧹 PHASE 0: Cleaning stale effects for player ${playerId}`);
const effectsRemoved = CardEffect.cleanupStaleEffectsForPlayer(player, playerId, gameEnv);
console.log(`   Removed ${effectsRemoved} stale effects`);
```

**Cleanup Logic:**
1. **Get current field state** - Collect all `carduid` values from slots (units and pilots)
2. **Validate effect sources** - Check each effect's `sourceCarduid` against current field
3. **Remove stale effects** - Filter out effects whose source cards are no longer present
4. **Comprehensive coverage** - Clean effects on both unit and pilot cards in all slots

**Key Methods:**
- **`cleanupStaleEffectsForPlayer()`** - Main Phase 0 cleanup method for single player
- **`removeStaleEffectsFromCard()`** - Individual card cleanup with source validation
- **Logging transparency** - Clear console output showing which effects are removed and why

**Example Cleanup Log:**
```
🧹 PHASE 0: Cleaning stale effects for player playerId_1
   🗑️ Removing stale effect pair_ap_boost_all from source source-card-123
   Removed 2 stale effects
```

### Effect Types (Switch-Case Generalization)
**Unified Processing Architecture:**
- **ALWAYS_ACTIVE** - Continuous effects like ST01-009 "Zowort" attack restrictions
- **PAIR_TRIGGERED** - Effects that activate when unit+pilot paired (ST01-001 "Gundam" AP+1)
- **LINK_TRIGGERED** - Effects for unit.link matches (future expansion)

**Switch-Case Implementation:**
```typescript
switch (effectType) {
    case ContinuousEffectType.ALWAYS_ACTIVE:
        if (CardEffect.processAlwaysActiveEffect(effectRule, card, playerId, gameEnv)) {
            appliedCount++;
        }
        break;
    case ContinuousEffectType.PAIR_TRIGGERED:
        if (slotState.isPaired && CardEffect.processPairTriggeredEffect(effectRule, card, playerId, gameEnv)) {
            appliedCount++;
        }
        break;
    case ContinuousEffectType.LINK_TRIGGERED:
        if (slotState.isLinked && CardEffect.processLinkTriggeredEffect(effectRule, card, playerId, gameEnv)) {
            appliedCount++;
        }
        break;
}
```

### Enhanced Storage Structure
**Real-World Effect Data Structure:**
```typescript
// Cards store effects in continuousEffects array using unified value structure
card.continuousEffects = [
  {
    effectId: "pair_ap_boost_all",
    type: "static",
    timing: ["YOUR_TURN"],
    effect: {
      action: "modifyAP",
      parameters: { value: 1 },         // Unified numeric structure
      duration: "while_paired"
    },
    sourceCarduid: "source-card-123",  // Source tracking for cleanup
    active: false,     // Set to true when applied in Phase 2
    appliedValue: 0    // Calculated value when applied
  }
]
```

**Key Fields:**
- **`sourceCarduid`** - Critical for Phase 0 cleanup validation
- **`effectId`** - Used for duplicate prevention
- **`active`/`appliedValue`** - Two-phase application tracking
- **`parameters.value`** - Unified numeric parameter for all effects

### Method Naming Conventions (January 2025)
**"Update" Terminology for Future-Proofing:**

**Philosophy:**
- Methods use "update" instead of "add" or "process" for future extensibility
- Supports add, remove, and modify operations as the system evolves
- Consistent naming pattern across all continuous effects methods

**Examples:**
- **`updatePlayerSlotsContinuousEffects()`** instead of `addContinuousEffectsToPlayerSlots()`
- **`updateSlotContinuousEffects()`** instead of `processSlotEffects()`
- **`updateCardContinuousEffects()`** instead of `addCardEffects()`

**Benefits:**
- **🔮 Future-Proof** - Naming supports add/remove/modify operations
- **📝 Consistent** - All methods follow same naming convention
- **🧹 Clear Intent** - "Update" implies comprehensive processing
- **🚀 Extensible** - Easy to add new update operations without naming conflicts

### Integration Points
**Complete System Integration:**
- **`src/services/GameEngine.ts`** - Calls continuous effects processing after card placement
- **`src/services/PlayerCardManager.ts`** - Returns `isOnLink`/`isOnPair` detection results
- **`src/models/ContinuousEffects.ts`** - TypeScript interfaces and helper functions
- **`src/models/CardSystem.ts`** - Added `continuousEffects` field to ZoneCard interface
- **`src/config/gameConstants.ts`** - Centralized slot zone constants for consistency

**Processing Triggers:**
- **Card placement** - Automatically triggered after any card is placed
- **Leader changes** - Triggered when new leaders activate
- **Effect simulation** - Used during replay-based game state reconstruction

### Key Features & Benefits
**Architectural Improvements:**
- **🧹 Three-Phase Processing** - Cleanup, storage, and application phases for robust effect management
- **🔒 Duplicate Prevention** - Uses `ContinuousEffectsHelper.addEffect()` with unique key checking
- **🎯 Source Tracking** - Each effect tracks its source card for automatic cleanup
- **🗑️ Stale Effect Cleanup** - Phase 0 automatically removes effects from cards no longer on field
- **📊 Real Effect Structure** - Uses actual card data structure from `st01Card.json`
- **⚙️ Automatic Processing** - Always processes effects, no conditional triggers
- **🎮 Simplified Logic** - Maximum 2 levels of nesting, focused utility methods
- **📐 Consistent Constants** - Unified `SLOT_ZONES` constant eliminates hardcoded arrays

**Developer Experience:**
- **🚀 Single File Architecture** - All continuous effects logic in one location
- **🔍 Clear Logging** - Comprehensive console output for debugging
- **📋 Type Safety** - TypeScript interfaces for all effect structures
- **🔄 Future-Proof Naming** - Method names support system evolution

### Usage Guidelines
**Primary Interface:**
- **Main Processing**: Use `CardEffect.processAllContinuousEffects(gameEnv)` for complete processing
- **Effect Storage**: Effects stored on `targetCard.continuousEffects` array with duplicate prevention
- **Three-Phase Approach**: Cleanup → Storage → Application (automatic)
- **Data Access**: Access effect data directly from card: `card.continuousEffects[i].appliedValue`
- **Automatic Cleanup**: No manual effect cleanup needed - automatic when source cards removed

**Development Rules:**
1. **Never skip Phase 0** - Always run cleanup before adding new effects
2. **Use centralized constants** - Import `SLOT_ZONES` from `gameConstants.ts`
3. **Follow naming conventions** - Use "update" terminology for new methods
4. **Trust the source tracking** - Effects automatically cleaned when source cards removed
5. **Leverage real data structures** - Use actual card JSON structure for parameters

## Development Notes & Recent Updates

### Key Implementation Guidelines

**Unified Effect System (NEW - January 2025):**
- **Single Source of Truth:** All effects processed through EffectSimulator's `simulateCardPlaySequence()`
- **No Manual Effect Management:** Never call old `processLeaderFieldEffects` or `clearPlayerLeaderEffects` 
- **Play Sequence Integration:** Record all leader actions as `PLAY_LEADER` in play sequence
- **Automatic Transitions:** Leader changes handled automatically through replay system
- **Effect Debugging:** All effects traceable through chronological play sequence replay

**Card Selection Replay System (January 2025):**
- **Complete Selection Tracking:** Card selections now recorded as `APPLY_SET_POWER` actions in play sequence
- **Replay Consistency:** Card selection effects maintain target information during game state reconstruction
- **Enhanced Action Types:** New action types `APPLY_SET_POWER` and `APPLY_EFFECT` for effect execution tracking
- **Cross-Player Effects:** Target information preserved for effects that affect opponent cards
- **Debugging Support:** Full trace of card selections available in play sequence for debugging

**General Development:**
- **Event System Usage:** All game state changes automatically generate appropriate events for frontend consumption
- **Error Handling:** Every validation failure should generate a specific error event type
- **Zone Compatibility:** Always use `gameType` field for zone placement, never `traits[0]`
- **Leader Access:** Use `leader.zoneCompatibility[zone]` not `leader[zone]`
- **Face-Down Cards:** Bypass all restrictions but contribute 0 power and no combos
- **SP Phase Rules:** SP cards MUST be played face-down during SP_PHASE
- **File-Based Storage:** All game state persisted to JSON files, no in-memory storage

### Testing Considerations

**Unified Effect System Testing (NEW):**
- All effect testing now goes through single EffectSimulator path - no separate field effect tests needed
- Test scenarios automatically get proper leader effects through `injectGameState` play sequence recording
- Leader effect testing: Use play sequence with `PLAY_LEADER` actions for consistent testing
- Complex effect interactions: Test through complete game scenario replay, not isolated effect testing
- Cross-player effects: Test Powell-style effects through full game simulation

**General Testing:**
- Test scenarios may need updating for new card IDs and JSON structure
- Event system requires testing of frontend polling and acknowledgment flow
- SP phase enforcement and auto-reveal system needs comprehensive testing
- Face-down card mechanics require validation across all game phases
- Dynamic tests now properly apply leader restrictions without manual field effect setup

### Frontend Integration Requirements
- Implement 1-second polling of GET `/player/:playerId?gameId=X`
- Process events from `gameEnv.notificationQueue` array based on event type
- Call POST `/player/acknowledgeEvents` to mark events as processed
- Handle all error event types with appropriate user feedback
- Support card selection workflow via events and blocking logic