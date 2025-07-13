# Frontend Requirements - Revolution and Rebellion TCG

## Project Overview

Create a web-based Trading Card Game frontend using **Phaser 3** framework for "Revolution and Rebellion" - a strategic TCG where leaders summon characters to compete based on power and combinations rather than direct combat.

## Technical Stack Requirements

### Core Framework
- **Phaser 3** (latest stable version) - primary game engine
- **HTML5/CSS3/JavaScript (ES6+)** - web technologies
- **Responsive Design** - support desktop and tablet (1024x768 minimum)
- **Modern Browser Support** - Chrome, Firefox, Safari, Edge (ES6+ compatible)

### Development Tools
- **Webpack/Vite** - build system and bundling
- **ESLint/Prettier** - code quality and formatting
- **Live Reload** - development server with hot reload
- **Source Maps** - debugging support

## Game Architecture Requirements

### Scene Structure
Create the following Phaser scenes:

1. **MenuScene** - Main menu, game creation, lobby
2. **GameScene** - Core gameplay interface and interactions
3. **CardSelectionScene** - Modal overlay for card selection workflows
4. **BattleResultScene** - Battle results, victory points, round progression
5. **GameOverScene** - Final victory screen and game statistics

### Asset Management
- **Preloader Scene** - loading screen with progress bar
- **Asset Organization** - separate folders for cards, UI, backgrounds, effects
- **Dynamic Loading** - load card images based on game data
- **Fallback Images** - placeholder for missing card artwork

## Backend Integration Requirements

### API Communication
- **Base URL**: Configurable backend server endpoint
- **HTTP Client**: Use fetch API with proper error handling
- **Polling System**: 1-second intervals for game state updates
- **Event Processing**: Handle real-time game events from server

### Required API Endpoints Integration
```javascript
// Game Management
POST /game/create
GET /game/:gameId
POST /player/startGame
POST /player/startReady

// Gameplay Actions  
POST /player/playerAction
POST /player/selectCard
POST /player/acknowledgeEvents
GET /player/:playerId

// Battle Progression
POST /player/nextRound
```

### Event System Integration
Implement polling-based event system:
- Poll `GET /player/:playerId?gameId=X` every 1 second
- Process events from `gameEnv.gameEvents` array
- Call `POST /player/acknowledgeEvents` to mark events processed
- Handle all event types (see Event Types section below)

## Game State Management

### Client-Side State
```javascript
gameState = {
  gameId: string,
  playerId: string,
  playerName: string,
  gameEnv: {
    phase: string,           // Current game phase
    currentPlayer: string,   // Active player ID
    players: {},            // Player data and hands
    zones: {},              // Card placement zones
    gameEvents: [],         // Unprocessed events
    pendingCardSelections: {}, // Card selection workflows
    victoryPoints: {},      // Current VP totals
    round: number           // Current round/leader
  },
  uiState: {
    selectedCard: null,
    hoveredZone: null,
    showingCardDetails: false,
    pendingAction: null
  }
}
```

### Event Types to Handle
```javascript
// Setup Events
'GAME_STARTED', 'INITIAL_HAND_DEALT', 'PLAYER_READY', 
'HAND_REDRAWN', 'GAME_PHASE_START', 'CARD_DRAWN'

// Turn & Phase Events  
'TURN_SWITCH', 'PHASE_CHANGE', 'ALL_MAIN_ZONES_FILLED',
'ALL_SP_ZONES_FILLED'

// Card Action Events
'CARD_PLAYED', 'ZONE_FILLED', 'CARD_EFFECT_TRIGGERED',
'CARD_SELECTION_REQUIRED', 'CARD_SELECTION_COMPLETED'

// SP & Battle Events
'SP_CARDS_REVEALED', 'SP_EFFECTS_EXECUTED', 
'BATTLE_CALCULATED', 'VICTORY_POINTS_AWARDED', 'NEXT_ROUND_START'

// Error Events
'ERROR_OCCURRED', 'CARD_SELECTION_PENDING', 'WAITING_FOR_PLAYER',
'ZONE_COMPATIBILITY_ERROR', 'PHASE_RESTRICTION_ERROR', 'ZONE_OCCUPIED_ERROR'
```

## User Interface Requirements

### Main Game Board Layout
```
┌─────────────────────────────────────────────────────────────┐
│  OPPONENT INFO        ROUND INFO         VICTORY POINTS     │
│  [Leader] [Hand: 5]   [Round 1/4]       [You: 12 | Opp: 8] │
├─────────────────────────────────────────────────────────────┤
│              OPPONENT CARD ZONES                            │
│    ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐            │
│    │ TOP  │    │ LEFT │    │RIGHT │    │ HELP │            │
│    └──────┘    └──────┘    └──────┘    └──────┘            │
├─────────────────────────────────────────────────────────────┤
│                     BATTLE ZONE                             │
│  ┌──────┐                                    ┌──────┐       │
│  │ SP   │         [BATTLE RESULTS]           │ SP   │       │
│  │(OPP) │           Power + Combo            │(YOU) │       │
│  └──────┘        [Winner Display]           └──────┘       │
├─────────────────────────────────────────────────────────────┤
│              YOUR CARD ZONES                                │
│    ┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐            │
│    │ TOP  │    │ LEFT │    │RIGHT │    │ HELP │            │
│    └──────┘    └──────┘    └──────┘    └──────┘            │
├─────────────────────────────────────────────────────────────┤
│  YOUR INFO           PHASE INFO          ACTION BUTTONS     │
│  [Leader] [Hand: 7]  [MAIN PHASE]       [End Turn] [Menu]  │
└─────────────────────────────────────────────────────────────┘
│                     YOUR HAND                               │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐         │
│  │ C1 │ │ C2 │ │ C3 │ │ C4 │ │ C5 │ │ C6 │ │ C7 │         │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Card Display Requirements

#### Card Visual Elements
- **Card Frame**: Different colors/borders for card types
  - Character cards: Blue border
  - Help cards: Green border  
  - SP cards: Purple border
  - Leader cards: Gold border
- **Card Art**: Placeholder images with card ID display
- **Power Value**: Prominent display for character cards
- **Card Name**: Clear, readable font
- **Face-Down Cards**: Generic card back design
- **Zone Compatibility Icons**: Visual indicators for character card types

#### Card Interaction States
- **Default**: Standard appearance
- **Hovered**: Slight glow/highlight effect
- **Selected**: Strong highlight border
- **Playable**: Green glow when valid placement
- **Invalid**: Red glow when invalid placement
- **Disabled**: Grayed out when not actionable

### Zone Interaction Requirements

#### Zone Visual States
- **Empty**: Dashed border placeholder
- **Occupied**: Solid border with placed card
- **Valid Drop Target**: Green highlight when dragging compatible card
- **Invalid Drop Target**: Red highlight when dragging incompatible card
- **Mandatory Fill**: Yellow border when zone must be filled

#### Drag and Drop System
- **Card Dragging**: Smooth drag from hand to zones
- **Drop Validation**: Real-time feedback on valid/invalid placement
- **Snap to Zone**: Cards snap to center of zones when dropped
- **Cancel Drag**: Return to hand on invalid drop or ESC key
- **Face-Down Toggle**: Right-click or modifier key for face-down placement

### User Interface Components

#### Game Header
- **Player Names**: Display both player names/IDs
- **Current Leader**: Show active leader cards for both players
- **Victory Points**: Real-time VP tracking with visual progress bars
- **Round Counter**: Current round (1-4) with leader progression
- **Timer**: Optional turn timer (if implemented)

#### Phase Indicator
- **Current Phase**: Large, clear display of game phase
- **Phase Progress**: Visual indicator of phase completion
- **Next Phase**: Preview of upcoming phase
- **Auto-Skip Messages**: Notifications when phases are skipped

#### Hand Management
- **Card Arrangement**: Spread cards in hand with slight overlap
- **Hand Scrolling**: Horizontal scroll for large hands
- **Card Count**: Display number of cards in hand
- **Card Tooltips**: Hover for detailed card information

#### Action Buttons
- **End Turn**: Available when player actions complete
- **Redraw**: During initial setup phase
- **Face-Down Toggle**: For strategic face-down placement
- **Menu**: Access to game menu and settings

### Modal and Overlay Requirements

#### Card Selection Interface
When `CARD_SELECTION_REQUIRED` event occurs:
- **Modal Overlay**: Dim background, focus on selection
- **Available Cards**: Display filtered cards in grid layout
- **Selection Limit**: Show "Select X of Y cards" counter
- **Card Preview**: Large preview of hovered card
- **Confirm/Cancel**: Clear action buttons
- **Selection Validation**: Disable confirm until required selections made

#### Battle Results Display
- **Power Calculation**: Breakdown of power sources
- **Combo Display**: Visual representation of triggered combos
- **Victory Points**: Animated VP award with sound
- **Winner Announcement**: Clear victory declaration
- **Next Round Button**: Progress to next leader battle

#### Error and Notification System
- **Toast Notifications**: Temporary messages for game events
- **Error Messages**: Clear error explanations with suggested actions
- **Waiting Indicators**: "Waiting for opponent" messages
- **Connection Status**: Network connection indicator

## Game Flow Implementation

### Game Initialization
1. **Menu Scene**: Player enters name, creates/joins game
2. **Lobby Wait**: Show waiting for opponent message
3. **Leader Reveal**: Display both players' first leaders
4. **Hand Draw**: Animate initial 7-card draw
5. **Redraw Option**: Present redraw choice with countdown
6. **Game Start**: Transition to main game board

### Main Phase Flow
1. **Turn Indicator**: Clear display of active player
2. **Card Placement**: Drag-and-drop from hand to zones
3. **Zone Validation**: Real-time compatibility checking
4. **Face-Down Option**: Right-click or toggle for strategic placement
5. **Turn Completion**: Automatic turn advancement when zones filled
6. **Phase Progression**: Automatic advance when both players complete

### SP Phase Flow
1. **SP Phase Announcement**: Clear phase transition notification
2. **Face-Down Enforcement**: Only allow face-down SP card placement
3. **Auto-Reveal Trigger**: Both cards reveal when zones filled
4. **Priority Display**: Show execution order based on leader initial points
5. **Effect Animation**: Visual effects for SP card abilities
6. **Battle Calculation**: Animated power and combo calculation

### Battle Resolution
1. **Power Display**: Animated counting of total power
2. **Combo Visualization**: Highlight matching card combinations
3. **Winner Declaration**: Clear victory announcement with effects
4. **Victory Points**: Animated VP award and running total update
5. **Next Round**: Transition to next leader or game end

### Card Selection Workflow
1. **Selection Trigger**: Modal appears for search effects
2. **Available Cards**: Display filtered options in organized grid
3. **Selection Process**: Click to select/deselect with visual feedback
4. **Confirmation**: Review selections before submitting
5. **Result Processing**: Cards move to designated zones/hand

## Visual Design Requirements

### Art Style
- **Clean, Modern**: Professional card game aesthetic
- **High Contrast**: Ensure accessibility and readability
- **Consistent Theme**: Historical/political theme with elegant design
- **Color Coding**: Consistent colors for card types and game elements

### Animation Requirements
- **Card Movements**: Smooth transitions for all card actions
- **Zone Highlights**: Subtle pulsing/glowing effects
- **Battle Effects**: Dramatic animations for SP effects and battles
- **UI Transitions**: Smooth scene transitions and modal appearances
- **Victory Celebrations**: Satisfying victory point animations

### Responsive Design
- **Desktop Primary**: Optimized for 1920x1080 displays
- **Tablet Support**: Functional on 1024x768 devices
- **Mobile Consideration**: Basic functionality on large phones (landscape)
- **Scaling System**: UI elements scale appropriately with screen size

## Performance Requirements

### Technical Performance
- **Frame Rate**: Maintain 60 FPS during gameplay
- **Memory Usage**: Efficient asset management and cleanup
- **Load Times**: Game ready within 10 seconds on average connection
- **Network Efficiency**: Minimize API calls while maintaining responsiveness

### User Experience Performance
- **Responsive Interactions**: UI responds within 100ms to user input
- **Visual Feedback**: Immediate feedback for all user actions
- **Error Recovery**: Graceful handling of network issues
- **State Persistence**: Maintain game state during connection problems

## Audio Requirements (Optional)

### Sound Effects
- **Card Actions**: Subtle sounds for card placement and selection
- **Phase Transitions**: Audio cues for phase changes
- **Battle Sounds**: Dramatic effects for SP abilities and battles
- **UI Sounds**: Button clicks, error notifications
- **Victory Music**: Celebratory audio for battle wins

### Audio Implementation
- **Volume Controls**: User-configurable audio levels
- **Mute Option**: Complete audio disable option
- **Audio Loading**: Async loading to prevent blocking
- **Browser Compatibility**: Handle various browser audio policies

## Testing Requirements

### Functional Testing
- **Game Flow**: Complete games from start to finish
- **Error Handling**: Test all error scenarios and recovery
- **Edge Cases**: Unusual card combinations and sequences
- **Multi-Browser**: Test on all supported browsers
- **Network Issues**: Handle disconnections and timeouts

### User Experience Testing
- **Usability**: Intuitive interface without tutorials
- **Accessibility**: Basic keyboard navigation and screen reader support
- **Performance**: Test on minimum specification devices
- **Visual Quality**: Ensure clarity at all supported resolutions

## Deployment Requirements

### Build Configuration
- **Production Build**: Minified, optimized bundle
- **Environment Variables**: Configurable backend API endpoints
- **Asset Optimization**: Compressed images and audio files
- **Caching Strategy**: Efficient browser caching for assets

### Hosting Requirements
- **Static Hosting**: Compatible with CDN deployment
- **HTTPS**: Secure connection for API communication
- **Cross-Origin**: Proper CORS configuration
- **Error Pages**: Custom 404 and error page handling

## Development Guidelines

### Code Organization
```
src/
├── scenes/           # Phaser scene classes
├── components/       # Reusable UI components  
├── managers/         # Game state and API managers
├── utils/           # Helper functions and utilities
├── assets/          # Images, audio, fonts
├── config/          # Game configuration
└── main.js          # Application entry point
```

### Code Quality Standards
- **ES6+ Syntax**: Modern JavaScript features
- **Consistent Naming**: Clear, descriptive variable/function names
- **Documentation**: JSDoc comments for complex functions
- **Error Handling**: Comprehensive try-catch blocks
- **Code Reuse**: Modular, reusable components

### Version Control
- **Git**: Use semantic commit messages
- **Branching**: Feature branches for development
- **Documentation**: Update README with setup instructions
- **Changelog**: Track notable changes and releases

## Success Criteria

### Functional Completion
- [ ] Complete game flow from menu to victory
- [ ] All card types and effects properly implemented
- [ ] Real-time multiplayer synchronization working
- [ ] Card selection workflows functional
- [ ] Face-down mechanics implemented correctly
- [ ] SP phase auto-reveal and priority system working

### Quality Standards
- [ ] No game-breaking bugs or crashes
- [ ] Intuitive user interface requiring no tutorial
- [ ] Consistent visual design throughout
- [ ] Responsive performance on target devices
- [ ] Graceful error handling and user feedback

### Technical Standards
- [ ] Clean, maintainable code structure
- [ ] Proper API integration with error handling
- [ ] Efficient asset loading and management
- [ ] Cross-browser compatibility verified
- [ ] Production build ready for deployment

## Additional Notes

### Future Enhancements
- **AI Opponent**: Single-player mode against computer
- **Deck Builder**: Custom deck creation interface
- **Statistics**: Game history and performance tracking
- **Tournaments**: Multi-player bracket system
- **Spectator Mode**: Watch ongoing games

### Integration Points
- **Backend Events**: Ensure complete event system integration
- **Card Data**: Dynamic loading from backend card definitions
- **Game Rules**: Strict adherence to backend validation logic
- **State Sync**: Maintain perfect synchronization with server state

This document provides comprehensive requirements for implementing a professional-quality Trading Card Game frontend using Phaser 3. The implementation should prioritize user experience, visual clarity, and robust integration with the existing backend system.