// UIHelper.js - Enhanced utility class for common UI operations and button creation
export default class UIHelper {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Creates a standardized button with consistent styling and click effects
   * @param {number} x - X position
   * @param {number} y - Y position  
   * @param {string} text - Button text
   * @param {Function} onClick - Click handler function
   * @param {Object} options - Additional options
   * @returns {Object} Button object with image and text
   */
  createButton(x, y, text, onClick, options = {}) {
    const defaults = {
      scale: 0.8,
      tint: 0xffffff,
      fontSize: '14px',
      textColor: '#ffffff',
      clickScale: 0.76,
      clickDelay: 50,
      enableHover: false,
      hoverTint: 0xcccccc,
      disabled: false,
      disabledTint: 0x666666
    };
    
    const config = { ...defaults, ...options };
    
    // Create button image
    const button = this.scene.add.image(x, y, 'button');
    button.setScale(config.scale);
    button.setInteractive();
    
    if (config.tint !== 0xffffff) {
      button.setTint(config.tint);
    }
    
    // Create button text
    const buttonText = this.scene.add.text(x, y, text, {
      fontSize: config.fontSize,
      fontFamily: 'Arial',
      fill: config.textColor
    });
    buttonText.setOrigin(0.5);
    
    // State management
    let isDisabled = config.disabled;
    
    // Apply disabled state if needed
    if (isDisabled) {
      button.setTint(config.disabledTint);
      buttonText.setAlpha(0.5);
    }
    
    // Add hover effects if enabled
    if (config.enableHover && !isDisabled) {
      button.on('pointerover', () => {
        if (!isDisabled) {
          button.setTint(config.hoverTint);
          this.scene.input.setDefaultCursor('pointer');
        }
      });
      
      button.on('pointerout', () => {
        if (!isDisabled) {
          if (config.tint !== 0xffffff) {
            button.setTint(config.tint);
          } else {
            button.clearTint();
          }
          this.scene.input.setDefaultCursor('default');
        }
      });
    }
    
    // Add click effect
    button.on('pointerdown', () => {
      if (isDisabled) return;
      
      // Visual click effect
      button.setTint(0x888888);
      button.setScale(config.scale * 0.95); // Consistent scale reduction
      buttonText.setScale(0.95);
      
      this.scene.time.delayedCall(100, () => {
        if (!isDisabled) {
          if (config.tint !== 0xffffff) {
            button.setTint(config.tint);
          } else {
            button.clearTint();
          }
          button.setScale(config.scale);
          buttonText.setScale(1);
        }
      });
      
      this.scene.time.delayedCall(config.clickDelay, () => {
        if (!isDisabled) onClick();
      });
    });
    
    return {
      button,
      text: buttonText,
      setVisible: (visible) => {
        button.setVisible(visible);
        buttonText.setVisible(visible);
      },
      setEnabled: (enabled) => {
        isDisabled = !enabled;
        if (isDisabled) {
          button.setTint(config.disabledTint);
          buttonText.setAlpha(0.5);
        } else {
          if (config.tint !== 0xffffff) {
            button.setTint(config.tint);
          } else {
            button.clearTint();
          }
          buttonText.setAlpha(1);
        }
      },
      setText: (newText) => {
        buttonText.setText(newText);
      },
      destroy: () => {
        button.destroy();
        buttonText.destroy();
      }
    };
  }

  /**
   * Creates a column of buttons with consistent spacing
   * @param {number} startX - Starting X position
   * @param {number} startY - Starting Y position
   * @param {Array} buttonConfigs - Array of {text, onClick, options} objects
   * @param {number} spacing - Vertical spacing between buttons
   * @returns {Array} Array of button objects
   */
  createButtonColumn(startX, startY, buttonConfigs, spacing = 60) {
    return buttonConfigs.map((config, index) => {
      const y = startY - (index * spacing);
      return this.createButton(
        startX, 
        y, 
        config.text, 
        config.onClick, 
        config.options || {}
      );
    });
  }

  /**
   * Creates a row of buttons with consistent spacing
   * @param {number} startX - Starting X position
   * @param {number} startY - Starting Y position
   * @param {Array} buttonConfigs - Array of {text, onClick, options} objects
   * @param {number} spacing - Horizontal spacing between buttons
   * @returns {Array} Array of button objects
   */
  createButtonRow(startX, startY, buttonConfigs, spacing = 160) {
    const totalWidth = (buttonConfigs.length - 1) * spacing;
    const firstButtonX = startX - totalWidth / 2;
    
    return buttonConfigs.map((config, index) => {
      const x = firstButtonX + (index * spacing);
      return this.createButton(
        x, 
        startY, 
        config.text, 
        config.onClick, 
        config.options || {}
      );
    });
  }

  /**
   * Get standard position presets for common button locations
   * @returns {Object} Object with position presets
   */
  getStandardPositions() {
    const { width, height } = this.scene.cameras.main;
    
    return {
      // Bottom area positions
      bottomRight: { x: width - 120, y: height - 60 },
      bottomLeft: { x: 130, y: height - 60 },
      bottomCenter: { x: width / 2, y: height - 60 },
      
      // Center area positions
      center: { x: width / 2, y: height / 2 },
      centerLeft: { x: width * 0.25, y: height / 2 },
      centerRight: { x: width * 0.75, y: height / 2 },
      
      // Top area positions
      topLeft: { x: 130, y: 60 },
      topRight: { x: width - 120, y: 60 },
      topCenter: { x: width / 2, y: 60 },
      
      // Test button column (DemoScene pattern)
      testColumn: {
        base: { x: 130, y: height - 60 },
        getPosition: (index) => ({ x: 130, y: height - 60 - (index * 60) })
      }
    };
  }

  /**
   * Creates demo/test buttons in the standard pattern
   * @param {Array} testButtons - Array of test button configurations
   * @returns {Array} Array of created button objects
   */
  createTestButtons(testButtons) {
    const positions = this.getStandardPositions();
    
    return testButtons.map((btnConfig, index) => {
      const pos = positions.testColumn.getPosition(index);
      return this.createButton(
        pos.x,
        pos.y,
        btnConfig.text,
        btnConfig.onClick,
        {
          fontSize: '12px',
          clickScale: 0.76,
          ...btnConfig.options
        }
      );
    });
  }

  /**
   * Creates a status indicator with background
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} text - Status text
   * @param {Object} options - Styling options
   * @returns {Object} Status display object
   */
  createStatusDisplay(x, y, text, options = {}) {
    const defaults = {
      bgWidth: 220,
      bgHeight: 45,
      bgColor: 0x000000,
      bgAlpha: 0.7,
      borderColor: 0x888888,
      borderWidth: 2,
      fontSize: '24px',
      textColor: '#ffffff'
    };
    
    const config = { ...defaults, ...options };
    
    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(config.bgColor, config.bgAlpha);
    bg.fillRoundedRect(x - config.bgWidth/2, y - config.bgHeight/2, config.bgWidth, config.bgHeight, 5);
    bg.lineStyle(config.borderWidth, config.borderColor);
    bg.strokeRoundedRect(x - config.bgWidth/2, y - config.bgHeight/2, config.bgWidth, config.bgHeight, 5);
    
    // Text
    const statusText = this.scene.add.text(x, y, text, {
      fontSize: config.fontSize,
      fontFamily: 'Arial',
      fill: config.textColor,
      align: 'center'
    });
    statusText.setOrigin(0.5);
    
    return {
      background: bg,
      text: statusText,
      setText: (newText) => statusText.setText(newText),
      setVisible: (visible) => {
        bg.setVisible(visible);
        statusText.setVisible(visible);
      },
      destroy: () => {
        bg.destroy();
        statusText.destroy();
      }
    };
  }

  /**
   * Creates a dialog box with overlay
   * @param {string} title - Dialog title
   * @param {string} message - Dialog message
   * @param {Array} buttons - Array of button configs [{text, onClick, tint}]
   * @param {Object} options - Dialog options
   * @returns {Object} Dialog object
   */
  createDialog(title, message, buttons, options = {}) {
    const { width, height } = this.scene.cameras.main;
    
    const defaults = {
      overlayAlpha: 0.7,
      dialogWidth: 400,
      dialogHeight: 200,
      dialogBg: 0x333333,
      borderColor: 0x666666
    };
    
    const config = { ...defaults, ...options };
    const elements = [];
    
    // Overlay
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, config.overlayAlpha);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(1000);
    elements.push(overlay);
    
    // Dialog background
    const dialogBg = this.scene.add.graphics();
    dialogBg.fillStyle(config.dialogBg);
    dialogBg.fillRoundedRect(width/2 - config.dialogWidth/2, height/2 - config.dialogHeight/2, config.dialogWidth, config.dialogHeight, 10);
    dialogBg.lineStyle(2, config.borderColor);
    dialogBg.strokeRoundedRect(width/2 - config.dialogWidth/2, height/2 - config.dialogHeight/2, config.dialogWidth, config.dialogHeight, 10);
    dialogBg.setDepth(1002);
    elements.push(dialogBg);
    
    // Title
    if (title) {
      const titleText = this.scene.add.text(width/2, height/2 - 70, title, {
        fontSize: '20px',
        fontFamily: 'Arial Bold',
        fill: '#ffffff',
        align: 'center'
      });
      titleText.setOrigin(0.5);
      titleText.setDepth(1002);
      elements.push(titleText);
    }
    
    // Message
    const messageText = this.scene.add.text(width/2, height/2 - 30, message, {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    messageText.setOrigin(0.5);
    messageText.setDepth(1002);
    elements.push(messageText);
    
    // Buttons using createButtonRow
    const buttonConfigs = buttons.map(btn => ({
      text: btn.text,
      onClick: () => {
        btn.onClick();
        this.destroyDialog(elements);
      },
      options: { tint: btn.tint }
    }));
    
    const dialogButtons = this.createButtonRow(width/2, height/2 + 30, buttonConfigs);
    
    // Set button depths and add to elements
    dialogButtons.forEach(btn => {
      btn.button.setDepth(1002);
      btn.text.setDepth(1002);
      elements.push(btn.button, btn.text);
    });
    
    return {
      elements,
      buttons: dialogButtons,
      destroy: () => this.destroyDialog(elements)
    };
  }
  
  destroyDialog(elements) {
    elements.forEach(element => element.destroy());
  }
}