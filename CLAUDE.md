# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"Revolution and Rebellion" is a strategic trading card game with both backend (Node.js/Express) and frontend (Phaser 3) components. Players control leaders who summon characters to compete based on power and combinations rather than direct combat, using a unique round-based system where judges award points to the most impressive rosters.

## Repository Structure

This is a **monorepo** containing two main applications:

```
cardGameRevamp/
├── cardBackend/     # Node.js/Express API server
└── cardFrontend/    # Phaser 3 web client
```

## Development Commands

### Backend (cardBackend/)
```bash
# Development with hot reload
npm run dev

# Production server
npm start

# Testing
npm test                    # Run all Jest tests
npm test:watch             # Jest watch mode
npm test -- --testNamePattern="cardEffects"  # Specific test file
npm run run-test           # Custom test scenarios
npm run run-testcase1      # Case 1 validation
```

### Frontend (cardFrontend/)
```bash
# Development server (opens port 3000)
npm run dev

# Production build
npm run build
npm run preview            # Preview production build

# Code quality
npm run lint
npm run format
```

## Architecture Overview

### Backend Architecture (`cardBackend/`)

**Core System:**
- **Express.js API** - RESTful endpoints with CORS support
- **File-based Storage** - Game states persisted as JSON files in `src/gameData/`
- **Event System** - Comprehensive real-time event tracking for frontend integration
- **Phase-based Gameplay** - Strict turn/phase management system

**Key Modules:**
- `src/services/GameLogic.js` - Main game coordinator and API handlers
- `src/mozGame/mozGamePlay.js` - Core gameplay mechanics and phase management
- `src/services/CardEffectManager.js` - Card placement validation and effect processing
- `src/services/DeckManager.js` - Deck loading and player deck management
- `src/controllers/gameController.js` - HTTP request handlers
- `src/routes/gameRoutes.js` - API route definitions

**Game Data:**
- `src/data/characterCards.json` - Character card definitions with combo rules
- `src/data/leaderCards.json` - Leader cards with zone compatibility rules
- `src/data/utilityCards.json` - Help and SP (Special Power) cards
- `src/data/decks.json` - Predefined deck configurations

### Frontend Architecture (`cardFrontend/`)

**Phaser 3 Scene System:**
- `PreloaderScene` - Asset loading and texture creation
- `MenuScene` - Game creation and player setup
- `GameScene` - Main gameplay with board and card interactions
- `CardSelectionScene` - Modal overlay for card selection workflows
- `BattleResultScene` - Battle result animations and scoring
- `GameOverScene` - Final victory screen

**Key Components:**
- `src/components/Card.js` - Interactive card component with drag-and-drop
- `src/components/ShuffleAnimationManager.js` - Deck shuffle animations
- `src/managers/GameStateManager.js` - Client-side game state management
- `src/managers/APIManager.js` - Backend API integration with polling

**Configuration:**
- `src/config/gameConfig.js` - Game constants and UI settings
- `src/config/cardConfig.js` - Card-specific configuration

## Game Flow and Phases

### Battle Flow
1. **START_REDRAW** - Initial hand management and player ready status
2. **DRAW_PHASE** - Card drawing mechanics
3. **MAIN_PHASE** - Character and Help card placement (3 character zones + 1 help zone required)
4. **SP_PHASE** - Special Power cards (face-down placement only)
5. **BATTLE_PHASE** - Power calculation and winner determination
6. **END_PHASE** - Cleanup and next round preparation

### Zone System
- **Character Zones** (TOP/LEFT/RIGHT) - For character cards with zone compatibility rules
- **Help Zone** - For utility cards (1 per player)
- **SP Zone** - For special power cards (face-down during SP_PHASE)
- **Leader Zone** - Current leader card (determines zone compatibility)

### Card Effect System
- **Replay-Based Simulation** - Complete sequence replay for consistent effects
- **Effect Types** - Disable cards, modify power, change restrictions
- **Play Sequence Tracking** - All card plays recorded with timestamps
- **Computed State** - Final game state after all effects applied

### Continuous Effects System (January 2025)
**Consolidated Single-File Architecture** - Complete continuous effects processing in one unified service:

**Core Components:**
- `src/services/CardEffect.ts` - **SINGLE FILE** containing all continuous effects logic
- Array-based storage with duplicate prevention using `effectId + sourceCardUid` keys
- Two-phase processing: Phase 1 (storage), Phase 2 (application)
- Switch-case architecture for different effect types (ALWAYS_ACTIVE, PAIR_TRIGGERED, LINK_TRIGGERED)

**Effect Flow:**
1. `processAllContinuousEffects()` - Main orchestration entry point
2. `processPlayerSlots()` - Process each player's slots for effects
3. `detectSlotState()` - Determine slot conditions (paired, linked, etc.)
4. `processCardEffects()` - Extract and classify effects from individual cards
5. `addContinuousEffect()` - Store effects (Phase 1 - no immediate application)
6. `applyContinuousEffects()` - Apply stored effects (Phase 2 - activate and apply values)

**Effect Types (Switch-Case Generalization):**
- **ALWAYS_ACTIVE** - Continuous effects like ST01-009 "Zowort" attack restrictions
- **PAIR_TRIGGERED** - Effects that activate when unit+pilot paired (ST01-001 "Gundam" AP+1)
- **LINK_TRIGGERED** - Effects for unit.link matches (future expansion)

**Storage Structure:**
```typescript
// Cards store effects in continuousEffects array
card.continuousEffects = [
  {
    effectId: "pair_ap_boost_all",
    type: "static",
    timing: ["YOUR_TURN"],
    effect: {
      action: "modifyAP",
      parameters: { modifier: "+1" },
      duration: "while_paired"
    },
    sourceCardUid: "source-card-123",
    active: false,     // Set to true when applied
    appliedValue: 0    // Calculated value when applied
  }
]
```

**Integration Points:**
- `src/services/GameEngine.ts` - Calls continuous effects processing after card placement
- `src/services/PlayerCardManager.ts` - Returns `isOnLink`/`isOnPair` detection results
- `src/models/ContinuousEffects.ts` - TypeScript interfaces and helper functions
- `src/models/CardSystem.ts` - Added `continuousEffects` field to ZoneCard interface

**Key Features:**
- **Duplicate Prevention** - Uses `ContinuousEffectsHelper.addEffect()` with unique key checking
- **Source Tracking** - Each effect tracks its source card for automatic cleanup
- **Real Effect Structure** - Uses actual card data structure from `st01Card.json`
- **Automatic Processing** - Always processes effects, no conditional triggers
- **Simplified Logic** - Maximum 2 levels of nesting, focused utility methods

### Victory Conditions
- 4 rounds (4 different leaders per player)
- First team to 50 victory points wins
- Points awarded based on power totals and combo bonuses

## Key Implementation Patterns

### API Integration
- **Backend URL**: `http://localhost:8080` (configured in `cardFrontend/src/config/gameConfig.js`)
- **Polling**: 1-second intervals for real-time updates via `GET /player/:playerId?gameId=X`
- **Event Processing**: Process events from `gameEnv.notificationQueue` array
- **Event Acknowledgment**: Call `POST /player/acknowledgeEvents` to mark events processed

### Game State Management
- **File-based Backend**: All game states persisted to `cardBackend/src/gameData/{gameId}.json`
- **No In-Memory Storage**: Games survive server restarts
- **Unified Structure**: Single gameEnv format eliminates backend/frontend transformation
- **Event System**: 30+ event types for precise frontend updates
- **Card Selection Workflow**: `pendingCardSelections` handles player input requirements with consolidated detection

### Face-Down Card Mechanics
- **Complete Restriction Bypass**: Face-down cards ignore zone compatibility
- **Zero Power Contribution**: Face-down cards contribute 0 power and no combos
- **SP Phase Enforcement**: During SP_PHASE, cards MUST be played face-down
- **Strategic Placement**: Players can use face-down placement for bluffing and zone filling

## Testing Strategy

### Complete GameEnv Testing Architecture

**NEW: End-to-End Scenario Testing System**
- **Shared Test Scenarios** - Complete game environments in `shared/testScenarios/`
- **Frontend Scenario Testing** - Interactive UI testing with complete game states
- **Backend Scenario Validation** - Automated validation of card effects and game logic
- **Unified Test Data** - Same scenarios used across frontend and backend for consistency

### Backend Testing
- **Jest Test Suite** - Located in `cardBackend/src/tests/`
- **Integration Tests** - Automatic server start/stop with `setup.js`/`teardown.js`
- **Test Scenarios** - JSON-defined game situations in `src/tests/scenarios/`
- **Custom Scripts** - `test.cjs` and `test_case1.cjs` for full game flow validation
- **NEW: Complete Scenario Runner** - `CompleteScenarioRunner.js` for full gameEnv testing
- **NEW: Scenario Test Suite** - `completeScenarios.test.js` for comprehensive effect validation

### Frontend Testing
- **Demo Mode** - Complete offline testing with mock data
- **API Connection Testing** - Graceful fallback when backend unavailable
- **Interactive Testing** - Full drag-and-drop and UI testing capabilities
- **NEW: Scenario Testing UI** - Interactive scenario loading and validation in demo mode
- **NEW: Visual Effect Validation** - Real-time testing of card effects and power calculations

### Testing Workflow
1. **Create Complete Scenarios** - Define full game states with expected results
2. **Frontend Visual Testing** - Load scenarios in demo mode, validate UI behavior
3. **Backend Automated Testing** - Run scenarios through effect simulation system
4. **Cross-Platform Validation** - Ensure frontend and backend produce consistent results
5. **Effect Coverage Testing** - Validate all card effects across different game states

## Critical Development Notes

### Zone Compatibility Rules
```javascript
// CORRECT: Access via zoneCompatibility object
const allowedTypes = leader.zoneCompatibility[zone];

// INCORRECT: Direct property access (will be undefined)
const allowedTypes = leader[zone];
```

### Card Type vs Traits
- Use `card.gameType` (string) for zone placement validation
- Use `card.traits` (array) for card effects and abilities
- Never use `traits[0]` for zone compatibility checks

### Event System Usage
- All game state changes automatically generate events
- Events persist for 3 seconds (3 polling cycles)
- Frontend must call `acknowledgeEvents` to prevent event buildup
- 30+ event types including errors, phase changes, and card actions

### Continuous Effects Usage
- Use `CardEffect.processAllContinuousEffects(gameEnv)` for complete processing
- Effects stored on `targetCard.continuousEffects` array with duplicate prevention
- Two-phase approach: `addContinuousEffect()` then `applyContinuousEffects()`
- Access effect data directly from card: `card.continuousEffects[i].appliedValue`
- No manual effect cleanup needed - automatic when source cards removed

### API Response Pattern
- All game data returned in `gameEnv` object
- Single `phase` field for game state (eliminated duplicate `roomStatus`)
- No separate response fields (eliminated `requiresCardSelection`)
- Card selection detected via `pendingCardSelections` object inspection
- Detailed selection data in `pendingCardSelections[selectionId]`

## Demo Mode

Both frontend and backend support comprehensive demo/testing modes:
- **Frontend**: Complete offline gameplay with `src/mock/handCards.json`
- **Backend**: Test data in `src/gameData/test-*.json` files
- **Full Game Flow**: Test all mechanics from setup to victory

## Development Workflow

1. **Backend First**: Start with `npm run dev` in `cardBackend/`
2. **Frontend Integration**: Run `npm run dev` in `cardFrontend/` 
3. **Testing**: Use demo mode for UI testing, Jest for backend logic
4. **API Testing**: Use `src/tests/` for comprehensive game scenario validation

## Common Pitfalls to Avoid

1. **Zone Compatibility**: Always use `leader.zoneCompatibility[zone]`, never `leader[zone]`
2. **Card Types**: Use `gameType` for placement, `traits` for effects
3. **Face-down Rules**: Remember face-down cards bypass ALL restrictions
4. **SP Phase**: Only face-down placement allowed in SP zones during SP_PHASE
5. **Event Cleanup**: Always acknowledge processed events to prevent memory issues
6. **File Storage**: Backend uses file-based storage, not in-memory state
7. **Continuous Effects**: Never mix ContinuousEffectManager with CardEffect.ts - everything is consolidated in CardEffect.ts
8. **Effect Processing**: Always use two-phase approach - store first, then apply all effects
9. **Effect Parameters**: Use real structure from `st01Card.json` (`parameters.modifier`) not assumptions (`parameters.amount`)

## Related Documentation

- `cardBackend/CLAUDE.md` - Detailed backend architecture and recent updates
- `cardFrontend/CLAUDE.md` - Frontend-specific development patterns
- `cardBackend/API_README.md` - Complete API endpoint documentation
- `cardFrontend/README.md` - Frontend setup and game controls
- `EFFECT_SYSTEM.md` - Card Effect Execution System with replay-based simulation