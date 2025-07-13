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

## Backend Integration

The frontend is designed to integrate with a REST API backend:

### API Endpoints (Planned)
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

## Known Limitations

- Currently uses demo/mock data instead of live backend
- API integration is prepared but not fully implemented
- No persistent storage of game state
- Limited to local/demo gameplay

## Next Steps

1. **Backend Integration**: Connect to live game server
2. **Multiplayer**: Real-time opponent interaction
3. **Card Effects**: Implement specific card abilities
4. **Deck Building**: Custom deck creation interface
5. **Tournaments**: Multi-game competitive play

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly in demo mode
5. Submit a pull request

## License

MIT License - see LICENSE file for details