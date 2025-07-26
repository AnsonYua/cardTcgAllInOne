import Phaser from 'phaser';
import GameScene from './GameScene.js';
import UIHelper from '../utils/UIHelper.js';

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
    
    // Initialize UI helper
    this.uiHelper = new UIHelper(this);
    
    // Add demo-specific features
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
      }
    ];

    // Create test buttons using UIHelper - creates them in a vertical column
    this.testButtons = this.uiHelper.createTestButtons(testButtonConfigs);
    
    // Store reference to specific buttons if needed
    this.menuButton = this.testButtons[0];
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