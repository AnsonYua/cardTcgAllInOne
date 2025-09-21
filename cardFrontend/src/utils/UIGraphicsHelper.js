/**
 * UIGraphicsHelper - Centralized UI graphics creation and management
 * Eliminates duplication across DialogUIManager, BaseAndShieldAreaManager, SlotAreaManager, etc.
 */
export default class UIGraphicsHelper {

  /**
   * Create a standardized hover effect graphics object
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} options - Hover effect options
   * @param {number} options.x - X position (default: 0)
   * @param {number} options.y - Y position (default: 0)
   * @param {number} options.width - Rectangle width
   * @param {number} options.height - Rectangle height
   * @param {number} options.color - Border color (default: 0x00ff00)
   * @param {number} options.lineWidth - Border width (default: 3)
   * @param {number} options.alpha - Alpha value (default: 0.8)
   * @param {number} options.radius - Border radius (default: 8)
   * @param {number} options.depth - Z-depth (default: 1505)
   * @param {number} options.padding - Extra padding around rectangle (default: 2)
   * @returns {Phaser.GameObjects.Graphics} Created graphics object
   */
  static createHoverEffect(scene, options = {}) {
    const {
      x = 0,
      y = 0,
      width,
      height,
      color = 0x00ff00,
      lineWidth = 3,
      alpha = 0.8,
      radius = 8,
      depth = 1505,
      padding = 2
    } = options;

    const graphics = scene.add.graphics();
    graphics.lineStyle(lineWidth, color, alpha);
    graphics.strokeRoundedRect(
      x - width / 2 - padding,
      y - height / 2 - padding,
      width + (padding * 2),
      height + (padding * 2),
      radius
    );
    graphics.setDepth(depth);
    graphics.setAlpha(0); // Start invisible for animation

    return graphics;
  }

  /**
   * Create a standardized button graphics object
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} options - Button options
   * @param {number} options.x - X position
   * @param {number} options.y - Y position
   * @param {number} options.width - Button width (default: 100)
   * @param {number} options.height - Button height (default: 35)
   * @param {number} options.color - Button color (default: 0x4CAF50)
   * @param {number} options.radius - Border radius (default: 8)
   * @param {number} options.depth - Z-depth (default: 1506)
   * @param {boolean} options.isOKButton - Flag for tracking button type (default: false)
   * @returns {Phaser.GameObjects.Graphics} Created button graphics
   */
  static createButton(scene, options = {}) {
    const {
      x,
      y,
      width = 100,
      height = 35,
      color = 0x4CAF50,
      radius = 8,
      depth = 1506,
      isOKButton = false
    } = options;

    const button = scene.add.graphics();
    button.fillStyle(color);
    button.fillRoundedRect(x, y - 17, width, height, radius);
    button.setDepth(depth);

    // Store metadata for future reference
    button._buttonY = y;
    button._isOKButton = isOKButton;
    button._originalColor = color;
    button._width = width;
    button._height = height;
    button._radius = radius;

    return button;
  }

  /**
   * Update button color (safe for Graphics objects)
   * @param {Phaser.GameObjects.Graphics} button - Button graphics object
   * @param {number} color - New color
   */
  static setButtonColor(button, color) {
    if (button && typeof button.clear === 'function') {
      const scene = button.scene;
      const centerX = scene ? scene.scale.width / 2 : 960;
      const buttonY = button._buttonY || (scene && scene.scale.height * 0.7) || 700;
      
      // Determine button position using stored flag
      const isOKButton = button._isOKButton === true;
      const buttonX = isOKButton ? centerX - 120 : centerX + 20;
      
      // Use stored dimensions or defaults
      const width = button._width || 100;
      const height = button._height || 35;
      const radius = button._radius || 8;

      button.clear();
      button.fillStyle(color);
      button.fillRoundedRect(buttonX, buttonY - 17, width, height, radius);
    }
  }

  /**
   * Create dialog background overlay
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} options - Background options
   * @param {number} options.alpha - Background alpha (default: 0.7)
   * @param {number} options.color - Background color (default: 0x000000)
   * @param {number} options.depth - Z-depth (default: 1500)
   * @returns {Phaser.GameObjects.Graphics} Created background graphics
   */
  static createDialogBackground(scene, options = {}) {
    const {
      alpha = 0.7,
      color = 0x000000,
      depth = 1500
    } = options;

    const background = scene.add.graphics();
    background.fillStyle(color, alpha);
    background.fillRect(0, 0, scene.scale.width, scene.scale.height);
    background.setDepth(depth);

    return background;
  }

  /**
   * Create card container background
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} options - Container background options
   * @param {number} options.x - X position
   * @param {number} options.y - Y position
   * @param {number} options.width - Background width
   * @param {number} options.height - Background height
   * @param {number} options.color - Background color (default: 0x333333)
   * @param {number} options.alpha - Background alpha (default: 0.8)
   * @param {number} options.radius - Border radius (default: 10)
   * @param {number} options.depth - Z-depth (default: 1501)
   * @returns {Phaser.GameObjects.Graphics} Created container background
   */
  static createCardContainerBackground(scene, options = {}) {
    const {
      x,
      y,
      width,
      height,
      color = 0x333333,
      alpha = 0.8,
      radius = 10,
      depth = 1501
    } = options;

    const background = scene.add.graphics();
    background.fillStyle(color, alpha);
    background.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    background.setDepth(depth);

    return background;
  }

  /**
   * Create dialog panel background
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} options - Panel options
   * @param {number} options.x - X position
   * @param {number} options.y - Y position
   * @param {number} options.width - Panel width
   * @param {number} options.height - Panel height
   * @param {number} options.color - Panel color (default: 0x2a2a2a)
   * @param {number} options.alpha - Panel alpha (default: 0.95)
   * @param {number} options.borderColor - Border color (default: 0x555555)
   * @param {number} options.borderWidth - Border width (default: 2)
   * @param {number} options.radius - Border radius (default: 15)
   * @param {number} options.depth - Z-depth (default: 1502)
   * @returns {Phaser.GameObjects.Graphics} Created panel graphics
   */
  static createDialogPanel(scene, options = {}) {
    const {
      x,
      y,
      width,
      height,
      color = 0x2a2a2a,
      alpha = 0.95,
      borderColor = 0x555555,
      borderWidth = 2,
      radius = 15,
      depth = 1502
    } = options;

    const panel = scene.add.graphics();
    
    // Fill background
    panel.fillStyle(color, alpha);
    panel.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    
    // Add border
    panel.lineStyle(borderWidth, borderColor, 1);
    panel.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    
    panel.setDepth(depth);

    return panel;
  }

  /**
   * Create zone highlight graphics
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} options - Zone highlight options
   * @param {number} options.x - X position
   * @param {number} options.y - Y position
   * @param {number} options.width - Zone width
   * @param {number} options.height - Zone height
   * @param {number} options.color - Highlight color (default: 0xffff00)
   * @param {number} options.alpha - Alpha value (default: 0.6)
   * @param {number} options.lineWidth - Border width (default: 2)
   * @param {number} options.radius - Border radius (default: 5)
   * @param {number} options.depth - Z-depth (default: 100)
   * @returns {Phaser.GameObjects.Graphics} Created zone highlight
   */
  static createZoneHighlight(scene, options = {}) {
    const {
      x,
      y,
      width,
      height,
      color = 0xffff00,
      alpha = 0.6,
      lineWidth = 2,
      radius = 5,
      depth = 100
    } = options;

    const highlight = scene.add.graphics();
    highlight.lineStyle(lineWidth, color, alpha);
    highlight.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    highlight.setDepth(depth);

    return highlight;
  }

  /**
   * Create pagination indicator graphics
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} options - Pagination options
   * @param {number} options.x - X position
   * @param {number} options.y - Y position
   * @param {number} options.radius - Indicator radius (default: 6)
   * @param {number} options.color - Indicator color (default: 0x999999)
   * @param {number} options.activeColor - Active indicator color (default: 0xffffff)
   * @param {boolean} options.isActive - Whether this indicator is active (default: false)
   * @param {number} options.depth - Z-depth (default: 1507)
   * @returns {Phaser.GameObjects.Graphics} Created pagination indicator
   */
  static createPaginationIndicator(scene, options = {}) {
    const {
      x,
      y,
      radius = 6,
      color = 0x999999,
      activeColor = 0xffffff,
      isActive = false,
      depth = 1507
    } = options;

    const indicator = scene.add.graphics();
    const fillColor = isActive ? activeColor : color;
    indicator.fillStyle(fillColor);
    indicator.fillCircle(x, y, radius);
    indicator.setDepth(depth);

    // Store metadata for updates
    indicator._radius = radius;
    indicator._color = color;
    indicator._activeColor = activeColor;

    return indicator;
  }

  /**
   * Update pagination indicator state
   * @param {Phaser.GameObjects.Graphics} indicator - Indicator graphics object
   * @param {boolean} isActive - Whether indicator should be active
   */
  static updatePaginationIndicator(indicator, isActive) {
    if (indicator && typeof indicator.clear === 'function') {
      const fillColor = isActive ? indicator._activeColor : indicator._color;
      indicator.clear();
      indicator.fillStyle(fillColor);
      indicator.fillCircle(0, 0, indicator._radius);
    }
  }

  /**
   * Create loading spinner graphics
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} options - Spinner options
   * @param {number} options.x - X position
   * @param {number} options.y - Y position
   * @param {number} options.radius - Spinner radius (default: 20)
   * @param {number} options.color - Spinner color (default: 0x00ff00)
   * @param {number} options.lineWidth - Line width (default: 3)
   * @param {number} options.depth - Z-depth (default: 1508)
   * @returns {Phaser.GameObjects.Graphics} Created spinner graphics
   */
  static createLoadingSpinner(scene, options = {}) {
    const {
      x = 0,
      y = 0,
      radius = 20,
      color = 0x00ff00,
      lineWidth = 3,
      depth = 1508
    } = options;

    const spinner = scene.add.graphics();
    spinner.lineStyle(lineWidth, color);
    spinner.arc(x, y, radius, 0, Math.PI * 1.5);
    spinner.setDepth(depth);

    return spinner;
  }

  /**
   * Animate hover effect in
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Phaser.GameObjects.Graphics} graphics - Graphics object to animate
   * @param {Object} options - Animation options
   * @param {number} options.targetAlpha - Target alpha (default: 0.8)
   * @param {number} options.duration - Animation duration (default: 200)
   * @param {string} options.ease - Easing function (default: 'Power2.easeOut')
   */
  static animateHoverIn(scene, graphics, options = {}) {
    const {
      targetAlpha = 0.8,
      duration = 200,
      ease = 'Power2.easeOut'
    } = options;

    scene.tweens.add({
      targets: graphics,
      alpha: targetAlpha,
      duration: duration,
      ease: ease
    });
  }

  /**
   * Animate hover effect out and destroy
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Phaser.GameObjects.Graphics} graphics - Graphics object to animate
   * @param {Object} options - Animation options
   * @param {number} options.duration - Animation duration (default: 150)
   * @param {string} options.ease - Easing function (default: 'Power2.easeIn')
   * @param {Function} options.onComplete - Callback when animation completes
   */
  static animateHoverOut(scene, graphics, options = {}) {
    const {
      duration = 150,
      ease = 'Power2.easeIn',
      onComplete = null
    } = options;

    scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: duration,
      ease: ease,
      onComplete: () => {
        if (graphics) {
          graphics.destroy();
        }
        if (onComplete) {
          onComplete();
        }
      }
    });
  }

  /**
   * Clean up graphics object
   * @param {Phaser.GameObjects.Graphics} graphics - Graphics object to clean up
   */
  static cleanup(graphics) {
    if (graphics && graphics.destroy) {
      graphics.destroy();
    }
  }

  /**
   * Batch cleanup for multiple graphics objects
   * @param {Array<Phaser.GameObjects.Graphics>} graphicsArray - Array of graphics objects
   */
  static batchCleanup(graphicsArray) {
    if (Array.isArray(graphicsArray)) {
      graphicsArray.forEach(graphics => this.cleanup(graphics));
    }
  }
}