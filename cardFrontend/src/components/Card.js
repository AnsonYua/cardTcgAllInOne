import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';

// Utility function to determine card type and properties from ID
function getCardInfoFromId(id) {
  if (!id) return null;
  
  if (id.startsWith('c-')) {
    return {
      type: 'character',
      folder: 'character'
    };
  } else if (id.startsWith('h-')) {
    return {
      type: 'help',
      folder: 'utilityCard'
    };
  } else if (id.startsWith('sp-')) {
    return {
      type: 'sp',
      folder: 'utilityCard'
    };
  } else if (id.startsWith('s-')) {
    return {
      type: 'leader',
      folder: 'leader'
    };
  }
  
  return null;
}

export default class Card extends Phaser.GameObjects.Container {
  constructor(scene, x, y, cardData, options = {}) {
    super(scene, x, y);
    
    // Store reference to GameStateManager for computed values
    this.gameStateManager = options.gameStateManager || null;
    
    // Auto-populate card data from ID if only ID is provided
    if (cardData && cardData.id && !cardData.type) {
      const cardInfo = getCardInfoFromId(cardData.id);
      if (cardInfo) {
        this.cardData = {
          ...cardData,
          type: cardInfo.type,
          folder: cardInfo.folder
        };
      } else {
        this.cardData = cardData;
      }
    } else {
      this.cardData = cardData;
    }
    this.options = {
      interactive: true,
      draggable: false,
      faceDown: false,
      scale: 1,
      usePreview: false,  // Use preview images (-preview.png) instead of original
      disableHighlight: false,  // Disable selection highlight for leader cards
      ...options
    };
    
    this.isSelected = false;
    this.isDragging = false;
    this.originalPosition = { x, y };
    
    this.create();
    this.setupInteraction();
    
    scene.add.existing(this);
  }

  create() {
    if (this.options.faceDown) {
      // Show card back when face down
      this.cardImage = this.scene.add.image(0, 0, 'card-back');
      this.add(this.cardImage);
    } else {
      // Check if we have a valid card ID
      if (!this.cardData || !this.cardData.id) {
        console.error(`[Card] Invalid card data - missing ID:`, this.cardData);
        // Create placeholder with error message
        this.cardImage = this.scene.add.image(0, 0, 'card-back');
        this.cardImage.setTint(0xff0000); // Red tint
        
        const errorText = this.scene.add.text(0, 0, 'NO ID', {
          fontSize: '16px',
          fontFamily: 'Arial',
          fill: '#ffffff',
          align: 'center'
        });
        errorText.setOrigin(0.5);
        this.add(errorText);
        this.add(this.cardImage);
        return;
      }
      
      // Show actual card image when face up
      const cardKey = this.options.usePreview ? 
        `${this.cardData.id}-preview` :  // Use preview version (e.g., "c-1-preview")
        this.cardData.id;                // Use original version (e.g., "c-1")
      
      console.log(`[Card] Trying to load image with key: ${cardKey}`);
      console.log(`[Card] Card data:`, this.cardData);
      console.log(`[Card] Available textures:`, Object.keys(this.scene.textures.list).filter(key => key.startsWith(this.cardData.id?.substring(0, 2) || '')));
      
      // Check if texture exists
      if (this.scene.textures.exists(cardKey)) {
        this.cardImage = this.scene.add.image(0, 0, cardKey);
        console.log(`[Card] Successfully loaded image: ${cardKey}`);
      } else {
        console.warn(`[Card] Texture not found: ${cardKey}, using fallback`);
        // Create a fallback placeholder with card ID text
        this.cardImage = this.scene.add.image(0, 0, 'card-back');
        this.cardImage.setTint(0xff0000); // Red tint to indicate missing texture
        
        // Add text showing the card ID for debugging
        const idText = this.scene.add.text(0, 0, this.cardData.id || 'NO ID', {
          fontSize: '16px',
          fontFamily: 'Arial',
          fill: '#ffffff',
          align: 'center'
        });
        idText.setOrigin(0.5);
        this.add(idText);
      }
      this.add(this.cardImage);
      
      // Card images already contain all the necessary information
      // Text overlays are not needed when using actual card artwork
      // if (this.cardData) {
      //   this.createCardContent();
      // }
    }
    
    // Scale card image to match game config dimensions with better filtering
    if (this.cardImage) {
      const scaleX = GAME_CONFIG.card.width / this.cardImage.width;
      const scaleY = GAME_CONFIG.card.height / this.cardImage.height;
      const scale = Math.min(scaleX, scaleY);
      this.cardImage.setScale(scale);
      
      // Set texture filtering for better quality when scaling
      this.cardImage.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    
    this.setScale(this.options.scale);
    this.updateVisualState();
  }

  createCardContent() {
    // Card name
    this.cardName = this.scene.add.text(0, -70, this.cardData.name || 'Unknown Card', {
      fontSize: '12px',
      fontFamily: 'Arial',
      fill: '#000000',
      align: 'center',
      wordWrap: { width: 100 }
    });
    this.cardName.setOrigin(0.5);
    this.add(this.cardName);

    // Power value for character cards (using computed power from effect system)
    if (this.cardData.type === 'character' && this.cardData.power !== undefined) {
      const displayPower = this.getDisplayPower();
      this.powerText = this.scene.add.text(45, -45, displayPower.toString(), {
        fontSize: '20px',
        fontFamily: 'Arial Bold',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2
      });
      this.powerText.setOrigin(0.5);
      this.add(this.powerText);
    }

    // Card type indicator
    const typeColor = GAME_CONFIG.colors[this.cardData.type] || 0xffffff;
    this.typeIndicator = this.scene.add.circle(-45, -60, 8, typeColor);
    this.add(this.typeIndicator);

    // Zone compatibility icons for character cards
    if (this.cardData.type === 'character' && this.cardData.zones) {
      this.createZoneIcons();
    }

    // Effect text for non-character cards
    if (this.cardData.type !== 'character' && this.cardData.effect) {
      this.effectText = this.scene.add.text(0, 20, this.cardData.effect, {
        fontSize: '10px',
        fontFamily: 'Arial',
        fill: '#333333',
        align: 'center',
        wordWrap: { width: 90 }
      });
      this.effectText.setOrigin(0.5);
      this.add(this.effectText);
    }

    // Card ID (for debugging/development)
    this.cardId = this.scene.add.text(0, 70, this.cardData.id, {
      fontSize: '8px',
      fontFamily: 'Arial',
      fill: '#666666',
      align: 'center'
    });
    this.cardId.setOrigin(0.5);
    this.add(this.cardId);
  }

  createZoneIcons() {
    const iconY = 40;
    const iconSpacing = 15;
    const startX = -(this.cardData.zones.length - 1) * iconSpacing / 2;
    
    this.cardData.zones.forEach((zone, index) => {
      const iconX = startX + (index * iconSpacing);
      const icon = this.scene.add.text(iconX, iconY, zone.toUpperCase()[0], {
        fontSize: '10px',
        fontFamily: 'Arial Bold',
        fill: '#ffffff',
        backgroundColor: '#000000',
        padding: { x: 3, y: 2 }
      });
      icon.setOrigin(0.5);
      this.add(icon);
    });
  }

  setupInteraction() {
    if (!this.options.interactive) return;

    this.setSize(120, 180);
    this.setInteractive();

    // Hover effects
    this.on('pointerover', () => {
      if (!this.isDragging) {
        this.scene.game.canvas.style.cursor = 'pointer';
        this.scene.events.emit('card-hover', this);
        
        // NO ANIMATION - just cursor change and event emission
      }
    });

    this.on('pointerout', () => {
      if (!this.isDragging) {
        this.scene.game.canvas.style.cursor = 'default';
        this.scene.events.emit('card-unhover', this);
        
        // NO ANIMATION - just cursor change and event emission
      }
    });

    // Click/tap interaction
    this.on('pointerdown', (pointer, localX, localY, event) => {
      if (pointer.rightButtonDown()) {
        // Right click for face-down toggle - TEMPORARILY DISABLED
        console.log(`Right click on card ${this.cardData?.id} - face-down toggle disabled`);
        event.stopPropagation();
      } else {
        // Left click for selection/deselection
        console.log(`Card ${this.cardData?.id} clicked - isSelected: ${this.isSelected}, visible: ${this.visible}, active: ${this.active}`);
        
        // Check if card is still valid before processing click
        if (!this.visible || !this.active) {
          console.error(`Card ${this.cardData?.id} - cannot process click, card is not visible or active`);
          return;
        }
        
        // Skip selection logic if highlight is disabled (e.g., for leader cards)
        if (this.options.disableHighlight) {
          console.log(`Card ${this.cardData?.id} clicked but highlight disabled - no selection`);
          return;
        }
        
        // SAFER SELECTION LOGIC
        try {
          if (this.isSelected) {
            // If already selected, deselect it
            console.log(`Deselecting card ${this.cardData?.id}`);
            this.deselect();
            this.scene.events.emit('card-deselect', this);
          } else {
            // If not selected, emit selection event (GameScene will handle the actual selection)
            console.log(`Emitting card-select for card ${this.cardData?.id}`);
            this.scene.events.emit('card-select', this);
          }
        } catch (error) {
          console.error(`Error in selection logic for card ${this.cardData?.id}:`, error);
        }
        
        if (this.options.draggable && !this.isSelected) {
          this.startDrag(pointer);
        }
      }
    });

    // Drag functionality
    if (this.options.draggable) {
      this.scene.input.on('pointermove', (pointer) => {
        if (this.isDragging) {
          this.x = pointer.x;
          this.y = pointer.y;
          this.scene.events.emit('card-drag', this, pointer);
        }
      });

      this.scene.input.on('pointerup', (pointer) => {
        if (this.isDragging) {
          this.stopDrag(pointer);
        }
      });
    }
  }

  startDrag(pointer) {
    this.isDragging = true;
    this.setDepth(1000);
    
    // No scaling animation - just set depth and emit event
    
    this.scene.events.emit('card-drag-start', this, pointer);
  }

  stopDrag(pointer) {
    this.isDragging = false;
    this.setDepth(0);
    
    // No scaling animation - just reset depth and emit event
    
    this.scene.events.emit('card-drag-end', this, pointer);
  }

  select() {
    console.log(`Card ${this.cardData?.id} select() called`);
    this.isSelected = true;
    this.updateVisualState();
  }

  deselect() {
    console.log(`Card ${this.cardData?.id} deselect() called`);
    try {
      this.isSelected = false;
      this.updateVisualState();
    } catch (error) {
      console.error(`Error in deselect() for card ${this.cardData?.id}:`, error);
    }
  }

  deselectSilently() {
    // Deselect without triggering animations or events
    console.log(`Card ${this.cardData?.id} deselectSilently() called`);
    try {
      this.isSelected = false;
      this.updateVisualState();
    } catch (error) {
      console.error(`Error in deselectSilently() for card ${this.cardData?.id}:`, error);
    }
  }

  toggleFaceDown() {
    this.options.faceDown = !this.options.faceDown;
    this.recreate();
    this.scene.events.emit('card-face-toggle', this);
  }

  updateVisualState() {
    console.log(`Card ${this.cardData?.id} updateVisualState - isSelected: ${this.isSelected}, visible: ${this.visible}, active: ${this.active}`);
    
    // Safety check - if card is not visible or active, don't update visual state
    if (!this.visible || !this.active) {
      console.log(`Card ${this.cardData?.id} - skipping visual state update due to visibility/active state`);
      return;
    }
    
    // Safety check - if scene is not available, don't update visual state
    if (!this.scene) {
      console.error(`Card ${this.cardData?.id} - no scene available, skipping visual state update`);
      return;
    }
    
    // Update power text if it exists (for character cards)
    if (this.powerText && this.cardData.type === 'character') {
      const displayPower = this.getDisplayPower();
      this.powerText.setText(displayPower.toString());
    }
    
    // Check if card is disabled by effects
    const isDisabled = this.isCardDisabled();
    
    // Apply disabled visual state
    if (isDisabled) {
      if (!this.disabledOverlay) {
        try {
          this.disabledOverlay = this.scene.add.graphics();
          this.disabledOverlay.fillStyle(0x000000, 0.5); // Semi-transparent black overlay
          this.disabledOverlay.fillRoundedRect(-62, -92, 124, 184, 8);
          this.add(this.disabledOverlay);
          console.log(`Disabled overlay added to card ${this.cardData?.id}`);
        } catch (error) {
          console.error(`Error adding disabled overlay to card ${this.cardData?.id}:`, error);
          this.disabledOverlay = null;
        }
      }
      
      // Gray out the card image
      if (this.cardImage) {
        this.cardImage.setTint(0x808080);
      }
    } else {
      // Remove disabled overlay
      if (this.disabledOverlay) {
        try {
          if (this.disabledOverlay.scene) {
            this.disabledOverlay.destroy();
          }
          this.disabledOverlay = null;
          console.log(`Disabled overlay removed from card ${this.cardData?.id}`);
        } catch (error) {
          console.error(`Error removing disabled overlay from card ${this.cardData?.id}:`, error);
          this.disabledOverlay = null;
        }
      }
      
      // Remove gray tint
      if (this.cardImage) {
        this.cardImage.clearTint();
      }
    }
    
    if (this.isSelected) {
      // Add selection highlight with green frame - only if not already present
      if (!this.selectionHighlight) {
        try {
          this.selectionHighlight = this.scene.add.graphics();
          this.selectionHighlight.lineStyle(4, 0x00ff00); // Green highlight for selection
          this.selectionHighlight.strokeRoundedRect(-62, -92, 124, 184, 8);
          this.add(this.selectionHighlight);
          console.log(`Green frame added to card ${this.cardData?.id}`);
        } catch (error) {
          console.error(`Error adding selection highlight to card ${this.cardData?.id}:`, error);
          // If failed to create highlight, don't mark as selected to avoid inconsistent state
          this.selectionHighlight = null;
        }
      }
    } else {
      // Remove selection highlight - only if present
      if (this.selectionHighlight) {
        try {
          // Check if the graphics object is still valid before destroying
          if (this.selectionHighlight.scene) {
            this.selectionHighlight.destroy();
          }
          this.selectionHighlight = null;
          console.log(`Green frame removed from card ${this.cardData?.id}`);
        } catch (error) {
          console.error(`Error removing selection highlight from card ${this.cardData?.id}:`, error);
          // Force clear the reference even if destroy failed
          this.selectionHighlight = null;
        }
      }
    }
  }

  recreate() {
    // Clear existing content
    this.removeAll(true);
    
    // Clear references to destroyed objects
    this.selectionHighlight = null;
    this.disabledOverlay = null;
    this.cardImage = null;
    this.powerText = null;
    
    // Recreate card
    this.create();
    
    // Restore visual state (selection highlight if needed)
    this.updateVisualState();
  }

  returnToOriginalPosition(duration = 300) {
    this.scene.tweens.add({
      targets: this,
      x: this.originalPosition.x,
      y: this.originalPosition.y,
      duration: duration,
      ease: 'Power2'
    });
  }

  moveToPosition(x, y, duration = 300, removeFromContainer = true) {
    this.originalPosition = { x, y };
    
    if (removeFromContainer) {
      // Get the current world position of the card
      const worldPos = this.getWorldTransformMatrix();
      const currentWorldX = worldPos.tx;
      const currentWorldY = worldPos.ty;
      
      // Remove the card from its current parent container (if any)
      if (this.parentContainer) {
        this.parentContainer.remove(this);
      }
      
      // Set the card's position to its current world position
      this.setPosition(currentWorldX, currentWorldY);
      
      // Add the card directly to the scene
      this.scene.add.existing(this);
      
      // Now animate to the target position
      this.scene.tweens.add({
        targets: this,
        x: x,
        y: y,
        duration: duration,
        ease: 'Power2'
      });
    } else {
      // Card stays in its container, just animate to new relative position
      this.scene.tweens.add({
        targets: this,
        x: x,
        y: y,
        duration: duration,
        ease: 'Power2'
      });
    }
  }

  canPlayInZone(zoneType) {
    if (this.cardData.type === 'character') {
      // Default character zone compatibility - can be placed in top, left, or right
      const defaultZones = ['top', 'left', 'right'];
      return this.cardData.zones ? this.cardData.zones.includes(zoneType) : defaultZones.includes(zoneType);
    }
    
    if (this.cardData.type === 'help') {
      return zoneType === 'help';
    }
    
    if (this.cardData.type === 'sp') {
      return zoneType === 'sp';
    }
    
    return false;
  }

  getCardData() {
    return this.cardData;
  }

  isFaceDown() {
    return this.options.faceDown;
  }

  // NEW: Effect System Integration Methods
  
  /**
   * Get the display power for this card (computed from effect system)
   * @returns {number} Power value to display
   */
  getDisplayPower() {
    if (this.gameStateManager && this.cardData.type === 'character') {
      return this.gameStateManager.getComputedCardPower(this.cardData);
    }
    return this.cardData.power || 0;
  }
  
  /**
   * Check if this card is disabled by effects
   * @returns {boolean} Whether card is disabled
   */
  isCardDisabled() {
    if (this.gameStateManager) {
      return this.gameStateManager.isCardDisabled(this.cardData);
    }
    return false;
  }
  
  /**
   * Update the GameStateManager reference
   * @param {GameStateManager} gameStateManager - GameStateManager instance
   */
  setGameStateManager(gameStateManager) {
    this.gameStateManager = gameStateManager;
    // Update visual state to reflect any changes
    this.updateVisualState();
  }
  
  /**
   * Refresh the card's visual state (called when effects change)
   */
  refreshFromEffects() {
    this.updateVisualState();
  }

  // Hover animation methods removed - no animations on hover
}
