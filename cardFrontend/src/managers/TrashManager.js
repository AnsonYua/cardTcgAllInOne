// TrashManager.js
// Centralized trash management system for game UI

import Phaser from 'phaser';

/**
 * TrashManager - Centralized trash handling for both player and opponent
 * 
 * Features:
 * - Creates and manages trash icons for both players
 * - Handles trash icon click events and interactions
 * - Manages trash area viewing dialogs
 * - Filters and processes trash area data
 * - Integrates with DialogManager for trash viewing
 * - Integrated visual trash icon creation and styling
 */
export default class TrashManager {
  constructor(scene) {
    this.scene = scene;
    this.gameStateManager = scene.gameStateManager;
    this.dialogManager = scene.dialogManager;
    
    // Trash icon instances (Phaser containers)
    this.playerTrashIcon = null;
    this.opponentTrashIcon = null;
    
    // Configuration for trash icons
    this.iconConfig = {
      // Visual styling
      radius: 25,
      backgroundColor: 0x444444,
      backgroundAlpha: 0.8,
      borderColor: 0x666666,
      borderWidth: 2,
      
      // Icon styling
      iconColor: 0xFFFFFF,
      iconWidth: 3,
      
      // Hover effects
      hoverBackgroundColor: 0xFF6B6B,
      hoverBorderColor: 0xFF0000,
      hoverBorderWidth: 3,
      
      // Click zone
      clickZoneSize: 50,
      
      // Position offsets
      playerOffsetX: 0,
      playerOffsetY: 150,
      opponentOffsetX: 0,
      opponentOffsetY: -150
    };
  }

  /**
   * Initialize trash icons for both players
   * Called during game scene creation
   */
  initialize() {
    this.createTrashIcons();
    this.setupTrashEventHandlers();
    console.log('TrashManager: Initialized trash icons for both players');
  }

  /**
   * Create trash icons for both player and opponent
   */
  createTrashIcons() {
    // Get player IDs
    const playerId = this.gameStateManager.getCurrentPlayerId();
    const opponentId = this.gameStateManager.getOpponent();

    // Create player trash icon
    this.playerTrashIcon = this._createTrashIcon({
      isOpponent: false,
      playerId: playerId,
      offsetX: this.iconConfig.playerOffsetX,
      offsetY: this.iconConfig.playerOffsetY
    });

    // Position relative to player deck
    this._positionTrashIcon(this.playerTrashIcon, this.scene.layout.player.deck, false);

    // Create opponent trash icon
    this.opponentTrashIcon = this._createTrashIcon({
      isOpponent: true,
      playerId: opponentId,
      offsetX: this.iconConfig.opponentOffsetX,
      offsetY: this.iconConfig.opponentOffsetY
    });

    // Position relative to opponent deck
    this._positionTrashIcon(this.opponentTrashIcon, this.scene.layout.opponent.deck, true);
  }

  /**
   * Create a single trash icon with visual elements and interactions
   * @param {Object} options - Configuration options
   * @returns {Phaser.GameObjects.Container} Trash icon container
   */
  _createTrashIcon(options) {
    const container = this.scene.add.container(0, 0);
    
    // Store configuration on container
    container.config = {
      isOpponent: options.isOpponent,
      playerId: options.playerId,
      offsetX: options.offsetX,
      offsetY: options.offsetY,
      isHovered: false
    };

    // Create background circle
    const trashBg = this.scene.add.graphics();
    this._updateTrashBackground(trashBg, false);
    container.add(trashBg);
    container.trashBg = trashBg;

    // Create trash icon graphics
    const trashIcon = this.scene.add.graphics();
    this._createTrashIconGraphics(trashIcon);
    container.add(trashIcon);
    container.trashIcon = trashIcon;

    // Create interactive zone
    const trashZone = this.scene.add.zone(0, 0, this.iconConfig.clickZoneSize, this.iconConfig.clickZoneSize);
    trashZone.setInteractive();
    trashZone.setName(options.isOpponent ? 'opponent-trash' : 'player-trash');
    container.add(trashZone);
    container.trashZone = trashZone;

    // Set up interactions
    this._setupTrashIconInteractions(container);

    // Set depth
    container.setDepth(100);

    console.log(`TrashManager: Created trash icon for ${options.isOpponent ? 'opponent' : 'player'}`);
    return container;
  }

  /**
   * Create the trash can icon graphics
   * @param {Phaser.GameObjects.Graphics} graphics - Graphics object to draw on
   */
  _createTrashIconGraphics(graphics) {
    graphics.clear();
    graphics.lineStyle(this.iconConfig.iconWidth, this.iconConfig.iconColor, 1);
    
    // Trash can body (rectangle)
    graphics.strokeRect(-12, -8, 24, 16);
    
    // Trash can lid (line)
    graphics.strokeRect(-15, -12, 30, 3);
    
    // Handle on lid
    graphics.strokeRect(-4, -15, 8, 3);
    
    // Vertical lines inside trash can
    graphics.moveTo(-6, -5);
    graphics.lineTo(-6, 5);
    graphics.moveTo(0, -5);
    graphics.lineTo(0, 5);
    graphics.moveTo(6, -5);
    graphics.lineTo(6, 5);
    graphics.strokePath();
  }

  /**
   * Update trash icon background based on hover state
   * @param {Phaser.GameObjects.Graphics} graphics - Background graphics object
   * @param {boolean} isHovered - Whether the icon is hovered
   */
  _updateTrashBackground(graphics, isHovered) {
    graphics.clear();
    
    const bgColor = isHovered ? this.iconConfig.hoverBackgroundColor : this.iconConfig.backgroundColor;
    const borderColor = isHovered ? this.iconConfig.hoverBorderColor : this.iconConfig.borderColor;
    const borderWidth = isHovered ? this.iconConfig.hoverBorderWidth : this.iconConfig.borderWidth;
    const alpha = this.iconConfig.backgroundAlpha + (isHovered ? 0.1 : 0);
    
    graphics.fillStyle(bgColor, alpha);
    graphics.fillCircle(0, 0, this.iconConfig.radius);
    graphics.lineStyle(borderWidth, borderColor, 1);
    graphics.strokeCircle(0, 0, this.iconConfig.radius);
  }

  /**
   * Set up interactions for a trash icon container
   * @param {Phaser.GameObjects.Container} container - Trash icon container
   */
  _setupTrashIconInteractions(container) {
    const zone = container.trashZone;
    const config = container.config;

    // Hover effects
    zone.on('pointerover', () => {
      config.isHovered = true;
      this._updateTrashBackground(container.trashBg, true);
      console.log(`TrashManager: ${config.isOpponent ? 'Opponent' : 'Player'} trash icon hovered`);
    });

    zone.on('pointerout', () => {
      config.isHovered = false;
      this._updateTrashBackground(container.trashBg, false);
      console.log(`TrashManager: ${config.isOpponent ? 'Player' : 'Player'} trash icon unhovered`);
    });

    // Click handling
    zone.on('pointerdown', (pointer) => {
      console.log(`TrashManager: ${config.isOpponent ? 'Opponent' : 'Player'} trash icon clicked`);
      
      // Visual feedback
      this._showClickFeedback(container);
      
      // Handle the click
      this.handleTrashClick({
        isOpponent: config.isOpponent,
        playerId: config.playerId,
        trashZone: zone,
        pointer: pointer
      });
    });
  }

  /**
   * Show visual feedback when trash icon is clicked
   * @param {Phaser.GameObjects.Container} container - Trash icon container
   */
  _showClickFeedback(container) {
    const originalScale = container.scaleX;
    
    this.scene.tweens.add({
      targets: container,
      scaleX: originalScale * 1.2,
      scaleY: originalScale * 1.2,
      duration: 100,
      yoyo: true,
      ease: 'Power2'
    });
  }

  /**
   * Position trash icon relative to deck position
   * @param {Phaser.GameObjects.Container} container - Trash icon container
   * @param {Object} deckPosition - Deck position with x, y coordinates
   * @param {boolean} isOpponent - Whether this is opponent's trash icon
   */
  _positionTrashIcon(container, deckPosition, isOpponent) {
    const config = container.config;
    const trashX = deckPosition.x + config.offsetX;
    const trashY = deckPosition.y + config.offsetY;
    
    container.setPosition(trashX, trashY);
    
    console.log(`TrashManager: ${isOpponent ? 'Opponent' : 'Player'} trash icon positioned at: ${trashX}, ${trashY}`);
  }

  /**
   * Set up event handlers for trash icon interactions
   */
  setupTrashEventHandlers() {
    // Event handlers are now set up directly in _setupTrashIconInteractions
    // This method is kept for backward compatibility but does nothing
    console.log('TrashManager: Event handlers already set up during icon creation');
  }

  /**
   * Handle trash icon click events - Shows cards in trash area
   * @param {Object} eventData - Event data from trash icon click
   */
  handleTrashClick(eventData) {
    console.log('TrashManager: Handling trash icon click:', eventData);

    const trashOwner = eventData.isOpponent ? 'opponent' : 'player';
    const currentPlayerId = this.gameStateManager.getCurrentPlayerId();
    const targetPlayerId = eventData.isOpponent ? this.gameStateManager.getOpponent() : currentPlayerId;

    // Get and process trash area cards
    const trashArea = this.getProcessedTrashArea(targetPlayerId);
    
    console.log(`TrashManager: ${trashOwner} trash clicked (Player ID: ${eventData.playerId}, Cards: ${trashArea.length})`);

    // Show appropriate dialog based on trash content
    this.showTrashDialog(trashOwner, targetPlayerId, trashArea);
  }

  /**
   * Get and process trash area cards from game state
   * @param {string} targetPlayerId - Player ID to get trash for
   * @returns {Array} Processed trash area cards
   */
  getProcessedTrashArea(targetPlayerId) {
    // Get trash area cards from game state
    const gameState = this.gameStateManager.getGameState();
    let trashArea = gameState.gameEnv?.players?.[targetPlayerId]?.zones?.trashArea || [];

    // Remove cards with uid = "base_default" from trash area
    const originalTrashLength = trashArea.length;
    trashArea = trashArea.filter(card => card.cardUid !== "base_default");
    
    console.log(`TrashManager: Filtered trash area - ${originalTrashLength} -> ${trashArea.length} cards`);

    // Update the game state if any cards were removed
    if (trashArea.length !== originalTrashLength) {
      const removedCount = originalTrashLength - trashArea.length;
      console.log(`TrashManager: Removed ${removedCount} base_default card(s) from trash area`);

      // Update the trash area in game state
      if (gameState.gameEnv?.players?.[targetPlayerId]?.zones) {
        gameState.gameEnv.players[targetPlayerId].zones.trashArea = trashArea;
      }
    }

    return trashArea;
  }

  /**
   * Show trash viewing dialog
   * @param {string} trashOwner - 'player' or 'opponent'
   * @param {string} targetPlayerId - Player ID who owns the trash
   * @param {Array} trashArea - Processed trash area cards
   */
  showTrashDialog(trashOwner, targetPlayerId, trashArea) {
    // Show empty trash message if no cards
    if (trashArea.length === 0) {
      this.dialogManager.showInformationDialog({
        title: `${trashOwner === 'player' ? 'Your' : 'Opponent\'s'} Trash Area`,
        message: 'No cards in trash area.',
        width: 350,
        height: 150
      });
      return;
    }

    // Create a read-only card selection dialog for viewing trash
    const selectionId = `trash_view_${Date.now()}`;

    // Convert trash area cards to eligibleCards format - preserve all original values
    const eligibleCards = trashArea.map((card, index) => ({
      // Preserve all original card properties
      ...card,
      dialogDisplayType:"singleCard"
    }));

    // Use eligibleCards format directly (no ItemDataResolver processing needed)
    const selection = {
      eligibleCards: eligibleCards, // Direct card array, no items needed
      selectCount: 0, // Read-only, no selection needed
      title: `${trashOwner === 'player' ? 'Your' : 'Opponent\'s'} Trash Area`,
      description: `${trashArea.length} card${trashArea.length !== 1 ? 's' : ''} in trash area`,
      callback: () => {
        // No action needed - just viewing
        console.log('TrashManager: Trash dialog closed');
      }
    };

    console.log("TrashManager: Showing trash dialog with eligibleCards:", JSON.stringify(eligibleCards));

    // Use the existing card selection dialog system
    this.dialogManager.showCardSelectionDialog(selectionId, selection, selection.callback);
  }

  /**
   * Get trash area for a specific player (utility method)
   * @param {string} playerId - Player ID
   * @returns {Array} Raw trash area cards
   */
  getTrashArea(playerId) {
    const gameState = this.gameStateManager.getGameState();
    return gameState.gameEnv?.players?.[playerId]?.zones?.trashArea || [];
  }

  /**
   * Get processed trash area for a specific player (utility method)
   * @param {string} playerId - Player ID
   * @returns {Array} Processed trash area cards (filtered)
   */
  getProcessedTrashAreaForPlayer(playerId) {
    return this.getProcessedTrashArea(playerId);
  }

  /**
   * Check if player has cards in trash
   * @param {string} playerId - Player ID
   * @returns {boolean} True if player has cards in trash
   */
  hasTrashCards(playerId) {
    const trashArea = this.getProcessedTrashArea(playerId);
    return trashArea.length > 0;
  }

  /**
   * Get trash card count for a player
   * @param {string} playerId - Player ID
   * @returns {number} Number of cards in trash
   */
  getTrashCardCount(playerId) {
    const trashArea = this.getProcessedTrashArea(playerId);
    return trashArea.length;
  }

  /**
   * Show trash area for current player (utility method)
   */
  showPlayerTrash() {
    const playerId = this.gameStateManager.getCurrentPlayerId();
    const eventData = {
      isOpponent: false,
      playerId: playerId
    };
    this.handleTrashClick(eventData);
  }

  /**
   * Show trash area for opponent (utility method)
   */
  showOpponentTrash() {
    const opponentId = this.gameStateManager.getOpponent();
    const eventData = {
      isOpponent: true,
      playerId: opponentId
    };
    this.handleTrashClick(eventData);
  }

  /**
   * Update trash icon visibility or state (if needed in future)
   */
  updateTrashIcons() {
    // Placeholder for future trash icon updates
    // Could update card counts, visibility, etc.
  }

  /**
   * Show/hide trash icons
   * @param {boolean} visible - Whether icons should be visible
   */
  setTrashIconsVisible(visible) {
    if (this.playerTrashIcon) {
      this.playerTrashIcon.setVisible(visible);
    }
    if (this.opponentTrashIcon) {
      this.opponentTrashIcon.setVisible(visible);
    }
    console.log(`TrashManager: Trash icons ${visible ? 'shown' : 'hidden'}`);
  }

  /**
   * Update trash icon styling
   * @param {Object} newConfig - New configuration options
   */
  updateIconConfig(newConfig) {
    this.iconConfig = { ...this.iconConfig, ...newConfig };
    
    // Recreate icons if they exist
    if (this.playerTrashIcon) {
      this._updateTrashBackground(this.playerTrashIcon.trashBg, this.playerTrashIcon.config.isHovered);
      this._createTrashIconGraphics(this.playerTrashIcon.trashIcon);
    }
    
    if (this.opponentTrashIcon) {
      this._updateTrashBackground(this.opponentTrashIcon.trashBg, this.opponentTrashIcon.config.isHovered);
      this._createTrashIconGraphics(this.opponentTrashIcon.trashIcon);
    }
    
    console.log('TrashManager: Updated icon configuration');
  }

  /**
   * Get trash icon information
   * @returns {Object} Information about both trash icons
   */
  getTrashIconInfo() {
    return {
      player: this.playerTrashIcon ? {
        x: this.playerTrashIcon.x,
        y: this.playerTrashIcon.y,
        visible: this.playerTrashIcon.visible,
        hovered: this.playerTrashIcon.config.isHovered
      } : null,
      opponent: this.opponentTrashIcon ? {
        x: this.opponentTrashIcon.x,
        y: this.opponentTrashIcon.y,
        visible: this.opponentTrashIcon.visible,
        hovered: this.opponentTrashIcon.config.isHovered
      } : null
    };
  }

  /**
   * Cleanup trash manager resources
   */
  cleanup() {
    if (this.playerTrashIcon) {
      // Clean up event listeners
      if (this.playerTrashIcon.trashZone) {
        this.playerTrashIcon.trashZone.removeAllListeners();
      }
      this.playerTrashIcon.destroy();
      this.playerTrashIcon = null;
    }
    
    if (this.opponentTrashIcon) {
      // Clean up event listeners
      if (this.opponentTrashIcon.trashZone) {
        this.opponentTrashIcon.trashZone.removeAllListeners();
      }
      this.opponentTrashIcon.destroy();
      this.opponentTrashIcon = null;
    }
    
    console.log('TrashManager: Cleaned up resources');
  }
}