import Phaser from 'phaser';
import DemoSceneBasic from './DemoSceneBasic.js';
import UIHelper from '../utils/UIHelper.js';
import { DEBUG_SCENARIO_PATHS, getNextScenarioPath, resolveScenarioPathIndex } from '../phaser/controllers/DebugControls.ts';

export default class DemoScene extends DemoSceneBasic {
  constructor() {
    // Call parent constructor with DemoScene key
    super({ key: 'DemoScene' });
    
    // Demo specific properties
    this.isDemoMode = true;
    console.log("DemoScene constructor called");
    
    // Default values - will be overridden by init() method
    this.inGamePlayerId = "playerId_1";
    this.gameId = null;
    this.gameMode = 'host';
    this.debugScenarioIndex = 0;
  }


  init(data) {
    console.log('DemoScene init called with data:', data);
    
    // Use GameScene's init method
    super.init(data);
    
    // Demo mode settings
    this.isManualPollingMode = data.isManualPollingMode !== false;  // Default to true for demo mode
    this.isDemoMode = true;  // Flag to identify this as demo mode
    
    // Override default values with passed parameters
    if (data.scenarioPath) {
      this.scenarioPath = data.scenarioPath;
      console.log('DemoScene using scenarioPath:', this.scenarioPath);
    }
    this.debugScenarioIndex = resolveScenarioPathIndex(this.scenarioPath);
    
    if (data.inGamePlayerId) {
      this.inGamePlayerId = data.inGamePlayerId;
      console.log('DemoScene using inGamePlayerId:', this.inGamePlayerId);
    }
    
    if (data.gameId) {
      this.gameId = data.gameId;
      console.log('DemoScene using gameId:', this.gameId);
    }
    
    if (data.gameMode) {
      this.gameMode = data.gameMode;
      console.log('DemoScene using gameMode:', this.gameMode);
    } else {
      // Default gameMode based on playerId if not specified
      this.gameMode = (this.inGamePlayerId === 'playerId_1') ? 'host' : 'join';
      console.log('DemoScene defaulting to gameMode:', this.gameMode);
    }
    
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
    
    if(this.inGamePlayerId == "playerId_1"){
      // Define test buttons configuration
      /*
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
          text: 'Set Scenario',
          onClick: () => this.simulateSetScenario(),
          options: { 
            enableHover: true,
            fontSize: '12px'
          }
        }
      ];*/
            const testButtonConfigs = [
        {
          text: 'Preload',
          onClick: () => this.preloadResource(),
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
          text: 'Next Scenario',
          onClick: () => this.cycleDebugScenario(),
          options: {
            enableHover: true,
            fontSize: '12px'
          }
        },
        {
          text: 'SetGameEnv',
          onClick: () => this.setEnvironment(),
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
        },
        {
          text: 'Opponent End Turn',
          onClick: () => this.opponentEndTurn(),
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
    }else{
      // Define test buttons configuration
      /*
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
      ];*/
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
          text: 'Next Scenario',
          onClick: () => this.cycleDebugScenario(),
          options: {
            enableHover: true,
            fontSize: '12px'
          }
        },
        {
          text: 'SetGameEnv',
          onClick: () => this.setEnvironment(),
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
        },
        {
          text: 'Opponent End Turn',
          onClick: () => this.opponentEndTurn(),
          options: { 
            enableHover: true,
            fontSize: '12px'
          }
        },
        {
          text: 'Opponent Attack Shield',
          onClick: () => this.opponentAttack(),
          options: { 
            enableHover: true,
            fontSize: '12px'
          }
        },
        {
          text: 'Opponent Attack unit',
          onClick: () => this.opponentAttackUnit(),
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
  }

  preloadResource() {
    this.isSetScenoria = true;
    this.showHandArea();
    this.loadCardResources().then(() => {
     
    })
  }

  // Demo mode cleanup
  destroy() {
    console.log('DemoScene cleanup');
    super.destroy();
  }

  // Override simulateSetScenario for demo-specific functionality
  async simulateSetScenario() {
    this.isSetScenoria = true
    this.isTestMode = true
    const _scenarioPath = this.scenarioPath;
    console.log("adfadsasd ", JSON.stringify(this.isTestMode))
    this.loadCardResources().then(() => {
      if(this.gameMode != "join"){
        super.simulateSetScenario(_scenarioPath);
      }
    })
  }

  cycleDebugScenario() {
    const nextPath = getNextScenarioPath(this.scenarioPath);
    this.scenarioPath = nextPath;
    this.debugScenarioIndex = resolveScenarioPathIndex(nextPath);
    this.showRoomStatus(`Scenario selected (${this.debugScenarioIndex + 1}/${DEBUG_SCENARIO_PATHS.length}): ${nextPath}`);
    console.log('DemoScene switched scenarioPath:', nextPath);
  }

  async setEnvironment() {
    // Test the hand count comparison logic
    console.log('🧪 Testing hand count comparison logic...');
    
    console.log('Current game state before test:', this.gameStateManager.getGameState());
    console.log('Current hand container count:', this.handContainer ? this.handContainer.list.length : 0);
  
    
    console.log('isSetScenoria after test:', this.isSetScenoria);
  }
  async opponentAttack(){
    try {
      console.log('🗡️ Simulating opponent attack from slot 1 unit to shield/base');
      
      // Get current game state
      const gameState = this.gameStateManager.getGameState();
      const gameId = gameState.gameId;
      const opponentPlayerId = this.gameStateManager.getOpponent();
      
      if (!gameId) {
        throw new Error('No gameId found. Make sure a game is active.');
      }
      
      if (!opponentPlayerId) {
        throw new Error('No opponent found. Make sure both players have joined.');
      }
      
      // Get opponent's zones to check for slot 1 unit (likely 'left' zone based on game structure)
      const opponentZones = this.gameStateManager.getPlayerZones(opponentPlayerId);
      console.log('Opponent zones:', opponentZones);
      
      // Check for units in attacking zones (assuming slot1 = left zone based on card game structure)
      let attackerSlot = null;
      let hasAttackingUnit = false;
      
      // Check common zone names for slot 1 unit
      const possibleSlots = ['slot1']; // Common zone naming patterns
      console.log("helpe 1123221",JSON.stringify(opponentZones['slot1']))


      attackerSlot = opponentZones['slot1'];
      hasAttackingUnit = true;
    
      
      if (!hasAttackingUnit) {
        this.showRoomStatus('No attacking units found in opponent slots');
        console.log('Available opponent zones:', Object.keys(opponentZones));
        return;
      }
      
      // Prepare attack action data
      const actionData = {
        actionType: 'attackShieldArea', // Attack shield/base area
        playerId: opponentPlayerId,
        gameId: gameId,
        attackerCarduid:attackerSlot.unit.carduid
      };
      
      console.log('Sending attack action:', actionData);
      
      // Send the attack request via APIManager
      const response = await this.apiManager.playerAction(opponentPlayerId, gameId, actionData);
      
      if (response && response.success) {
        console.log('Attack executed successfully:', response);
        this.showRoomStatus(`Opponent attack from ${attackerSlot} successful!`);
        
        // Update game state if returned in response
        if (response.gameEnv) {
          const requiresRefresh = this.gameStateManager.checkHandUIDChangesAndSetScenario(
            response.gameEnv,
            'Attack',
            this.handContainer
          );

          if (requiresRefresh) {
            this.isSetScenoria = true;
          }

          this.gameStateManager.updateGameEnv(response.gameEnv);
          this.updateGameState();
        }
        
        // Optionally show attack result details
        if (response.result) {
          console.log('Attack result:', response.result);
          this.showRoomStatus(`Attack result: ${response.result}`);
        }
        
      } else {
        throw new Error(response?.error || 'Failed to execute attack');
      }
      
    } catch (error) {
      console.error('Failed to execute opponent attack:', error);
      this.showRoomStatus('Failed to execute opponent attack: ' + error.message);
      
      // Provide helpful debugging information
      const gameState = this.gameStateManager.getGameState();
      console.log('Current game state for debugging:', {
        phase: gameState.gameEnv.phase,
        currentPlayer: gameState.gameEnv.currentPlayer,
        players: Object.keys(gameState.gameEnv.players),
        zones: gameState.gameEnv.players
      });
    }
  }


  async opponentAttackUnit(){
    try {
      console.log('🗡️ Simulating opponent attack from slot 1 unit to shield/base');
      
      // Get current game state
      const gameState = this.gameStateManager.getGameState();
      const gameId = gameState.gameId;
      const opponentPlayerId = this.gameStateManager.getOpponent();
      
      if (!gameId) {
        throw new Error('No gameId found. Make sure a game is active.');
      }
      
      if (!opponentPlayerId) {
        throw new Error('No opponent found. Make sure both players have joined.');
      }
      
      // Get opponent's zones to check for slot 1 unit (likely 'left' zone based on game structure)
      const opponentZones = this.gameStateManager.getPlayerZones(opponentPlayerId);
      console.log('Opponent zones:', opponentZones);
      
      // Check for units in attacking zones (assuming slot1 = left zone based on card game structure)
      let attackerSlot = null;
      let hasAttackingUnit = false;
      
      // Check common zone names for slot 1 unit
      const possibleSlots = ['slot1']; // Common zone naming patterns
      console.log("helpe 1123221",JSON.stringify(opponentZones['slot1']))


      attackerSlot = opponentZones['slot1'];
      hasAttackingUnit = true;
    
      
      if (!hasAttackingUnit) {
        this.showRoomStatus('No attacking units found in opponent slots');
        console.log('Available opponent zones:', Object.keys(opponentZones));
        return;
      }
      
      // Prepare attack action data
      const actionData = {
        actionType: 'attackUnit', // Attack shield/base area
        playerId: opponentPlayerId,
        gameId: gameId,
        attackerCarduid:attackerSlot.unit.carduid,
        targetUnitUid:'ST01-001_a5fcfa44-d212-4400-8c12-9a58fdbcac84',
        targetPlayerId:'playerId_2'
      };
      
      console.log('Sending attack action:', actionData);
      
      // Send the attack request via APIManager
      const response = await this.apiManager.playerAction(opponentPlayerId, gameId, actionData);
      
      if (response && response.success) {
        console.log('Attack executed successfully:', response);
        this.showRoomStatus(`Opponent attack from ${attackerSlot} successful!`);
        
        // Update game state if returned in response
        if (response.gameEnv) {
          const requiresRefresh = this.gameStateManager.checkHandUIDChangesAndSetScenario(
            response.gameEnv,
            'Attack',
            this.handContainer
          );

          if (requiresRefresh) {
            this.isSetScenoria = true;
          }

          this.gameStateManager.updateGameEnv(response.gameEnv);
          this.updateGameState();
        }
        
        // Optionally show attack result details
        if (response.result) {
          console.log('Attack result:', response.result);
          this.showRoomStatus(`Attack result: ${response.result}`);
        }
        
      } else {
        throw new Error(response?.error || 'Failed to execute attack');
      }
      
    } catch (error) {
      console.error('Failed to execute opponent attack:', error);
      this.showRoomStatus('Failed to execute opponent attack: ' + error.message);
      
      // Provide helpful debugging information
      const gameState = this.gameStateManager.getGameState();
      console.log('Current game state for debugging:', {
        phase: gameState.gameEnv.phase,
        currentPlayer: gameState.gameEnv.currentPlayer,
        players: Object.keys(gameState.gameEnv.players),
        zones: gameState.gameEnv.players
      });
    }
  }


  async opponentEndTurn(){
    const opponentPlayerId = this.gameStateManager.getOpponent();
    const gameState = this.gameStateManager.getGameState();
    const gameId = gameState.gameId;
    const response = await this.apiManager.endTurn(gameId, opponentPlayerId);
    
    if (response && response.success) {
      console.log('Turn ended successfully:', response);
      this.showRoomStatus('Turn ended successfully');
      
      // Update game state if returned in response
      if (response.gameEnv) {
        this.gameStateManager.updateGameEnv(response.gameEnv);
        this.updateGameState();
      }
    } else {
      throw new Error(response?.error || 'Failed to end turn');
    }
  }

  async opponentAcknowledgeDraw() {
    try {
      const gameState = this.gameStateManager.getGameState();
      const gameId = gameState.gameId;
      const playerId = gameState.playerId;
      const opponentPlayerId = this.gameStateManager.getOpponent();
      if (!gameId) {
        throw new Error('No gameId found. Make sure a game is active.');
      }
      
      if (!playerId) {
        throw new Error('No playerId found. Make sure a player is assigned.');
      }
      
      // Get all current game events
      const allEvents = gameState.gameEnv.notificationQueue || [];
      console.log('All events:', allEvents);
      
      // Filter for CARD_DRAWN events that haven't been processed
      const drawEvents = allEvents.filter(event => 
        event.type === 'CARD_DRAWN' && 
        !event.metadata.frontendProcessed && 
        event.metadata.requiresAcknowledgment
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
      const response = await this.apiManager.acknowledgeEvents(gameId, opponentPlayerId, eventIds);
      
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
