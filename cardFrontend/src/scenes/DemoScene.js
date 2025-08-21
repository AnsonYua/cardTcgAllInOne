import Phaser from 'phaser';
import DemoSceneBasic from './DemoSceneBasic.js';
import UIHelper from '../utils/UIHelper.js';

export default class DemoScene extends DemoSceneBasic {
  constructor() {
    // Call parent constructor with DemoScene key
    super({ key: 'DemoScene' });
    
    // Demo specific properties
    this.isDemoMode = true;
    console.log("DemoScene constructor called");
    this.inGamePlayerId = "playerId_1";
    //this.scenarioPath = 'UtilityEffects/h-2_setZero_normal_multiple_select';
    this.scenarioPath = 'CharacterCase/sample_play_card_all';
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
    await super.create();
    this.uiHelper = new UIHelper(this);
    this.initializeDemoFeatures();
  }

  initializeDemoFeatures() {
    console.log('Initializing demo-specific features...');
    // Demo features removed as requested
    this.createTestButtons();
  }

  createTestButtons() {
    console.log('Creating test buttons...');
    
    // Define test buttons configuration
    const testButtonConfigs = [
      {
        text: 'Menu',
        onClick: () => this.openMenu(),
        options: { enableHover: true }
      },
      {
        text: 'Test Polling',
        onClick: () => this.testPolling(),
        options: { 
          enableHover: true,
          fontSize: '12px'
        }
      },
      {
        text: 'Player 2 Join',
        onClick: () => this.simulatePlayer2Join(),
        options: { 
          enableHover: true,
          fontSize: '12px'
        }
      },
      {
        text: 'P2 Redraw',
        onClick: () => this.simulatePlayer2Redraw(),
        options: { 
          enableHover: true,
          fontSize: '12px'
        }
      },
      {
        text: 'Set Scenario',
        onClick: () => this.simulateSetScenario(),
        options: { 
          enableHover: true,
          fontSize: '12px'
        }
      },
      {
        text: 'Acknowledge Draw',
        onClick: () => this.opponentAcknowledgeDraw(),
        options: { 
          enableHover: true,
          fontSize: '12px'
        }
      }
    ];

    // Create test buttons using UIHelper - creates them in a vertical column
    this.testButtons = this.uiHelper.createTestButtons(testButtonConfigs);
    
    // Store reference to specific buttons if needed
    this.menuButton = this.testButtons[0];
  }


  // Demo mode cleanup
  destroy() {
    console.log('DemoScene cleanup');
    super.destroy();
  }

  // Override simulateSetScenario for demo-specific functionality
  async simulateSetScenario() {
    //const scenarioPath = 'CharacterCase/character_c-1_trump_family_boost_dynamic';
    const _scenarioPath = this.scenarioPath;
    await super.simulateSetScenario(_scenarioPath);
  }

  async opponentAcknowledgeDraw() {
    try {
      const gameState = this.gameStateManager.getGameState();
      const gameId = gameState.gameId;
      
      if (!gameId) {
        throw new Error('No gameId found. Make sure a game is active.');
      }
      
      // Get all current game events
      const allEvents = gameState.gameEnv.gameEvents || [];
      console.log('All events:', allEvents);
      
      // Filter for DRAW_PHASE_COMPLETE events that haven't been processed
      const drawEvents = allEvents.filter(event => 
        event.type === 'DRAW_PHASE_COMPLETE' && 
        !event.frontendProcessed && 
        event.requireFrontendAcknowledgment
      );
      
      if (drawEvents.length === 0) {
        console.log('No unprocessed draw events found');
        this.showRoomStatus('No unprocessed draw events to acknowledge');
        return;
      }
      
      // Extract event IDs
      const eventIds = drawEvents.map(event => event.id);
      console.log('Found draw events to acknowledge:', eventIds);
      
      // Call the acknowledgeEvents API
      const response = await this.apiManager.acknowledgeEvents(gameId, eventIds);
      
      console.log('Acknowledge events response:', response);
      this.showRoomStatus(`Successfully acknowledged ${eventIds.length} draw event(s): ${eventIds.join(', ')}`);
      
      // Optional: Force a poll to get updated game state
      if (this.testPolling) {
        setTimeout(() => this.testPolling(), 100);
      }
      
    } catch (error) {
      console.error('Failed to acknowledge draw events:', error);
      this.showRoomStatus('Failed to acknowledge draw events: ' + error.message);
    }
  }
}