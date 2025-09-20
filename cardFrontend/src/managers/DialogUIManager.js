// DialogUIManager.js
// Specialized UI manager for dialog creation, interaction, and rendering
// Extracted from GameSceneUtils.js for better code organization

import Card from '../components/Card.js';
import ItemDataResolver from '../utils/ItemDataResolver.js';

/**
 * DialogUIManager - Handles all dialog UI creation, interaction, and management
 * 
 * Features:
 * - Card selection dialog creation and management
 * - Dialog layout and styling
 * - Card display and interaction handling
 * - Pagination and button controls
 * - Hover and selection highlighting
 * - Animation management
 */
export default class DialogUIManager {
  
  /**
   * Creates a card selection dialog with pagination and interactive elements
   * @param {string} selectionId - Unique identifier for the selection
   * @param {Object} selection - Selection configuration object with items array
   * @param {Phaser.Scene} scene - Phaser scene instance
   * @param {Function} onConfirm - Callback when user confirms selection
   * @returns {Object} Dialog interface with cleanup method
   */
  static createCardSelectionDialog(selectionId, selection, scene, onConfirm) {
    console.log('🎮 DialogUIManager: Creating card selection dialog');
    console.log('Selection ID:', selectionId);
    console.log('Selection config:', selection);
    
    // Resolve items to eligibleCards format
    let eligibleCards = [];
    if (selection.eligibleCards && Array.isArray(selection.eligibleCards)) {
      // Direct eligibleCards provided (e.g., trash viewing)
      eligibleCards = selection.eligibleCards;
      console.log('📦 Using provided eligibleCards:', eligibleCards.length, 'cards');
    } else if (selection.items && Array.isArray(selection.items)) {
      // Resolve items using ItemDataResolver
      console.log('📦 Resolving', selection.items.length, 'items to cards');
      const gameState = scene.gameStateManager.getGameState();
      eligibleCards = ItemDataResolver.resolveItems(selection.items, gameState);
      console.log('✅ Resolved to', eligibleCards.length, 'eligible cards');
    } else {
      console.warn('DialogUIManager: No items or eligibleCards provided in selection');
      eligibleCards = [];
    }
    
    // Add eligibleCards to selection for rest of system
    selection.eligibleCards = eligibleCards;
    
    console.log('Available cards:', eligibleCards.length);
    
    // Create dialog configuration and layout
    const config = this._createDialogConfig(scene, selection);
    const dialogElements = { cardListElements: [] };
    
    // Create dialog background and layout sections
    this._createDialogBackground(scene, config, dialogElements);
    this._createTitleSection(scene, config, dialogElements);
    this._createCardSectionBackground(scene, config, dialogElements, selection);
    
    // Initialize pagination state
    const paginationState = {
      currentPage: 0,
      maxCardsPerPage: 4,
      totalCards: eligibleCards.length,
      totalPages: Math.ceil(eligibleCards.length / 4)
    };
    
    // Initialize selection state
    const selectionState = {
      selectedCard: null,
      selectedCards: [],
      selectedCardHighlight: null,
      selectedCardHighlights: [],
      maxSelections: selection.selectCount || 1
    };
    
    // Create card display configuration
    const cardDisplayConfig = {
      cardDisplayWidth: 140,
      cardDisplayHeight: 200,
      cardSpacing: 20
    };
    
    // Create pagination controls
    this._createPaginationControls(scene, config, paginationState, dialogElements);
    
    // Create card manager and display
    const { updateCardDisplay, clearSelections } = this._createCardManager(
      scene, selection, config, paginationState, selectionState, cardDisplayConfig, dialogElements
    );
    
    // Handle button configuration
    let updateOKButtonState;
    if (selection.buttons) {
      // Custom button configuration
      const buttonConfig = { buttons: selection.buttons };
      this._createButtonSection(scene, selectionId, selection, config, selectionState, dialogElements, () => {}, onConfirm);
      updateOKButtonState = () => this._updateConfigurableButtonState(selectionState, dialogElements, buttonConfig);
    } else {
      // Default OK/Cancel buttons
      this._createButtonSection(scene, selectionId, selection, config, selectionState, dialogElements, (state, elements) => {
        this._updateOKButtonState(state, elements);
      }, onConfirm);
      updateOKButtonState = () => this._updateOKButtonState(selectionState, dialogElements);
    }
    
    // Initial card display
    updateCardDisplay('in');
    updateOKButtonState();
    
    // Disable main game interactions while dialog is open
    this._disableMainGameCardInteractions(scene);
    
    console.log('✅ Dialog created successfully');
    
    // Return dialog interface
    return {
      elements: this._getAllDialogElements(dialogElements),
      cleanup: () => {
        console.log('🧹 Cleaning up dialog interface');
        this._cleanupDialog(scene, dialogElements);
        this._enableMainGameCardInteractions(scene);
      }
    };
  }

  /**
   * Creates a custom button dialog for specific interactions
   * @param {Object} selection - Selection configuration with custom buttons
   * @param {Phaser.Scene} scene - Phaser scene instance  
   * @param {Function} onConfirm - Callback when user confirms
   * @returns {Object} Dialog interface
   */
  static createCustomButtonDialog(selection, scene, onConfirm) {
    console.log('🎮 DialogUIManager: Creating custom button dialog');
    return this.createCardSelectionDialog(selection.selectionId, selection, scene, onConfirm);
  }

  /**
   * Create dialog configuration based on scene and selection
   * @private
   */
  static _createDialogConfig(scene, selection) {
    const { width, height } = scene.cameras.main;
    
    // Base dialog dimensions
    const dialogWidth = Math.min(width * 0.8, 800);
    const dialogHeight = Math.min(height * 0.8, 600);
    
    // Responsive card sizing based on dialog width
    const cardDisplayWidth = Math.max(120, Math.min(160, (dialogWidth - 100) / 4 - 20));
    const cardDisplayHeight = cardDisplayWidth * 1.4; // Maintain aspect ratio
    
    return {
      centerX: width / 2,
      centerY: height / 2,
      dialogWidth: dialogWidth,
      dialogHeight: dialogHeight,
      cardDisplayWidth: cardDisplayWidth,
      cardDisplayHeight: cardDisplayHeight,
      title: selection.title || 'Select Cards',
      description: selection.description || ''
    };
  }

  /**
   * Create the main dialog background and overlay
   * @private
   */
  static _createDialogBackground(scene, config, dialogElements) {
    // Semi-transparent overlay
    const overlay = scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, scene.cameras.main.width, scene.cameras.main.height);
    overlay.setDepth(1500);
    overlay.setInteractive();
    dialogElements.overlay = overlay;
    
    // Main dialog background
    const background = scene.add.graphics();
    background.fillStyle(0x2a2a2a);
    background.fillRoundedRect(
      config.centerX - config.dialogWidth/2, 
      config.centerY - config.dialogHeight/2, 
      config.dialogWidth, 
      config.dialogHeight, 
      15
    );
    background.lineStyle(3, 0x4a4a4a);
    background.strokeRoundedRect(
      config.centerX - config.dialogWidth/2, 
      config.centerY - config.dialogHeight/2, 
      config.dialogWidth, 
      config.dialogHeight, 
      15
    );
    background.setDepth(1501);
    dialogElements.background = background;
  }

  /**
   * Create the title section of the dialog
   * @private
   */
  static _createTitleSection(scene, config, dialogElements) {
    const titleSection = {
      centerY: config.centerY - config.dialogHeight/2 + 50
    };
    
    // Title text
    const titleText = scene.add.text(config.centerX, titleSection.centerY - 15, config.title, {
      fontSize: '24px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    titleText.setOrigin(0.5);
    titleText.setDepth(1503);
    
    // Description text
    const descriptionText = scene.add.text(config.centerX, titleSection.centerY + 15, config.description, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#cccccc',
      align: 'center',
      wordWrap: { width: config.dialogWidth - 60 }
    });
    descriptionText.setOrigin(0.5);
    descriptionText.setDepth(1503);
    
    dialogElements.titleSection = {
      centerY: titleSection.centerY,
      titleText: titleText,
      descriptionText: descriptionText
    };
  }

  /**
   * Create the card section background and layout
   * @private
   */
  static _createCardSectionBackground(scene, config, dialogElements, selection) {
    const cardSection = {
      centerY: config.centerY,
      background: scene,
      width: config.dialogWidth - 40,
      height: config.dialogHeight - 200
    };
    
    // Card section background
    const cardBg = scene.add.graphics();
    cardBg.fillStyle(0x1a1a1a);
    cardBg.fillRoundedRect(
      config.centerX - cardSection.width/2,
      cardSection.centerY - cardSection.height/2,
      cardSection.width,
      cardSection.height,
      10
    );
    cardBg.setDepth(1502);
    
    dialogElements.cardSection = {
      centerY: cardSection.centerY,
      background: scene,
      width: cardSection.width,
      height: cardSection.height,
      cardBg: cardBg
    };
  }

  /**
   * Extract card display information from various card data formats
   * @private
   */
  static _extractCardDisplayInfo(card) {
    let cardImageId, displayCardId;
    
    // Direct card object (unit from zones)
    if (card.cardData && card.cardData.id) {
      cardImageId = card.cardData.id;
      displayCardId = card.cardUid || card.cardId;
    } else if (card.cardData && card.cardData.cardId) {
      cardImageId = card.cardData.cardId;
      displayCardId = card.cardUid || card.cardId;
    } else if (card.cardId) {
      // Fallback for simple card objects
      cardImageId = card.cardId;
      displayCardId = card.cardId;
    } else if (card.id) {
      // Direct card data format
      cardImageId = card.id;
      displayCardId = card.id;
    } else {
      console.warn('Unknown card data structure:', card);
      cardImageId = 'unknown';
      displayCardId = 'unknown';
    }
    
    return { cardImageId, displayCardId };
  }

  /**
   * Creates pagination controls for card navigation
   * @private
   */
  static _createPaginationControls(scene, config, paginationState, dialogElements) {
    dialogElements.paginationElements = {};
    
    // Left arrow
    dialogElements.paginationElements.leftArrow = scene.add.graphics();
    dialogElements.paginationElements.leftArrow.fillStyle(0x888888);
    dialogElements.paginationElements.leftArrow.fillTriangle(
      config.centerX - config.dialogWidth/2 + 40, dialogElements.cardSection.centerY,
      config.centerX - config.dialogWidth/2 + 65, dialogElements.cardSection.centerY - 15,
      config.centerX - config.dialogWidth/2 + 65, dialogElements.cardSection.centerY + 15
    );
    dialogElements.paginationElements.leftArrow.setDepth(1504);
    dialogElements.paginationElements.leftArrow.setInteractive(new Phaser.Geom.Rectangle(
      config.centerX - config.dialogWidth/2 + 30, dialogElements.cardSection.centerY - 20, 45, 40
    ), Phaser.Geom.Rectangle.Contains);

    // Right arrow
    dialogElements.paginationElements.rightArrow = scene.add.graphics();
    dialogElements.paginationElements.rightArrow.fillStyle(0x888888);
    dialogElements.paginationElements.rightArrow.fillTriangle(
      config.centerX + config.dialogWidth/2 - 40, dialogElements.cardSection.centerY,
      config.centerX + config.dialogWidth/2 - 65, dialogElements.cardSection.centerY - 15,
      config.centerX + config.dialogWidth/2 - 65, dialogElements.cardSection.centerY + 15
    );
    dialogElements.paginationElements.rightArrow.setDepth(1504);
    dialogElements.paginationElements.rightArrow.setInteractive(new Phaser.Geom.Rectangle(
      config.centerX + config.dialogWidth/2 - 75, dialogElements.cardSection.centerY - 20, 45, 40
    ), Phaser.Geom.Rectangle.Contains);

    // Page text
    dialogElements.paginationElements.pageText = scene.add.text(
      config.centerX, dialogElements.cardSection.centerY + dialogElements.cardSection.height/2 - 30,
      `Page ${paginationState.currentPage + 1} of ${paginationState.totalPages}`,
      {
        fontSize: '16px',
        fontFamily: 'Arial',
        fill: '#cccccc',
        align: 'center'
      }
    );
    dialogElements.paginationElements.pageText.setOrigin(0.5);
    dialogElements.paginationElements.pageText.setDepth(1503);
  }

  /**
   * Get button preset configurations
   * @private
   */
  static _getButtonPresets() {
    return {
      // Confirmation buttons
      'ACTIVATE': { text: 'ACTIVATE', color: 0xff6b35, action: 'confirm', enabledCondition: 'hasSelection' },
      'OK': { text: 'OK', color: 0x4CAF50, action: 'confirm', enabledCondition: 'hasSelection' },
      'CONFIRM': { text: 'CONFIRM', color: 0x4CAF50, action: 'confirm', enabledCondition: 'hasSelection' },
      'YES': { text: 'YES', color: 0x4CAF50, action: 'confirm', enabledCondition: 'hasSelection' },
      'SELECT': { text: 'SELECT', color: 0x2196F3, action: 'confirm', enabledCondition: 'hasSelection' },
      
      // Cancel buttons  
      'CANCEL': { text: 'CANCEL', color: 0xf44336, action: 'cancel', enabledCondition: 'always' },
      'SKIP': { text: 'SKIP', color: 0xf44336, action: 'cancel', enabledCondition: 'always' },
      'NO': { text: 'NO', color: 0xf44336, action: 'cancel', enabledCondition: 'always' },
      'CLOSE': { text: 'CLOSE', color: 0x666666, action: 'cancel', enabledCondition: 'always' },
      
      // Special buttons
      'REDRAW': { text: 'REDRAW', color: 0xff9800, action: 'confirm', enabledCondition: 'hasSelection', initialText: 'SELECT CARDS' }
    };
  }

  /**
   * Get lighter color variant for hover effects
   * @private
   */
  static _getLighterColor(color) {
    const r = (color >> 16) & 0xFF;
    const g = (color >> 8) & 0xFF;
    const b = color & 0xFF;
    
    const factor = 1.3;
    return ((Math.min(255, Math.floor(r * factor)) << 16) |
            (Math.min(255, Math.floor(g * factor)) << 8) |
            Math.min(255, Math.floor(b * factor)));
  }

  /**
   * Get all dialog elements for cleanup
   * @private
   */
  static _getAllDialogElements(dialogElements) {
    const elements = [];
    
    // Basic dialog elements
    if (dialogElements.overlay) elements.push(dialogElements.overlay);
    if (dialogElements.background) elements.push(dialogElements.background);
    
    // Title section
    if (dialogElements.titleSection) {
      if (dialogElements.titleSection.titleText) elements.push(dialogElements.titleSection.titleText);
      if (dialogElements.titleSection.descriptionText) elements.push(dialogElements.titleSection.descriptionText);
    }
    
    // Card section
    if (dialogElements.cardSection && dialogElements.cardSection.cardBg) {
      elements.push(dialogElements.cardSection.cardBg);
    }
    
    // Card list elements
    if (dialogElements.cardListElements) {
      elements.push(...dialogElements.cardListElements);
    }
    
    // Pagination elements
    if (dialogElements.paginationElements) {
      Object.values(dialogElements.paginationElements).forEach(element => {
        if (element) elements.push(element);
      });
    }
    
    // Button section
    if (dialogElements.buttonSection) {
      Object.values(dialogElements.buttonSection).forEach(element => {
        if (element) elements.push(element);
      });
    }
    
    return elements;
  }

  /**
   * Clean up dialog and all its elements
   * @private
   */
  static _cleanupDialog(scene, dialogElements) {
    console.log('🧹 DialogUIManager: Starting dialog cleanup');
    
    // Clean up all card elements first (including hover effects)
    if (dialogElements.cardListElements) {
      this._cleanupCardElements(dialogElements.cardListElements);
    }
    
    // Clean up all dialog elements
    const allElements = this._getAllDialogElements(dialogElements);
    allElements.forEach(element => {
      if (element && element.destroy) {
        try {
          element.destroy();
        } catch (error) {
          console.warn('Error destroying dialog element:', error);
        }
      }
    });
    
    // Clear arrays
    if (dialogElements.cardListElements) {
      dialogElements.cardListElements.length = 0;
    }
    
    console.log('✅ Dialog cleanup completed');
  }

  /**
   * Clean up hover effects from card elements
   * @private
   */
  static _cleanupHoverEffects(cardElements) {
    cardElements.forEach(element => {
      if (element && element.hoverEffect) {
        try {
          element.hoverEffect.destroy();
          element.hoverEffect = null;
        } catch (error) {
          console.warn('Error cleaning up hover effect:', error);
        }
      }
    });
  }

  /**
   * Clean up card elements and their associated effects
   * @private
   */
  static _cleanupCardElements(cardElements) {
    // Clean up hover effects first
    this._cleanupHoverEffects(cardElements);
    
    // Clean up the card elements themselves
    cardElements.forEach(element => {
      if (element && element.destroy) {
        try {
          element.destroy();
        } catch (error) {
          console.warn('Error destroying card element:', error);
        }
      }
    });
  }

  /**
   * Disable main game card interactions while dialog is open
   * @private
   */
  static _disableMainGameCardInteractions(scene) {
    console.log('🔒 Disabling main game card interactions');
    
    if (scene.children && scene.children.list) {
      scene.children.list.forEach(child => {
        if (child.texture && child.texture.key && child.texture.key.includes('card')) {
          if (child.input && child.input.enabled) {
            child.wasInteractiveBeforeDialog = true;
            child.disableInteractive();
          }
        }
        
        if (child.type === 'Container' && child.list) {
          child.list.forEach(containerChild => {
            if (containerChild.texture && containerChild.texture.key && containerChild.texture.key.includes('card')) {
              if (containerChild.input && containerChild.input.enabled) {
                containerChild.wasInteractiveBeforeDialog = true;
                containerChild.disableInteractive();
              }
            }
          });
        }
      });
    }
  }

  /**
   * Re-enable main game card interactions after dialog closes
   * @private
   */
  static _enableMainGameCardInteractions(scene) {
    console.log('🔓 Re-enabling main game card interactions');
    
    if (scene.children && scene.children.list) {
      scene.children.list.forEach(child => {
        if (child.wasInteractiveBeforeDialog) {
          child.setInteractive();
          child.wasInteractiveBeforeDialog = false;
        }
        
        if (child.type === 'Container' && child.list) {
          child.list.forEach(containerChild => {
            if (containerChild.wasInteractiveBeforeDialog) {
              containerChild.setInteractive();
              containerChild.wasInteractiveBeforeDialog = false;
            }
          });
        }
      });
    }
  }

  /**
   * Create card manager that handles card display, pagination, and selection
   * @private
   */
  static _createCardManager(scene, selection, config, paginationState, selectionState, cardDisplayConfig, dialogElements) {
    const eligibleCards = selection.eligibleCards;
    
    // Function to clear selections when changing pages
    const clearSelections = () => {
      selectionState.selectedCard = null;
      selectionState.selectedCards.length = 0;
      if (selectionState.selectedCardHighlight) {
        selectionState.selectedCardHighlight.destroy();
        selectionState.selectedCardHighlight = null;
      }
      selectionState.selectedCardHighlights.forEach(highlight => {
        if (highlight) highlight.destroy();
      });
      selectionState.selectedCardHighlights.length = 0;
    };
    
    // Function to create cards for current page
    const createCardsForCurrentPage = (animateDirection) => {
      const startIndex = paginationState.currentPage * paginationState.maxCardsPerPage;
      const endIndex = Math.min(startIndex + paginationState.maxCardsPerPage, eligibleCards.length);
      const currentPageCards = eligibleCards.slice(startIndex, endIndex);
      
      // Calculate layout
      const totalCardsWidth = (currentPageCards.length * cardDisplayConfig.cardDisplayWidth) + 
                             ((currentPageCards.length - 1) * cardDisplayConfig.cardSpacing);
      const cardsStartX = config.centerX - totalCardsWidth / 2;
      const cardsY = dialogElements.cardSection.centerY + 10;
      
      // Create cards
      currentPageCards.forEach((card, index) => {
        this._createSingleCardDisplay(
          scene, card, index, cardsStartX, cardsY, 
          cardDisplayConfig, dialogElements, selectionState, animateDirection
        );
      });
      
      // Update pagination controls visibility
      this._updatePaginationVisibility(paginationState, dialogElements);
    };
    
    // Main update function
    const updateCardDisplay = (animateDirection = null) => {
      clearSelections();
      
      if (animateDirection && dialogElements.cardListElements.length > 0) {
        this._animateCardsOut(scene, dialogElements.cardListElements, animateDirection)
          .then(() => {
            dialogElements.cardListElements.length = 0;
            createCardsForCurrentPage(animateDirection);
          });
      } else {
        this._cleanupCardElements(dialogElements.cardListElements);
        dialogElements.cardListElements.length = 0;
        createCardsForCurrentPage(null);
      }
    };
    
    // Setup pagination events
    this._setupPaginationEvents(scene, paginationState, dialogElements, updateCardDisplay);
    
    return { updateCardDisplay, clearSelections };
  }

  /**
   * Create a single card display with interaction and styling
   * @private
   */
  static _createSingleCardDisplay(scene, card, index, cardsStartX, cardsY, cardDisplayConfig, dialogElements, selectionState, animateDirection) {
    const cardX = cardsStartX + (index * (cardDisplayConfig.cardDisplayWidth + cardDisplayConfig.cardSpacing)) + cardDisplayConfig.cardDisplayWidth / 2;
    
    // Card container background - made taller to accommodate total AP/HP labels
    const cardContainer = scene.add.graphics();
    cardContainer.fillStyle(0x333333);
    const extraHeight = 25; // Additional height for total AP/HP labels
    // Center the extra height: move Y position up by half the extra height to keep visual center aligned
    const adjustedY = cardsY - cardDisplayConfig.cardDisplayHeight/2 - (extraHeight / 2);
    cardContainer.fillRoundedRect(cardX - cardDisplayConfig.cardDisplayWidth/2, adjustedY, cardDisplayConfig.cardDisplayWidth, cardDisplayConfig.cardDisplayHeight + extraHeight, 8);
    cardContainer.lineStyle(2, 0x666666);
    cardContainer.strokeRoundedRect(cardX - cardDisplayConfig.cardDisplayWidth/2, adjustedY, cardDisplayConfig.cardDisplayWidth, cardDisplayConfig.cardDisplayHeight + extraHeight, 8);
    cardContainer.setDepth(1503);
    dialogElements.cardListElements.push(cardContainer);
    
    // Extract card display info and create card element (can be Card component or Container)
    const { cardImageId, displayCardId } = this._extractCardDisplayInfo(card);
    console.log("card item 1111111 ", JSON.stringify(card))
    const cardElement = this._createCardImage(scene, cardX, cardsY, cardImageId, displayCardId, cardDisplayConfig, card);
    if (cardElement) {
      dialogElements.cardListElements.push(cardElement);
      this._setupCardInteraction(scene, card, cardElement, displayCardId, selectionState, cardX, cardsY, cardDisplayConfig, dialogElements);
    }
    
    // Animate card in if direction is specified
    if (animateDirection && cardElement) {
      this._animateCardIn(scene, cardElement, cardContainer, cardX, cardsY, animateDirection, index);
    }
  }

  /**
   * Creates full Card component with AP/HP display instead of simple image
   * @private
   */
  static _createCardImage(scene, cardX, cardsY, cardImageId, displayCardId, cardDisplayConfig, originalCard = null) {
    // Check if this is a slot target (unit + pilot combination)
    if (originalCard && originalCard.isSlotTarget) {
      return this._createSlotTargetDisplay(scene, cardX, cardsY, cardDisplayConfig, originalCard);
    }
    
    // Create full Card component with AP/HP display
    try {
      const cardData = this._prepareCardDataForDisplay(cardImageId, displayCardId, originalCard);
      
      // Calculate appropriate scale for dialog display
      const dialogScale = Math.min(
        (cardDisplayConfig.cardDisplayWidth - 16) / 124,  // Card width is 124px by default
        (cardDisplayConfig.cardDisplayHeight - 16) / 184  // Card height is 184px by default
      );
      
      const cardComponent = new Card(scene, cardX, cardsY, cardData, {
        usePreview: true,     // Use preview images
        scale: dialogScale,   // Scale to fit dialog
        interactive: true,   // Disable interaction (handled separately)
        showBackground: false ,// No PowerOverlay background in dialogs
        handleOutside: true
      });
      
      cardComponent.setDepth(1504);
      
      // Ensure PowerOverlay is visible and properly configured for dialog display
      if (cardComponent.powerOverlay) {
        cardComponent.powerOverlay.setShowBackground(false);
        cardComponent.powerOverlay.setVisible(true);
        cardComponent.powerOverlay.setDepth(1505);
      }
      
      return cardComponent;
    } catch (error) {
      console.warn('Failed to create Card component, falling back to image:', error);
      return this._createFallbackCardImage(scene, cardX, cardsY, cardImageId, displayCardId, cardDisplayConfig);
    }
  }

  /**
   * Creates display for slot targets (unit + pilot combinations)
   * @private
   */
  static _createSlotTargetDisplay(scene, cardX, cardsY, cardDisplayConfig, slotTarget) {
    // Calculate scale for slot target display
    const dialogScale = Math.min(
      (cardDisplayConfig.cardDisplayWidth - 16) / 124,
      (cardDisplayConfig.cardDisplayHeight - 16) / 184
    );
    
    // Create a container to hold unit and pilot cards with extra height for total AP/HP labels
    const slotContainer = scene.add.container(cardX, cardsY);
    
    // Add extra vertical spacing for slot targets to accommodate total AP/HP labels
    const extraSpacing = 15; // Additional space for total labels
    
    // Create pilot card if present (positioned below unit with extra spacing)
    let pilotCard = null;
    if (slotTarget.pilot) {
      const pilotData = this._prepareCardDataForDisplay(slotTarget.pilot.cardId, slotTarget.pilot.cardId, slotTarget.pilot);
      pilotCard = new Card(scene, 0, 23 + extraSpacing, pilotData, {
        usePreview: true,
        scale: dialogScale,
        interactive: false, // Container will handle interaction
        showBackground: false,
        handleOutside: true
      });
      slotContainer.add(pilotCard);
    }

    // Create unit card (always present) - center if no pilot, otherwise position at top with extra spacing
    const unitY = slotTarget.pilot ? -20 - extraSpacing : 0; // Add extra spacing when pilot present
    const unitData = this._prepareCardDataForDisplay(slotTarget.unit.cardId, slotTarget.unit.cardId, slotTarget.unit);
    const unitCard = new Card(scene, 0, unitY, unitData, {
      usePreview: true,
      scale: dialogScale,
      interactive: false, // Container will handle interaction
      showBackground: false,
      handleOutside: true
    });
    
    slotContainer.add(unitCard);
    
    // Store references for interaction handling
    slotContainer.unitCard = unitCard;
    slotContainer.pilotCard = pilotCard;
    slotContainer.slotData = slotTarget;
    
    slotContainer.setDepth(1504);
    
    console.log(`Created slot target display: ${slotTarget.unit.cardId}${slotTarget.pilot ? ` + ${slotTarget.pilot.cardId}` : ''}`);
    return slotContainer;
  }

  /**
   * Create fallback card image when Card component fails
   * @private
   */
  static _createFallbackCardImage(scene, cardX, cardsY, cardImageId, displayCardId, cardDisplayConfig) {
    console.log(`Creating fallback image for: ${cardImageId}`);
    
    // Calculate scale to fit dialog
    const dialogScale = Math.min(
      cardDisplayConfig.cardDisplayWidth / 124,
      cardDisplayConfig.cardDisplayHeight / 184
    );
    
    // Create image with fallback
    let cardImage;
    try {
      cardImage = scene.add.image(cardX, cardsY, cardImageId);
      cardImage.setScale(dialogScale);
    } catch (error) {
      console.warn(`Image ${cardImageId} not found, creating placeholder`);
      cardImage = scene.add.graphics();
      cardImage.fillStyle(0x444444);
      cardImage.fillRoundedRect(cardX - 60, cardsY - 84, 120, 168, 8);
      cardImage.lineStyle(2, 0x666666);
      cardImage.strokeRoundedRect(cardX - 60, cardsY - 84, 120, 168, 8);
      
      // Add text
      const placeholderText = scene.add.text(cardX, cardsY, displayCardId || 'Unknown', {
        fontSize: '12px',
        fontFamily: 'Arial',
        fill: '#ffffff',
        align: 'center',
        wordWrap: { width: 100 }
      });
      placeholderText.setOrigin(0.5);
      placeholderText.setDepth(1505);
      
      // Group them together
      const group = scene.add.group([cardImage, placeholderText]);
      return group;
    }
    
    cardImage.setDepth(1504);
    return cardImage;
  }

  /**
   * Prepare card data for display in dialog
   * @private
   */
  static _prepareCardDataForDisplay(cardImageId, displayCardId, originalCard = null) {
    // Base card data structure
    let cardData = {
      id: cardImageId,
      name: displayCardId || cardImageId,
      hp: 0,
      ap: 0,
      description: '',
      type: 'unknown'
    };
    
    // Use original card data if available
    if (originalCard) {
      if (originalCard.cardData) {
        cardData = { ...cardData, ...originalCard.cardData };
      }
      
      // Override with current stats if available
      if (originalCard.currentHP !== undefined) {
        cardData.hp = originalCard.currentHP;
      }
      if (originalCard.currentAP !== undefined) {
        cardData.ap = originalCard.currentAP;
      }
    }
    
    return cardData;
  }

  /**
   * Setup card interaction based on card type
   * @private
   */
  static _setupCardInteraction(scene, card, cardElement, displayCardId, selectionState, cardX, cardsY, cardDisplayConfig, dialogElements) {
    if (!cardElement) {
      console.warn('No card element provided for interaction setup');
      return;
    }
    // Determine if this is a slot container (unit+pilot) or regular card
    const isSlotContainer = cardElement.type === 'Container' && cardElement.slotData;
    
    if (isSlotContainer) {
      this._setupSlotContainerInteraction(scene, card, cardElement, selectionState, cardX, cardsY, cardDisplayConfig, dialogElements);
    } else {
      this._setupRegularCardInteraction(scene, card, cardElement, selectionState, cardX, cardsY, cardDisplayConfig, dialogElements);
    }
  }

  /**
   * Setup interaction for slot containers (unit + pilot combinations)
   * @private
   */
  static _setupSlotContainerInteraction(scene, card, slotContainer, selectionState, cardX, cardsY, cardDisplayConfig, dialogElements) {
    // Set up proper interactive area for the container - include extra height for total AP/HP labels
    const interactiveWidth = cardDisplayConfig.cardDisplayWidth;
    const extraHeight = 25; // Match the extra height from card container background
    const interactiveHeight = cardDisplayConfig.cardDisplayHeight + extraHeight;
    
    slotContainer.setInteractive(
      new Phaser.Geom.Rectangle(-interactiveWidth/2, -interactiveHeight/2, interactiveWidth, interactiveHeight), 
      Phaser.Geom.Rectangle.Contains
    );
    
    // Create shared hover effect management with animation
    const showContainerHoverEffect = () => {
      if (!slotContainer.hoverEffect) {
        slotContainer.hoverEffect = scene.add.graphics();
        slotContainer.hoverEffect.lineStyle(3, 0x00ff00, 0.8);
        slotContainer.hoverEffect.strokeRoundedRect(
          -interactiveWidth/2 - 2, 
          -interactiveHeight/2 - 2, 
          interactiveWidth + 4, 
          interactiveHeight + 4, 
          8
        );
        slotContainer.hoverEffect.setDepth(1505);
        slotContainer.hoverEffect.setAlpha(0);
        slotContainer.add(slotContainer.hoverEffect);
        
        // Animate the hover effect in
        scene.tweens.add({
          targets: slotContainer.hoverEffect,
          alpha: 0.8,
          duration: 200,
          ease: 'Power2.easeOut'
        });
      }
      scene.game.canvas.style.cursor = 'pointer';
    };
    
    const hideContainerHoverEffect = () => {
      if (slotContainer.hoverEffect) {
        // Animate out before destroying
        scene.tweens.add({
          targets: slotContainer.hoverEffect,
          alpha: 0,
          duration: 150,
          ease: 'Power2.easeIn',
          onComplete: () => {
            if (slotContainer.hoverEffect) {
              slotContainer.hoverEffect.destroy();
              slotContainer.hoverEffect = null;
            }
          }
        });
      }
      scene.game.canvas.style.cursor = 'default';
    };
    
    // Handle container selection
    const handleContainerSelection = () => {
      console.log('Slot container selected:', card);
      this._handleCardSelection(card, cardX, cardsY, selectionState, cardDisplayConfig, dialogElements);
    };
    
    // Set up container events
    slotContainer.on('pointerover', showContainerHoverEffect);
    slotContainer.on('pointerout', hideContainerHoverEffect);
    slotContainer.on('pointerdown', handleContainerSelection);
  }

  /**
   * Setup interaction for regular cards
   * @private
   */
  static _setupRegularCardInteraction(scene, card, cardComponent, selectionState, cardX, cardsY, cardDisplayConfig, dialogElements) {
    if (!cardComponent.setInteractive) {
      console.warn('Card component does not support setInteractive');
      return;
    }

    cardComponent.setInteractive();
    
    // Create hover frame highlighting functions with animation - match taller container background
    const showRegularCardHoverEffect = () => {
      if (!cardComponent.hoverEffect) {
        cardComponent.hoverEffect = scene.add.graphics();
        cardComponent.hoverEffect.lineStyle(3, 0x00ff00, 0.8);
        const extraHeight = 25; // Match the extra height from card container background
        // Match the centered positioning of the card container background
        const adjustedY = cardsY - cardDisplayConfig.cardDisplayHeight/2 - (extraHeight / 2);
        cardComponent.hoverEffect.strokeRoundedRect(
          cardX - cardDisplayConfig.cardDisplayWidth/2 - 2, 
          adjustedY - 2, 
          cardDisplayConfig.cardDisplayWidth + 4, 
          cardDisplayConfig.cardDisplayHeight + extraHeight + 4, 
          8
        );
        cardComponent.hoverEffect.setDepth(1505);
        cardComponent.hoverEffect.setAlpha(0);
        dialogElements.cardListElements.push(cardComponent.hoverEffect);
        
        // Animate the hover effect in
        scene.tweens.add({
          targets: cardComponent.hoverEffect,
          alpha: 0.8,
          duration: 200,
          ease: 'Power2.easeOut'
        });
      }
      scene.game.canvas.style.cursor = 'pointer';
    };
    
    const hideRegularCardHoverEffect = () => {
      if (cardComponent.hoverEffect) {
        // Animate out before destroying
        scene.tweens.add({
          targets: cardComponent.hoverEffect,
          alpha: 0,
          duration: 150,
          ease: 'Power2.easeIn',
          onComplete: () => {
            if (cardComponent.hoverEffect) {
              cardComponent.hoverEffect.destroy();
              cardComponent.hoverEffect = null;
            }
          }
        });
      }
      scene.game.canvas.style.cursor = 'default';
    };
    
    // Handle card selection
    const handleRegularCardSelection = () => {
      console.log('Regular card selected:', card);
      this._handleCardSelection(card, cardX, cardsY, selectionState, cardDisplayConfig, dialogElements);
    };
    
    // Set up card events
    cardComponent.on('pointerover', showRegularCardHoverEffect);
    cardComponent.on('pointerout', hideRegularCardHoverEffect);
    cardComponent.on('pointerdown', handleRegularCardSelection);
  }

  /**
   * Handle card selection logic
   * @private
   */
  static _handleCardSelection(card, cardX, cardsY, selectionState, cardDisplayConfig, dialogElements) {
    const cardId = this._getCardIdentifier(card);
    
    if (selectionState.maxSelections === 1) {
      // Single selection mode
      const currentSelectedId = selectionState.selectedCard ? this._getCardIdentifier(selectionState.selectedCard) : null;
      const isCurrentlySelected = currentSelectedId === cardId;
      
      if (isCurrentlySelected) {
        // Deselect the currently selected card
        if (selectionState.selectedCardHighlight) {
          selectionState.selectedCardHighlight.destroy();
          selectionState.selectedCardHighlight = null;
        }
        selectionState.selectedCard = null;
        selectionState.selectedCards = [];
        selectionState.selectedCardHighlights = [];
        console.log('Card deselected (single):', cardId);
      } else {
        // Clear any previous selection first
        if (selectionState.selectedCardHighlight) {
          selectionState.selectedCardHighlight.destroy();
          selectionState.selectedCardHighlight = null;
        }
        
        // Select the new card
        selectionState.selectedCard = card;
        selectionState.selectedCards = [card];
        
        // Create selection highlight
        selectionState.selectedCardHighlight = this._createSelectionHighlight(cardX, cardsY, cardDisplayConfig, dialogElements);
        selectionState.selectedCardHighlights = [selectionState.selectedCardHighlight];
        console.log('Card selected (single):', cardId);
      }
    } else {
      // Multiple selection mode
      const index = selectionState.selectedCards.findIndex(c => this._getCardIdentifier(c) === cardId);
      
      if (index > -1) {
        // Deselect card
        selectionState.selectedCards.splice(index, 1);
        const highlight = selectionState.selectedCardHighlights.splice(index, 1)[0];
        if (highlight) {
          highlight.destroy();
          const elementIndex = dialogElements.cardListElements.indexOf(highlight);
          if (elementIndex > -1) {
            dialogElements.cardListElements.splice(elementIndex, 1);
          }
        }
        console.log('Card deselected (multiple):', cardId);
      } else {
        // Select card (if under limit)
        if (selectionState.selectedCards.length < selectionState.maxSelections) {
          selectionState.selectedCards.push(card);
          const highlight = this._createSelectionHighlight(cardX, cardsY, cardDisplayConfig, dialogElements);
          selectionState.selectedCardHighlights.push(highlight);
          console.log('Card selected (multiple):', cardId);
        } else {
          console.log('Maximum selections reached:', selectionState.maxSelections);
        }
      }
      
      // Update legacy compatibility
      selectionState.selectedCard = selectionState.selectedCards.length > 0 ? selectionState.selectedCards[0] : null;
      selectionState.selectedCardHighlight = selectionState.selectedCardHighlights.length > 0 ? selectionState.selectedCardHighlights[0] : null;
    }
  }

  /**
   * Creates selection highlight for a card - matches taller container background
   * @private
   */
  static _createSelectionHighlight(cardX, cardsY, cardDisplayConfig, dialogElements) {
    const highlight = dialogElements.cardSection.background.add.graphics();
    highlight.lineStyle(4, 0x00ff00);
    const extraHeight = 25; // Match the extra height from card container background
    // Match the centered positioning of the card container background
    const adjustedY = cardsY - cardDisplayConfig.cardDisplayHeight/2 - (extraHeight / 2);
    highlight.strokeRoundedRect(
      cardX - cardDisplayConfig.cardDisplayWidth/2 - 2, 
      adjustedY - 2, 
      cardDisplayConfig.cardDisplayWidth + 4, 
      cardDisplayConfig.cardDisplayHeight + extraHeight + 4, 
      10
    );
    highlight.setDepth(1506);
    dialogElements.cardListElements.push(highlight);
    return highlight;
  }

  /**
   * Get card identifier for comparison
   * @private
   */
  static _getCardIdentifier(card) {
    return card.cardUid || card.cardId || card.id || card.displayCardId || 'unknown';
  }

  /**
   * Create button section
   * @private
   */
  static _createButtonSection(scene, selectionId, selection, config, selectionState, dialogElements, updateOKButtonState, onConfirm) {
    dialogElements.buttonSection = {};
    
    // Create OK and Cancel buttons
    const buttonY = config.centerY + config.dialogHeight/2 - 50;
    
    // OK Button
    const okButton = scene.add.graphics();
    okButton.fillStyle(0x4CAF50);
    okButton.fillRoundedRect(config.centerX - 120, buttonY - 17, 100, 35, 8);
    okButton.setDepth(1502);
    okButton.setInteractive(new Phaser.Geom.Rectangle(config.centerX - 120, buttonY - 17, 100, 35), Phaser.Geom.Rectangle.Contains);
    
    const okText = scene.add.text(config.centerX - 70, buttonY, 'CONFIRM', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    okText.setOrigin(0.5);
    okText.setDepth(1503);
    
    // Cancel Button
    const cancelButton = scene.add.graphics();
    cancelButton.fillStyle(0xf44336);
    cancelButton.fillRoundedRect(config.centerX + 20, buttonY - 17, 100, 35, 8);
    cancelButton.setDepth(1502);
    cancelButton.setInteractive(new Phaser.Geom.Rectangle(config.centerX + 20, buttonY - 17, 100, 35), Phaser.Geom.Rectangle.Contains);
    
    const cancelText = scene.add.text(config.centerX + 70, buttonY, 'CANCEL', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    cancelText.setOrigin(0.5);
    cancelText.setDepth(1503);
    
    dialogElements.buttonSection.okButton = okButton;
    dialogElements.buttonSection.okText = okText;
    dialogElements.buttonSection.cancelButton = cancelButton;
    dialogElements.buttonSection.cancelText = cancelText;
    
    // Set up button events
    this._setupOKButtonEvents(scene, selectionId, selection, selectionState, dialogElements, onConfirm);
    this._setupCancelButtonEvents(scene, dialogElements);
  }

  /**
   * Setup OK button events
   * @private
   */
  static _setupOKButtonEvents(scene, selectionId, selection, selectionState, dialogElements, onConfirm) {
    const okButton = dialogElements.buttonSection.okButton;
    
    okButton.on('pointerover', () => {
      if (selectionState.maxSelections === 0 || selectionState.selectedCards.length >= 1) {
        okButton.setTint(0x66BB6A);
        scene.input.setDefaultCursor('pointer');
      }
    });
    
    okButton.on('pointerout', () => {
      this._updateOKButtonState(selectionState, dialogElements);
      scene.input.setDefaultCursor('default');
    });
    
    okButton.on('pointerdown', () => {
      if (selectionState.maxSelections === 0 || selectionState.selectedCards.length >= 1) {
        this._cleanupDialog(scene, dialogElements);
        this._enableMainGameCardInteractions(scene);
        onConfirm(selectionId, selectionState.selectedCards, []);
      }
    });
  }

  /**
   * Setup Cancel button events
   * @private
   */
  static _setupCancelButtonEvents(scene, dialogElements) {
    const cancelButton = dialogElements.buttonSection.cancelButton;
    
    cancelButton.on('pointerover', () => {
      cancelButton.setTint(0xf66659);
      scene.input.setDefaultCursor('pointer');
    });
    
    cancelButton.on('pointerout', () => {
      cancelButton.setTint(0xf44336);
      scene.input.setDefaultCursor('default');
    });
    
    cancelButton.on('pointerdown', () => {
      this._cleanupDialog(scene, dialogElements);
      this._enableMainGameCardInteractions(scene);
      scene.events.emit('dialog-cancelled');
    });
  }

  /**
   * Update OK button state based on selection
   * @private
   */
  static _updateOKButtonState(selectionState, dialogElements) {
    const okButton = dialogElements.buttonSection.okButton;
    const okText = dialogElements.buttonSection.okText;
    
    if (!okButton || !okText) return;
    
    // Handle read-only mode (selectCount: 0)
    if (selectionState.maxSelections === 0) {
      okButton.setTint(0x4CAF50);
      okText.setText('CLOSE');
      return;
    }
    
    if (selectionState.selectedCards.length >= 1) {
      okButton.setTint(0x4CAF50);
      if (selectionState.maxSelections > 1) {
        okText.setText(`CONFIRM (${selectionState.selectedCards.length}/${selectionState.maxSelections})`);
      } else {
        okText.setText('CONFIRM');
      }
    } else {
      okButton.setTint(0x888888);
      if (selectionState.maxSelections > 1) {
        okText.setText(`SELECT ${selectionState.maxSelections} CARDS`);
      } else {
        okText.setText('SELECT CARD');
      }
    }
  }

  // Add remaining utility methods for pagination, animation, etc.
  static _updatePaginationVisibility(paginationState, dialogElements) {
    // Simple implementation
    if (dialogElements.paginationElements) {
      const leftArrow = dialogElements.paginationElements.leftArrow;
      const rightArrow = dialogElements.paginationElements.rightArrow;
      
      if (leftArrow) leftArrow.setAlpha(paginationState.currentPage > 0 ? 1 : 0.3);
      if (rightArrow) rightArrow.setAlpha(paginationState.currentPage < paginationState.totalPages - 1 ? 1 : 0.3);
    }
  }

  static _setupPaginationEvents(scene, paginationState, dialogElements, updateCardDisplay) {
    // Simple implementation
    if (dialogElements.paginationElements) {
      const leftArrow = dialogElements.paginationElements.leftArrow;
      const rightArrow = dialogElements.paginationElements.rightArrow;
      
      if (leftArrow) {
        leftArrow.on('pointerdown', () => {
          if (paginationState.currentPage > 0) {
            paginationState.currentPage--;
            updateCardDisplay('left');
          }
        });
      }
      
      if (rightArrow) {
        rightArrow.on('pointerdown', () => {
          if (paginationState.currentPage < paginationState.totalPages - 1) {
            paginationState.currentPage++;
            updateCardDisplay('right');
          }
        });
      }
    }
  }

  static _animateCardsOut(scene, cardElements, direction) {
    return Promise.resolve(); // Simplified for now
  }

  static _animateCardIn(scene, cardElement, cardContainer, cardX, cardsY, direction, index) {
    // Simplified animation
    if (cardElement && cardElement.setAlpha) {
      cardElement.setAlpha(0);
      scene.tweens.add({
        targets: cardElement,
        alpha: 1,
        duration: 300,
        delay: index * 100,
        ease: 'Power2.easeOut'
      });
    }
  }
}