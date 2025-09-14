import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import GameStateManager from '../managers/GameStateManager.js';
import APIManager from '../managers/APIManager.js';
import CardResourcePreloader from './CardResourcePreloader.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this.gameStateManager = new GameStateManager();
    this.apiManager = new APIManager();
  }

  async create() {
    this.createBackground();
    this.createTitle();
    this.createMenuUI();
  }

  createBackground() {
    const { width, height } = this.cameras.main;
    
    // Create gradient background
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    graphics.fillRect(0, 0, width, height);
    
    // Add decorative elements
    
    for (let i = 0; i < 20; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 3),
        0xffffff,
        0.3
      );
      
      this.tweens.add({
        targets: star,
        alpha: { from: 0.3, to: 0.8 },
        duration: Phaser.Math.Between(2000, 4000),
        yoyo: true,
        repeat: -1
      });
    }
  }

  createTitle() {
    const { width, height } = this.cameras.main;
    
    const title = this.add.text(width / 2, height / 4, 'REVOLUTION\n& REBELLION', {
      fontSize: '64px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center',
      stroke: GAME_CONFIG.colors.highlight,
      strokeThickness: 2
    });
    title.setOrigin(0.5);
    
    const subtitle = this.add.text(width / 2, height / 4 + 120, 'Trading Card Game', {
      fontSize: '24px',
      fontFamily: 'Arial',
      fill: '#cccccc',
      align: 'center'
    });
    subtitle.setOrigin(0.5);
    
    // Animate title
    this.tweens.add({
      targets: title,
      scaleX: { from: 1, to: 1.05 },
      scaleY: { from: 1, to: 1.05 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  createMenuUI() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const startY = height / 2 + 50;
    
    // Player name input
    this.createPlayerNameInput(centerX, startY);
    
    // Menu buttons
    this.createButton(centerX, startY + 100, 'Create Game', () => this.createGame());
    this.createButton(centerX, startY + 170, 'Join Game', () => this.showJoinGameInput());
    this.createButton(centerX, startY + 240, 'Demo Mode', () => this.startDemo());
    
    // Instructions
    const instructions = this.add.text(centerX, height - 100, 
      'Enter your name and create or join a game to begin', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#888888',
      align: 'center'
    });
    instructions.setOrigin(0.5);
  }

  createPlayerNameInput(x, y) {
    // Create input background
    const inputBg = this.add.graphics();
    inputBg.fillStyle(0x333333);
    inputBg.fillRoundedRect(x - 150, y - 25, 300, 50, 8);
    inputBg.lineStyle(2, 0x555555);
    inputBg.strokeRoundedRect(x - 150, y - 25, 300, 50, 8);
    
    // Label
    const label = this.add.text(x, y - 60, 'Player Name:', {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    label.setOrigin(0.5);
    
    // Placeholder text
    this.playerNameText = this.add.text(x, y, 'Click to enter name...', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#888888'
    });
    this.playerNameText.setOrigin(0.5);
    
    // Make input interactive
    const inputZone = this.add.zone(x, y, 300, 50);
    inputZone.setInteractive();
    inputZone.on('pointerdown', () => this.showNameInput());
    
    this.playerName = '';
  }

  createButton(x, y, text, callback) {
    console.log('[MenuScene] Creating button - texture exists:', this.textures.exists('button'));
    const button = this.add.image(x, y, 'button');
    button.setInteractive();
    
    const buttonText = this.add.text(x, y, text, {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    buttonText.setOrigin(0.5);
    
    button.on('pointerover', () => {
      button.setTint(0xcccccc);
      this.game.canvas.style.cursor = 'pointer';
    });
    
    button.on('pointerout', () => {
      button.clearTint();
      this.game.canvas.style.cursor = 'default';
    });
    
    button.on('pointerdown', () => {
      // Click visual effect - quick scale and tint
      button.setTint(0x888888);
      button.setScale(0.95);
      buttonText.setScale(0.95);
      
      // Reset after short delay
      this.time.delayedCall(100, () => {
        button.clearTint();
        button.setScale(1);
        buttonText.setScale(1);
      });
      
      // Execute callback after visual effect starts
      this.time.delayedCall(50, callback);
    });
    
    return { button, text: buttonText };
  }

  showNameInput() {
    const name = prompt('👤 Enter your player name:\n\n(This name will be visible to other players)');
    if (name && name.trim()) {
      this.playerName = name.trim();
      this.playerNameText.setText(this.playerName);
      this.playerNameText.setStyle({ fill: '#ffffff' });
    }
  }

  async createGame() {
    this.showLoadingMessage('Creating game...');
    
    try {
      // Create game room via API
      const playerName = this.playerName || 'Player 1'; // Default name if not set
      const response = await this.apiManager.createGame(playerName);
      
      if (response.gameId && response.gameEnv) {
        // For game creator, always use playerId_1
        const playerId = 'playerId_1';
        
        this.gameStateManager.initializeGame(response.gameId, playerId, playerName);
        this.gameStateManager.updateGameEnv(response.gameEnv);
        
        this.hideLoadingMessage();
        this.showConnectionStatus(`🎮 Room created! Game ID: ${response.gameId} (Waiting for player 2...)`);
        
        // Store scene data and use CardResourcePreloader before GameScene
        const sceneData = { 
          gameStateManager: this.gameStateManager, 
          apiManager: this.apiManager,
          isManualPollingMode: false,  // Automatic polling for real games
          gameMode: 'host'  // Host mode for game creator
        };
        
        CardResourcePreloader.preloadBeforeScene(this, 'GameScene', sceneData);
        return;
      }
      
      // Fallback to demo mode
      this.createOfflineDemoGame();
      
    } catch (error) {
      console.error('Failed to create game:', error);
      this.hideLoadingMessage();
      this.showErrorMessage('Failed to connect to server. Starting demo mode...');
      setTimeout(() => this.createOfflineDemoGame(), 2000);
    }
  }

  async showJoinGameInput() {
    const gameId = prompt('🎮 Enter Game ID to join:');
    if (!gameId) {
      return; // User cancelled
    }
    
    const trimmedGameId = gameId.trim();
    if (!trimmedGameId) {
      alert('❌ Game ID cannot be empty. Please enter a valid Game ID.');
      return;
    }
    
    if (trimmedGameId.length < 3) {
      alert('❌ Game ID seems too short. Please check and try again.');
      return;
    }
    
    // Always start DemoScene in join mode with the provided gameId
    const playerId = 'playerId_2';
    const playerName = this.playerName || 'Player 2';
    
    this.gameStateManager.initializeGame(trimmedGameId, playerId, playerName);
    
    // Store scene data and use CardResourcePreloader before DemoScene
    const sceneData = { 
      gameStateManager: this.gameStateManager, 
      apiManager: this.apiManager,
      isManualPollingMode: true,  // Manual polling for demo mode
      scenarioPath: 'CharacterCase/c_9_play_and_draw_hand',
      inGamePlayerId: 'playerId_1',
      gameId: trimmedGameId,
      gameMode: 'join'  // Join mode
    };
    
    CardResourcePreloader.preloadBeforeScene(this, 'DemoScene', sceneData);
  }

  async startDemo() {
    // Start demo with preset name
    this.playerName = 'Demo Player';
    this.showLoadingMessage('Creating demo room...');
    
    try {
      // Create demo game via API
      const playerName = this.playerName || 'Demo Player';
      const createResponse = await this.apiManager.createGame(playerName);
      if (createResponse.gameId && createResponse.gameEnv) {
        const gameId = createResponse.gameId;
        
        // Initialize game state for player 1 (the human player in demo)
        this.gameStateManager.initializeGame(gameId, 'playerId_1', playerName);
        this.gameStateManager.updateGameEnv(createResponse.gameEnv);
        
        console.log('Demo game created with gameId:', gameId);
        console.log('Initial game environment:', createResponse.gameEnv);
        
        this.hideLoadingMessage();
        this.showConnectionStatus(`🎮 Demo room created! Game ID: ${gameId} (Use test buttons to control)`);
        
        // Store scene data and use CardResourcePreloader before DemoScene
        const sceneData = { 
          gameStateManager: this.gameStateManager, 
          apiManager: this.apiManager,
          isManualPollingMode: true,  // Demo mode uses manual polling
          //scenarioPath: 'CharacterCase/sample_play_card_all',
          scenarioPath : 'BasicCase/basicMainBase',
          inGamePlayerId: 'playerId_1',
          gameId: gameId,
          gameMode: 'host'  // Host mode
        };
        
        CardResourcePreloader.preloadBeforeScene(this, 'DemoScene', sceneData);
        return;
      }
    } catch (error) {
      console.error('Failed to create demo game via API:', error);
      this.hideLoadingMessage();
      this.showErrorMessage('API unavailable. Starting offline demo...');
      setTimeout(() => this.createOfflineDemoGame(), 2000);
      return;
    }
  }

  setupDemoGameState() {
    // Create demo game state with sample data
    const opponentId = 'opponent_demo';
    const playerId = this.gameStateManager.getGameState().playerId;
    
    this.gameStateManager.updateGameEnv({
      phase: GAME_CONFIG.phases.MAIN,
      currentPlayer: playerId,
      players: {
        [playerId]: {
          name: this.playerName,
          hand: this.createDemoHand(),
          leader: { id: 'leader_1', name: 'Revolutionary Leader', power: 15 }
        },
        [opponentId]: {
          name: 'Opponent',
          hand: Array(5).fill().map((_, i) => ({ id: `opp_card_${i}` })),
          leader: { id: 'leader_2', name: 'Imperial Commander', power: 18 }
        }
      },
      zones: {
        [playerId]: {
          top: null,
          left: null,
          right: null,
          help: null,
          sp: null
        },
        [opponentId]: {
          top: null,
          left: null,
          right: null,
          help: null,
          sp: null
        }
      },
      victoryPoints: {
        [playerId]: 0,
        [opponentId]: 0
      },
      round: 1
    });
  }

  createDemoHand() {
    return [
      { id: 'char_1', name: 'Revolutionary Fighter', type: 'character', power: 8, zones: ['top', 'left'] },
      { id: 'char_2', name: 'Rebel Strategist', type: 'character', power: 6, zones: ['right'] },
      { id: 'help_1', name: 'Supply Drop', type: 'help', effect: 'Draw 2 cards' },
      { id: 'char_3', name: 'Freedom Fighter', type: 'character', power: 7, zones: ['top', 'right'] },
      { id: 'sp_1', name: 'Revolution Spark', type: 'sp', effect: 'All characters +3 power' },
      { id: 'char_4', name: 'Guerrilla Warrior', type: 'character', power: 5, zones: ['left', 'right'] },
      { id: 'help_2', name: 'Strategic Planning', type: 'help', effect: 'Search deck for character' }
    ];
  }


  showConnectionStatus(message) {
    if (this.connectionStatusText) {
      this.connectionStatusText.destroy();
    }
    
    const { width } = this.cameras.main;
    this.connectionStatusText = this.add.text(width - 20, 20, message, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: '#51CF66'  // Always green for status messages
    });
    this.connectionStatusText.setOrigin(1, 0);
  }

  showLoadingMessage(message) {
    if (this.loadingText) {
      this.loadingText.destroy();
    }
    
    const { width, height } = this.cameras.main;
    this.loadingText = this.add.text(width / 2, height - 50, message, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#FFD700'
    });
    this.loadingText.setOrigin(0.5);
  }

  hideLoadingMessage() {
    if (this.loadingText) {
      this.loadingText.destroy();
      this.loadingText = null;
    }
  }

  showErrorMessage(message) {
    if (this.errorText) {
      this.errorText.destroy();
    }
    
    const { width, height } = this.cameras.main;
    this.errorText = this.add.text(width / 2, height - 50, message, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#FF6B6B'
    });
    this.errorText.setOrigin(0.5);
    
    // Auto-hide after 3 seconds
    this.time.delayedCall(3000, () => {
      if (this.errorText) {
        this.errorText.destroy();
        this.errorText = null;
      }
    });
  }

  createOfflineDemoGame() {
    const gameId = 'demo_' + Date.now();
    const playerId = 'player_' + Date.now();
    const playerName = this.playerName || 'Player 1';
    
    this.gameStateManager.initializeGame(gameId, playerId, playerName);
    this.setupDemoGameState();
    
    // Store scene data and use CardResourcePreloader before DemoScene
    const sceneData = { 
      gameStateManager: this.gameStateManager,
      apiManager: this.apiManager,
      isManualPollingMode: true,  // Manual polling for offline demo
      scenarioPath: 'CharacterCase/sample_play_card_all',
      inGamePlayerId: 'playerId_1',
      gameId: gameId,
      gameMode: 'host'  // Host mode
    };
    
    CardResourcePreloader.preloadBeforeScene(this, 'DemoScene', sceneData);
  }


  joinOfflineDemoGame(gameId) {
    const playerId = 'player_' + Date.now();
    const playerName = this.playerName || 'Player 2';
    this.gameStateManager.initializeGame(gameId, playerId, playerName);
    this.setupDemoGameState();
    
    // Store scene data and use CardResourcePreloader before DemoScene
    const sceneData = { 
      gameStateManager: this.gameStateManager,
      apiManager: this.apiManager,
      isManualPollingMode: true,  // Manual polling for offline demo
      scenarioPath: 'CharacterCase/sample_play_card_all',
      inGamePlayerId: 'playerId_2',
      gameId: gameId,
      gameMode: 'join'  // Join mode
    };
    
    CardResourcePreloader.preloadBeforeScene(this, 'DemoScene', sceneData);
  }
}