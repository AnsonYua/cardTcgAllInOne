/**
 * UIMessageManager - Centralized UI message and status display management
 * 
 * Handles all UI feedback messages, loading states, and phase indicators
 * across different scenes and components to eliminate code duplication
 */
export default class UIMessageManager {
  constructor(scene) {
    this.scene = scene;
    
    // UI element references
    this.roomStatusText = null;
    this.errorMessageText = null;
    this.loadingIndicator = null;
    this.phaseText = null;
    
    // Configuration
    this.config = {
      roomStatus: {
        x: 250,
        y: 80,
        fontSize: '16px',
        fontFamily: 'Arial',
        fill: '#FFD700',
        align: 'left',
        depth: 2000,
        autoHideDelay: 5000
      },
      errorMessage: {
        fontSize: '18px',
        fontFamily: 'Arial',
        fill: '#FF6B6B',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2,
        y: 120,
        depth: 2000,
        autoHideDelay: 4000
      },
      loadingIndicator: {
        fontSize: '24px',
        fontFamily: 'Arial',
        fill: '#FFD700',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 3,
        depth: 1000
      }
    };
  }

  /**
   * Show room status message
   * @param {string} message - Status message to display
   * @param {Object} options - Optional configuration overrides
   */
  showRoomStatus(message, options = {}) {
    // Remove existing room status text
    if (this.roomStatusText) {
      this.roomStatusText.destroy();
    }

    const config = { ...this.config.roomStatus, ...options };
    const { width } = this.scene.cameras.main;

    // Create new room status text
    this.roomStatusText = this.scene.add.text(config.x, config.y, message, {
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      fill: config.fill,
      align: config.align
    });
    this.roomStatusText.setOrigin(0.5);
    this.roomStatusText.setDepth(config.depth);

    // Auto-hide after specified delay
    this.scene.time.delayedCall(config.autoHideDelay, () => {
      if (this.roomStatusText) {
        this.roomStatusText.destroy();
        this.roomStatusText = null;
      }
    });
  }

  /**
   * Show error message
   * @param {string} message - Error message to display
   * @param {Object} options - Optional configuration overrides
   */
  showErrorMessage(message, options = {}) {
    // Remove existing error message
    if (this.errorMessageText) {
      this.errorMessageText.destroy();
    }

    const config = { ...this.config.errorMessage, ...options };
    const { width } = this.scene.cameras.main;

    // Create new error message text
    this.errorMessageText = this.scene.add.text(width / 2, config.y, message, {
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      fill: config.fill,
      align: config.align,
      stroke: config.stroke,
      strokeThickness: config.strokeThickness
    });
    this.errorMessageText.setOrigin(0.5);
    this.errorMessageText.setDepth(config.depth);

    // Auto-hide after specified delay
    this.scene.time.delayedCall(config.autoHideDelay, () => {
      if (this.errorMessageText) {
        this.errorMessageText.destroy();
        this.errorMessageText = null;
      }
    });
  }

  /**
   * Show success message (similar to error message but with success styling)
   * @param {string} message - Success message to display
   * @param {Object} options - Optional configuration overrides
   */
  showSuccessMessage(message, options = {}) {
    const successConfig = {
      fill: '#4CAF50', // Green color for success
      stroke: '#2E7D32',
      ...options
    };
    this.showErrorMessage(message, successConfig);
  }

  /**
   * Set UI loading state
   * @param {boolean} isLoading - Whether to show or hide loading indicator
   * @param {string} loadingText - Custom loading text (default: 'Processing...')
   * @param {Object} options - Optional configuration overrides
   */
  setUILoadingState(isLoading, loadingText = 'Processing...', options = {}) {
    if (isLoading) {
      // Create loading indicator if it doesn't exist
      if (!this.loadingIndicator) {
        const config = { ...this.config.loadingIndicator, ...options };
        const { width, height } = this.scene.cameras.main;
        
        this.loadingIndicator = this.scene.add.text(width / 2, height / 2, loadingText, {
          fontSize: config.fontSize,
          fontFamily: config.fontFamily,
          fill: config.fill,
          align: config.align,
          stroke: config.stroke,
          strokeThickness: config.strokeThickness
        });
        this.loadingIndicator.setOrigin(0.5);
        this.loadingIndicator.setDepth(config.depth);
      }
      this.loadingIndicator.setVisible(true);

      // Disable input during loading
      this.scene.input.enabled = false;
    } else {
      // Hide loading indicator
      if (this.loadingIndicator) {
        this.loadingIndicator.setVisible(false);
      }

      // Re-enable input
      this.scene.input.enabled = true;
    }
  }

  /**
   * Update phase indicator display
   * @param {string} phase - Current game phase
   * @param {string} currentPlayer - Current player ID (optional)
   * @param {Object} gameStateManager - Game state manager for player info (optional)
   */
  updatePhaseIndicator(phase, currentPlayer = null, gameStateManager = null) {
    if (phase == null || !this.phaseText) {
      return;
    }

    let displayText = this.formatPhaseText(phase);

    // Add current player info for turn-based phases
    if (currentPlayer && gameStateManager && this.shouldShowTurnInfo(phase)) {
      const currentPlayerId = gameStateManager.getCurrentPlayerId();
      const turnPlayer = currentPlayer === currentPlayerId ? 'Your Turn' : 'Opponent Turn';
      displayText += ` (${turnPlayer})`;
    }

    this.phaseText.setText(displayText);
  }

  /**
   * Format phase text for display
   * @param {string} phase - Raw phase string
   * @returns {string} Formatted display text
   */
  formatPhaseText(phase) {
    const phaseMap = {
      'DRAW_PHASE': 'DRAW PHASE',
      'MAIN_PHASE': 'MAIN PHASE',
      'SP_PHASE': 'SP PHASE',
      'BATTLE_PHASE': 'BATTLE PHASE',
      'READY_PHASE': 'READY PHASE',
      'WAITING_FOR_PLAYERS': 'WAITING FOR PLAYERS',
      'BOTH_JOINED': 'BOTH JOINED',
      'START_REDRAW': 'REDRAW PHASE'
    };

    if (phaseMap[phase]) {
      return phaseMap[phase];
    } else {
      console.log('Unknown phase:', phase);
      // Clean up any underscore-separated phases
      return phase.replace(/_/g, ' ').toUpperCase();
    }
  }

  /**
   * Determine if turn information should be shown for this phase
   * @param {string} phase - Current game phase
   * @returns {boolean} Whether to show turn info
   */
  shouldShowTurnInfo(phase) {
    const turnBasedPhases = [
      'DRAW_PHASE',
      'MAIN_PHASE',
      'SP_PHASE'
    ];
    return turnBasedPhases.includes(phase);
  }

  /**
   * Set the phase text element reference
   * @param {Phaser.GameObjects.Text} phaseTextElement - Phase text game object
   */
  setPhaseTextElement(phaseTextElement) {
    this.phaseText = phaseTextElement;
  }

  /**
   * Clear all UI messages and indicators
   */
  clearAll() {
    if (this.roomStatusText) {
      this.roomStatusText.destroy();
      this.roomStatusText = null;
    }
    
    if (this.errorMessageText) {
      this.errorMessageText.destroy();
      this.errorMessageText = null;
    }
    
    if (this.loadingIndicator) {
      this.loadingIndicator.destroy();
      this.loadingIndicator = null;
    }
  }

  /**
   * Update configuration for UI elements
   * @param {string} element - Element type ('roomStatus', 'errorMessage', 'loadingIndicator')
   * @param {Object} newConfig - New configuration object
   */
  updateConfig(element, newConfig) {
    if (this.config[element]) {
      this.config[element] = { ...this.config[element], ...newConfig };
    }
  }

  /**
   * Cleanup when manager is no longer needed
   */
  destroy() {
    this.clearAll();
    this.scene = null;
    this.phaseText = null;
  }
}