import Phaser from 'phaser';

/**
 * TrashIconManager - A component for managing trash icons for both player and opponent
 * 
 * Features:
 * - Creates visual trash icon with hover effects
 * - Handles click interactions with placeholder functionality
 * - Supports both player and opponent positions
 * - Emits events for game logic handling
 * - Integrates with existing layout system
 */
export default class TrashIconManager extends Phaser.GameObjects.Container {
  constructor(scene, options = {}) {
    super(scene, 0, 0);
    
    // Configuration
    this.config = {
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
      
      // Player configuration
      isOpponent: options.isOpponent || false,
      playerId: options.playerId || null,
      
      // Position offset from deck (can be overridden)
      offsetX: options.offsetX || 0,
      offsetY: options.offsetY || 80,
      
      ...options
    };
    
    // State tracking
    this.isVisible = true;
    this.isHovered = false;
    
    // Visual elements (will be created in create method)
    this.trashBg = null;
    this.trashIcon = null;
    this.trashZone = null;
    
    this.create();
    scene.add.existing(this);
  }
  
  /**
   * Create the visual trash icon and interaction zone
   */
  create() {
    // Create background circle
    this.trashBg = this.scene.add.graphics();
    this.updateBackground(false); // false = not hovered
    this.add(this.trashBg);
    
    // Create trash icon (simple trash can shape)
    this.trashIcon = this.scene.add.graphics();
    this.createTrashIcon();
    this.add(this.trashIcon);
    
    // Create interactive click zone
    this.trashZone = this.scene.add.zone(0, 0, this.config.clickZoneSize, this.config.clickZoneSize);
    this.trashZone.setInteractive();
    this.trashZone.setName(this.config.isOpponent ? 'opponent-trash' : 'player-trash');
    this.add(this.trashZone);
    
    // Set up interaction events
    this.setupInteractionEvents();
    
    // Set initial depth to ensure it appears above other elements
    this.setDepth(100);
    
    console.log(`TrashIconManager created for ${this.config.isOpponent ? 'opponent' : 'player'}`);
  }
  
  /**
   * Create the trash can icon graphics
   */
  createTrashIcon() {
    this.trashIcon.clear();
    this.trashIcon.lineStyle(this.config.iconWidth, this.config.iconColor, 1);
    
    // Trash can body (rectangle)
    this.trashIcon.strokeRect(-12, -8, 24, 16);
    
    // Trash can lid (line)
    this.trashIcon.strokeRect(-15, -12, 30, 3);
    
    // Handle on lid
    this.trashIcon.strokeRect(-4, -15, 8, 3);
    
    // Vertical lines inside trash can
    this.trashIcon.moveTo(-6, -5);
    this.trashIcon.lineTo(-6, 5);
    this.trashIcon.moveTo(0, -5);
    this.trashIcon.lineTo(0, 5);
    this.trashIcon.moveTo(6, -5);
    this.trashIcon.lineTo(6, 5);
    this.trashIcon.strokePath();
  }
  
  /**
   * Update background appearance based on hover state
   * @param {boolean} isHovered - Whether the trash icon is being hovered
   */
  updateBackground(isHovered) {
    this.trashBg.clear();
    
    const bgColor = isHovered ? this.config.hoverBackgroundColor : this.config.backgroundColor;
    const borderColor = isHovered ? this.config.hoverBorderColor : this.config.borderColor;
    const borderWidth = isHovered ? this.config.hoverBorderWidth : this.config.borderWidth;
    const alpha = this.config.backgroundAlpha + (isHovered ? 0.1 : 0);
    
    this.trashBg.fillStyle(bgColor, alpha);
    this.trashBg.fillCircle(0, 0, this.config.radius);
    this.trashBg.lineStyle(borderWidth, borderColor, 1);
    this.trashBg.strokeCircle(0, 0, this.config.radius);
  }
  
  /**
   * Set up click interaction events
   */
  setupInteractionEvents() {
    // Pointer over - highlight trash zone
    this.trashZone.on('pointerover', () => {
      this.isHovered = true;
      this.updateBackground(true);
      console.log(`${this.config.isOpponent ? 'Opponent' : 'Player'} trash icon hovered`);
    });
    
    // Pointer out - remove highlight
    this.trashZone.on('pointerout', () => {
      this.isHovered = false;
      this.updateBackground(false);
      console.log(`${this.config.isOpponent ? 'Opponent' : 'Player'} trash icon unhovered`);
    });
    
    // Click - placeholder functionality
    this.trashZone.on('pointerdown', (pointer) => {
      console.log(`${this.config.isOpponent ? 'Opponent' : 'Player'} trash icon clicked!`);
      
      // Placeholder functionality - show a temporary visual indication
      this.showClickFeedback();
      
      // Emit custom event for game logic to handle (placeholder functionality)
      this.emit('trashClicked', {
        isOpponent: this.config.isOpponent,
        playerId: this.config.playerId,
        trashZone: this.trashZone,
        pointer: pointer
      });
    });
  }
  
  /**
   * Show visual feedback when trash icon is clicked (placeholder functionality)
   */
  showClickFeedback() {
    // Create a temporary pulsing effect
    const originalScale = this.scaleX;
    
    // Quick scale animation for click feedback
    this.scene.tweens.add({
      targets: this,
      scaleX: originalScale * 1.2,
      scaleY: originalScale * 1.2,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
      onComplete: () => {
        // Log placeholder message
        console.log(`Trash functionality clicked! (Placeholder - no cards will be trashed)`);
        
        // You could add additional placeholder functionality here, such as:
        // - Showing a temporary text message
        // - Playing a sound effect
        // - Creating a particle effect
        // - Opening a modal dialog
      }
    });
  }
  
  /**
   * Position the trash icon relative to a deck position
   * @param {Object} deckPosition - Object with x, y coordinates
   */
  positionRelativeToDeck(deckPosition) {
    const trashX = deckPosition.x + this.config.offsetX;
    const trashY = deckPosition.y + this.config.offsetY;
    
    this.setPosition(trashX, trashY);
    
    console.log(`${this.config.isOpponent ? 'Opponent' : 'Player'} trash icon positioned at: ${trashX}, ${trashY}`);
  }
  
  /**
   * Set absolute position for the trash icon
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  setAbsolutePosition(x, y) {
    this.setPosition(x, y);
    console.log(`${this.config.isOpponent ? 'Opponent' : 'Player'} trash icon positioned at: ${x}, ${y}`);
  }
  
  /**
   * Show the trash icon
   */
  show() {
    if (!this.isVisible) {
      this.setVisible(true);
      this.isVisible = true;
      console.log(`${this.config.isOpponent ? 'Opponent' : 'Player'} trash icon shown`);
    }
  }
  
  /**
   * Hide the trash icon
   */
  hide() {
    if (this.isVisible) {
      this.setVisible(false);
      this.isVisible = false;
      console.log(`${this.config.isOpponent ? 'Opponent' : 'Player'} trash icon hidden`);
    }
  }
  
  /**
   * Update trash icon configuration
   * @param {Object} newConfig - Configuration updates
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Recreate visual elements if needed
    if (newConfig.radius || newConfig.backgroundColor || newConfig.borderColor) {
      this.updateBackground(this.isHovered);
    }
    
    if (newConfig.iconColor || newConfig.iconWidth) {
      this.createTrashIcon();
    }
  }
  
  /**
   * Get current position information
   * @returns {Object} Position and configuration data
   */
  getInfo() {
    return {
      x: this.x,
      y: this.y,
      isVisible: this.isVisible,
      isOpponent: this.config.isOpponent,
      playerId: this.config.playerId,
      isHovered: this.isHovered
    };
  }
  
  /**
   * Clean up resources when destroying
   */
  destroy(fromScene = false) {
    // Clean up event listeners
    if (this.trashZone) {
      this.trashZone.removeAllListeners();
    }
    
    // Remove custom event listeners
    this.removeAllListeners();
    
    super.destroy(fromScene);
  }
}