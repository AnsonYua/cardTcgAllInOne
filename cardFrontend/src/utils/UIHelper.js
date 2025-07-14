// UIHelper.js - Utility class for common UI operations and button creation
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
   * @param {Object} options - Additional options (scale, tint, fontSize, etc.)
   * @returns {Object} Button object with image and text
   */
  createButton(x, y, text, onClick, options = {}) {
    const defaults = {
      scale: 0.8,
      tint: 0xffffff,
      fontSize: '14px',
      textColor: '#ffffff',
      clickScale: 0.76,
      clickDelay: 50
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
    
    // Add standardized click effect
    button.on('pointerdown', () => {
      // Visual click effect
      button.setTint(0x888888);
      button.setScale(config.clickScale);
      buttonText.setScale(0.95);
      
      this.scene.time.delayedCall(100, () => {
        if (config.tint !== 0xffffff) {
          button.setTint(config.tint);
        } else {
          button.clearTint();
        }
        button.setScale(config.scale);
        buttonText.setScale(1);
      });
      
      this.scene.time.delayedCall(config.clickDelay, () => onClick());
    });
    
    return {
      button,
      text: buttonText,
      setVisible: (visible) => {
        button.setVisible(visible);
        buttonText.setVisible(visible);
      },
      destroy: () => {
        button.destroy();
        buttonText.destroy();
      }
    };
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
    
    // Buttons
    const buttonSpacing = 160;
    const startX = width/2 - (buttons.length - 1) * buttonSpacing / 2;
    
    buttons.forEach((buttonConfig, index) => {
      const buttonX = startX + index * buttonSpacing;
      const button = this.scene.add.image(buttonX, height/2 + 30, 'button');
      button.setScale(0.8);
      button.setInteractive();
      button.setDepth(1002);
      
      if (buttonConfig.tint) {
        button.setTint(buttonConfig.tint);
      }
      
      const buttonText = this.scene.add.text(buttonX, height/2 + 30, buttonConfig.text, {
        fontSize: '16px',
        fontFamily: 'Arial',
        fill: '#ffffff'
      });
      buttonText.setOrigin(0.5);
      buttonText.setDepth(1002);
      
      button.on('pointerdown', () => {
        buttonConfig.onClick();
        this.destroyDialog(elements);
      });
      
      elements.push(button, buttonText);
    });
    
    return {
      elements,
      destroy: () => this.destroyDialog(elements)
    };
  }
  
  destroyDialog(elements) {
    elements.forEach(element => element.destroy());
  }
}