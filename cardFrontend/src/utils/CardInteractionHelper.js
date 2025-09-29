/**
 * CardInteractionHelper - Centralized hover effects and interaction patterns
 * Eliminates duplication across DialogUIManager, CardPreviewManager, SlotAreaManager, etc.
 */
export default class CardInteractionHelper {
  
  /**
   * Create standardized hover effect for cards or containers
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} target - Target object (container, card, etc.)
   * @param {Object} options - Hover effect options
   * @param {number} options.width - Interactive width
   * @param {number} options.height - Interactive height
   * @param {number} options.color - Border color (default: 0x00ff00)
   * @param {number} options.lineWidth - Border line width (default: 3)
   * @param {number} options.alpha - Target alpha (default: 0.8)
   * @param {number} options.depth - Graphics depth (default: 1505)
   * @param {number} options.radius - Border radius (default: 8)
   * @param {number} options.animationDuration - Animation duration (default: 200)
   * @returns {Function} Show hover effect function
   */
  static createShowHoverEffect(scene, target, options = {}) {
    const {
      width,
      height,
      color = 0x00ff00,
      lineWidth = 3,
      alpha = 0.8,
      depth = 1505,
      radius = 8,
      animationDuration = 200
    } = options;

    return () => {
      if (!target.hoverEffect) {
        target.hoverEffect = scene.add.graphics();
        target.hoverEffect.lineStyle(lineWidth, color, alpha);
        target.hoverEffect.strokeRoundedRect(
          -width / 2 - 2,
          -height / 2 - 2,
          width + 4,
          height + 4,
          radius
        );
        target.hoverEffect.setDepth(depth);
        target.hoverEffect.setAlpha(0);
        target.add(target.hoverEffect);

        // Animate the hover effect in
        scene.tweens.add({
          targets: target.hoverEffect,
          alpha: alpha,
          duration: animationDuration,
          ease: 'Power2.easeOut'
        });
      }

      // Change cursor
      scene.game.canvas.style.cursor = 'pointer';
    };
  }

  /**
   * Create standardized hide hover effect for cards or containers
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} target - Target object (container, card, etc.)
   * @param {Object} options - Hide effect options
   * @param {number} options.animationDuration - Animation duration (default: 150)
   * @returns {Function} Hide hover effect function
   */
  static createHideHoverEffect(scene, target, options = {}) {
    const {
      animationDuration = 150
    } = options;

    return () => {
      if (target.hoverEffect) {
        // Animate out before destroying
        scene.tweens.add({
          targets: target.hoverEffect,
          alpha: 0,
          duration: animationDuration,
          ease: 'Power2.easeIn',
          onComplete: () => {
            if (target.hoverEffect) {
              target.hoverEffect.destroy();
              target.hoverEffect = null;
            }
          }
        });
      }

      // Reset cursor
      scene.game.canvas.style.cursor = 'default';
    };
  }

  /**
   * Create enhanced hover effect with card preview integration
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} target - Target object (container, card, etc.)
   * @param {Object} hoverOptions - Hover effect options (same as createShowHoverEffect)
   * @param {Object} previewOptions - Preview options
   * @param {string} previewOptions.type - Preview type ('single', 'dual', 'slot')
   * @param {Object} previewOptions.unitCard - Unit card for dual/slot preview
   * @param {Object} previewOptions.pilotCard - Pilot card for dual/slot preview
   * @param {Object} previewOptions.cardData - Card data for single preview
   * @returns {Object} Object with showHover and hideHover functions
   */
  static createHoverWithPreview(scene, target,card, hoverOptions = {}, previewOptions = {}) {
    const showHover = this.createShowHoverEffect(scene, target, hoverOptions);
    const hideHover = this.createHideHoverEffect(scene, target, hoverOptions);

    const showHoverWithPreview = () => {
      // Show hover effect
      showHover();

      // Show card preview if CardPreviewManager available
      if (scene.cardPreviewManager) {
        try {
          scene.cardPreviewManager.showCardPreviewWithZone(card,"card-hover");
        } catch (error) {
          console.warn('Failed to show card preview in hover:', error);
        }
      }
    };

    const hideHoverWithPreview = () => {
      // Hide hover effect
      hideHover();

      // Hide card preview
      if (scene.cardPreviewManager) {
        scene.cardPreviewManager.hideCardPreview();
      }
    };

    return {
      showHover: showHoverWithPreview,
      hideHover: hideHoverWithPreview
    };
  }

  /**
   * Attach standardized interaction events to a target object
   * @param {Object} target - Target object to attach events to
   * @param {Function} onHover - Function to call on hover
   * @param {Function} onHoverOut - Function to call on hover out
   * @param {Function} onClick - Function to call on click (optional)
   * @param {Object} options - Event options
   * @param {boolean} options.setInteractive - Whether to set target as interactive (default: true)
   * @param {Object} options.interactiveArea - Custom interactive area (optional)
   */
  static attachInteractionEvents(target, onHover, onHoverOut, onClick = null, options = {}) {
    const { setInteractive = true, interactiveArea } = options;

    if (setInteractive) {
      if (interactiveArea) {
        target.setInteractive(interactiveArea, Phaser.Geom.Rectangle.Contains);
      } else {
        target.setInteractive();
      }
    }

    target.on('pointerover', onHover);
    target.on('pointerout', onHoverOut);
    
    if (onClick) {
      target.on('pointerdown', onClick);
    }
  }

  /**
   * Create complete interaction setup for slot containers (unit+pilot)
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} slotContainer - Slot container object
   * @param {Object} config - Configuration object
   * @param {number} config.width - Interactive width
   * @param {number} config.height - Interactive height
   * @param {Object} config.unitCard - Unit card (optional)
   * @param {Object} config.pilotCard - Pilot card (optional)
   * @param {Function} config.onSelection - Selection handler function
   * @param {Object} config.hoverOptions - Additional hover options (optional)
   */
  static setupSlotContainerInteraction(scene,slotContainer, card, config) {
    const { width, height, unitCard, pilotCard, onSelection, hoverOptions = {} } = config;

    // Set up interactive area for the container
    const interactiveArea = new Phaser.Geom.Rectangle(
      -width / 2, 
      -height / 2, 
      width, 
      height
    );

    slotContainer.setInteractive(interactiveArea, Phaser.Geom.Rectangle.Contains);

    // Create hover effects with preview
    const previewOptions = {
      type: 'slot',
      unitCard: unitCard,
      pilotCard: pilotCard
    };

    const combinedHoverOptions = {
      width,
      height,
      ...hoverOptions
    };

    const { showHover, hideHover } = this.createHoverWithPreview(
      scene,
      slotContainer, 
      card, 
      combinedHoverOptions, 
      previewOptions
    );

    // Attach events to container
    this.attachInteractionEvents(
      slotContainer,
      showHover,
      hideHover,
      onSelection,
      { setInteractive: false } // Already set interactive above
    );

    // Also set up events on individual cards for better responsiveness
    if (unitCard && unitCard.setInteractive) {
      unitCard.setInteractive();
      this.attachInteractionEvents(unitCard, showHover, hideHover, onSelection, { setInteractive: false });
      console.log('Unit card interaction events attached via CardInteractionHelper');
    }

    if (pilotCard && pilotCard.setInteractive) {
      pilotCard.setInteractive();
      this.attachInteractionEvents(pilotCard, showHover, hideHover, onSelection, { setInteractive: false });
      console.log('Pilot card interaction events attached via CardInteractionHelper');
    }
  }

  /**
   * Create simple card hover effect (for single cards)
   * @param {Phaser.Scene} scene - Phaser scene
   * @param {Object} card - Card object
   * @param {Object} cardData - Card data for preview
   * @param {Object} options - Options for hover effect
   * @returns {Object} Object with showHover and hideHover functions
   */
  static setupSimpleCardHover(scene, card, cardData, options = {}) {
    const hoverOptions = {
      width: card.displayWidth || 130,
      height: card.displayHeight || 190,
      ...options
    };

    const previewOptions = {
      type: 'single',
      cardData: cardData
    };

    return this.createHoverWithPreview(scene, card, hoverOptions, previewOptions);
  }

  /**
   * Clean up interaction events and hover effects from target
   * @param {Object} target - Target object to clean up
   */
  static cleanupInteraction(target) {
    if (!target) return;

    // Remove event listeners
    target.off('pointerover');
    target.off('pointerout');
    target.off('pointerdown');

    // Clean up hover effect if it exists
    if (target.hoverEffect) {
      target.hoverEffect.destroy();
      target.hoverEffect = null;
    }

    // Remove interactivity
    target.disableInteractive();
  }
}