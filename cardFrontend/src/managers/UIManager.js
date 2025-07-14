// UIManager.js - Handles all UI creation, layout, and visual elements
import { GAME_CONFIG } from '../config/gameConfig.js';

export default class UIManager {
  constructor(scene) {
    this.scene = scene;
    this.uiElements = {};
    this.layout = null;
  }

  // Initialize all UI elements
  init() {
    this.createLayout();
    this.createBackground();
    this.createGameBoard();
    this.createTopUI();
    this.createConnectionStatus();
    this.createPhaseIndicator();
    this.createOpponentHandDisplay();
    this.createActionButtons();
    this.createHandArea();
  }

  // Create responsive layout positions
  createLayout() {
    const { width, height } = this.scene.cameras.main;
    const startY = 45;
    const cardHeight = 160;
    
    this.layout = {
      functionalArea: {
        cardPreview: {
          x: width * 0.5 + 130 + 50 + 130 + 80 + 130 + 130,
          y: startY + 100 + cardHeight
        },
      },
      opponent: {
        top: { x: width * 0.5, y: startY + 100 + cardHeight + 10 + 15 },
        left: { x: width * 0.5 - 130 - 50, y: startY + 100 + cardHeight + 10 + 15 },
        right: { x: width * 0.5 + 130 + 50, y: startY + 100 + cardHeight + 10 + 15 },
        help: { x: width * 0.5 - 130 - 50, y: startY + 100 + 0 },
        sp: { x: width * 0.5 + 130 + 50, y: startY + 100 + 0 },
        leader: { x: width * 0.5, y: startY + 100 + 0 },
        deck: { x: width * 0.5 - 130 - 50 - 130 - 50, y: startY + 100 + cardHeight + 10 + 15 },
        leaderDeck: { x: width * 0.5 + 130 + 50 + 130 + 50, y: startY + 100 + cardHeight + 10 + 15 },
      },
      player: {
        top: { x: width * 0.5, y: startY + 100 + cardHeight + 10 + 15 + cardHeight + 70 },
        left: { x: width * 0.5 - 130 - 50, y: startY + 100 + cardHeight + 10 + 15 + cardHeight + 70 },
        right: { x: width * 0.5 + 130 + 50, y: startY + 100 + cardHeight + 10 + 15 + cardHeight + 70 },
        help: { x: width * 0.5 - 130 - 50, y: startY + 100 + cardHeight + 10 + 15 + cardHeight + 70 + cardHeight + 30 },
        sp: { x: width * 0.5 + 130 + 50, y: startY + 100 + cardHeight + 10 + 15 + cardHeight + 70 + cardHeight + 30 },
        leader: { x: width * 0.5, y: startY + 100 + cardHeight + 10 + 15 + cardHeight + 70 + cardHeight + 30 },
        deck: { x: width * 0.5 + 130 + 50 + 130 + 50, y: startY + 100 + cardHeight + 10 + 15 + cardHeight + 70 },
        leaderDeck: { x: width * 0.5 - 130 - 50 - 130 - 70, y: startY + 100 + cardHeight + 10 + 15 + cardHeight + 70 + 50 }
      },
      hand: { x: width * 0.5, y: height * 0.85 }
    };
  }

  createBackground() {
    const { width, height } = this.scene.cameras.main;
    
    // Create gradient background
    const graphics = this.scene.add.graphics();
    graphics.fillGradientStyle(0x0f3460, 0x0f3460, 0x16213e, 0x16213e, 1);
    graphics.fillRect(0, 0, width, height);
    
    // Add table texture
    const tableGraphics = this.scene.add.graphics();
    tableGraphics.fillStyle(0x2d5016);
    tableGraphics.fillRoundedRect(50, 50, width - 100, height - 140, 20);
    tableGraphics.lineStyle(4, 0x8b4513);
    tableGraphics.strokeRoundedRect(50, 50, width - 100, height - 140, 20);

    this.uiElements.background = { graphics, tableGraphics };
  }

  createGameBoard() {
    // This will be handled by ZoneManager
    this.uiElements.gameBoard = {};
  }

  createTopUI() {
    const { width } = this.scene.cameras.main;
    
    // Create UI background
    const uiBg = this.scene.add.graphics();
    uiBg.fillStyle(0x000000, 0.5);
    uiBg.fillRect(0, 0, width, 50);
    
    // Player info elements
    this.uiElements.topUI = {
      background: uiBg,
      playerInfoText: this.scene.add.text(50, 5, 'Player Info', {
        fontSize: '16px',
        fontFamily: 'Arial',
        fill: '#ffffff'
      }),
      playerVPText: this.scene.add.text(-100, 30, 'VP: 0', {
        fontSize: '14px',
        fontFamily: 'Arial',
        fill: '#4CAF50'
      }),
      playerHandText: this.scene.add.text(-100, 50, 'Hand: 0', {
        fontSize: '14px',
        fontFamily: 'Arial',
        fill: '#ffffff'
      }),
      opponentInfoText: this.scene.add.text(width - 50, 5, 'Opponent Info', {
        fontSize: '16px',
        fontFamily: 'Arial',
        fill: '#ffffff'
      }),
      opponentVPText: this.scene.add.text(width + 1000, 30, 'VP: 0', {
        fontSize: '14px',
        fontFamily: 'Arial',
        fill: '#FF5722'
      }),
      opponentHandText: this.scene.add.text(width + 1000, 50, 'Hand: 0', {
        fontSize: '14px',
        fontFamily: 'Arial',
        fill: '#ffffff'
      }),
      roundText: this.scene.add.text(width / 2, 15, 'Round 1 / 4', {
        fontSize: '18px',
        fontFamily: 'Arial Bold',
        fill: '#ffffff',
        align: 'center'
      })
    };
    
    // Set origins
    this.uiElements.topUI.opponentInfoText.setOrigin(1, 0);
    this.uiElements.topUI.opponentVPText.setOrigin(1, 0);
    this.uiElements.topUI.opponentHandText.setOrigin(1, 0);
    this.uiElements.topUI.roundText.setOrigin(0.5);
  }

  createPhaseIndicator() {
    const { width } = this.scene.cameras.main;
    
    this.uiElements.phaseText = this.scene.add.text(width / 2, 35, 'MAIN PHASE', {
      fontSize: '20px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    this.uiElements.phaseText.setOrigin(0.5);
  }

  createOpponentHandDisplay() {
    const displayX = 200;
    const displayY = 120;
    
    // Background for the display
    const displayBg = this.scene.add.graphics();
    displayBg.fillStyle(0x000000, 0.7);
    displayBg.fillRoundedRect(displayX - 70, displayY - 20, 220, 45, 5);
    displayBg.lineStyle(2, 0x888888);
    displayBg.strokeRoundedRect(displayX - 70, displayY - 20, 220, 45, 5);
    
    this.uiElements.opponentHandDisplay = {
      background: displayBg,
      label: this.scene.add.text(displayX + 30, displayY, 'Opponent Hand:', {
        fontSize: '24px',
        fontFamily: 'Arial',
        fill: '#ffffff',
        align: 'center'
      }),
      countText: this.scene.add.text(displayX + 130, displayY + 1, '0', {
        fontSize: '25px',
        fontFamily: 'Arial Bold',
        fill: '#FFD700',
        align: 'center'
      })
    };
    
    this.uiElements.opponentHandDisplay.label.setOrigin(0.5);
    this.uiElements.opponentHandDisplay.countText.setOrigin(0.5);
  }

  createActionButtons() {
    const { width, height } = this.scene.cameras.main;
    
    this.uiElements.buttons = {};
    
    // End Turn button
    this.createButton('endTurn', {
      x: width - 120,
      y: height - 60,
      text: 'End Turn',
      scale: 0.8,
      callback: () => this.scene.events.emit('ui-end-turn')
    });
    
    // Menu button
    this.createButton('menu', {
      x: 130,
      y: height - 60,
      text: 'Menu',
      scale: 0.8,
      callback: () => this.scene.events.emit('ui-menu')
    });
    
    // Test buttons
    this.createTestButtons();
  }

  createTestButtons() {
    const { height } = this.scene.cameras.main;
    
    const testButtons = [
      { key: 'testLeader', y: height - 120, text: 'Test Leader', callback: () => this.scene.events.emit('ui-test-leader') },
      { key: 'testOpponentLeader', y: height - 180, text: 'Test Opp Leader', callback: () => this.scene.events.emit('ui-test-opponent-leader') },
      { key: 'testAddCard', y: height - 240, text: 'Test Add Card', callback: () => this.scene.events.emit('ui-test-add-card') }
    ];
    
    testButtons.forEach(btn => {
      this.createButton(btn.key, {
        x: 130,
        y: btn.y,
        text: btn.text,
        scale: 0.8,
        fontSize: '12px',
        callback: btn.callback
      });
    });
    
    // Manual polling buttons (conditional)
    if (this.scene.isManualPollingMode) {
      this.createButton('testPolling', {
        x: 130,
        y: height - 300,
        text: 'Test Polling',
        scale: 0.8,
        fontSize: '12px',
        callback: () => this.scene.events.emit('ui-test-polling')
      });
      
      this.createButton('testJoinPlayer2', {
        x: 130,
        y: height - 360,
        text: 'Player 2 Join',
        scale: 0.8,
        fontSize: '12px',
        callback: () => this.scene.events.emit('ui-test-join-player2')
      });
    }
  }

  createButton(key, options) {
    const button = this.scene.add.image(options.x, options.y, 'button');
    button.setScale(options.scale || 1);
    button.setInteractive();
    
    const text = this.scene.add.text(options.x, options.y, options.text, {
      fontSize: options.fontSize || '14px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    text.setOrigin(0.5);
    
    // Button interaction effects
    button.on('pointerdown', () => {
      button.setTint(0x888888);
      button.setScale((options.scale || 1) * 0.95);
      text.setScale(0.95);
      
      this.scene.time.delayedCall(100, () => {
        button.clearTint();
        button.setScale(options.scale || 1);
        text.setScale(1);
      });
      
      this.scene.time.delayedCall(50, options.callback);
    });
    
    this.uiElements.buttons[key] = { button, text };
  }

  createHandArea() {
    const { width, height } = this.scene.cameras.main;
    
    // Hand background
    const handBg = this.scene.add.graphics();
    handBg.fillStyle(0x000000, 0);
    handBg.fillRoundedRect(50, height - 220, width - 100, 170, 10);
    
    this.uiElements.handArea = {
      background: handBg,
      container: this.scene.add.container(width / 2, height - 120)
    };
  }

  createConnectionStatus() {
    const { width } = this.scene.cameras.main;
    
    const statusText = this.scene.isOnlineMode ? '🟢 Online' : '🔴 Demo';
    const statusColor = this.scene.isOnlineMode ? '#51CF66' : '#FF6B6B';
    
    this.uiElements.connectionStatus = this.scene.add.text(width - 20, 20, statusText, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: statusColor
    });
    this.uiElements.connectionStatus.setOrigin(1, 0);
  }

  createDialog(title, message, buttons) {
    const { width, height } = this.scene.cameras.main;
    
    // Semi-transparent background
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(1000);
    
    // Dialog box
    const dialogBg = this.scene.add.graphics();
    dialogBg.fillStyle(0x333333);
    dialogBg.fillRoundedRect(width/2 - 200, height/2 - 100, 400, 200, 10);
    dialogBg.lineStyle(2, 0x666666);
    dialogBg.strokeRoundedRect(width/2 - 200, height/2 - 100, 400, 200, 10);
    dialogBg.setDepth(1002);
    
    // Dialog text
    const dialogText = this.scene.add.text(width/2, height/2 - 50, message, {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    dialogText.setOrigin(0.5);
    dialogText.setDepth(1002);
    
    // Create buttons
    const dialogElements = [overlay, dialogBg, dialogText];
    buttons.forEach((btnConfig, index) => {
      const btnX = width/2 + (index === 0 ? -80 : 80);
      const btnY = height/2 + 30;
      
      const button = this.scene.add.image(btnX, btnY, 'button');
      button.setScale(0.8);
      button.setInteractive();
      button.setTint(btnConfig.tint || 0xFFFFFF);
      button.setDepth(1002);
      
      const buttonText = this.scene.add.text(btnX, btnY, btnConfig.text, {
        fontSize: '16px',
        fontFamily: 'Arial',
        fill: '#ffffff'
      });
      buttonText.setOrigin(0.5);
      buttonText.setDepth(1002);
      
      button.on('pointerdown', () => {
        btnConfig.callback();
        dialogElements.forEach(element => element.destroy());
      });
      
      dialogElements.push(button, buttonText);
    });
    
    return dialogElements;
  }

  // Update UI elements with new data
  updateTopUI(gameData) {
    if (this.uiElements.topUI) {
      this.uiElements.topUI.playerInfoText.setText(`You: ${gameData.playerName || 'Unknown'}`);
      this.uiElements.topUI.playerVPText.setText(`VP: ${gameData.playerVP || 0}`);
      this.uiElements.topUI.playerHandText.setText(`Hand: ${gameData.playerHandCount || 0}`);
      this.uiElements.topUI.opponentInfoText.setText(`Opponent: ${gameData.opponentName || 'Unknown'}`);
      this.uiElements.topUI.opponentVPText.setText(`VP: ${gameData.opponentVP || 0}`);
      this.uiElements.topUI.opponentHandText.setText(`Hand: ${gameData.opponentHandCount || 0}`);
      this.uiElements.topUI.roundText.setText(`Round ${gameData.round || 1} / 4`);
    }
  }

  updatePhase(phase) {
    if (this.uiElements.phaseText) {
      this.uiElements.phaseText.setText(`${phase.toUpperCase()} PHASE`);
    }
  }

  updateOpponentHandCount(count) {
    if (this.uiElements.opponentHandDisplay) {
      this.uiElements.opponentHandDisplay.countText.setText(count.toString());
    }
  }

  updateTurnIndicator(isCurrentPlayer) {
    if (this.uiElements.buttons.endTurn) {
      this.uiElements.buttons.endTurn.button.setTint(isCurrentPlayer ? 0xffffff : 0x888888);
    }
  }

  showRoomStatus(message) {
    // Remove existing room status
    if (this.uiElements.roomStatus) {
      this.uiElements.roomStatus.destroy();
    }
    
    const { width } = this.scene.cameras.main;
    this.uiElements.roomStatus = this.scene.add.text(width / 2, 30, message, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#FFD700',
      align: 'center'
    });
    this.uiElements.roomStatus.setOrigin(0.5);
    
    // Auto-hide after 5 seconds
    this.scene.time.delayedCall(5000, () => {
      if (this.uiElements.roomStatus) {
        this.uiElements.roomStatus.destroy();
        this.uiElements.roomStatus = null;
      }
    });
  }

  hideHandArea() {
    if (this.uiElements.handArea?.container) {
      this.uiElements.handArea.container.setVisible(false);
    }
  }

  showHandArea() {
    if (this.uiElements.handArea?.container) {
      this.uiElements.handArea.container.setVisible(true);
    }
  }

  getLayout() {
    return this.layout;
  }

  getHandContainer() {
    return this.uiElements.handArea?.container;
  }

  // Clean up resources
  destroy() {
    Object.values(this.uiElements).forEach(element => {
      if (element && typeof element.destroy === 'function') {
        element.destroy();
      } else if (element && typeof element === 'object') {
        Object.values(element).forEach(subElement => {
          if (subElement && typeof subElement.destroy === 'function') {
            subElement.destroy();
          }
        });
      }
    });
    this.uiElements = {};
  }
}