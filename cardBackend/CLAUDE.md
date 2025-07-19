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
1. **START_REDRAW** - Initial hand management
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
- `src/mozGame/mozDeckHelper.js` - Deck preparation for games
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
  - **h-2 (Make America Great Again)**: Automatically sets first opponent character power to 0
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
- **Event Storage:** All events stored in `gameEnv.gameEvents` array within game state
- **Event Persistence:** Events persist for 3 seconds (matching 1-second frontend polling)
- **Automatic Cleanup:** Expired and acknowledged events automatically removed
- **Unique IDs:** Each event has timestamp-based unique identifier

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
- `CARD_EFFECT_TRIGGERED` - Card effect activated with effect type
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
- Detects unprocessed events in `gameEnv.gameEvents` array
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
    "zone": "top",
    "isFaceDown": false
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

## Unified Effect System (January 2025) - MAJOR ARCHITECTURAL CONSOLIDATION

### Overview
**BREAKING CHANGE**: The field effects system has been completely consolidated into a single unified architecture. All leader and card effects are now processed through the EffectSimulator's play sequence replay system.

**What Changed:**
- ✅ **Eliminated dual-system architecture** - No more separate `processLeaderFieldEffects` and `processAllFieldEffects`
- ✅ **Single source of truth** - All effects handled by EffectSimulator through play sequence replay
- ✅ **Complete leader effect integration** - Zone restrictions, power boosts, and cross-player effects unified
- ✅ **Automatic effect management** - Leader changes handled automatically through `PLAY_LEADER` actions
- ✅ **Simplified codebase** - Removed ~300 lines of duplicate effect processing code

### Why This Change Was Necessary
The previous system had critical issues:
- **Duplication**: Similar logic in FieldEffectProcessor and EffectSimulator
- **Inconsistency**: Different processing paths for leader vs card effects
- **Manual Synchronization**: Required manual clearing and reapplication of leader effects
- **Complexity**: Multiple integration points and potential for sync issues

### New Unified Architecture
```
BEFORE (Dual System):
┌─────────────────────┐    ┌─────────────────────┐
│ FieldEffectProcessor│    │   EffectSimulator   │
│ - Zone restrictions │    │ - Card effects      │
│ - Power boosts      │    │ - Basic leader      │
│ - Cross-player      │    │ - Play sequence     │
└─────────────────────┘    └─────────────────────┘
     Manual sync needed

AFTER (Unified System):
┌─────────────────────────────────────────────┐
│           EffectSimulator (UNIFIED)         │
│ ✅ Zone restrictions (via PLAY_LEADER)     │
│ ✅ Power boosts (leader JSON processing)   │
│ ✅ Cross-player effects (Powell nullify)   │
│ ✅ Card effects (existing system)          │
│ ✅ Automatic leader transitions            │
│ ✅ Single replay-based calculation         │
└─────────────────────────────────────────────┘
```

### Core Components

**Backend Implementation:**
- `EffectSimulator` - SINGLE service class handling ALL effect logic (leader + card effects)
- `PlaySequenceManager` - Records all actions including `PLAY_LEADER` for unified replay
- `fieldEffects` - Computed automatically during simulation, no manual management needed
- `FieldEffectProcessor` - Kept for compatibility, only handles basic validation now

**Frontend Integration:**
- No changes required - same API responses with computed effects included
- Real-time effect data via existing polling system
- All effect calculations happen transparently in unified system

### Unified Effect Types

**Zone Restrictions (Automatic via PLAY_LEADER):**
- Leaders automatically restrict zones when recorded in play sequence
- Example: Trump restricts TOP zone to ["右翼", "自由", "經濟"] when played
- Enforced during card placement validation
- **Processing**: Handled by `processCompleteLeaderEffects()` during simulation

**Power Boosts (Unified JSON Processing):**
- Leaders grant power bonuses through unified effect system
- Example: Trump grants +45 power to "右翼"/"愛國者" cards via JSON effect rules
- Applied during `calculateCardPowerWithLeaderEffects()` in final state calculation
- **Processing**: JSON rules converted to standardized effects automatically

**Cross-Player Effects (Automatic Scope Detection):**
- Leaders can affect opponent's cards through unified targeting system
- Example: Powell nullifies opponent's "經濟" trait cards (sets power to 0)
- **Processing**: Handled by `processCrossPlayerLeaderEffects()` with automatic player targeting

**All Effects Benefits:**
- ✅ **Consistent Processing**: Same replay-based logic for all effect types
- ✅ **Automatic Transitions**: Leader changes handled without manual clearing
- ✅ **Complex Interactions**: Proper ordering and interaction resolution
- ✅ **Performance**: Single calculation pass instead of multiple separate systems

### Data Structure

**Player Field Effects:**
```javascript
gameEnv[playerId].fieldEffects = {
  zoneRestrictions: {
    "TOP": ["右翼", "自由", "經濟"],
    "LEFT": ["右翼", "自由", "愛國者"],
    "RIGHT": ["右翼", "愛國者", "經濟"],
    "HELP": "ALL",
    "SP": "ALL"
  },
  activeEffects: [
    {
      effectId: "s-1_power_bonus",
      source: "s-1",
      sourcePlayerId: "playerId_1",
      type: "powerBoost",
      target: {
        scope: "SELF",
        zones: "ALL",
        gameTypes: ["右翼", "愛國者"]
      },
      value: 45
    }
  ]
}
```

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

**NEW Unified Processing:**
- ✅ `processCompleteLeaderEffects()` - Complete leader processing in EffectSimulator
- ✅ `calculateCardPowerWithLeaderEffects()` - Unified power calculation
- ✅ `PLAY_LEADER` actions in play sequence - Leaders treated like any other card play
- ✅ Automatic effect transitions - No manual synchronization needed

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
- **Values**: `WAITING_FOR_PLAYERS`, `BOTH_JOINED`, `READY_PHASE`, `DRAW_PHASE`, `MAIN_PHASE`, `SP_PHASE`, `BATTLE_PHASE`
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

## Development Notes & Recent Updates

### Key Implementation Guidelines

**Unified Effect System (NEW - January 2025):**
- **Single Source of Truth:** All effects processed through EffectSimulator's `simulateCardPlaySequence()`
- **No Manual Effect Management:** Never call old `processLeaderFieldEffects` or `clearPlayerLeaderEffects` 
- **Play Sequence Integration:** Record all leader actions as `PLAY_LEADER` in play sequence
- **Automatic Transitions:** Leader changes handled automatically through replay system
- **Effect Debugging:** All effects traceable through chronological play sequence replay

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
- Process events from `gameEnv.gameEvents` array based on event type
- Call POST `/player/acknowledgeEvents` to mark events as processed
- Handle all error event types with appropriate user feedback
- Support card selection workflow via events and blocking logic