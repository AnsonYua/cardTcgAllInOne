// GameSceneRefactored.js - Clean, separated GameScene using manager pattern
import Phaser from 'phaser';
import UIManager from '../managers/UIManager.js';
import ZoneManager from '../managers/ZoneManager.js';
import GameLogicManager from '../managers/GameLogicManager.js';
import GameAnimationManager from '../managers/GameAnimationManager.js';
import EventManager from '../managers/EventManager.js';

export default class GameSceneRefactored extends Phaser.Scene {
  constructor() {
    super({ key: 'GameSceneRefactored' });
    
    // Initialize managers
    this.managers = {};
  }

  init(data) {
    console.log('GameSceneRefactored init called with data:', data);
    
    // Store initialization data
    this.gameStateManager = data.gameStateManager;
    this.apiManager = data.apiManager;
    this.isOnlineMode = data.isOnlineMode || false;
    this.isManualPollingMode = data.isManualPollingMode || false;
    this.shuffleAnimationPlayed = false;
    this.waitingForPlayers = false;
  }

  async create() {
    console.log('GameSceneRefactored create method called');
    console.log('Initial game state:', this.gameStateManager?.getGameState());
    
    // Initialize all managers
    this.initializeManagers();
    
    // Set up the game
    await this.setupGame();
    
    // Start game flow
    this.startGameFlow();
  }

  initializeManagers() {
    // Create managers
    this.managers.ui = new UIManager(this);
    this.managers.zone = new ZoneManager(this);
    this.managers.gameLogic = new GameLogicManager(this);
    this.managers.animation = new GameAnimationManager(this);
    this.managers.event = new EventManager(this);
    
    // Initialize managers
    this.managers.ui.init();
    this.managers.zone.init(this.managers.ui.getLayout());
    this.managers.gameLogic.init(this.gameStateManager, this.apiManager, this.isOnlineMode);
    this.managers.animation.init();
    this.managers.event.init(this.managers);
    
    console.log('All managers initialized successfully');
  }

  async setupGame() {
    // Start polling if in online mode
    this.setupPolling();
    
    // Load game data
    await this.loadGameData();
    
    // Prepare initial state
    this.prepareInitialState();
  }

  setupPolling() {
    if (this.isOnlineMode && this.apiManager && !this.isManualPollingMode) {
      console.log('Starting API polling...');
      this.gameStateManager.startPolling(this.apiManager);
    } else if (this.isManualPollingMode) {
      console.log('Manual polling mode enabled - use test button to poll');
    }
  }

  async loadGameData() {
    // Load mock hand data only in offline mode
    if (!this.isOnlineMode) {
      await this.managers.gameLogic.loadMockHandData();
    }
    
    // Load leader cards data
    await this.managers.gameLogic.loadLeaderCardsData();
  }

  prepareInitialState() {
    // Hide hand area during shuffling
    this.managers.ui.hideHandArea();
    
    // Decide whether to start animation immediately or wait
    if (!this.isOnlineMode) {
      this.startShuffleAnimation();
    } else {
      console.log('Online mode - waiting for both players to be ready before starting animation...');
      this.waitingForPlayers = true;
    }
  }

  startGameFlow() {
    console.log('Game flow started successfully');
    
    // Initial game state update
    this.managers.gameLogic.updateGameState();
  }

  async startShuffleAnimation() {
    try {
      console.log('Starting shuffle animation...');
      await this.managers.event.startShuffleAnimation();
      console.log('Shuffle animation completed');
    } catch (error) {
      console.error('Error during shuffle animation:', error);
    }
  }

  // Simplified public methods for backwards compatibility
  updateGameState() {
    this.managers.gameLogic.updateGameState();
  }

  selectLeaderCard(playerType = 'player') {
    this.managers.gameLogic.selectLeaderCard(playerType);
  }

  async testAddCard() {
    await this.managers.gameLogic.testAddCard();
  }

  async testPolling() {
    await this.managers.gameLogic.testPolling();
  }

  async simulatePlayer2Join() {
    await this.managers.gameLogic.simulatePlayer2Join();
  }

  showRedrawDialog() {
    this.managers.event.showRedrawDialog();
  }

  displayGameInfo() {
    this.managers.event.displayGameInfo();
  }

  showRoomStatus(message) {
    this.managers.ui.showRoomStatus(message);
  }

  // Getters for backwards compatibility
  get layout() {
    return this.managers.zone.getLayout();
  }

  get playerHand() {
    return this.managers.gameLogic.getPlayerHand();
  }

  get playerZones() {
    return this.managers.zone.getPlayerZones();
  }

  get opponentZones() {
    return this.managers.zone.getOpponentZones();
  }

  get handContainer() {
    return this.managers.ui.getHandContainer();
  }

  get leaderCards() {
    return this.managers.gameLogic.getLeaderCards();
  }

  get playerLeaderCards() {
    return this.managers.gameLogic.getPlayerLeaderCards();
  }

  get opponentLeaderCards() {
    return this.managers.gameLogic.getOpponentLeaderCards();
  }

  get shuffleAnimationManager() {
    return this.managers.animation.getShuffleAnimationManager();
  }

  // Simplified event handlers
  endTurn() {
    this.managers.gameLogic.endTurn();
  }

  openMenu() {
    this.scene.start('MenuScene');
  }

  showCardPreview(cardData) {
    this.managers.zone.showCardPreview(cardData);
  }

  hideCardPreview() {
    this.managers.zone.hideCardPreview();
  }

  // Scene lifecycle
  destroy() {
    console.log('GameSceneRefactored destroy called');
    
    // Stop polling when scene is destroyed
    if (this.gameStateManager) {
      this.gameStateManager.stopPolling();
    }
    
    // Clean up all managers
    Object.values(this.managers).forEach(manager => {
      if (manager && typeof manager.destroy === 'function') {
        manager.destroy();
      }
    });
    
    this.managers = {};
    
    // Call parent destroy
    super.destroy();
  }

  // Development/debugging helpers
  getManager(name) {
    return this.managers[name];
  }

  getAllManagers() {
    return this.managers;
  }

  // Event forwarding for external access
  on(eventName, handler) {
    this.managers.event.on(eventName, handler);
  }

  emit(eventName, data) {
    this.managers.event.emit(eventName, data);
  }
}

// Export the refactored scene for easy switching
export { GameSceneRefactored };