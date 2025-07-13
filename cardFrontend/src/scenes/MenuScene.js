import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import GameStateManager from '../managers/GameStateManager.js';
import APIManager from '../managers/APIManager.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
    this.gameStateManager = new GameStateManager();
    this.apiManager = new APIManager();
    this.isOnlineMode = false;
  }

  async create() {
    this.createBackground();
    this.createTitle();
    await this.checkConnection();
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
    const name = prompt('Enter your player name:');
    if (name && name.trim()) {
      this.playerName = name.trim();
      this.playerNameText.setText(this.playerName);
      this.playerNameText.setStyle({ fill: '#ffffff' });
    }
  }

  async createGame() {
    if (!this.playerName) {
      alert('Please enter your name first');
      return;
    }
    
    this.showLoadingMessage('Creating game...');
    
    try {
      if (this.isOnlineMode) {
        // Create game via API
        const response = await this.apiManager.createGame(this.playerName);
        
        if (response.gameId && response.gameEnv) {
          // Extract playerId from gameEnv players
          const playerIds = Object.keys(response.gameEnv);
          const playerId = playerIds.find(id => response.gameEnv[id].name === this.playerName) || playerIds[0];
          
          this.gameStateManager.initializeGame(response.gameId, playerId, this.playerName);
          this.gameStateManager.updateGameEnv(response.gameEnv);
          
          this.hideLoadingMessage();
          this.scene.start('GameScene', { 
            gameStateManager: this.gameStateManager, 
            apiManager: this.apiManager,
            isOnlineMode: true
          });
          return;
        }
      }
      
      // Fallback to demo mode
      this.createDemoGame();
      
    } catch (error) {
      console.error('Failed to create game:', error);
      this.hideLoadingMessage();
      this.showErrorMessage('Failed to connect to server. Starting demo mode...');
      setTimeout(() => this.createDemoGame(), 2000);
    }
  }

  async showJoinGameInput() {
    if (!this.playerName) {
      alert('Please enter your name first');
      return;
    }
    
    const gameId = prompt('Enter Game ID:');
    if (gameId && gameId.trim()) {
      this.showLoadingMessage('Joining game...');
      
      try {
        if (this.isOnlineMode) {
          const playerId = 'player_' + Date.now();
          const response = await this.apiManager.joinGame(playerId, gameId.trim());
          
          if (response.gameEnv) {
            this.gameStateManager.initializeGame(gameId.trim(), playerId, this.playerName);
            this.gameStateManager.updateGameEnv(response.gameEnv);
            
            this.hideLoadingMessage();
            this.scene.start('GameScene', { 
              gameStateManager: this.gameStateManager, 
              apiManager: this.apiManager,
              isOnlineMode: true
            });
            return;
          }
        }
        
        // Fallback to demo mode
        this.joinDemoGame(gameId.trim());
        
      } catch (error) {
        console.error('Failed to join game:', error);
        this.hideLoadingMessage();
        this.showErrorMessage('Failed to join game. Starting demo mode...');
        setTimeout(() => this.joinDemoGame(gameId.trim()), 2000);
      }
    }
  }

  startDemo() {
    // Start demo with preset name
    this.playerName = 'Demo Player';
    this.createDemoGame();
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
          hand: Array(5).fill().map((_, i) => ({ id: `opp_card_${i}`, faceDown: true })),
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

  async checkConnection() {
    this.showLoadingMessage('Checking server connection...');
    
    try {
      this.isOnlineMode = await this.apiManager.testConnection();
      
      if (this.isOnlineMode) {
        this.showConnectionStatus('🟢 Online Mode - Connected to server');
      } else {
        this.showConnectionStatus('🔴 Demo Mode - Server unavailable');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      this.isOnlineMode = false;
      this.showConnectionStatus('🔴 Demo Mode - Server unavailable');
    }
    
    this.hideLoadingMessage();
  }

  showConnectionStatus(message) {
    if (this.connectionStatusText) {
      this.connectionStatusText.destroy();
    }
    
    const { width } = this.cameras.main;
    this.connectionStatusText = this.add.text(width - 20, 20, message, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: this.isOnlineMode ? '#51CF66' : '#FF6B6B'
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

  createDemoGame() {
    const gameId = 'demo_' + Date.now();
    const playerId = 'player_' + Date.now();
    
    this.gameStateManager.initializeGame(gameId, playerId, this.playerName);
    this.setupDemoGameState();
    
    this.scene.start('GameScene', { 
      gameStateManager: this.gameStateManager,
      apiManager: this.apiManager,
      isOnlineMode: true,  // Demo mode now online but without auto-polling
      isManualPollingMode: true  // Flag for manual polling mode
    });
  }

  joinDemoGame(gameId) {
    const playerId = 'player_' + Date.now();
    this.gameStateManager.initializeGame(gameId, playerId, this.playerName);
    this.setupDemoGameState();
    
    this.scene.start('GameScene', { 
      gameStateManager: this.gameStateManager,
      apiManager: this.apiManager,
      isOnlineMode: true,  // Demo mode now online but without auto-polling
      isManualPollingMode: true  // Flag for manual polling mode
    });
  }
}