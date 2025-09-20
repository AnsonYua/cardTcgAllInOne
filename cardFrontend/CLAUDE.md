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