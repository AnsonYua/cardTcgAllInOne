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
    this.crtPlayer = "playerId_1";
    this.scenarioPath = 'UtilityEffects/h-2_setZero_normal';
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
}