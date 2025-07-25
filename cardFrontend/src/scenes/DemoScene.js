import Phaser from 'phaser';
import GameScene from './GameScene.js';

export default class DemoScene extends Phaser.Scene {
  constructor() {
    super({ key: 'DemoScene' });
    
    // Copy all GameScene properties to this instance
    this.gameStateManager = null;
    this.apiManager = null;
    this.cards = [];
    this.zones = {};
    this.selectedCard = null;
    this.draggedCard = null;
    this.isOnlineMode = false;
    this.isManualPollingMode = false;
    this.isTestMode = false;
    this.isDemoMode = true;
    this.shuffleAnimationPlayed = false;
    this.drawPhaseAnimationPlayed = false;
    this.testButtonsCreated = false;
    this.scenarioPath = null;
  }

  init(data) {
    console.log('DemoScene init called with data:', data);
    
    // Use GameScene's init method
    GameScene.prototype.init.call(this, data);
    
    // Handle both demo and test modes
    this.isTestMode = data.isTestMode || false;
    this.scenarioPath = data.scenarioPath || null;
    
    if (this.isTestMode) {
      // Test mode settings
      this.isOnlineMode = data.isOnlineMode || false;
      this.isManualPollingMode = true;  // Test mode uses manual controls
      this.isDemoMode = false;  // This is test mode, not demo mode
      console.log('DemoScene initialized in test mode with scenario:', this.scenarioPath);
    } else {
      // Demo mode settings
      this.isOnlineMode = false;  // Demo scene is always offline
      this.isManualPollingMode = true;  // Enable manual polling for demo
      this.isDemoMode = true;  // Flag to identify this as demo mode
      console.log('DemoScene initialized with demo-specific settings');
    }
  }

  async create() {
    console.log('DemoScene create method called');
    
    // Use GameScene's create method
    await GameScene.prototype.create.call(this);
    
    // Add demo-specific features
    this.initializeDemoFeatures();
  }

  initializeDemoFeatures() {
    console.log('Initializing demo/test-specific features...');
    
    // Add mode indicator
    this.createModeIndicator();
    
    // Add mode-specific instructions
    this.createModeInstructions();
    
    // Add mode-specific buttons
    this.createModeSpecificButtons();
  }

  createModeIndicator() {
    const { width } = this.cameras.main;
    
    // Mode indicator in top-right
    const modeText = this.isTestMode ? 'TEST MODE' : 'DEMO MODE';
    const modeColor = this.isTestMode ? '#ff6600' : '#00ff00';
    
    const modeIndicator = this.add.text(width - 20, 20, modeText, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: modeColor,
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    });
    modeIndicator.setOrigin(1, 0);
    
    // Add scenario path for test mode
    if (this.isTestMode && this.scenarioPath) {
      const scenarioIndicator = this.add.text(width - 20, 50, this.scenarioPath, {
        fontSize: '12px',
        fontFamily: 'Arial',
        fill: '#cccccc',
        backgroundColor: '#000000',
        padding: { x: 5, y: 3 }
      });
      scenarioIndicator.setOrigin(1, 0);
    }
    
    // Add pulsing effect
    this.tweens.add({
      targets: modeIndicator,
      alpha: 0.5,
      duration: 1000,
      ease: 'Power2.easeInOut',
      yoyo: true,
      repeat: -1
    });
  }

  createModeInstructions() {
    const { width, height } = this.cameras.main;
    
    // Mode-specific instructions at bottom center
    const instructionText = this.isTestMode 
      ? 'TEST MODE: Use test buttons to control game flow and test scenarios'
      : 'DEMO MODE: Use test buttons on the left to control the game flow';
    
    const instructions = this.add.text(width / 2, height - 50, instructionText, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: '#ffff00',
      align: 'center'
    });
    instructions.setOrigin(0.5);
  }

  createModeSpecificButtons() {
    const { height } = this.cameras.main;
    const leftX = 130;
    let buttonY = height - 480; // Position above existing buttons
    
    // Reset Demo button
    this.resetDemoButton = this.add.image(leftX, buttonY, 'button');
    this.resetDemoButton.setScale(0.8);
    this.resetDemoButton.setInteractive();
    
    const resetDemoButtonText = this.add.text(leftX, buttonY, 'Reset Demo', {
      fontSize: '12px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    resetDemoButtonText.setOrigin(0.5);
    
    this.resetDemoButton.on('pointerdown', () => {
      this.resetDemoButton.setTint(0x888888);
      this.resetDemoButton.setScale(0.76);
      resetDemoButtonText.setScale(0.95);
      
      this.time.delayedCall(100, () => {
        this.resetDemoButton.clearTint();
        this.resetDemoButton.setScale(0.8);
        resetDemoButtonText.setScale(1);
      });
      
      this.time.delayedCall(50, () => this.resetDemo());
    });
  }

  // Demo-specific methods
  async resetDemo() {
    try {
      console.log('Resetting demo...');
      
      // Reset game state to initial demo state
      this.setupDemoGameState();
      
      // Refresh the UI using GameScene method
      if (GameScene.prototype.updateGameUI) {
        GameScene.prototype.updateGameUI.call(this);
      }
      
      this.showRoomStatus('Demo reset to initial state.');
      
    } catch (error) {
      console.error('Error resetting demo:', error);
      this.showRoomStatus('Error: Could not reset demo.');
    }
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
    // Use GameScene's method
    if (GameScene.prototype.showRoomStatus) {
      GameScene.prototype.showRoomStatus.call(this, demoMessage);
    } else {
      console.log(demoMessage);
    }
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

// Copy all GameScene prototype methods to DemoScene
Object.getOwnPropertyNames(GameScene.prototype).forEach(name => {
  if (name !== 'constructor' && name !== 'init' && name !== 'create' && name !== 'showRoomStatus') {
    DemoScene.prototype[name] = GameScene.prototype[name];
  }
});