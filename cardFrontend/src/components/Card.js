import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import PowerOverlay from './PowerOverlay.js';
import CardStatCalculator from '../utils/CardStatCalculator.js';


export default class Card extends Phaser.GameObjects.Container {
  constructor(scene, x, y, _cardData, options = {}) {
    super(scene, x, y);
    
    // Store reference to GameStateManager for computed values
    this.gameStateManager = options.gameStateManager || null;
    console.log('Card constructor - cardData:', JSON.stringify(_cardData));

    // Handle both nested and flat card data structures
    if (_cardData && _cardData.cardData) {
      // Nested structure: { cardData: {...}, other properties... }
      this.fullCardData = _cardData;
      this.cardData = _cardData.cardData;
    } else {
      // Flat structure: { id, cardType, power, ... }
      this.fullCardData = { cardData: _cardData };
      this.cardData = _cardData;
    }

    
    this.options = {
      scale: 1,
      usePreview: false,  // Use preview images (-preview.png) instead of original
      handleOutside:false,  // Disable selection highlight for leader cards
      ...options
    };
    
    this.isSelected = false;
    this.originalPosition = { x, y };
    
    // Zone placement tracking for hover preview system
    this.isInZone = false;
    this.zoneType = null;
    this.isPlayerZone = false;
    
    // Interaction state tracking
    this.isInteractionDisabled = false;
    
    // Power overlay for character cards in zones
    this.powerOverlay = null;
    
    // Create power overlay if this is a character card
    const cardType = this.cardData?.cardType || this.cardData?.type;

    this.create();
    this.setupInteraction();
    
    scene.add.existing(this);
  }

  create() {
    console.log(`[Card] 11111:`, JSON.stringify(this.fullCardData));
    // Check if we have a valid card ID
    if(this.cardData.cardType == "shield" ||
      this.cardData.cardType == "base" ||
      this.cardData.cardType == "energy"
      ){

    }else if (!this.cardData || !this.cardData.id) {
      console.error(`[Card] Invalid card data - missing ID:`, this.cardData);
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
    let cardKey = this.options.usePreview ? 
      `${this.cardData.id}-preview` :  // Use preview version (e.g., "c-1-preview")
      this.cardData.id;                // Use original version (e.g., "c-1")
    if(this.cardData.cardType == "shield"){
      cardKey = `${GAME_CONFIG.imageKey.cardback}-preview`
    }else if(this.cardData.cardType == "base" && this.fullCardData.carduid == "base_default"){
      cardKey = this.options.usePreview ? 
      `${GAME_CONFIG.imageKey.exBase}-preview` :  GAME_CONFIG.imageKey.exBase;     
    }else if (this.cardData.cardType == "energy"){
      cardKey = this.options.usePreview ? 
      `${GAME_CONFIG.imageKey.extraResource}-preview` :  // Use preview version (e.g., "c-1-preview")
      GAME_CONFIG.imageKey.extraResource  ;  
      if (!this.fullCardData.isExtraEnergy){
        cardKey = this.options.usePreview ? 
        `${GAME_CONFIG.imageKey.resource}-preview` :  // Use preview version (e.g., "c-1-preview")
        GAME_CONFIG.imageKey.resource;  
      }  
    }
    
    console.log("cardKey111 ", cardKey)
    console.log(`[Card] Trying to load image with key: ${cardKey}`);
    console.log(`[Card] Card data:`, this.cardData);
    console.log(`[Card] Available textures:`, Object.keys(this.scene.textures.list));
    
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
    
    // Create power overlay for character cards (initially hidden)
    this.createPowerOverlay();
    
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
    this.setSize(120, 180);
    this.setInteractive();

    // Set up all interaction event handlers
    this.on('pointerover', this.handlePointerOver, this);
    this.on('pointerout', this.handlePointerOut, this);
    this.on('pointerdown', this.handlePointerDown, this);
    
  }

  /**
   * Consolidated interaction state checker
   * @returns {Object} Current interaction state
   */
  getInteractionState() {
    const baseInteraction = this.visible && this.active;
    
    // Cards that should never be clickable
    const shouldDisableClick = this.cardData?.cardType === "energy" ||
     this.cardData?.cardType === "shield" || 
     this.cardData?.cardType === "base" ||
     (this.isInZone && !this.isPlayerZone); // Opponent cards should not be clickable
    
    return {
      // Cards in zones can still be selected for highlighting, even if other interactions are disabled
      // EXCEPT energy/shield/base cards and opponent cards - they should never be clickable
      canInteract: baseInteraction && (!this.isInteractionDisabled || (this.isInZone && !shouldDisableClick)),
      canSelect: !this.options.handleOutside && !shouldDisableClick,
      isInZone: this.isInZone
    };
  }

  /**
   * Centralized cursor management
   * @param {string} cursorType - Type of cursor to set
   */
  setCursor(cursorType = 'default') {
    if (this.scene && this.scene.game && this.scene.game.canvas) {
      // Always show pointer cursor on hover, regardless of interaction state
      if (cursorType === 'pointer') {
        this.scene.game.canvas.style.cursor = 'pointer';
      } else {
        this.scene.game.canvas.style.cursor = 'default';
      }
    }
  }

  /**
   * Consolidated event emission based on card location
   * @param {string} action - Action type (hover, unhover, select, deselect)
   */
  emitLocationAwareEvent(action) {
    console.log("select card if in zone ", this.isInZone , " ", action )
    const eventPrefix = this.isInZone ? 'zone-card' : 'card';
    this.scene.events.emit(`${eventPrefix}-${action}`, this);
  }

  /**
   * Handle pointer over events
   */
  handlePointerOver(pointer, localX, localY, event) {
    
    this.setCursor('pointer');
    this.emitLocationAwareEvent('hover');
  }

  /**
   * Handle pointer out events
   */
  handlePointerOut() {
    
    this.setCursor('default');
    this.emitLocationAwareEvent('unhover');
  }

  /**
   * Handle pointer down events
   */
  handlePointerDown(pointer, localX, localY, event) {
    const state = this.getInteractionState();
    console.log("card clicked here ", this.options.handleOutside)
    // Early return if card should not handle interaction
    if (this.options.handleOutside) return;
    if (pointer.rightButtonDown()) {
      this.handleRightClick(event);
    } else {
      this.handleLeftClick(pointer, state);
    }
  }

  /**
   * Handle right click events
   */
  handleRightClick(event) {
    console.log(`Right click on card ${this.cardData?.id} - face-down toggle disabled`);
    event.stopPropagation();
  }

  /**
   * Handle left click events
   */
  handleLeftClick(pointer, state) {
    console.log(`Card ${this.cardData?.id} clicked - state:`, {
      isSelected: this.isSelected,
      canInteract: state.canInteract,
      canSelect: state.canSelect
    });
    
    // Validate card state
    if (!state.canInteract) {
      console.log(`Card ${this.cardData?.id} interaction blocked - disabled or invalid state`);
      return;
    }
    console.log("show click toggling");
    // Handle selection logic
    if (state.canSelect) {
      console.log("show click toggling1111");
      this.handleSelectionToggle();
    }
    
  }

  /**
   * Handle selection toggle logic
   */
  handleSelectionToggle() {
    try {
      if (this.isSelected) {
        console.log(`Deselecting card ${this.cardData?.id}`);
        this.deselect();
        this.emitLocationAwareEvent('deselect');
      } else {
        console.log(`Selecting card ${this.cardData?.id}`);
        this.emitLocationAwareEvent('select');
      }
    } catch (error) {
      console.error(`Error in selection toggle for card ${this.cardData?.id}:`, error);
    }
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

  recreate() {
    // Clear existing content
    this.removeAll(true);
    
    // Clear references to destroyed objects
    this.selectionHighlight = null;
    this.disabledOverlay = null;
    this.cardImage = null;
    this.powerOverlay = null;
    
    // Recreate card
    this.create();

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
    

    // Update power overlay for character cards
    this.updatePowerOverlay();
    
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

  canPlayInZone(zoneType) {
    const cardType = this.cardData?.cardType || this.cardData?.type;
    
    if (cardType === 'character') {
      // Default character zone compatibility - can be placed in top, left, or right
      const defaultZones = ['top', 'left', 'right'];
      return this.cardData.zones ? this.cardData.zones.includes(zoneType) : defaultZones.includes(zoneType);
    }
    
    if (cardType === 'help') {
      return zoneType === 'help';
    }
    
    if (cardType === 'sp') {
      return zoneType === 'sp';
    }
    
    return false;
  }

  getCardData() {
    return this.cardData;
  }

  getCardFullData(){
    return this.fullCardData
  }

  // NEW: Effect System Integration Methods
  
  /**
   * Get the display power for this card (computed from effect system)
   * @returns {number} Power value to display
   */
  getDisplayPower() {
    const cardType = this.cardData?.cardType || this.cardData?.type;
    if (this.gameStateManager && cardType === 'character') {
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
  
  /**
   * Check if a command card has pilot_designation effect (making it function as a pilot)
   */
  hasCommandPilotDesignation() {
    if (!this.cardData || this.cardData.cardType !== 'command') {
      return false;
    }
    
    // Check if the command card has pilot_designation effect in its rules
    return this.cardData.effects?.rules?.some(rule => rule.effectId === 'pilot_designation') || false;
  }

  /**
   * Extract AP and HP values from card data based on card type
   * @returns {{ap: number, hp: number, originalAP: number, originalHP: number}} Current and original AP/HP values
   */
  getAPandHPFromCardData() {
    if (!this.fullCardData) {
      return { ap: 0, hp: 0, originalAP: 0, originalHP: 0 };
    }
    // For regular cards (unit, pilot, base), get AP/HP directly from card properties
    if (this.fullCardData.cardData.cardType === 'unit' || 
        this.fullCardData.cardData.cardType === 'pilot' || 
        this.fullCardData.cardData.cardType === 'base') {
   
          return {
            ap: this.fullCardData?.originalAP || this.cardData.ap || 0,
            hp: this.fullCardData?.originalHP || this.cardData.hp || 0,
            originalAP: this.fullCardData?.originalAP || this.cardData.ap || 0,
            originalHP: this.fullCardData?.originalHP || this.cardData.hp || 0
          };
       
    }

    // For command cards with pilot_designation effect, extract AP/HP from effect parameters
    if (this.cardData.cardType === 'command' && this.hasCommandPilotDesignation()) {
      const pilotEffect = this.cardData.effects?.rules?.find(rule => rule.effectId === 'pilot_designation');
      if (pilotEffect && pilotEffect.effect?.parameters) {
        const originalAP = pilotEffect.effect.parameters.AP || 0;
        const originalHP = pilotEffect.effect.parameters.HP || 0;
        
        return {
          ap: originalAP,
          hp: originalHP,
          originalAP: originalAP,
          originalHP: originalHP
        };
      }
    }

    // Default fallback
    return { ap: 0, hp: 0, originalAP: 0, originalHP: 0 };
  }

  /**
   * Create power overlay component for cards with AP/HP values
   * Only creates overlay for cards that have meaningful power values
   */
  createPowerOverlay() {

    const shouldShowPowerOverlay = this.cardData && (
      this.cardData.cardType === 'unit' ||
      this.cardData.cardType === 'pilot' || 
      this.cardData.cardType === 'base' ||
      (this.cardData.cardType === 'command' && this.hasCommandPilotDesignation())
    );
    console.log("overlay data ",JSON.stringify(this.cardData)," ", shouldShowPowerOverlay)
    
    if (shouldShowPowerOverlay) {
      if (this.powerOverlay) {
        this.powerOverlay.destroy();
      }
      
      // Pass parent card scale and card type to PowerOverlay for type-specific positioning
      this.powerOverlay = new PowerOverlay(this.scene, 0, 0, {
        parentCardScale: this.options.scale,
        showBackground: false,
        cardType: this.cardData?.cardType
      });
      this.add(this.powerOverlay);
      
      // Extract AP and HP values from card data
      const { ap, hp, originalAP, originalHP } = this.getAPandHPFromCardData();
      console.log("update ap and hp card", JSON.stringify(this.fullCardData))
      console.log("update ap and hp 1111", ap , " ", hp, " original:", originalAP, originalHP)
      this.powerOverlay.updateAP(ap, originalAP);
      this.powerOverlay.updateHP(hp, originalHP);
      // Update PowerOverlay with the extracted AP and HP values (simplified API)
      //this.powerOverlay.updateStats(ap, hp);
      
      console.log(`[Card] PowerOverlay initialized with AP: ${ap}, HP: ${hp} for card: ${this.cardData?.id || 'unknown'}`);
      
      // Initially hidden until placed in character zone
      this.powerOverlay.setVisible(true);
      //this.updatePowerOverlay();
    }
  }
  
  
  /**
   * Update power overlay with current AP and HP values (simplified)
   */
  updatePowerOverlay() {
    // Check if PowerOverlay exists and card should show overlay
    const shouldShowPowerOverlay = this.powerOverlay && this.cardData && (
      this.cardData.cardType === 'unit' ||
      this.cardData.cardType === 'pilot' || 
      this.cardData.cardType === 'base' ||
      (this.cardData.cardType === 'command' && this.hasCommandPilotDesignation())
    );

    if (!shouldShowPowerOverlay) {
      console.log('[Card] updatePowerOverlay skipped - no overlay or not supported type:', this.cardData?.id, 'type:', this.cardData?.cardType);
      return;
    }
    
    
    // Extract AP and HP values from card data using our unified method
    const { ap, hp, originalAP, originalHP } = this.getAPandHPFromCardData();
    
    console.log('[Card] updatePowerOverlay for', this.cardData.id, '- AP:', ap, '- HP:', hp, '- Original AP:', originalAP, '- Original HP:', originalHP);
    
    // Update using simplified API with original values
    this.powerOverlay.updateStats(ap, hp, originalAP, originalHP);
    
    // Make sure overlay is visible
    this.powerOverlay.setVisible(true);
  }
  
  /**
   * Set whether the power overlay should be visible
   * Used when card is placed in/removed from zones
   * @param {boolean} visible - Whether overlay should be shown
   * @param {boolean} animate - Whether to animate the change
   */
  setPowerOverlayVisible(visible) {
    console.log('[Card] setPowerOverlayVisible called:', visible, 'for card:', this.cardData?.id, 'powerOverlay exists:', !!this.powerOverlay);
    if (this.powerOverlay) {
      this.powerOverlay.setVisible(visible);
      if (visible) {
        this.updatePowerOverlay();
      }
    }
  }
  
  /**
   * Enable or disable power overlay background and borders
   * @param {boolean} showBackground - Whether to show backgrounds and borders
   */
  setPowerOverlayBackground(showBackground) {
    console.log('[Card] setPowerOverlayBackground called:', showBackground, 'for card:', this.cardData?.id);
    if (this.powerOverlay) {
      this.powerOverlay.setShowBackground(showBackground);
    }
  }

  /**
   * Update total AP and HP labels (only visible in slot zones)
   * Convenient wrapper for PowerOverlay.updateTotalStats()
   * @param {number} totalAP - Total AP value including all effects and modifications
   * @param {number} totalHP - Total HP value including all effects and modifications
   */
  updateTotalLabels(totalAP, totalHP , isRested) {
    console.log(`[Card] updateTotalLabels called: AP=${totalAP}, HP=${totalHP} for card:`, this.cardData?.id);
    if (this.powerOverlay && this.powerOverlay.updateTotalStats) {
      this.powerOverlay.updateTotalStats(totalAP, totalHP,isRested);
      console.log(`[Card] Total labels updated successfully for card:`, this.cardData?.id);
    } else {
      console.warn(`[Card] Cannot update total labels - PowerOverlay not available for card:`, this.cardData?.id);
    }
  }

  /**
   * Set the zone placement status of this card
   * Used by GameScene when cards are placed in or removed from zones
   * @param {boolean} inZone - Whether the card is currently in a zone
   * @param {string} zoneType - The type of zone (top, left, right, help, sp)
   * @param {boolean} isPlayerZone - Whether this is a player zone or opponent zone
   */
  setZonePlacement(inZone, zoneType = null, isPlayerZone = false) {
    this.isInZone = inZone;
    this.zoneType = zoneType;
    this.isPlayerZone = isPlayerZone;
    console.log(`[Card] ${this.cardData?.id} zone placement updated: inZone=${inZone}, type=${zoneType}, player=${isPlayerZone}`);
  }
  
  /**
   * Get the current zone placement status
   * @returns {Object} Zone placement information
   */
  getZonePlacement() {
    return {
      isInZone: this.isInZone,
      zoneType: this.zoneType,
      isPlayerZone: this.isPlayerZone
    };
  }

  /**
   * Disable card interaction (clicking, selection)
   * Used when cards are placed in zones and should no longer be interactive
   * Preserves hover events for preview system
   */
  disableInteraction() {
    console.log(`[Card] Disabling interaction for card ${this.cardData?.id}`);
    
    // Clear any existing selection state
    if (this.isSelected) {
      this.deselectSilently();
    }
    
    // Add flag to track disabled state
    this.isInteractionDisabled = true;
    
    // Don't call disableInteractive() - we still want hover events for preview system
    // The getInteractionState() method will handle the disabled logic
  }

  /**
   * Re-enable card interaction
   * Used if cards need to become interactive again (e.g., returned to hand)
   */
  enableInteraction() {
    console.log(`[Card] Enabling interaction for card ${this.cardData?.id}`);
    
    // Clear disabled flag
    this.isInteractionDisabled = false;
    
    // Re-enable Phaser interactivity
    this.setInteractive();
    
    // Restore normal event handlers by calling setupInteraction again
    this.setupInteraction();
  }

  /**
   * Configure PowerOverlay to show total AP/HP labels
   * @param {number} totalAP - Total AP value to display
   * @param {number} totalHP - Total HP value to display
   * @param {Object} options - Configuration options
   * @param {boolean} options.showBackground - Whether to show PowerOverlay background (default: false)
   * @param {number} options.depth - Z-depth for the PowerOverlay (optional)
   * @param {string} options.zone - Zone name for label visibility ('slot1' shows, 'hand' hides, default: 'slot1')
   */
  configureTotalLabelsToShow(totalAP, totalHP, options = {}) {
    const config = {
      showBackground: false,
      zone: 'slot1',
      ...options
    };
    
    if (!this.powerOverlay) {
      console.warn('Card has no PowerOverlay to configure');
      return;
    }
    
    try {
      // Configure PowerOverlay settings
      //this.powerOverlay.setShowBackground(config.showBackground);
      this.powerOverlay.setVisible(true);
      
      // Set depth if provided
      if (config.depth !== undefined) {
        this.powerOverlay.setDepth(config.depth);
      }
      
      // Set total labels visibility (following SlotAreaManager pattern)
      if (this.powerOverlay.setTotalLabelsVisibility) {
        this.powerOverlay.setTotalLabelsVisibility(config.zone);
      }
      
      // Update total stats
      if (this.powerOverlay.updateTotalStats) {
        this.powerOverlay.updateTotalStats(totalAP, totalHP);
        console.log(`Card ${this.cardData?.id} total stats: AP=${totalAP}, HP=${totalHP}`);
      }
      
      console.log(`PowerOverlay total labels configured for card ${this.cardData?.id}`);
    } catch (error) {
      console.error(`Error configuring PowerOverlay total labels for card ${this.cardData?.id}:`, error);
    }
  }

  /**
   * Calculate and update own total labels with optional pilot
   * Convenience method that combines CardStatCalculator.calculateTotalInSlot() with updateTotalLabels()
   * @param {Card|null} pilotCard - Optional pilot card for combined calculation
   * @param {boolean} isRested - Rest state for visual effects
   * @returns {Object} { totalAP, totalHP } - Calculated totals
   */
  updateCalculatedTotalLabels(pilotCard = null, isRested = false) {
    const { totalAP, totalHP } = CardStatCalculator.calculateTotalInSlot(this, pilotCard);
    this.updateTotalLabels(totalAP, totalHP, isRested);
    return { totalAP, totalHP };
  }

  /**
   * Calculate and update own total stats with optional pilot
   * Convenience method that combines CardStatCalculator.calculateTotalInSlot() with powerOverlay.updateTotalStats()
   * @param {Card|null} pilotCard - Optional pilot card for combined calculation
   * @param {boolean} isRested - Rest state for visual effects
   * @returns {Object} { totalAP, totalHP } - Calculated totals
   */
  updateCalculatedTotalStats(pilotCard = null, isRested = false) {
    const { totalAP, totalHP } = CardStatCalculator.calculateTotalInSlot(this, pilotCard);
    if (this.powerOverlay?.updateTotalStats) {
      this.powerOverlay.updateTotalStats(totalAP, totalHP, isRested);
    }
    return { totalAP, totalHP };
  }

  /**
   * Calculate and configure total labels to show with optional pilot
   * Convenience method that combines CardStatCalculator.calculateTotalInSlot() with configureTotalLabelsToShow()
   * @param {Card|null} pilotCard - Optional pilot card for combined calculation
   * @param {Object} options - Configuration options for configureTotalLabelsToShow
   * @returns {Object} { totalAP, totalHP } - Calculated totals
   */
  calculateAndConfigureTotalLabels(pilotCard = null, options = {}) {
    const { totalAP, totalHP } = CardStatCalculator.calculateTotalInSlot(this, pilotCard);
    this.configureTotalLabelsToShow(totalAP, totalHP, options);
    return { totalAP, totalHP };
  }

  // Hover animation methods removed - no animations on hover
}
