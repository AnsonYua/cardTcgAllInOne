import Phaser from 'phaser';
import GameScene from './GameScene.js';

export default class DemoScene extends GameScene {
  constructor() {
    // Call parent constructor with DemoScene key
    super({ key: 'DemoScene' });
    
    // Demo specific properties
    this.isDemoMode = true;
  }

  init(data) {
    console.log('DemoScene init called with data:', data);
    
    // Use GameScene's init method
    super.init(data);
    
    // Demo mode settings
    this.isOnlineMode = data.isOnlineMode || false;
    this.isManualPollingMode = true;  // Demo mode uses manual controls
    this.isDemoMode = true;  // Flag to identify this as demo mode
    console.log('DemoScene initialized with demo-specific settings');
  }

  async create() {
    console.log('DemoScene create method called');
    
    // Use GameScene's create method
    await super.create();
    
    // Add demo-specific features
    this.initializeDemoFeatures();
  }

  initializeDemoFeatures() {
    console.log('Initializing demo-specific features...');
    
    // Demo features removed as requested
  }


  setupDemoGameState() {
    // Set up initial demo game state (similar to MenuScene's setupDemoGameState)
    const mockGameEnv = {
      phase: 'MAIN_PHASE',
      round: 1,
      gameStarted: true,
      currentPlayer: 'playerId_1',
      currentTurn: 0,
      firstPlayer: 0,
      players: {
        playerId_1: {
          id: 'playerId_1',
          name: 'Demo Player',
          deck: {
            hand: ['c-1', 'h-1', 'c-2', 'c-3', 'c-4'],
            mainDeck: ['c-5', 'c-6', 'c-7', 'c-8', 'c-9'],
            leader: ['s-1', 's-2', 's-3', 's-4'],
            currentLeaderIdx: 0
          },
          isReady: true,
          redraw: 0,
          turnAction: [],
          playerPoint: 0,
          fieldEffects: {
            zoneRestrictions: {
              TOP: ['右翼', '自由', '經濟'],
              LEFT: ['右翼', '自由', '愛國者'],
              RIGHT: ['右翼', '愛國者', '經濟'],
              HELP: 'ALL',
              SP: 'ALL'
            },
            activeEffects: [],
            calculatedPowers: {},
            disabledCards: [],
            victoryPointModifiers: 0
          }
        },
        playerId_2: {
          id: 'playerId_2',
          name: 'Demo Opponent',
          deck: {
            hand: ['h-2', 'c-17', 'c-18', 'c-19', 'c-20'],
            mainDeck: ['c-21', 'c-22', 'c-23', 'c-24', 'c-25'],
            leader: ['s-2', 's-3', 's-4', 's-5'],
            currentLeaderIdx: 0
          },
          isReady: true,
          redraw: 0,
          turnAction: [],
          playerPoint: 0,
          fieldEffects: {
            zoneRestrictions: {
              TOP: ['左翼', '自由', '經濟', '右翼', '愛國者'],
              LEFT: ['左翼', '自由', '經濟', '右翼', '愛國者'],
              RIGHT: ['左翼', '自由', '經濟', '右翼', '愛國者'],
              HELP: 'ALL',
              SP: 'ALL'
            },
            activeEffects: [],
            calculatedPowers: {},
            disabledCards: [],
            victoryPointModifiers: 0
          }
        }
      },
      zones: {
        playerId_1: {
          leader: {
            id: 's-1',
            name: '特朗普',
            cardType: 'leader',
            gameType: '愛國者',
            initialPoint: 100,
            level: 8,
            rarity: 'legendary',
            zoneCompatibility: {
              top: ['右翼', '自由', '經濟'],
              left: ['右翼', '自由', '愛國者'],
              right: ['右翼', '愛國者', '經濟']
            }
          },
          top: [],
          left: [],
          right: [],
          help: [],
          sp: []
        },
        playerId_2: {
          leader: {
            id: 's-2',
            name: '拜登',
            cardType: 'leader',
            gameType: '左翼',
            initialPoint: 100,
            level: 7,
            rarity: 'legendary',
            zoneCompatibility: {
              top: ['左翼', '自由', '經濟', '右翼', '愛國者'],
              left: ['左翼', '自由', '經濟', '右翼', '愛國者'],
              right: ['左翼', '自由', '經濟', '右翼', '愛國者']
            }
          },
          top: [],
          left: [],
          right: [],
          help: [],
          sp: []
        }
      },
      gameEvents: [],
      lastEventId: 1,
      pendingPlayerAction: null,
      pendingCardSelections: {},
      playSequence: {
        globalSequence: 2,
        plays: [
          {
            sequenceId: 1,
            playerId: 'playerId_1',
            cardId: 's-1',
            zone: 'leader',
            timestamp: 1000,
            faceDown: false
          },
          {
            sequenceId: 2,
            playerId: 'playerId_2',
            cardId: 's-2',
            zone: 'leader',
            timestamp: 1001,
            faceDown: false
          }
        ]
      }
    };

    // Update game state manager
    this.gameStateManager.updateGameEnv(mockGameEnv);
    
    console.log('Demo game state reset');
  }

  // Override showRoomStatus to add demo prefix
  showRoomStatus(message) {
    const demoMessage = `[DEMO] ${message}`;
    super.showRoomStatus(demoMessage);
  }

  // Override polling behavior for demo mode
  startManualPolling() {
    console.log('Demo mode: Manual polling enabled - use test buttons to update state');
    // Demo mode uses test buttons instead of automatic polling
  }

  // Demo mode cleanup
  destroy() {
    console.log('DemoScene cleanup');
    super.destroy();
  }
}