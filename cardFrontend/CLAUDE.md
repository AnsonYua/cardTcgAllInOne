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
├── scenes/           # Phaser scene classes (6 total)
├── components/       # Reusable UI components (Card.js, ShuffleAnimationManager.js)
├── managers/         # Game state and API managers (GameStateManager.js, APIManager.js)
├── config/          # Game configuration (gameConfig.js, cardConfig.js)
├── assets/          # Images and card artwork (organized by type: character/, leader/, utilityCard/)
├── mock/            # Mock data for demo mode (handCards.json)
├── utils/           # Helper functions and utilities (currently empty)
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
    zones: {},              // Card placement zones (TOP/LEFT/RIGHT/HELP/SP)
    gameEvents: [],         // Unprocessed events
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
- **Zone System**: TOP/LEFT/RIGHT/HELP/SP zones with different card type compatibility
- **Animation System**: Smooth transitions using Phaser tweens for all game actions

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
- `POST /player/playerAction` - Send player actions
- `POST /player/selectCard` - Card selection
- `POST /player/acknowledgeEvents` - Mark events processed
- `GET /player/:playerId` - Get player data and events

**Battle Progression:**
- `POST /player/nextRound` - Advance to next round

### Event System
- **Real-time Updates**: Poll `GET /player/:playerId?gameId=X` every 1 second
- **Event Processing**: Process events from `gameEnv.gameEvents` array
- **Event Acknowledgment**: Call `POST /player/acknowledgeEvents` to mark processed
- **Event Types**: 30+ different event types (GAME_STARTED, CARD_PLAYED, BATTLE_CALCULATED, etc.)

### Demo Mode
- **Mock Data**: Complete demo functionality without backend (uses `src/mock/handCards.json`)
- **Sample Cards**: Full card database for testing (28 characters, 15 help cards, 10 SP cards, 6 leaders)
- **Game Flow**: Test complete game flow from start to finish
- **Connection Testing**: API connection testing with graceful fallback to demo mode

## Game Mechanics Implementation

### Card System
- **Card Types**: Character (blue), Help (green), SP (purple), Leader (gold)
- **Zones**: TOP/LEFT/RIGHT (character), HELP (help cards), SP (special power), LEADER, DECK zones
- **Face-down Mechanics**: Strategic placement with right-click toggle
- **Drag-and-Drop**: Complete system with zone validation and visual feedback
- **Zone Compatibility**: Cards can only be placed in compatible zones

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
- **Manager Pattern**: GameStateManager and APIManager for separation of concerns
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

## Critical Development Patterns

### Component Design
- **Card Component**: Extends `Phaser.GameObjects.Container` with full interaction system
- **State Management**: Cards maintain their own state (selected, dragging, faceDown, etc.)
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

### Development Workflow Tips
- **Demo-First**: Always test in demo mode before backend integration
- **Scene Debugging**: Use `this.scene.get('SceneName')` for cross-scene communication
- **State Inspection**: GameStateManager provides complete state visibility
- **Performance Monitoring**: Watch for memory leaks in drag-and-drop operations