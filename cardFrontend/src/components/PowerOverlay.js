import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';

/**
 * PowerOverlay - A component for displaying power numbers on cards in zones
 * 
 * Features:
 * - Displays current power value overlaid on card
 * - Color coding for different power states
 * - Animation support for power value changes
 * - Hide/show logic for face-down cards
 * - Integration with computed power system
 */
export default class PowerOverlay extends Phaser.GameObjects.Container {
  constructor(scene, x = 0, y = 0, options = {}) {
    super(scene, x, y);
    
    // Detect if parent card is scaled (for preview mode)
    this.parentCardScale = options.parentCardScale || 1;
    this.isPreviewMode = this.parentCardScale > 2; // Assume preview mode if scale > 2
    
    // Configuration
    this.config = {
      // Position relative to card center
      offsetX: 36.5,         // Right side of card
      offsetY: 73,        // Top area of card
      
      // Visual styling - adjust for scale
      fontSize: this.isPreviewMode ? 48 : 16,
      fontFamily: 'Arial Bold',
      
      // Background styling - adjust for scale
      backgroundPadding: this.isPreviewMode ? 48 : 6,
      backgroundRadius: this.isPreviewMode ? 48 : 8,
      backgroundAlpha: 0.9,
      
      // Animation settings
      animationDuration: 300,
      scaleOnChange: 1,
      
      // Color scheme
      colors: {
        base: {
          text: '#FFFFFF',
          background: 0x333333,
          border: 0x666666
        },
        boosted: {
          text: '#FFFFFF', 
          background: 0x4CAF50,  // Green for positive
          border: 0x388E3C
        },
        reduced: {
          text: '#FFFFFF',
          background: 0xF44336,  // Red for negative
          border: 0xD32F2F
        },
        disabled: {
          text: '#CCCCCC',
          background: 0x666666,  // Gray for disabled
          border: 0x444444
        }
      },
      
      ...options
    };
    
    // State tracking
    this.currentPower = 0;
    this.basePower = 0;
    this.isVisible = false;
    this.animationTween = null;
    
    this.create();
    scene.add.existing(this);
  }
  
  create() {
    // Create background circle/rounded rect
    this.background = this.scene.add.graphics();
    this.add(this.background);
    
    // Create power text with scale-adjusted properties
    this.powerText = this.scene.add.text(0, 0, '0', {
      fontSize: `${this.config.fontSize}px`,
      fontFamily: this.config.fontFamily,
      fill: this.config.colors.base.text,
      align: 'center'
    });
    this.powerText.setOrigin(0.5);
    this.add(this.powerText);
    
    // Apply scale compensation for preview mode to prevent blur
    if (this.isPreviewMode) {
      console.log(`[PowerOverlay] Preview mode detected, applying scale compensation: ${1 / this.parentCardScale}`);
      this.setScale(1 / this.parentCardScale);
    }
    
    // Position the overlay relative to parent
    this.setPosition(this.config.offsetX, this.config.offsetY);
    
    // Set initial depth to ensure it appears above card
    this.setDepth(10);
    
    // Initially hidden
    this.setVisible(false);
  }
  
  /**
   * Update the power value displayed
   * @param {number} currentPower - Current power value
   * @param {number} basePower - Original base power
   * @param {boolean} animate - Whether to animate the change
   */
  updatePower(currentPower, basePower, animate = true) {
    const oldPower = this.currentPower;
    this.currentPower = currentPower;
    this.basePower = basePower;
    
    // Update text
    this.powerText.setText(currentPower.toString());
    
    // Determine power state and update styling
    this.updateStyling();
    
    // Show overlay if not visible and power > 0
    if (!this.isVisible && currentPower > 0) {
      this.show(animate);
    }
    // Hide overlay if power is 0 or less
    else if (this.isVisible && currentPower <= 0) {
      this.hide(animate);
    }
    // Animate value change if visible and power changed
    else if (this.isVisible && oldPower !== currentPower && animate) {
      this.animateValueChange();
    }
  }
  
  /**
   * Update visual styling based on power state
   */
  updateStyling() {
    const powerState = this.getPowerState();
    const colorScheme = this.config.colors[powerState];
    
    // Update text color
    this.powerText.setFill(colorScheme.text);
    
    // Update background
    this.background.clear();
    
    // Calculate background size based on text
    const textBounds = this.powerText.getBounds();
    const bgWidth = Math.max(textBounds.width + this.config.backgroundPadding * 2, 24);
    const bgHeight = textBounds.height + this.config.backgroundPadding * 2;
    
    // Adjust line thickness for preview mode to maintain visibility
    const lineThickness = this.isPreviewMode ? Math.ceil(2 / this.parentCardScale) : 2;
    
    // Draw background with border
    this.background.lineStyle(lineThickness, colorScheme.border, 1);
    this.background.fillStyle(colorScheme.background, this.config.backgroundAlpha);
    this.background.fillRoundedRect(
      -bgWidth / 2, 
      -bgHeight / 2, 
      bgWidth, 
      bgHeight, 
      this.config.backgroundRadius
    );
    this.background.strokeRoundedRect(
      -bgWidth / 2, 
      -bgHeight / 2, 
      bgWidth, 
      bgHeight, 
      this.config.backgroundRadius
    );
  }
  
  /**
   * Determine the current power state for styling
   * @returns {string} Power state: 'base', 'boosted', 'reduced', or 'disabled'
   */
  getPowerState() {
    if (this.currentPower <= 0) {
      return 'disabled';
    } else if (this.currentPower > this.basePower) {
      return 'boosted';
    } else if (this.currentPower < this.basePower) {
      return 'reduced';
    } else {
      return 'base';
    }
  }
  
  /**
   * Show the power overlay with animation
   * @param {boolean} animate - Whether to animate the appearance
   */
  show(animate = true) {
    if (this.isVisible) return;
    
    this.isVisible = true;
    this.setVisible(true);
    
    if (animate) {
      // Start small and scale up
      this.setScale(0.1);
      this.setAlpha(0);
      
      this.scene.tweens.add({
        targets: this,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: this.config.animationDuration,
        ease: 'Back.easeOut'
      });
    } else {
      this.setScale(1);
      this.setAlpha(1);
    }
  }
  
  /**
   * Hide the power overlay with animation
   * @param {boolean} animate - Whether to animate the disappearance
   */
  hide(animate = true) {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    
    if (animate) {
      this.scene.tweens.add({
        targets: this,
        scaleX: 0.1,
        scaleY: 0.1,
        alpha: 0,
        duration: this.config.animationDuration,
        ease: 'Power2',
        onComplete: () => {
          this.setVisible(false);
        }
      });
    } else {
      this.setVisible(false);
    }
  }
  
  /**
   * Animate when power value changes
   */
  animateValueChange() {
    // Stop any existing animation
    if (this.animationTween) {
      this.animationTween.stop();
    }
    
    // Scale up briefly then back to normal
    this.animationTween = this.scene.tweens.add({
      targets: this,
      scaleX: this.config.scaleOnChange,
      scaleY: this.config.scaleOnChange,
      duration: this.config.animationDuration / 2,
      ease: 'Power2',
      yoyo: true,
      onComplete: () => {
        this.animationTween = null;
      }
    });
  }
  
  /**
   * Update position relative to parent card
   * @param {number} x - X offset from card center
   * @param {number} y - Y offset from card center
   */
  updatePosition(x = this.config.offsetX, y = this.config.offsetY) {
    this.config.offsetX = x;
    this.config.offsetY = y;
    this.setPosition(x, y);
  }
  
  /**
   * Set whether the overlay should be visible
   * Used for face-down cards or when power display is disabled
   * @param {boolean} visible - Whether overlay should be shown
   * @param {boolean} animate - Whether to animate the change
   */
  setOverlayVisible(visible, animate = true) {
    if (visible && this.currentPower > 0) {
      this.show(animate);
    } else {
      this.hide(animate);
    }
  }
  
  /**
   * Clean up resources when destroying
   */
  destroy(fromScene = false) {
    // Stop any running animations
    if (this.animationTween) {
      this.animationTween.stop();
      this.animationTween = null;
    }
    
    super.destroy(fromScene);
  }
}