# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based Trading Card Game frontend for "Revolution and Rebellion" using Phaser 3. The game features strategic card placement mechanics where leaders summon characters to compete based on power and combinations rather than direct combat.

## Technical Stack

- **Phaser 3** (v3.70.0) - Primary game engine with arcade physics
- **Vite** (v4.5.0) - Modern build system with HMR, replaces webpack
- **ESLint** (v8.53.0) + **Prettier** (v3.1.0) - Code quality tools
- **ES6+ JavaScript** - Modern JavaScript features throughout
- **HTML5/CSS3** - Web technologies with responsive design

## Development Commands

```bash
# Development server (opens on port 3000)
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview production build
npm run preview

# Code quality checks
npm run lint
npm run format
```

## Project Architecture

### Scene Structure
The game uses Phaser 3 scenes with state management integration:

1. **PreloaderScene** - Asset loading with progress bar, creates card textures
2. **MenuScene** - Main menu, game creation, player name input
3. **GameScene** - Core gameplay with board, cards, drag-and-drop, **shuffle animation**
4. **CardSelectionScene** - Modal overlay for card selection workflows
5. **BattleResultScene** - Battle results, victory points, round progression
6. **GameOverScene** - Final victory screen and game statistics

### Directory Structure
```
src/
├── scenes/           # Phaser scene classes (8 total including DemoScene variants)
├── components/       # Reusable UI components (Card.js, ShuffleAnimationManager.js, area managers)
├── managers/         # Specialized managers (20+ files including GameFlowManager, HandCardManager, CardPreviewManager, FrontEventProcessor)
├── services/         # Service layer (GameApiService.js for API abstraction)
├── handlers/         # Event and action handlers (CardActionHandler.js, DeployEffectHandler.js)
├── systems/          # Game systems (ActionButtonManager.js, CardActionRegistry.js)
├── utils/            # Helper utilities (ZoneMapping.js, GameSceneUtils.js, CardAnimationUtils.js, UIHelper.js)
├── config/          # Game configuration (gameConfig.js, cardConfig.js)
├── assets/          # Images and card artwork (organized by type: character/, leader/, utilityCard/)
├── mock/            # Mock data and scenario loading (scenarioLoader.js, testConfig.json)
└── main.js          # Application entry point with Phaser config
```

### Game State Management
The application uses **GameStateManager** for centralized state control:

```javascript
gameState = {
  gameId: string,
  playerId: string,
  playerName: string,
  gameEnv: {
    phase: string,           // Current game phase (setup/main/sp/battle/cleanup)
    currentPlayer: string,   // Active player ID
    players: {},            // Player data and hands
    zones: {},              // Card placement zones (slot1-6, leaderDeck, deck, base)
    notificationQueue: [],  // Unprocessed events
    pendingCardSelections: {}, // Card selection workflows
    victoryPoints: {},      // Current VP totals
    round: number           // Current round/leader (1-4)
  },
  uiState: {
    selectedCard: null,
    hoveredZone: null,
    showingCardDetails: false,
    pendingAction: null
  }
}
```

### Key Architecture Patterns

#### **Component-Based Design**
- **Card Component** (`src/components/Card.js`): Sophisticated interactive card system with drag-and-drop, face-down mechanics, zone compatibility validation, and visual states
- **Zone System**: Modern slot-based zones (slot1-6, leaderDeck, deck, base) with flexible card placement
- **Animation System**: Smooth transitions using Phaser tweens for all game actions

#### **Manager Pattern Architecture**
- **GameStateManager** (`src/managers/GameStateManager.js`): Centralized game state management with event handling
- **APIManager** (`src/managers/APIManager.js`): REST API communication with error handling and retry logic
- **UIMessageManager** (`src/managers/UIMessageManager.js`): Centralized UI feedback system (errors, success, loading states, phase indicators)
- **ZoneManager** (`src/managers/ZoneManager.js`): Zone creation, highlighting, and interaction management
- **BoardLayoutManager** (`src/managers/BoardLayoutManager.js`): Dynamic board layout generation and responsive positioning
- **CardInteractionManager** (`src/managers/CardInteractionManager.js`): Centralized card interaction state management with turn-based activation
- **ResourceManager** (`src/managers/ResourceManager.js`): Centralized card resource loading with retry logic, caching, and performance monitoring
- **HandCardManager** (`src/managers/HandCardManager.js`): Complete hand card management with animations, positioning, and backend integration
- **CardPreviewManager** (`src/managers/CardPreviewManager.js`): Sophisticated card preview system with dual card support and current stats display
- **GameFlowManager** (`src/managers/GameFlowManager.js`): Game flow control, phase transitions, and complex update logic management
- **GameSceneUIManager** (`src/managers/GameSceneUIManager.js`): UI creation and management with standardized patterns
- **FrontEventProcessor** (`src/managers/FrontEventProcessor.js`): Generic event processing system with extensible event type registry
- **ActionButtonManager** (`src/systems/ActionButtonManager.js`): Dynamic action button system for card interactions

#### **Event-Driven Architecture**
- **Polling System**: 1-second intervals for backend synchronization
- **Event Processing**: 30+ event types (GAME_STARTED, CARD_PLAYED, BATTLE_CALCULATED, etc.)
- **State Synchronization**: Event acknowledgment system for server communication

#### **Scene Management**
- **Scene Transitions**: Smooth flow between game states
- **Data Passing**: GameStateManager passed between scenes via init(data)
- **Modal System**: CardSelectionScene overlays for card selection workflows

## Backend Integration

### API Configuration
- **Base URL**: `http://localhost:8080` (configured in `gameConfig.js`)
- **Poll Interval**: 1000ms for real-time updates
- **APIManager**: Handles REST API communication with error handling and retry logic

### API Endpoints
**Game Management:**
- `POST /game/create` - Create new game
- `GET /game/:gameId` - Get game state
- `POST /player/startGame` - Start game
- `POST /player/startReady` - Mark player ready

**Gameplay Actions:**
- `POST /player/playCard` - Send player actions
- `POST /player/selectCard` - Card selection
- `POST /player/acknowledgeEvents` - Mark events processed
- `GET /player/:playerId` - Get player data and events

**Battle Progression:**
- `POST /player/nextRound` - Advance to next round

### Event System
- **Real-time Updates**: Poll `GET /player/:playerId?gameId=X` every 1 second
- **Event Processing**: Process events from `gameEnv.notificationQueue` array
- **Event Acknowledgment**: Call `POST /player/acknowledgeEvents` to mark processed
- **Event Types**: 30+ different event types (GAME_STARTED, CARD_PLAYED, BATTLE_CALCULATED, etc.)

### Demo Mode
- **Mock Data**: Complete demo functionality without backend (uses `src/mock/handCards.json`)
- **Sample Cards**: Full card database for testing (28 characters, 15 help cards, 10 SP cards, 6 leaders)
- **Game Flow**: Test complete game flow from start to finish
- **Connection Testing**: API connection testing with graceful fallback to demo mode

## Game Mechanics Implementation

### Card System
- **Card Types**: Unit (combat), Command (strategy), Pilot (enhancement), Base (foundation)
- **Zone Structure**: Modern slot-based system with flexible card placement:
  - **Slot Zones** (slot1-6): Primary card placement areas for units, commands, pilots, and bases
  - **Deck Zones** (deck, leaderDeck): Card draw and storage areas
  - **Base Zone**: Foundation structures and special base cards
- **Face-down Mechanics**: Strategic placement with right-click toggle
- **Drag-and-Drop**: Complete system with zone validation and visual feedback
- **Zone Compatibility**: Dynamic validation based on card type and current game state

### Phase Flow
1. **Setup Phase**: Initial game setup and deck shuffling
2. **Main Phase**: Card placement from hand to zones
3. **SP Phase**: Face-down SP cards with auto-reveal
4. **Battle Phase**: Power calculation and combo resolution
5. **Cleanup Phase**: End turn cleanup and progression

### Game Flow
1. **Game Entry**: Shuffle animation plays when entering GameScene
2. **4-Round Structure**: Progress through 4 leaders with victory point tracking
3. **Victory Conditions**: First to reach victory point threshold wins

### UI Layout
- **Responsive Design**: 1920x1080 primary, 1024x768 minimum
- **Board Layout**: Opponent zones (top), battle area (center), player zones (bottom), hand area (bottom)
- **Zone Positions**: Calculated dynamically based on screen size
- **Card Dimensions**: 130x190 (card size), 120x160 (config size)

## Key Implementation Notes

### Performance Optimizations
- **60 FPS Target**: Smooth animations and interactions
- **Memory Management**: Efficient asset loading and cleanup
- **Phaser Tweens**: Hardware-accelerated animations
- **Object Pooling**: Reuse card objects where possible

### Animation System
- **Shuffle Animation**: Complex deck shuffling with custom grid layout (5x2 grid) - managed by `ShuffleAnimationManager.js`
- **Card Transitions**: Smooth drag-and-drop with spring physics
- **Visual Feedback**: Highlight zones, card hover effects, battle animations
- **Tween Chains**: Sequential animations for complex effects
- **Hardware Acceleration**: Uses Phaser's built-in tween system for optimal performance

### Error Handling
- **Network Resilience**: Handles API failures gracefully
- **State Recovery**: Comprehensive error recovery and user feedback
- **Validation**: Client-side validation for all card placements
- **Fallback Systems**: Demo mode when backend unavailable

## Slot Target Display System

### How to Trigger `_createSlotTargetDisplay`

The `_createSlotTargetDisplay` function displays unit+pilot combinations in dialogs (like deploy target selection). Here's the complete flow:

#### Required Data Structure
```javascript
const slotTarget = {
  // REQUIRED: Unit object
  unit: {
    cardId: "ST01-009",     // Card ID for texture loading
    cardData: { name, ap, hp, id },
    currentAP: 3,           // Current stats
    currentHP: 2
  },
  // OPTIONAL: Pilot object (triggers slot display when present)
  pilot: {
    cardId: "ST01-002",     // Pilot card ID  
    cardData: { name, ap, hp, id },
    currentAP: 2,
    currentHP: 1
  }
}
```

#### Trigger Flow
1. **Backend Event**: Send `DEPLOY_TARGET_CHOICE` event
2. **Event Processing**: FrontEventProcessor detects event in processing queue
3. **Dialog Creation**: DialogManager.showDeployTargetDialog() called
4. **Data Lookup**: buildTargetCardsFromOpponentZones() accesses gameState zones
5. **Card Format**: Creates cards with `isSlotTarget: true` when pilot exists
6. **Display Logic**: GameSceneUtils._createCardImage() detects `isSlotTarget` flag
7. **Slot Display**: Calls `_createSlotTargetDisplay()` for unit+pilot layout

#### Backend Response Format
```json
{
  "type": "DEPLOY_TARGET_CHOICE",
  "data": {
    "availableTargets": [
      {
        "cardUid": "ST01-009_uuid",
        "zone": "slot1",
        "playerId": "playerId_1"
      }
    ]
  }
}
```

#### Game State Requirements
The target player's zone must contain unit+pilot data:
```javascript
gameState.gameEnv.players.playerId_1.zones.slot1 = {
  unit: {
    cardUid: "ST01-009_uuid",
    cardData: { name: "Fighter", ap: 3, hp: 4, id: "ST01-009" },
    currentAP: 3,
    currentHP: 2
  },
  pilot: {  // Optional - triggers slot target display
    cardUid: "ST01-002_uuid", 
    cardData: { name: "Ace Pilot", ap: 2, hp: 1, id: "ST01-002" },
    currentAP: 2,
    currentHP: 1
  }
}
```

#### Visual Result
- **Unit Only**: Regular card display
- **Unit + Pilot**: Stacked display with unit on top (-20 Y offset) and pilot below (+23 Y offset)
- **Container**: Both cards in a single interactive container
- **Stats**: Combined AP/HP totals displayed properly

#### Testing Options
1. **Real Backend**: Have backend send proper game state with pilot in slot
2. **Force Test**: Temporarily set `isSlotTarget: true` in DialogManager
3. **Mock Data**: Add pilot data to demo game state

## Testing Approach

### Current Testing Strategy
- **Demo Mode**: Complete game flow testing without backend
- **Manual Testing**: Interactive testing of all UI components
- **Browser Testing**: Chrome, Firefox, Safari, Edge compatibility
- **Error Scenarios**: Network failures, invalid actions, edge cases
- **Performance Testing**: 60 FPS maintenance, memory usage

### Important Testing Focus Areas
- **Card Interactions**: Drag-and-drop, zone validation, face-down mechanics
- **Animation System**: Shuffle animations, transitions, tween chains
- **State Management**: Game state consistency, event processing
- **Responsive Design**: Different screen sizes and orientations
- **Edge Cases**: Unusual card combinations, rapid interactions

## Development Workflow

### Code Organization
- **Scene-Based**: Each game state has its own scene class
- **Component System**: Reusable Card component with full interaction system
- **Manager Pattern**: Comprehensive manager system for separation of concerns:
  - `GameStateManager.js` - Centralized state management
  - `UIMessageManager.js` - UI feedback and messaging
  - `ZoneManager.js` - Zone creation and management
  - `BoardLayoutManager.js` - Dynamic layout generation
  - `CardInteractionManager.js` - Turn-based card interaction states
  - `ResourceManager.js` - Card resource loading and caching
  - `APIManager.js` - Backend communication
- **Configuration-Driven**: All game constants in `gameConfig.js` and `cardConfig.js`

### Animation Development
- **Shuffle Animation**: Located in `GameScene.playShuffleDeckAnimation()` using `ShuffleAnimationManager.js`
- **Custom Shuffle Logic**: 5x2 grid layout with stacking for extra cards
- **Tween Chains**: Use Phaser tweens for smooth transitions
- **Visual Effects**: Fade-in/fade-out, rotation, scaling effects
- **Component Architecture**: Separate animation managers for complex effects

### State Management Patterns
- **Centralized State**: GameStateManager handles all game state
- **Event-Driven**: Scene communication through Phaser events
- **Immutable Updates**: State updates through dedicated methods
- **Demo Integration**: Mock data structures mirror real backend responses

### Performance Considerations
- **Memory Management**: Destroy unused objects, clear event listeners
- **Animation Optimization**: Use hardware acceleration, limit concurrent animations
- **Asset Loading**: Efficient texture management and reuse
- **Update Loops**: Minimize calculations in update loops

## Recent Architectural Improvements

### Major GameScene Refactoring (2024)
- **Manager Pattern Implementation**: Extracted complex GameScene logic into specialized managers, reducing GameScene.js from ~2000+ lines to manageable size
- **HandCardManager**: Complete hand card functionality extraction with animation support, card positioning, and UID-based backend integration
- **CardPreviewManager**: Sophisticated preview system supporting single cards, dual card previews (unit+pilot), and slot-based previews with current stats display
- **GameFlowManager**: Complex game flow logic extraction including phase transitions, event processing, and the massive updateUI method (~140 lines)
- **GameSceneUIManager**: All UI creation and management extracted with standardized patterns for buttons, displays, and status indicators
- **FrontEventProcessor**: Generic event processing system with extensible event type registry and handler patterns
- **GameApiService**: Standardized API call wrapper reducing code duplication with consistent response handling patterns

### Zone System and Utilities Refactoring (2024)
- **ZoneMapping Utility**: Comprehensive zone name normalization and validation system with legacy format conversion support
- **Enhanced Zone Management**: Modern slot-based architecture with backward compatibility for existing zone types
- **Utility Extraction**: GameSceneUtils and CardAnimationUtils for reusable game logic patterns
- **Service Layer**: Dedicated services directory with GameApiService for API abstraction

### Card Interaction System Fixes (2024)
- **Energy Card Interaction Control**: Fixed energy cards being clickable despite `card.active = false` - energy, shield, and base cards now properly disabled from user interaction while maintaining hover preview functionality
- **Card Preview Current Stats Display**: Fixed slot card hover previews showing original AP/HP instead of current values - previews now correctly display `currentAP`/`currentHP` affected by game effects and buffs
- **Opponent Slot Card Interaction Control**: Fixed opponent slot cards being clickable - implemented proper player/opponent zone distinction in SlotAreaManager to ensure only player slot cards and hand cards are clickable while opponent slot cards remain non-interactive

### UI Message System Refactoring (2024)
- **Centralized UI Management**: All UI feedback consolidated into `UIMessageManager.js`
- **Eliminated Code Duplication**: Removed duplicate UI methods across `GameScene.js` and `CardActionHandler.js`
- **Enhanced Message Types**: Support for error, success, loading, and phase indicator messages
- **Configurable Styling**: Centralized configuration for colors, positioning, and timing
- **Memory Management**: Automatic cleanup prevents UI message memory leaks

### Zone System Modernization (2024)
- **Legacy Cleanup**: Removed obsolete leader zone references (`playerZones.leader`, `opponentZones.leader`)
- **Slot-Based Architecture**: Modern slot1-6 system with dynamic zone management
- **Backward Compatibility**: Maintained support for existing `leaderDeck`, `deck`, and `base` zones
- **Dynamic Zone Creation**: `ZoneManager.js` handles all zone creation and management
- **Improved Flexibility**: Zone system adapts to different game states and card configurations

### Card Interaction System Refactoring (2024)
- **Centralized Interaction Management**: All card interaction states managed by `CardInteractionManager.js`
- **Turn-Based Activation**: Comprehensive turn-based card activation/deactivation system
- **Multi-Zone Support**: Handles hand cards, slot areas, base/shield areas, and energy zones
- **Statistics and Monitoring**: Built-in interaction statistics and performance monitoring
- **Batch Operations**: Efficient batch updating of multiple cards with consistent state management

### Resource Management System Refactoring (2024)
- **Centralized Resource Loading**: All card resource loading managed by `ResourceManager.js`
- **Retry Logic**: Robust retry mechanism with configurable attempts and delays
- **Performance Monitoring**: Comprehensive loading statistics and success rate tracking
- **Caching System**: Resource caching with hit tracking and memory management
- **Batch Loading**: Efficient parallel loading of card images with progress tracking

### Card System Refactoring - Code Deduplication (2025)

**Problem Solved**: Eliminated significant code duplication across card management components.

#### **1. Total Labels Calculation Duplication (7 occurrences eliminated)**

**Before**: Manual `CardStatCalculator.calculateTotalInSlot()` + `updateTotalLabels()` patterns repeated across:
- SlotAreaManager.js
- BaseAndShieldAreaManager.js  
- CardPreviewManager.js

**After**: Added three convenience methods to `Card.js`:
```javascript
// Calculate and update total labels in one call
const { totalAP, totalHP } = card.updateCalculatedTotalLabels(pilotCard, isRested);

// Calculate and update total stats for power overlay
const { totalAP, totalHP } = card.updateCalculatedTotalStats(pilotCard, isRested);

// Calculate and configure total labels display
const { totalAP, totalHP } = card.calculateAndConfigureTotalLabels(pilotCard, options);
```

#### **2. Card Creation Duplication (17+ new Card() instances eliminated)**

**Before**: Manual `new Card()` with repetitive configuration patterns across managers:
```javascript
// Repeated across multiple files
const card = new Card(scene, x, y, cardData, {
  usePreview: true,
  gameStateManager: this.gameStateManager
});
card.setDepth(depth);
card.setZonePlacement(true, zoneName, isPlayerZone);
// ... more repeated configuration
```

**After**: Created `CardFactory.js` with 6 specialized factory methods:

```javascript
// Specialized factory methods with pre-configured settings
CardFactory.createSlotCard(scene, cardData, x, y, options);     // Slot placement
CardFactory.createBaseCard(scene, cardData, x, y, options);     // Base cards
CardFactory.createShieldCard(scene, cardData, x, y, options);   // Shield rotation
CardFactory.createPreviewCard(scene, cardData, x, y, options);  // Large previews
CardFactory.createDialogCard(scene, cardData, x, y, options);   // Dialog display
CardFactory.createHandCard(scene, cardData, x, y, options);     // Hand cards
```

#### **Implementation Benefits**

**✅ Code Reduction**:
- Eliminated 7 instances of manual calculation + update patterns
- Consolidated 17+ repetitive card creation patterns
- Removed 50+ lines of duplicate configuration code

**✅ Maintainability**:
- Single source of truth for card creation logic
- Centralized total labels calculation patterns
- Consistent depth, interaction, and zone placement setup

**✅ Performance**:
- Reduced bundle size through elimination of duplicate code
- Consistent optimization patterns across all card types
- Reusable configuration templates

**✅ Developer Experience**:
- Simple, discoverable API for card operations
- Context-specific factory methods prevent configuration errors
- Self-documenting method names and parameters

#### **Refactored Components**

**SlotAreaManager.js**:
- ✅ Uses `CardFactory.createSlotCard()` for unit/pilot card creation
- ✅ Uses `Card.updateCalculatedTotalLabels()` for slot total calculations
- ✅ Eliminated manual `CardStatCalculator` + `updateTotalLabels` patterns

**BaseAndShieldAreaManager.js**:
- ✅ Uses `CardFactory.createBaseCard()` and `CardFactory.createShieldCard()`
- ✅ Uses `Card.updateCalculatedTotalLabels()` for base card totals
- ✅ Removed old `calculateBaseTotalAP/HP` methods

**CardPreviewManager.js**:
- ✅ Uses `CardFactory.createPreviewCard()` for all preview creation
- ✅ Uses `Card.updateCalculatedTotalLabels()` and `Card.updateCalculatedTotalStats()`
- ✅ Eliminated manual preview card configuration patterns

**DialogUIManager.js**:
- ✅ Uses `CardFactory.createDialogCard()` for all dialog card creation (single cards and slot cards)
- ✅ Fixed `_createSlotTargetDisplay()`: Always shows total AP/HP labels for slot target displays, even unit-only slots
- ✅ Uses `CardStatCalculator.calculateTotalInSlot()` for proper total calculation when values not provided
- ✅ Eliminated duplicate card creation patterns across 3 methods (`_createCardDisplay`, `_createSlotTargetDisplay`, `_createFallbackCardImage`)
- ✅ **Fixed cardStatusText (Rested/Active) display**: Dialog cards now properly show current rested status via `CardFactory._extractRestedStatus()`

#### **Migration Path for Future Development**

**Preferred Patterns**:
```javascript
// ✅ PREFERRED: Use CardFactory for card creation
const card = CardFactory.createSlotCard(scene, cardData, x, y, {
  slotName: 'slot1',
  cardType: 'unit', 
  playerType: 'player',
  gameStateManager: this.gameStateManager
});

// ✅ PREFERRED: Use Card convenience methods for calculations
const { totalAP, totalHP } = card.updateCalculatedTotalLabels(pilotCard, isRested);
```

**Deprecated Patterns**:
```javascript
// ❌ DEPRECATED: Manual card creation and configuration
const card = new Card(scene, x, y, cardData, options);
card.setDepth(depth);
card.setZonePlacement(true, zoneName, isPlayerZone);
// ... manual configuration

// ❌ DEPRECATED: Manual calculation patterns
const { totalAP, totalHP } = CardStatCalculator.calculateTotalInSlot(unitCard, pilotCard);
card.updateTotalLabels(totalAP, totalHP, isRested);
```

## Critical Development Patterns

### Component Design
- **Card Component**: Extends `Phaser.GameObjects.Container` with full interaction system
- **State Management**: Cards maintain their own state (selected, dragging,etc.)
- **Event System**: Uses Phaser events for component communication
- **Lifecycle Management**: Proper cleanup of event listeners and tweens

### API Integration Patterns
- **Graceful Degradation**: Falls back to demo mode when API unavailable
- **Connection Testing**: `APIManager.testConnection()` checks backend availability
- **Mock Integration**: Complete mock API methods for development (`createMockGame`, `getMockPlayer`)
- **Error Handling**: Comprehensive error handling with user-friendly messages

### Asset Management
- **Organized Structure**: Assets organized by type (character/, leader/, utilityCard/)
- **Texture Creation**: Dynamic texture generation in PreloaderScene
- **Memory Efficiency**: Reuse textures and cleanup unused assets
- **Loading Strategy**: Progressive loading with visual feedback

### UI Message Management Patterns
- **Centralized Messaging**: Use `UIMessageManager` for all user feedback
- **Message Types**: Error (red), success (green), room status (gold), loading indicators
- **Automatic Cleanup**: Messages auto-hide with configurable timeouts
- **Scene Integration**: Connect phase indicators and UI elements through manager
- **Usage Example**:
  ```javascript
  // In any scene:
  this.uiMessageManager = new UIMessageManager(this);
  this.uiMessageManager.showErrorMessage('Invalid action');
  this.uiMessageManager.showSuccessMessage('Card played!');
  this.uiMessageManager.setUILoadingState(true);
  ```

### Card Interaction Management Patterns
- **Centralized State Control**: Use `CardInteractionManager` for all card interaction states
- **Turn-Based Activation**: Automatic activation/deactivation based on current player turn
- **Multi-Zone Coverage**: Handles hand, slots, base, shield, and energy areas
- **Statistics Monitoring**: Track interaction updates with built-in statistics
- **Usage Example**:
  ```javascript
  // In GameScene:
  this.cardInteractionManager = new CardInteractionManager(this, this.gameStateManager);
  
  // Update all card states based on current turn
  this.cardInteractionManager.updateAllCardInteractionStates();
  
  // Update specific cards
  this.cardInteractionManager.updateCardState(card, true, 'manual activation');
  
  // Batch update multiple cards
  this.cardInteractionManager.batchUpdateCards(cardArray, false, 'opponent turn');
  
  // Get interaction statistics
  const stats = this.cardInteractionManager.getStats();
  ```

### Resource Management Patterns
- **Centralized Loading**: Use `ResourceManager` for all card resource loading
- **Retry Logic**: Automatic retry with configurable attempts and delays
- **Performance Tracking**: Monitor loading success rates and performance metrics
- **Caching**: Resource caching with hit tracking and memory optimization
- **Usage Example**:
  ```javascript
  // In GameScene:
  this.resourceManager = new ResourceManager(this);
  
  // Load all card resources from deck data
  const result = await this.resourceManager.loadCardResources();
  console.log(`Loaded ${result.loadedCount} resources, ${result.failedCount} failed`);
  
  // Preload specific cards
  await this.resourceManager.preloadCards(['card1.png', 'card2.png']);
  
  // Check if resource is loaded
  if (this.resourceManager.isResourceLoaded('card1')) {
    console.log('Card1 is ready to use');
  }
  
  // Get comprehensive loading statistics
  const stats = this.resourceManager.getStats();
  console.log(`Success rate: ${stats.successRate}, Average load time: ${stats.averageLoadTime}ms`);
  ```

### New Manager Usage Patterns (2024)

### HandCardManager Usage Patterns
- **Centralized Hand Management**: Use `HandCardManager` for all hand-related operations instead of direct manipulation
- **Animation Support**: Built-in card addition animations with proper positioning and depth management
- **Backend Integration**: Automatic UID-based backend action creation with zone validation
- **Usage Example**:
  ```javascript
  // In GameScene:
  this.handCardManager = new HandCardManager(this);
  this.handCardManager.createHandContainer();
  
  // Update hand from game state
  this.handCardManager.updatePlayerHand();
  
  // Add cards with animation
  this.handCardManager.addCardsToPlayerHand([cardData1, cardData2]);
  
  // Create backend actions
  const action = this.handCardManager.createBackendAction(cardData, 'slot1');
  ```

### CardPreviewManager Usage Patterns
- **Enhanced Preview System**: Use `CardPreviewManager` for all card preview operations with support for complex slot previews
- **Dual Card Support**: Automatic unit+pilot preview handling with proper stat calculations
- **Current Stats Display**: Previews show current AP/HP values affected by game effects
- **Usage Example**:
  ```javascript
  // In GameScene:
  this.cardPreviewManager = new CardPreviewManager(this);
  
  // Show single card preview
  this.cardPreviewManager.showCardPreview(cardData);
  
  // Show slot card preview (automatically detects unit+pilot)
  this.cardPreviewManager.showSlotCardPreview(hoveredCard);
  
  // Show dual preview explicitly
  this.cardPreviewManager.showDualCardPreview(unitCard, pilotCard);
  ```

### GameFlowManager Usage Patterns
- **Complex Flow Management**: Use `GameFlowManager` for phase transitions and game flow logic
- **Event Processing Integration**: Handles unprocessed events and event queue processing
- **Resource Loading**: Manages animation sequences and resource loading workflows
- **Usage Example**:
  ```javascript
  // In GameScene:
  this.gameFlowManager = new GameFlowManager(this);
  
  // Main game flow update (replaces complex updateUI logic)
  this.gameFlowManager.updateGameFlow();
  ```

### FrontEventProcessor Usage Patterns
- **Extensible Event System**: Use `FrontEventProcessor` for handling processing queue events with type registry
- **Custom Event Types**: Register new event types with custom handlers
- **Usage Example**:
  ```javascript
  // In GameScene:
  this.frontEventProcessor = new FrontEventProcessor(this);
  
  // Process all events (returns true if blocking event processed)
  const eventProcessed = this.frontEventProcessor.processAllEvents();
  
  // Register custom event type
  this.frontEventProcessor.registerEventType('CUSTOM_CHOICE', {
    handler: this.handleCustomChoice.bind(this),
    requiresPlayerMatch: true,
    allowMultiple: false,
    description: 'Custom choice events'
  });
  ```

### GameApiService Usage Patterns
- **Standardized API Calls**: Use `GameApiService` for consistent API call patterns with error handling
- **Response Handling**: Automatic gameEnv updates and UI feedback
- **Usage Example**:
  ```javascript
  // In GameScene:
  this.gameApiService = new GameApiService(this.apiManager, this.gameStateManager, this.uiMessageManager);
  
  // Standard API calls with consistent handling
  await this.gameApiService.endTurn();
  await this.gameApiService.joinRoom(gameId, playerName);
  await this.gameApiService.confirmBurstChoice(eventId, confirmed);
  
  // Generic API call wrapper
  await this.gameApiService.executeApiCall(
    () => this.apiManager.someApiCall(),
    'Loading...',
    'Success!',
    'Failed to execute',
    true // updateHand
  );
  ```

### ZoneMapping Utility Patterns
- **Zone Validation**: Use `ZoneMapping` for all zone name validation and normalization
- **Legacy Compatibility**: Convert between old and new action formats
- **Usage Example**:
  ```javascript
  import { ZoneMapping, ZONES } from '../utils/ZoneMapping.js';
  
  // Validate and normalize zone names
  const normalizedZone = ZoneMapping.normalizeZone('TOP'); // returns 'top'
  const isValid = ZoneMapping.isValidZone('slot1'); // returns true
  
  // Convert legacy actions
  const newAction = ZoneMapping.convertLegacyAction(legacyAction, playerHand);
  const legacyAction = ZoneMapping.convertToLegacyAction(newAction, playerHand);
  ```

### Development Workflow Tips
- **Demo-First**: Always test in demo mode before backend integration
- **Scene Debugging**: Use `this.scene.get('SceneName')` for cross-scene communication
- **State Inspection**: GameStateManager provides complete state visibility
- **Performance Monitoring**: Watch for memory leaks in drag-and-drop operations
- **Zone System**: Use `ZoneManager` for all zone-related operations instead of direct zone manipulation
- **UI Feedback**: Always use `UIMessageManager` methods instead of creating direct Phaser text objects
- **Card Interactions**: Use `CardInteractionManager` for all card state management instead of direct property manipulation
- **Resource Loading**: Use `ResourceManager` for all card resource loading instead of direct fetch operations
- **Hand Management**: Use `HandCardManager` for all hand-related operations instead of direct manipulation
- **Card Previews**: Use `CardPreviewManager` for all preview functionality instead of creating preview cards directly
- **Game Flow**: Use `GameFlowManager` for complex game flow logic instead of handling in main scene
- **API Calls**: Use `GameApiService` for standardized API call patterns with consistent error handling

## Data Structure Simplification Patterns (2024)

### ItemDataResolver Pattern (Enhanced)
**Purpose**: Convert simplified item references to dialog-ready card objects with maximum flexibility.

**Core Principle**: Pass raw unit/pilot objects directly to Card components following SlotAreaManager patterns.

**Constraint Removal**: All constraint filtering has been removed for maximum flexibility:
- ✅ Returns any slot with cards (unit only, pilot only, or both unit+pilot)
- ✅ No filtering by `has-unit`, `no-pilot`, or `has-pilot` constraints
- ✅ Optional `cardUid` filtering for specific card targeting
- ✅ Simplified utility methods without constraint parameters

**DialogUIManager Consolidation**: DialogUIManager now includes internal item resolution logic:
- ✅ Supports both `selection.items` and `selection.eligibleCards` formats
- ✅ Internal item resolution handles slot and carduid types (trash support removed)
- ✅ DialogManager simplified to pass items directly to DialogUIManager
- ✅ ItemDataResolver logic consolidated into DialogUIManager for better cohesion

```javascript
// ✅ SIMPLIFIED PATTERN (Current)
const cardObject = {
  // Core identifiers
  cardId: unit.cardData?.id || unit.cardUid,
  cardUid: unit.cardUid || cardUid,
  zone: zone,
  playerId: playerId,
  type: "slot",
  
  // Slot-level totals (unit + pilot combined)
  totalAP: totalAP,
  totalHP: totalHP,
  
  // Selection metadata
  selectionIndex: index,
  displayName: displayName,
  
  // Raw objects passed directly to Card components
  unit: unit,  // ✅ Raw unit object
  pilot: pilot ? pilot : null,  // ✅ Raw pilot object
  
  // Legacy compatibility
  slot: zone,
  slotName: zone
};
```

**Key Benefits**:
- ✅ Eliminates redundant data transformation
- ✅ Follows established SlotAreaManager patterns
- ✅ Maintains compatibility with Card component system
- ✅ Reduces complexity and potential data inconsistencies

### DialogUIManager Pattern
**Purpose**: Handle diverse card data structures while maintaining total AP/HP label display.

```javascript
// Smart card data detection
let cardDataForDisplay;
if (originalCard && originalCard.unit) {
  // Card object with unit property (from ItemDataResolver slot targets)
  cardDataForDisplay = originalCard.unit;
} else if (originalCard && originalCard.cardData) {
  // Direct card object with cardData property
  cardDataForDisplay = originalCard;
} else if (originalCard && originalCard.id) {
  // Direct cardData format
  cardDataForDisplay = originalCard;
} else {
  // Fallback to original card
  cardDataForDisplay = originalCard;
}

// ✅ SIMPLIFIED: Use Card's built-in total labels configuration method
if (originalCard && (originalCard.totalAP !== undefined || originalCard.totalHP !== undefined)) {
  const totalAP = originalCard.totalAP || cardDataForDisplay.currentAP || cardDataForDisplay.cardData?.ap || 0;
  const totalHP = originalCard.totalHP || cardDataForDisplay.currentHP || cardDataForDisplay.cardData?.hp || 0;
  
  cardComponent.configureTotalLabels(totalAP, totalHP, {
    showBackground: false,
    depth: 1505,
    zone: 'slot1'
  });
}
```

### Graphics Button Pattern (Fix for setTint Error)
**Problem**: Graphics objects don't have `setTint()` method, causing runtime errors.

**Solution**: Use helper method with `clear()`, `fillStyle()`, and `fillRoundedRect()`.

```javascript
// ✅ CORRECT PATTERN for Graphics buttons
static _setButtonColor(button, color) {
  if (button && typeof button.clear === 'function') {
    const scene = button.scene;
    const centerX = scene ? scene.scale.width / 2 : 960;
    const buttonY = button._buttonY || (scene && scene.scale.height * 0.7) || 700;
    
    // Determine button position using stored flag
    const isOKButton = button._isOKButton === true;
    const buttonX = isOKButton ? centerX - 120 : centerX + 20;
    
    button.clear();
    button.fillStyle(color);
    button.fillRoundedRect(buttonX, buttonY - 17, 100, 35, 8);
  }
}

// Usage in event handlers
okButton.on('pointerover', () => {
  this._setButtonColor(okButton, 0x66BB6A); // ✅ Works
  // okButton.setTint(0x66BB6A); // ❌ Fails for Graphics objects
});
```

### Slot Target Display Pattern
**Purpose**: Properly display unit+pilot combinations with correct total label visibility using SlotAreaManager pattern.

```javascript
// ✅ SIMPLIFIED: Use SlotAreaManager method for unit+pilot total label configuration
if (slotTarget.totalAP !== undefined && slotTarget.totalHP !== undefined) {
  SlotAreaManager.configureSlotTotalLabels(unitCard, pilotCard, slotTarget.totalAP, slotTarget.totalHP);
}

// This replaces the previous inline logic:
// - When both unit and pilot present: pilot shows combined totals, unit labels hidden
// - When unit only: unit shows its total labels
// - When pilot only: pilot shows its total labels
```

### SlotAreaManager Total Labels Configuration Method
**Purpose**: Centralized unit+pilot total label configuration following established SlotAreaManager patterns.

```javascript
// ✅ NEW STATIC METHOD in SlotAreaManager.js
/**
 * Configure total labels for unit+pilot card pair with given total values
 * @param {Card} unitCard - Unit card component
 * @param {Card} pilotCard - Pilot card component (can be null)
 * @param {number} totalAP - Total AP value to display
 * @param {number} totalHP - Total HP value to display
 */
SlotAreaManager.configureSlotTotalLabels(unitCard, pilotCard, totalAP, totalHP);

// ✅ USAGE EXAMPLES:
// For slot target displays with unit+pilot
SlotAreaManager.configureSlotTotalLabels(unitCard, pilotCard, slotData.totalAP, slotData.totalHP);

// For unit only scenarios
SlotAreaManager.configureSlotTotalLabels(unitCard, null, unitAP, unitHP);

// For pilot only scenarios  
SlotAreaManager.configureSlotTotalLabels(null, pilotCard, pilotAP, pilotHP);
```

### SlotAreaManager Card Lookup Method
**Purpose**: Find slot information for any card instance (needed for CardPreviewManager).

```javascript
// ✅ NEW INSTANCE METHOD in SlotAreaManager.js
/**
 * Get slot information for a given card instance
 * @param {Card} card - Card instance to find
 * @returns {Object|null} Slot info with playerType, slotName, cardType or null if not found
 */
const slotInfo = slotAreaManager.getSlotInfoFromCard(hoveredCard);

// Returns: { playerType: 'player', slotName: 'slot1', cardType: 'unit' }
// Or: { playerType: 'opponent', slotName: 'slot3', cardType: 'pilot' }
// Or: null if card not found in any slot

// ✅ USAGE EXAMPLE (CardPreviewManager):
const slotInfo = this.scene.slotAreaManager.getSlotInfoFromCard(hoveredCard);
if (slotInfo) {
  const slotCards = this.scene.slotAreaManager.getSlotCards(slotInfo.playerType, slotInfo.slotName);
  // Now can determine unit+pilot relationships for preview
}
```

### Card Total Labels Configuration Method
**Purpose**: Reusable method for configuring total AP/HP labels on any Card (dialogs, units without pilots, etc.).

```javascript
// ✅ NEW METHOD in Card.js
/**
 * Configure PowerOverlay to show total AP/HP labels
 * @param {number} totalAP - Total AP value to display
 * @param {number} totalHP - Total HP value to display
 * @param {Object} options - Configuration options
 * @param {boolean} options.showBackground - Whether to show PowerOverlay background (default: false)
 * @param {number} options.depth - Z-depth for the PowerOverlay (optional)
 * @param {string} options.zone - Zone name for label visibility ('slot1' shows, 'hand' hides, default: 'slot1')
 */
cardComponent.configureTotalLabels(totalAP, totalHP, {
  showBackground: false,  // No background for clean display
  depth: 1505,           // Above card depth (optional)
  zone: 'slot1'          // Show total labels
});

// ✅ USAGE EXAMPLES:
// For dialogs with slot data
cardComponent.configureTotalLabels(slotData.totalAP, slotData.totalHP);

// For unit cards without pilots in slots
cardComponent.configureTotalLabels(unitAP, unitHP, { zone: 'slot1' });

// For cards in hand (hide total labels)
cardComponent.configureTotalLabels(0, 0, { zone: 'hand' });
```

## Troubleshooting Common Issues (2024)

### Data Structure Issues

**Problem**: Complex data transformation leading to inconsistent card display
```javascript
// ❌ AVOID: Complex data transformation
const cardData = {
  id: cardImageId,
  name: displayCardId || cardImageId,
  hp: originalCard?.totalHP || originalCard?.originalHP || originalCard?.cardData?.hp || 0,
  // ... complex transformation
};
```

**Solution**: Pass raw objects directly
```javascript
// ✅ PREFERRED: Direct object passing
const cardComponent = new Card(scene, cardX, cardsY, originalCard, options);
```

### Graphics Button Errors

**Problem**: `TypeError: okButton.setTint is not a function`
- **Cause**: Using `setTint()` on Graphics objects instead of Image/Sprite objects
- **Fix**: Use `_setButtonColor()` helper method with proper Graphics API

**Problem**: Button color updates not working
- **Cause**: Missing position tracking or incorrect button identification
- **Fix**: Store `_isOKButton` and `_buttonY` properties during button creation

### PowerOverlay Label Issues

**Problem**: Total AP/HP labels not showing in dialogs
- **Cause**: PowerOverlay visibility settings or zone configuration
- **Fix**: Set `setTotalLabelsVisibility('slot1')` and `updateTotalStats()`

**Problem**: Labels showing background in dialogs
- **Cause**: Default PowerOverlay background setting
- **Fix**: Set `setShowBackground(false)` after Card creation

### ItemDataResolver Integration

**Problem**: Card component failing with ItemDataResolver data
- **Cause**: Mismatch between expected Card input and ItemDataResolver output
- **Fix**: Use smart card data detection pattern in DialogUIManager

## Best Practices for Future Development

### Data Flow Simplification
1. **Minimize Transformation**: Pass raw objects when possible
2. **Follow Patterns**: Use established SlotAreaManager patterns
3. **Preserve Context**: Maintain original data structure integrity
4. **Validate Compatibility**: Ensure Card component compatibility

### UI Component Creation
1. **Object Type Awareness**: Know whether you're working with Graphics, Image, or Sprite objects
2. **Method Availability**: Check method existence before calling (e.g., `setTint()` vs Graphics API)
3. **Position Tracking**: Store position data for dynamic updates
4. **Proper Cleanup**: Ensure proper destruction of dynamic elements

### PowerOverlay Management
1. **Zone Configuration**: Use proper zone names for visibility ('slot1' shows, 'hand' hides)
2. **Background Control**: Set `showBackground: false` for dialog cards
3. **Stats Updates**: Call `updateTotalStats()` with calculated values
4. **Depth Management**: Set appropriate depth levels for dialog overlays
5. **Card Status Updates**: Ensure `isRested` status is passed to `updateCardStatus()` for proper "Rested"/"Active" display

### Testing Strategies
1. **Data Structure Validation**: Test with various card data formats
2. **UI Interaction Testing**: Verify button hover/click behaviors
3. **Label Visibility Testing**: Check total AP/HP display in different scenarios
4. **Error Handling**: Test with malformed or missing data