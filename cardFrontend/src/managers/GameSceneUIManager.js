/**
 * GameSceneUIManager - Handles all UI creation and management for GameScene
 * Extracted from GameScene.js to reduce complexity and improve maintainability
 */
export default class GameSceneUIManager {
  constructor(gameScene) {
    this.scene = gameScene;
    this.gameStateManager = gameScene.gameStateManager;
  }

  /**
   * Create all UI elements - main entry point
   */
  createAllUI() {
    const { width, height } = this.scene.cameras.main;

    // Initialize ActionButtonManager (includes top UI creation)
    this.scene.actionButtonManager.initialize();

    // Create UI components
    this.createGameInfoDisplay();
    this.createActionButtons();
    this.createHandArea();
    this.createBattlePromptUI();

    // Set phaseText element for UIMessageManager
    this.scene.uiMessageManager.setPhaseTextElement(this.scene.phaseText);
  }

  /**
   * Create game info display (first player, opponent hand, current turn, phase)
   */
  createGameInfoDisplay() {
    const { width, height } = this.scene.cameras.main;

    // Position the combined display in the top-left area
    const displayX = 200;
    const displayY = 150;

    // Create single background for all labels (expanded height for 3 lines)
    const displayBg = this.scene.add.graphics();
    displayBg.fillStyle(0x000000, 0.7);
    displayBg.fillRoundedRect(displayX - 70, displayY - 45, 250, 105, 5);
    displayBg.lineStyle(2, 0x888888);
    displayBg.strokeRoundedRect(displayX - 70, displayY - 45, 250, 105, 5);

    // First player label (top line)
    this.scene.firstPlayerText = this.scene.add.text(displayX - 60, displayY - 28, 'First Player: Unknown', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'left'
    });
    this.scene.firstPlayerText.setOrigin(0, 0.5);

    // Opponent hand label (middle line)
    this.scene.opponentHandCountText = this.scene.add.text(displayX - 60, displayY - 4, 'Opponent Hand: 0', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'left'
    });
    this.scene.opponentHandCountText.setOrigin(0, 0.5);

    // Current turn label (bottom line)
    this.scene.currentTurnText = this.scene.add.text(displayX - 60, displayY + 20, 'Current Turn: Unknown', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#FFD700', // Gold color to highlight turn info
      align: 'left'
    });
    this.scene.currentTurnText.setOrigin(0, 0.5);

    // Phase indicator
    this.scene.phaseText = this.scene.add.text(displayX - 60, displayY + 40, 'MAIN PHASE', {
      fontSize: '16px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    this.scene.phaseText.setOrigin(0, 0.5);
  }

  /**
   * Create action buttons (End Turn button)
   */
  createActionButtons() {
    const { width, height } = this.scene.cameras.main;

    // End Turn button
    this.scene.endTurnButton = this.scene.add.image(width - 120, height - 60, 'button');
    this.scene.endTurnButton.setScale(0.8);
    this.scene.endTurnButton.setInteractive();

    const endTurnText = this.scene.add.text(width - 120, height - 60, 'End Turn', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    endTurnText.setOrigin(0.5);

    this.scene.endTurnButton.on('pointerdown', () => {
      // Click visual effect
      this.scene.endTurnButton.setTint(0x888888);
      this.scene.endTurnButton.setScale(0.76);
      endTurnText.setScale(0.95);

      this.scene.time.delayedCall(100, () => {
        this.scene.endTurnButton.clearTint();
        this.scene.endTurnButton.setScale(0.8);
        endTurnText.setScale(1);
      });

      this.scene.time.delayedCall(50, () => this.scene.endTurn());
    });
  }

  /**
   * Create hand area container
   */
  createHandArea() {
    const { width, height } = this.scene.cameras.main;

    // Hand background
    const handBg = this.scene.add.graphics();
    handBg.fillStyle(0x000000, 0);
    handBg.fillRoundedRect(50, height - 220, width - 100, 170, 10);

    // Use HandCardManager to create hand container
    this.scene.handCardManager.createHandContainer();

    // Initialize dynamic action button system
    this.scene.actionButtonManager.initialize();
  }

  createBattlePromptUI() {
    const { width } = this.scene.cameras.main;

    const container = this.scene.add.container(width / 2, 110);
    container.setDepth(650);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.75);
    bg.fillRoundedRect(-220, -40, 440, 90, 10);
    bg.lineStyle(2, 0x5ba0f5);
    bg.strokeRoundedRect(-220, -40, 440, 90, 10);
    container.add(bg);

    const promptText = this.scene.add.text(0, -10, '行动步骤：等待指令', {
      fontSize: '18px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    promptText.setOrigin(0.5);
    container.add(promptText);

    const button = this.scene.add.rectangle(0, 28, 180, 36, 0x1a37b8, 0.95);
    button.setInteractive();
    container.add(button);

    const buttonLabel = this.scene.add.text(0, 28, '结束行动步骤', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    buttonLabel.setOrigin(0.5);
    container.add(buttonLabel);

    button.on('pointerover', () => {
      button.setFillStyle(0x3b6be0, 1);
    });

    button.on('pointerout', () => {
      button.setFillStyle(0x1a37b8, 0.95);
    });

    button.on('pointerdown', () => {
      this.scene.cardActionHandler.handleResolveBattle();
    });

    container.setVisible(false);
    button.disableInteractive();

    this.scene.battlePromptContainer = container;
    this.scene.battlePromptText = promptText;
    this.scene.resolveBattleButton = button;
    this.scene.resolveBattleButtonText = buttonLabel;
  }

  /**
   * Update phase indicator display
   */
  updatePhaseIndicator(phase, currentPlayer) {
    if (!this.scene.phaseText) return;

    const isCurrentPlayer = this.scene.gameStateManager.isCurrentPlayer();
    const playerIndicator = isCurrentPlayer ? 'YOUR' : 'OPPONENT\'S';
    
    let phaseDisplay = phase;
    if (phase === 'MAIN_PHASE') {
      phaseDisplay = `${playerIndicator} TURN`;
    } else if (phase === 'BATTLE_PHASE') {
      phaseDisplay = `${playerIndicator} BATTLE`;
    }

    this.scene.phaseText.setText(phaseDisplay);
    
    // Color coding for phases
    if (isCurrentPlayer) {
      this.scene.phaseText.setFill('#00FF00'); // Green for your turn
    } else {
      this.scene.phaseText.setFill('#FF6B6B'); // Red for opponent's turn
    }
  }

  /**
   * Update current turn display
   */
  updateCurrentTurnDisplay(currentPlayer) {
    if (!this.scene.currentTurnText) return;

    const isCurrentPlayer = this.scene.gameStateManager.isCurrentPlayer();
    const turnText = isCurrentPlayer ? 'Your Turn' : 'Opponent\'s Turn';
    
    this.scene.currentTurnText.setText(`Current Turn: ${turnText}`);
  }

  /**
   * Show/hide hand area
   */
  hideHandArea() {
    if (this.scene.handContainer) {
      this.scene.handContainer.setVisible(false);
    }
  }

  showHandArea() {
    if (this.scene.handContainer) {
      this.scene.handContainer.setVisible(true);
    }
  }

  /**
   * Show room status message
   */
  showRoomStatus(message) {
    this.scene.uiMessageManager.showRoomStatus(message);
  }

  /**
   * Show error message
   */
  showErrorMessage(message) {
    this.scene.uiMessageManager.showErrorMessage(message);
  }

  /**
   * Show success message
   */
  showSuccessMessage(message) {
    this.scene.uiMessageManager.showSuccessMessage(message);
  }

  /**
   * Set UI loading state
   */
  setUILoadingState(isLoading) {
    this.scene.uiMessageManager.setUILoadingState(isLoading);
  }
}
