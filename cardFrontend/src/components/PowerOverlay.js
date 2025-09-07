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
    
    // Get card type for type-specific positioning
    this.cardType = options.cardType; // default to 'unit'
    
    // Card-type-specific positioning configurations
    const cardTypeOffsets = this.getCardTypeOffsets(this.cardType);
    
    // Configuration
    this.config = {
      // AP label position - responsive to preview mode and card type
      apOffsetX: this.isPreviewMode ? cardTypeOffsets.preview.apOffsetX : cardTypeOffsets.normal.apOffsetX,
      apOffsetY: this.isPreviewMode ? cardTypeOffsets.preview.apOffsetY : cardTypeOffsets.normal.apOffsetY,
      
      // HP label position - responsive to preview mode and card type
      hpOffsetX: this.isPreviewMode ? cardTypeOffsets.preview.hpOffsetX : cardTypeOffsets.normal.hpOffsetX,
      hpOffsetY: this.isPreviewMode ? cardTypeOffsets.preview.hpOffsetY : cardTypeOffsets.normal.hpOffsetY,
      
      // Visual styling - responsive to preview mode
      fontSize: this.isPreviewMode ? 64 : 14,
      fontFamily: 'Arial Bold',
      
      // Background styling - responsive to preview mode
      backgroundPadding: this.isPreviewMode ? 48 : 6,
      backgroundRadius: this.isPreviewMode ? 32 : 8,
      backgroundAlpha: 0.9,
      
      // Background visibility toggle
      showBackground: false,  // Set to false to show only text labels
      
      // Spacing between AP and HP labels - responsive to preview mode
      labelSpacing: this.isPreviewMode ? 100 : 20,
      
      // Color schemes for different label types
      apColors: {
        base: { text: '#FFFFFF', background: 0xFF5722, border: 0xE64A19 },      // Orange for attack
        boosted: { text: '#FFFFFF', background: 0xFF8A65, border: 0xFF7043 },   // Light orange boosted
        reduced: { text: '#FFFFFF', background: 0xD84315, border: 0xBF360C },   // Dark orange reduced
        disabled: { text: '#FFFFFF', background: 0x666666, border: 0x444444 }
      },
      
      hpColors: {
        base: { text: '#FFFFFF', background: 0x4CAF50, border: 0x388E3C },      // Green for health
        boosted: { text: '#FFFFFF', background: 0x81C784, border: 0x66BB6A },   // Light green boosted
        reduced: { text: '#FFFFFF', background: 0xF44336, border: 0xD32F2F },   // Red for damaged
        disabled: { text: '#FFFFFF', background: 0x666666, border: 0x444444 }
      },
      
      ...options
    };
    
    // State tracking for dual labels (simplified)
    this.ap = 0;
    this.hp = 0;
    this.isVisible = false;
    
    this.create();
    scene.add.existing(this);
  }
  
  /**
   * Get card-type-specific positioning offsets
   * @param {string} cardType - Card type: 'unit', 'pilot', 'base', 'command'
   * @returns {Object} Positioning configuration for normal and preview modes
   */
  getCardTypeOffsets(cardType) {
    const offsets = {
      unit: {
        normal: { apOffsetX: 36.5, apOffsetY: 73, hpOffsetX: 50, hpOffsetY: 73 },
        preview: { apOffsetX: 36.5, apOffsetY: 73, hpOffsetX: 50, hpOffsetY: 73 }
      },
      pilot: {
        normal: { apOffsetX: 36.5, apOffsetY: 47, hpOffsetX: 50, hpOffsetY: 47 },
        preview: {apOffsetX: 36.5, apOffsetY: 47, hpOffsetX: 50, hpOffsetY: 47 }
      },
      base: {
        normal: { apOffsetX: 36.5, apOffsetY: 73, hpOffsetX: 50, hpOffsetY: 73 },
        preview: { apOffsetX: 146, apOffsetY: 292, hpOffsetX: 200, hpOffsetY: 292 }
      },
      command: {
        normal: { apOffsetX: 36.5, apOffsetY: 70, hpOffsetX: 50, hpOffsetY: 70 },
        preview: {  apOffsetX: 36.5, apOffsetY: 70, hpOffsetX: 50, hpOffsetY: 70 }
      }
    };
    
    // Return the configuration for the specified card type, or default to 'unit'
    return offsets[cardType] || offsets.unit;
  }
  
  create() {
    // Create AP label components
    this.apBackground = this.scene.add.graphics();
    this.add(this.apBackground);
    
    this.apText = this.scene.add.text(this.config.apOffsetX, this.config.apOffsetY, '0', {
      fontSize: `${this.config.fontSize}px`,
      fontFamily: this.config.fontFamily,
      fill: this.config.apColors.base.text,
      align: 'center'
    });
    this.apText.setOrigin(0.5);
    
    // Improve text rendering quality for preview mode
    if (this.isPreviewMode) {
      this.apText.setScale(1);
      this.apText.setFontSize(this.apText.fontSize);
      this.apText.setResolution(5); // Higher resolution for crisp text
      // Ensure pixel-perfect positioning
      this.apText.x = Math.round(this.apText.x);
      this.apText.y = Math.round(this.apText.y);
    }
    this.add(this.apText);
    
    // Create HP label components
    this.hpBackground = this.scene.add.graphics();
    this.add(this.hpBackground);
    
    this.hpText = this.scene.add.text(this.config.hpOffsetX, this.config.hpOffsetY, '0', {
      fontSize: `${this.config.fontSize}px`,
      fontFamily: this.config.fontFamily,
      fill: this.config.hpColors.base.text,
      align: 'center'
    });
    this.hpText.setOrigin(0.5);
    
    // Improve text rendering quality for preview mode
    if (this.isPreviewMode) {
      this.hpText.setScale(1);
      this.hpText.setFontSize(this.hpText.fontSize);
      this.hpText.setResolution(5); // Higher resolution for crisp text
      this.hpText.x = Math.round(this.hpText.x);
      this.hpText.y = Math.round(this.hpText.y);
    }
    this.add(this.hpText);
    
    // Preview mode uses hardcoded values instead of scaling
    if (this.isPreviewMode) {
      console.log(`[PowerOverlay] Preview mode detected, using hardcoded configuration values`);
      // No scaling needed - all values are hardcoded for preview mode
    }
    
    // Position at origin - children are positioned relative to this container
    this.setPosition(0, 0);
    
    // Set initial depth to ensure it appears above card
    this.setDepth(10);
    
    // Initially hidden
    this.setVisible(false);
  }
  
  /**
   * Update both AP and HP values displayed
   * @param {number} ap - Attack power value
   * @param {number} hp - Health points value
   */
  updateStats(ap, hp) {
    // Update state
    this.ap = ap;
    this.hp = hp;
    
    // Update text displays
    this.apText.setText(ap.toString());
    this.hpText.setText(hp.toString());
    
    // Update styling for both labels (simplified - always base styling)
    this.updateStyling();
    
    // Show overlay if not visible and either stat > 0
    if (!this.isVisible && (ap > 0 || hp > 0)) {
      this.show();
    }
    // Hide overlay if both stats are 0 or less
    else if (this.isVisible && ap <= 0 && hp <= 0) {
      this.hide();
    }
  }
  
  /**
   * Update AP (Attack Power) value and styling
   * @param {number} ap - AP value
   */
  updateAP(ap) {
    this.ap = ap;
    this.apText.setText(ap.toString());
    this.updateAPStyling();
    console.log(`[PowerOverlay] AP updated: ${ap}`);
  }

  /**
   * Update HP (Health Points) value and styling
   * @param {number} hp - HP value
   */
  updateHP(hp) {
    this.hp = hp;
    this.hpText.setText(hp.toString());
    this.updateHPStyling();
    console.log(`[PowerOverlay] HP updated: ${hp}`);
  }
  
  /**
   * Update visual styling for both AP and HP labels
   */
  updateStyling() {
    this.updateAPStyling();
    this.updateHPStyling();
  }
  
  /**
   * Update AP label styling (simplified - always use base styling)
   */
  updateAPStyling() {
    const colorScheme = this.config.apColors.base; // Always use base colors
    
    // FORCE CONSISTENT TEXT PROPERTIES
    this.apText.setFill('#FFFFFF'); // Always white text
    this.apText.setAlpha(1.0); // Force full opacity
    this.apText.setTint(0xFFFFFF); // Force white tint
    this.apText.setBlendMode(Phaser.BlendModes.NORMAL); // Force normal blend
    // Clear existing background
    this.apBackground.clear();
    
    // Only draw background if showBackground is enabled
    if (this.config.showBackground) {
      // Calculate background size based on text
      const textBounds = this.apText.getBounds();
      const bgWidth = Math.max(textBounds.width + this.config.backgroundPadding * 2, 24);
      const bgHeight = textBounds.height + this.config.backgroundPadding * 2;
      
      // Line thickness - responsive to preview mode
      const lineThickness = this.isPreviewMode ? 8 : 2;
      
      // Draw AP background with border at AP position
      this.apBackground.lineStyle(lineThickness, colorScheme.border, 1);
      this.apBackground.fillStyle(colorScheme.background, this.config.backgroundAlpha);
      this.apBackground.fillRoundedRect(
        this.config.apOffsetX - bgWidth / 2, 
        this.config.apOffsetY - bgHeight / 2, 
        bgWidth, 
        bgHeight, 
        this.config.backgroundRadius
      );
      this.apBackground.strokeRoundedRect(
        this.config.apOffsetX - bgWidth / 2, 
        this.config.apOffsetY - bgHeight / 2, 
        bgWidth, 
        bgHeight, 
        this.config.backgroundRadius
      );
    }
  }
  
  /**
   * Update HP label styling (simplified - always use base styling)
   */
  updateHPStyling() {
    const colorScheme = this.config.hpColors.base; // Always use base colors
    
    // FORCE CONSISTENT TEXT PROPERTIES (identical to AP)
    this.hpText.setFill('#FFFFFF'); // Always white text
    this.hpText.setAlpha(1.0); // Force full opacity
    this.hpText.setTint(0xFFFFFF); // Force white tint
    this.hpText.setBlendMode(Phaser.BlendModes.NORMAL); // Force normal blend
    
    // Clear existing background
    this.hpBackground.clear();
    
    // Only draw background if showBackground is enabled
    if (this.config.showBackground) {
      // Calculate background size based on text
      const textBounds = this.hpText.getBounds();
      const bgWidth = Math.max(textBounds.width + this.config.backgroundPadding * 2, 24);
      const bgHeight = textBounds.height + this.config.backgroundPadding * 2;
      
      // Line thickness - responsive to preview mode
      const lineThickness = this.isPreviewMode ? 8 : 2;
      
      // Draw HP background with border at HP position
      this.hpBackground.lineStyle(lineThickness, colorScheme.border, 1);
      this.hpBackground.fillStyle(colorScheme.background, this.config.backgroundAlpha);
      this.hpBackground.fillRoundedRect(
        this.config.hpOffsetX - bgWidth / 2, 
        this.config.hpOffsetY - bgHeight / 2, 
        bgWidth, 
        bgHeight, 
        this.config.backgroundRadius
      );
      this.hpBackground.strokeRoundedRect(
        this.config.hpOffsetX - bgWidth / 2, 
        this.config.hpOffsetY - bgHeight / 2, 
        bgWidth, 
        bgHeight, 
        this.config.backgroundRadius
      );
    }
  }
  
  // getStatState method removed - no longer needed with simplified ap/hp system
  
  /**
   * Show the power overlay instantly
   */
  show() {
    if (this.isVisible) return;
    
    this.isVisible = true;
    this.setVisible(true);
    
    // No scaling needed - all values are hardcoded for preview mode
    this.setScale(1);
    this.setAlpha(1);
  }
  
  /**
   * Hide the power overlay instantly
   */
  hide() {
    if (!this.isVisible) return;
    
    this.isVisible = false;
    this.setVisible(false);
  }
  
  
  
  /**
   * Set whether the overlay should be visible
   * Used for face-down cards or when power display is disabled
   * @param {boolean} visible - Whether overlay should be shown
   */
  setOverlayVisible(visible) {
    if (visible && (this.currentAP > 0 || this.currentHP > 0)) {
      this.show();
    } else {
      this.hide();
    }
  }
  
  /**
   * Enable or disable background and border display
   * @param {boolean} showBackground - Whether to show backgrounds and borders
   */
  setShowBackground(showBackground) {
    this.config.showBackground = showBackground;
    
    // Update text styling based on background visibility (simplified - always use base colors)
    const apColorScheme = this.config.apColors.base;
    const hpColorScheme = this.config.hpColors.base;
    
    if (!showBackground) {
      // Add text stroke for better visibility without background
      this.apText.setStyle({
        fontSize: `${this.config.fontSize}px`,
        fontFamily: this.config.fontFamily,
        fill: apColorScheme.text,
        stroke: '#000000',
        strokeThickness: this.isPreviewMode ? 8 : 2,
        align: 'center'
      });
      
      this.hpText.setStyle({
        fontSize: `${this.config.fontSize}px`,
        fontFamily: this.config.fontFamily,
        fill: hpColorScheme.text,
        stroke: '#000000',
        strokeThickness: this.isPreviewMode ? 8 : 2,
        align: 'center'
      });
    } else {
      // Remove text stroke when background is present
      this.apText.setStyle({
        fontSize: `${this.config.fontSize}px`,
        fontFamily: this.config.fontFamily,
        fill: apColorScheme.text,
        stroke: null,
        strokeThickness: 0,
        align: 'center'
      });
      
      this.hpText.setStyle({
        fontSize: `${this.config.fontSize}px`,
        fontFamily: this.config.fontFamily,
        fill: hpColorScheme.text,
        stroke: null,
        strokeThickness: 0,
        align: 'center'
      });
    }
    
    // Refresh styling to apply changes
    this.updateStyling();
  }
  
  /**
   * Clean up resources when destroying
   */
  destroy(fromScene = false) {
    super.destroy(fromScene);
  }
}