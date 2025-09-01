import Phaser from 'phaser';
import GameScene from './GameScene.js';

export default class DemoSceneBasic extends GameScene {


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
  // Override simulateSetScenario for demo-specific functionality
  async simulateSetScenario(scenarioPath) {
    this.isTestMode = true;
    
    // Get scenario from API - new response structure
    const response = await this.apiManager.requestTestScenario(scenarioPath);
    console.log('Scenario response:', JSON.stringify(response));
    
    // Extract scenario data from new API response structure
    const scenario = response.scenario;
    const gameId = scenario.gameId;
    const gameEnv = scenario.initialGameEnv;
    
    // Inject game state using the new API method
    await this.apiManager.injectGameState(gameId, gameEnv);
    
    this.gameStateManager.initializeGame(
      gameId, 
      this.inGamePlayerId,
      'Test Player'
    );
    
    console.log("Leader data:", gameEnv.players.playerId_1.deck.leader);
    this.showRoomStatus('set scenario completed,please trigger test polling');
  }


  async testPolling() {
    if (!this.apiManager) {
      console.log('No API manager available');
      return;
    }

    const gameState = this.gameStateManager.getGameState();
    console.log('Manual polling test triggered...');
    console.log('Polling for playerId:', gameState.playerId, 'gameId:', gameState.gameId);
    
    try {
      // Perform a single poll manually
      const response = await this.apiManager.getPlayer(gameState.playerId, gameState.gameId);
      
      if (response && response.gameEnv) {
        console.log('Polling response received:', response);
        this.gameStateManager.updateGameEnv(response.gameEnv);
        
        // Process any events
        /*
        const allEventsProcessed = this.gameStateManager.processGameEvents();
        if(!allEventsProcessed) {
          this.updateGameState();
        }*/
        this.updateGameState();
        
        console.log('Manual polling completed successfully');
      } else {
        console.log('No game environment received from polling');
      }
    } catch (error) {
      console.error('Manual polling failed:', error);
      
      if (error.message.includes('404')) {
        console.log('Game not found on backend. In demo mode, you need to create the game on backend first.');
        console.log('You can either:');
        console.log('1. Create a real game through the API, or');
        console.log('2. Use the backend test endpoints to inject a game state');
      }
    }
  }

}