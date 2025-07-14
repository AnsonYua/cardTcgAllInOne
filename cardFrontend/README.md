# Revolution and Rebellion TCG - Frontend

A web-based Trading Card Game frontend built with Phaser 3 for the "Revolution and Rebellion" strategic card game.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser to** `http://localhost:3000`

## Game Features

### Core Gameplay
- **Strategic Card Placement**: Drag and drop cards from your hand to board zones
- **Face-Down Mechanics**: Right-click cards to place them face-down for strategic advantage
- **Zone-Based Combat**: Different card types can only be played in compatible zones
- **Power & Combo System**: Calculate battle results based on card power and combinations
- **4-Round Structure**: Progress through 4 leaders with victory point tracking

### Current Implementation
- ✅ Complete game board with player and opponent zones
- ✅ Interactive card system with drag-and-drop
- ✅ Card types: Character, Help, SP, and Leader cards
- ✅ Demo mode with sample cards and gameplay
- ✅ Battle result animations and victory point tracking
- ✅ Card selection modal for special effects
- ✅ Game over screen with statistics

### Demo Mode
The game includes a fully functional demo mode that allows you to:
- Play with sample cards and test all mechanics
- Experience the complete game flow from start to finish
- Test drag-and-drop, zone compatibility, and card interactions
- See battle animations and victory point calculations

## Game Controls

### Basic Controls
- **Left Click**: Select cards and interact with UI elements
- **Right Click**: Toggle cards face-down/face-up (strategic placement)
- **Drag & Drop**: Move cards from hand to board zones
- **Hover**: Preview card details and zone compatibility

### Zone Types
- **TOP/LEFT/RIGHT**: Character card zones (zone compatibility required)
- **HELP**: Help card zone (utility and support cards)
- **SP**: Special Power zone (powerful effect cards, played face-down)

## Development Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production  
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run format   # Format code with Prettier
```

## Project Structure

```
src/
├── scenes/           # Phaser game scenes
│   ├── PreloaderScene.js    # Asset loading
│   ├── MenuScene.js         # Main menu and game creation
│   ├── GameScene.js         # Main gameplay
│   ├── CardSelectionScene.js # Modal card selection
│   ├── BattleResultScene.js # Battle result display
│   └── GameOverScene.js     # Final game results
├── components/       # Reusable game components
│   └── Card.js              # Interactive card component
├── managers/         # Game state and API management
│   ├── GameStateManager.js  # Client-side game state
│   └── APIManager.js        # Backend API integration
├── config/          # Game configuration
│   └── gameConfig.js        # Constants and settings
└── main.js          # Application entry point
```

## Game Architecture

### Scene Flow
1. **PreloaderScene**: Loads assets and creates game textures
2. **MenuScene**: Player name input, game creation/joining
3. **GameScene**: Main gameplay with board, cards, and interactions
4. **CardSelectionScene**: Modal for card selection effects
5. **BattleResultScene**: Animated battle resolution display
6. **GameOverScene**: Final results and statistics

### Card System
- **Card Component**: Fully interactive with drag-and-drop, hover effects, and visual states
- **Zone Compatibility**: Character cards can only be played in compatible zones
- **Face-Down Mechanics**: Strategic placement options with visual toggles
- **Visual Feedback**: Highlights, animations, and clear interaction states

### Game State Management
- **Client-Side State**: Complete game state tracking with GameStateManager
- **Event System**: Handles game events and state synchronization
- **Demo Data**: Sample cards and game scenarios for testing

## Core Architecture

### GameScene.js - Main Gameplay Controller

The `GameScene` is the heart of the game, managing all gameplay interactions, UI, and visual elements.

#### Key Features
- **Card Management**: Handles player hand, leader decks, and card placement
- **Zone System**: Manages TOP/LEFT/RIGHT character zones, HELP zone, SP zone, and LEADER zone
- **Drag & Drop**: Full drag-and-drop system with zone validation
- **Animation System**: Shuffle animations, card movements, and visual effects
- **Real-time Updates**: Integrates with polling system for live game state updates

#### Important Methods
```javascript
// Card and deck management
loadLeaderCardsData()           // Loads and shuffles leader decks for both players
showHandCards()                 // Displays player hand cards
moveLeaderCardToPosition()      // Moves leader cards between deck and leader zone

// UI and interaction
showRedrawDialog()              // Shows card redraw interface with overlay
highlightHandCards()            // Highlights cards during redraw phase
updateUI()                      // Main UI update method triggered by polling

// Game flow
playShuffleDeckAnimation()      // Initial deck shuffle animation
waitForBothPlayersReady()       // Synchronizes game start between players
```

#### Phase Detection
GameScene monitors game phases through polling and triggers appropriate UI updates:
- **READY_PHASE**: Shows redraw dialog for initial hand management
- **MAIN_PHASE**: Enables card placement from hand to zones
- **SP_PHASE**: Handles special power card placement
- **BATTLE_PHASE**: Shows battle results and calculations

### APIManager.js - Backend Communication

Handles all REST API communication with the Node.js backend server.

#### Core Functionality
```javascript
// Game management
async createGame(playerName)              // Creates new game session
async joinGame(gameId, playerName)        // Joins existing game
async startGame(gameId, playerId)         // Starts the game

// Real-time data
async getPlayer(playerId, gameId)         // Polls player data and events
async acknowledgeEvents(gameId, eventIds) // Marks events as processed

// Gameplay actions
async playerAction(gameId, playerId, action) // Sends player actions
async selectCard(gameId, playerId, selectionId, cardIds) // Card selection
```

#### Connection Management
- **Base URL**: `http://localhost:8080`
- **Error Handling**: Graceful degradation to demo mode
- **Retry Logic**: Automatic retry for failed requests
- **Demo Mode**: Complete offline functionality for testing

### GameStateManager.js - State Coordination

Centralized state management system that coordinates between API polling and UI updates.

#### State Structure
```javascript
gameState = {
  gameId: string,
  playerId: string,
  playerName: string,
  gameEnv: {
    phase: string,           // Current game phase
    currentPlayer: string,   // Active player ID
    players: {},            // Player data including hands
    zones: {},              // Card placement zones
    gameEvents: [],         // Unprocessed events from backend
    pendingCardSelections: {}, // Card selection workflows
    victoryPoints: {},      // Victory point totals
    round: number           // Current round (1-4)
  },
  uiState: {
    selectedCard: null,
    hoveredZone: null,
    showingCardDetails: false,
    pendingAction: null
  }
}
```

#### Key Methods
```javascript
// State access
getPlayer(playerId)             // Get player data
getOpponent()                   // Get opponent player ID  
getPlayerHand(playerId)         // Get player's current hand
getPlayerZones(playerId)        // Get player's zone data

// Event system
addEventListener(eventType, handler) // Register event handlers
processGameEvents()             // Process incoming events
acknowledgeEvents(apiManager)   // Mark events as processed

// Polling
startPolling(apiManager)        // Begin 1-second polling cycle
stopPolling()                   // Stop polling
```

## Game Flow Integration

### 1. Game Initialization
```javascript
// MenuScene creates game and transitions to GameScene
gameStateManager.initializeGame(gameId, playerId, playerName);
scene.start('GameScene', { gameStateManager, apiManager, isOnlineMode: true });
```

### 2. Real-time Synchronization
```javascript
// GameStateManager polls every 1 second
startPolling(apiManager) → getPlayer() → updateGameEnv() → processGameEvents()
                                                         ↓
// GameScene responds to state changes
updateUI() → detectPhaseChanges() → showRedrawDialog() / updateCards()
```

### 3. Event Processing
```javascript
// Backend sends events → GameStateManager processes → GameScene updates UI
GAME_STARTED → playShuffleDeckAnimation()
PHASE_CHANGED → updateUI() 
CARD_PLAYED → updateZones()
BATTLE_CALCULATED → showBattleResults()
```

## Key Patterns

### Polling-Based Updates
- **Frequency**: 1-second intervals via `GAME_CONFIG.pollInterval`
- **Data Flow**: API → GameStateManager → GameScene → UI Updates
- **Event Acknowledgment**: Prevents event duplication via `acknowledgeEvents()`

### Depth Management
GameScene uses Phaser depth layers for proper UI rendering:
```javascript
// Overlay depth hierarchy
overlay.setDepth(1000);           // Background overlay
handCards.setDepth(1001);         // Hand cards above overlay  
leaderCards.setDepth(1001);       // Leader cards above overlay
dialog.setDepth(1002);            // Dialog above everything
```

### Card Component Integration
- **Container-Based**: Cards extend `Phaser.GameObjects.Container`
- **Interactive**: Full drag-and-drop with hover effects
- **State Management**: Face-up/face-down, selection states
- **Zone Validation**: Automatic compatibility checking

### Error Handling
- **Graceful Degradation**: Falls back to demo mode when API unavailable
- **Network Resilience**: Handles connection failures transparently
- **State Recovery**: Maintains game state across reconnections

## Backend Integration

The frontend connects to a Node.js/Express backend:

### API Endpoints
- `POST /game/create` - Create new game
- `GET /game/:gameId` - Get game state
- `POST /player/playerAction` - Send player actions
- `GET /player/:playerId` - Get player data and events
- `POST /player/acknowledgeEvents` - Mark events as processed

### Event Polling
- Polls server every 1 second for game updates
- Processes game events and updates UI accordingly
- Handles disconnections and reconnection gracefully

## Card Types & Mechanics

### Character Cards (Blue Border)
- Have power values for battle calculations
- Zone compatibility determines valid placement locations
- Form combos with other cards for bonus effects

### Help Cards (Green Border)
- Utility and support effects
- Can only be played in the HELP zone
- Provide immediate or ongoing benefits

### SP Cards (Purple Border)  
- Special Power cards with powerful effects
- Must be played face-down in SP zones
- Auto-reveal when both players have played SP cards

### Leader Cards (Gold Border)
- Represent the current round leader
- Provide base power and special abilities
- Progress through 4 different leaders per game

## Customization

### Visual Themes
- Modify colors in `src/config/gameConfig.js`
- Card frames and UI elements use configurable color schemes
- Responsive design scales across different screen sizes

### Game Rules
- Adjust game constants in `gameConfig.js`
- Modify card data structures for different card types
- Customize victory conditions and scoring

## Browser Support

- Modern browsers with ES6+ support
- Chrome, Firefox, Safari, Edge
- Minimum resolution: 1024x768
- Optimized for desktop and tablet gameplay

## Development Workflow

### Testing in Demo Mode
```bash
npm run dev  # Starts development server
# Navigate to game, select "Demo Mode" for offline testing
```

### Online Mode Testing
```bash
# Terminal 1 - Backend
cd cardBackend && npm run dev

# Terminal 2 - Frontend  
cd cardFrontend && npm run dev
# Select "Online Mode" and create/join games
```

### Key Files to Monitor
- `GameScene.js` - All gameplay logic and UI updates
- `GameStateManager.js` - State coordination and event processing
- `APIManager.js` - Backend communication and error handling
- `Card.js` - Individual card component behavior
- `gameConfig.js` - Configuration constants and API settings

## Known Limitations

- Leader card overlay visibility needs manual fix (depth management issue)
- Backend leader deck shuffling may need verification
- API integration requires backend server running
- Limited error recovery for network failures

## Next Steps

1. **Fix Leader Card Overlay**: Resolve depth management for leader cards during redraw dialog
2. **Backend Verification**: Ensure leader deck shuffling works correctly on backend
3. **Enhanced Error Handling**: Improve network failure recovery
4. **Card Effects**: Implement specific card abilities
5. **Tournament Mode**: Multi-game competitive play

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in demo mode
5. Submit a pull request

## License

MIT License - see LICENSE file for details