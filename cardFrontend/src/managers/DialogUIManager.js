// DialogUIManager.js
// Specialized UI manager for dialog creation, interaction, and rendering
// Extracted from GameSceneUtils.js for better code organization

import Card from '../components/Card.js';
import SlotAreaManager from '../components/SlotAreaManager.js';
import CardStatCalculator from '../utils/CardStatCalculator.js';
import CardFactory from '../utils/CardFactory.js';
import CardInteractionHelper from '../utils/CardInteractionHelper.js';
import UIGraphicsHelper from '../utils/UIGraphicsHelper.js';

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
   * Creates a unified slot selection dialog with pagination and interactive elements
   * 
   * SELECTION STRUCTURE - All dialogs must provide eligibleCards:
   * 
   * @param {Object} selection - Selection configuration object with the following structure:
   * {
   *   // REQUIRED: Pre-resolved eligibleCards array
   *   eligibleCards: [
   *     { type: "slot", cardId, cardUid, displayName, cardData, zone, playerId, isSlotTarget, unit, pilot, totalAP, totalHP, selectionIndex },
   *     { type: "carduid", cardId, cardUid, displayName, cardData, selectionIndex, preSelected }
   *   ],
   *   
   *   // REQUIRED: Selection behavior
   *   selectCount: 1,              // Number of cards user must select (0 for read-only)
   *   
   *   // REQUIRED: Dialog display
   *   title: 'Select Target',      // Dialog title
   *   description: 'Choose...',    // Dialog description
   *   
   *   // REQUIRED: Callback function
   *   callback: (selectionId, selectedCards) => { ... },
   *   
   *   // OPTIONAL: Dialog behavior
   *   dialogType: 'SELECT_UNIT_FOR_PILOT' | 'SELECT_ATTACK_TARGET' | 'DEPLOY_TARGET_CHOICE' | 'BURST_EFFECT_CHOICE',
   *   autoSelectFirst: false,      // Auto-select first card
   *   numberOfSections: 1,         // UI sections (legacy)
   *   
   *   // OPTIONAL: Custom buttons (if not provided, uses OK/Cancel)
   *   buttons: ['ACTIVATE', 'SKIP']
   * }
   * 
   * CALLING PATTERN: 
   * 
   * // Using pre-resolved eligibleCards (only supported format)
   * DialogUIManager.createCardSelectionDialog(selectionId, { eligibleCards, ... }, scene, onConfirm, onCancel);
   * 
   * @param {string} selectionId - Unique identifier for the selection
   * @param {Object} selection - Selection configuration object
   * @param {Phaser.Scene} scene - Phaser scene instance
   * @param {Function} onConfirm - Callback when user confirms selection
   * @param {Function} onCancel - Optional callback when user cancels dialog (default: null)
   * @returns {Object} Dialog interface with cleanup method
   */
  static createCardSelectionDialog(selectionId, selection, scene, onConfirm, onCancel = null, isAllowCancel=true) {
    console.log('🎮 DialogUIManager: Creating card selection dialog');
    console.log('Selection ID:', selectionId);
    console.log('Selection config1111:', JSON.stringify(selection));

    // Only support eligibleCards format
    if (!selection.eligibleCards || !Array.isArray(selection.eligibleCards)) {
      console.warn('DialogUIManager: selection must provide eligibleCards array');
      return { elements: [], cleanup: () => { } };
    }
    const gameState = scene.gameStateManager.getGameState();
    console.log("adsfdsadsasd as",JSON.stringify(selection.eligibleCards))
    const eligibleCards =  this._resolveItems(selection.eligibleCards, gameState);
    selection.eligibleCards = eligibleCards
    console.log("adsfdsadsasd as1111",JSON.stringify(eligibleCards))
    console.log('📦 Using provided eligibleCards:', eligibleCards.length, 'cards');

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
      this._createButtonSection(scene, 
        selectionId, 
        selection, 
        config, 
        selectionState, 
        dialogElements, () => { }, 
        onConfirm, 
        onCancel);
      updateOKButtonState = () => this._updateConfigurableButtonState(selectionState, dialogElements, buttonConfig);
    } else {
      // Default OK/Cancel buttons
      this._createButtonSection(scene, 
        selectionId, 
        selection, 
        config, 
        selectionState, 
        dialogElements, (state, elements) => {
          this._updateOKButtonState(state, elements);
        }, 
        onConfirm, 
        onCancel);
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
      config.centerX - config.dialogWidth / 2,
      config.centerY - config.dialogHeight / 2,
      config.dialogWidth,
      config.dialogHeight,
      15
    );
    background.lineStyle(3, 0x4a4a4a);
    background.strokeRoundedRect(
      config.centerX - config.dialogWidth / 2,
      config.centerY - config.dialogHeight / 2,
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
      centerY: config.centerY - config.dialogHeight / 2 + 50
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
      config.centerX - cardSection.width / 2,
      cardSection.centerY - cardSection.height / 2,
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
      config.centerX - config.dialogWidth / 2 + 40, dialogElements.cardSection.centerY,
      config.centerX - config.dialogWidth / 2 + 65, dialogElements.cardSection.centerY - 15,
      config.centerX - config.dialogWidth / 2 + 65, dialogElements.cardSection.centerY + 15
    );
    dialogElements.paginationElements.leftArrow.setDepth(1504);
    dialogElements.paginationElements.leftArrow.setInteractive(new Phaser.Geom.Rectangle(
      config.centerX - config.dialogWidth / 2 + 30, dialogElements.cardSection.centerY - 20, 45, 40
    ), Phaser.Geom.Rectangle.Contains);

    // Right arrow
    dialogElements.paginationElements.rightArrow = scene.add.graphics();
    dialogElements.paginationElements.rightArrow.fillStyle(0x888888);
    dialogElements.paginationElements.rightArrow.fillTriangle(
      config.centerX + config.dialogWidth / 2 - 40, dialogElements.cardSection.centerY,
      config.centerX + config.dialogWidth / 2 - 65, dialogElements.cardSection.centerY - 15,
      config.centerX + config.dialogWidth / 2 - 65, dialogElements.cardSection.centerY + 15
    );
    dialogElements.paginationElements.rightArrow.setDepth(1504);
    dialogElements.paginationElements.rightArrow.setInteractive(new Phaser.Geom.Rectangle(
      config.centerX + config.dialogWidth / 2 - 75, dialogElements.cardSection.centerY - 20, 45, 40
    ), Phaser.Geom.Rectangle.Contains);

    // Page text
    dialogElements.paginationElements.pageText = scene.add.text(
      config.centerX, dialogElements.cardSection.centerY + dialogElements.cardSection.height / 2 - 30,
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
    const extraHeight = 40; // Additional height for total AP/HP labels
    // Center the extra height: move Y position up by half the extra height to keep visual center aligned
    const adjustedY = cardsY - cardDisplayConfig.cardDisplayHeight / 2 - (extraHeight / 2);
    cardContainer.fillRoundedRect(cardX - cardDisplayConfig.cardDisplayWidth / 2, adjustedY, cardDisplayConfig.cardDisplayWidth, cardDisplayConfig.cardDisplayHeight + extraHeight, 8);
    cardContainer.lineStyle(2, 0x666666);
    cardContainer.strokeRoundedRect(cardX - cardDisplayConfig.cardDisplayWidth / 2, adjustedY, cardDisplayConfig.cardDisplayWidth, cardDisplayConfig.cardDisplayHeight + extraHeight, 8);
    cardContainer.setDepth(1503);
    dialogElements.cardListElements.push(cardContainer);

    // Extract card display info and create card element (can be Card component or Container)
    const { cardImageId, displayCardId } = this._extractCardDisplayInfo(card);
    console.log("card item 1111111 ", JSON.stringify(card))
    const cardElement = this._createCardDisplay(scene, cardX, cardsY, cardImageId, displayCardId, cardDisplayConfig, card);
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
   * Creates card display element (individual card or slot combination)
   * @private
   */
  static _createCardDisplay(scene, cardX, cardsY, cardImageId, displayCardId, cardDisplayConfig, originalCard = null) {
    // Check if this is a slot target (unit + pilot combination)
    if (originalCard && originalCard.isSlotTarget) {
      return this._createSlotTargetDisplay(scene, cardX, cardsY, cardDisplayConfig, originalCard);
    }

    // Create dialog card using CardFactory
    try {
      // Calculate appropriate scale for dialog display
      const dialogScale = Math.min(
        (cardDisplayConfig.cardDisplayWidth - 16) / 124,  // Card width is 124px by default
        (cardDisplayConfig.cardDisplayHeight - 16) / 184  // Card height is 184px by default
      );

      // Determine what data to pass to Card component
      let cardDataForDisplay;

      // Handle different card structures
      if (originalCard && originalCard.unit) {
        // Card object with unit property (from ItemDataResolver slot targets)
        cardDataForDisplay = originalCard.unit;
      } else if (originalCard && originalCard.cardData) {
        // Direct card object with cardData property
        cardDataForDisplay = originalCard;
      } else if (originalCard && originalCard.id) {
        // Direct cardData format
        cardDataForDisplay = originalCard;
      } else {
        // Fallback to original card
        cardDataForDisplay = originalCard;
      }

      // ✅ Use CardFactory for consistent dialog card creation
      const cardComponent = CardFactory.createDialogCard(scene, cardDataForDisplay, cardX, cardsY, {
        dialogScale: dialogScale,
        // ✅ CENTRALIZED: Use CardStatCalculator for consistent total calculation
        totalAP: (originalCard && originalCard.type === "slot" && originalCard.totalAP !== undefined) ? 
          originalCard.totalAP : 
          (originalCard && originalCard.type === "slot") ? 
            CardStatCalculator.calculateTotalAP(cardDataForDisplay) : undefined,
        totalHP: (originalCard && originalCard.type === "slot" && originalCard.totalHP !== undefined) ? 
          originalCard.totalHP : 
          (originalCard && originalCard.type === "slot") ? 
            CardStatCalculator.calculateTotalHP(cardDataForDisplay) : undefined
      });

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

    // Create pilot card if present (positioned below unit with extra spacing)
    let pilotCard = null;
    if (slotTarget.pilot) {
      // ✅ Use CardFactory for consistent pilot card creation
      pilotCard = CardFactory.createDialogCard(scene, slotTarget.pilot, 0, 23, {
        dialogScale: dialogScale,
        interactive: true // Container will handle interaction
      });
      slotContainer.add(pilotCard);
    }

    // Create unit card (always present) - center if no pilot, otherwise position at top with extra spacing
    const unitY = slotTarget.pilot ? -20 : 0; // Add extra spacing when pilot present
    // ✅ Use CardFactory for consistent unit card creation
    const unitCard = CardFactory.createDialogCard(scene, slotTarget.unit, 0, unitY, {
      dialogScale: dialogScale,
      interactive: false // Container will handle interaction
    });

    slotContainer.add(unitCard);

    // ✅ FIXED: Always show total labels for slot target displays, even unit-only
    // Use CardStatCalculator for proper total calculation or provided values
    let totalAP, totalHP;
    if (slotTarget.totalAP !== undefined && slotTarget.totalHP !== undefined) {
      // Use provided totals (already calculated)
      totalAP = slotTarget.totalAP;
      totalHP = slotTarget.totalHP;
    } else {
      // Calculate totals using CardStatCalculator (handles unit+pilot combinations properly)
      const totals = CardStatCalculator.calculateTotalInSlot(slotTarget.unit, slotTarget.pilot);
      totalAP = totals.totalAP;
      totalHP = totals.totalHP;
    }
    
    // Use SlotAreaManager method for unit+pilot total label configuration
    SlotAreaManager.configureSlotTotalLabels(unitCard, pilotCard, totalAP, totalHP);

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
    const extraHeight = 40; // Match the extra height from card container background
    const interactiveHeight = cardDisplayConfig.cardDisplayHeight + extraHeight;

    slotContainer.setInteractive(
      new Phaser.Geom.Rectangle(-interactiveWidth / 2, -interactiveHeight / 2, interactiveWidth, interactiveHeight),
      Phaser.Geom.Rectangle.Contains
    );

    // ✅ REFACTORED: Use CardInteractionHelper for slot container interaction
    const handleContainerSelection = () => {
      console.log('Slot container selected:', card);
      this._handleCardSelection(card, cardX, cardsY, selectionState, cardDisplayConfig, dialogElements);
    };

    // Use CardInteractionHelper to set up slot container interaction
    CardInteractionHelper.setupSlotContainerInteraction(scene, slotContainer, {
      width: interactiveWidth,
      height: interactiveHeight,
      unitCard: slotContainer.unitCard,
      pilotCard: slotContainer.pilotCard,
      onSelection: handleContainerSelection
    });
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

    // ✅ REFACTORED: Use CardInteractionHelper for regular card interaction
    
    // Determine card data for preview based on card type
    let cardDataForPreview;
    switch (card.type) {
      case "slot":
        // For slot cards, show the unit card data
        cardDataForPreview = card.unit;
        break;
      case "carduid":
      case "trash":
        // For carduid and trash cards, show the card data directly
        cardDataForPreview = card.cardData;
        break;
      default:
        // Fallback for cards without type or unknown types
        cardDataForPreview = card.cardData || card;
        break;
    }

    // Handle card selection
    const handleRegularCardSelection = () => {
      console.log('Regular card selected:', card);
      this._handleCardSelection(card, cardX, cardsY, selectionState, cardDisplayConfig, dialogElements);
    };

    // Calculate hover effect dimensions - match taller container background
    const extraHeight = 40;
    const adjustedY = cardsY - cardDisplayConfig.cardDisplayHeight / 2 - (extraHeight / 2);
    const hoverWidth = cardDisplayConfig.cardDisplayWidth + 4;
    const hoverHeight = cardDisplayConfig.cardDisplayHeight + extraHeight + 4;

    // Create hover effect with CardInteractionHelper
    const hoverOptions = {
      x: cardX,
      y: adjustedY + hoverHeight / 2, // Center the hover effect vertically
      width: hoverWidth,
      height: hoverHeight
    };

    const previewOptions = {
      type: 'single',
      cardData: cardDataForPreview
    };

    const { showHover, hideHover } = CardInteractionHelper.createHoverWithPreview(
      scene, 
      cardComponent, 
      hoverOptions, 
      previewOptions
    );

    // Custom hover functions to handle dialog elements tracking
    const showWithElementTracking = () => {
      showHover();
      // Add hover effect to dialog elements for cleanup
      if (cardComponent.hoverEffect && !dialogElements.cardListElements.includes(cardComponent.hoverEffect)) {
        dialogElements.cardListElements.push(cardComponent.hoverEffect);
      }
    };

    const hideWithElementTracking = () => {
      hideHover();
      // Additional cleanup handled by CardInteractionHelper
    };

    // Set up card events using CardInteractionHelper
    CardInteractionHelper.attachInteractionEvents(
      cardComponent,
      showWithElementTracking,
      hideWithElementTracking,
      handleRegularCardSelection,
      { setInteractive: false } // Already set interactive above
    );
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
    // ✅ REFACTORED: Use UIGraphicsHelper for selection highlight
    const extraHeight = 40; // Match the extra height from card container background
    const adjustedY = cardsY - cardDisplayConfig.cardDisplayHeight / 2 - (extraHeight / 2);
    const highlightWidth = cardDisplayConfig.cardDisplayWidth + 4;
    const highlightHeight = cardDisplayConfig.cardDisplayHeight + extraHeight + 4;

    const highlight = UIGraphicsHelper.createHoverEffect(dialogElements.cardSection.background, {
      x: cardX,
      y: adjustedY + highlightHeight / 2, // Center vertically
      width: highlightWidth,
      height: highlightHeight,
      color: 0x00ff00,
      lineWidth: 3, // ✅ FIXED: Match hover highlight line width
      alpha: 1.0, // Selection highlight is fully visible (intentionally different from hover)
      radius: 8, // ✅ FIXED: Match hover highlight corner radius
      depth: 1506, // Keep higher depth for selection (intentionally different)
      padding: 2 // ✅ FIXED: Match hover highlight padding
    });

    // Set fully visible for selection highlight (not animated like hover)
    highlight.setAlpha(1.0);
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
  static _createButtonSection(scene, selectionId, selection, config, selectionState, dialogElements, updateOKButtonState, onConfirm, onCancel) {
    dialogElements.buttonSection = {};

    // Create OK and Cancel buttons
    const buttonY = config.centerY + config.dialogHeight / 2 - 50;

    // ✅ REFACTORED: Use UIGraphicsHelper for OK button
    const okButton = UIGraphicsHelper.createButton(scene, {
      x: config.centerX - 120,
      y: buttonY,
      width: 100,
      height: 35,
      color: 0x4CAF50,
      depth: 1502,
      isOKButton: true
    });
    okButton.setInteractive(new Phaser.Geom.Rectangle(config.centerX - 120, buttonY - 17, 100, 35), Phaser.Geom.Rectangle.Contains);

    const okText = scene.add.text(config.centerX - 70, buttonY, 'CONFIRM', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    okText.setOrigin(0.5);
    okText.setDepth(1503);

    // ✅ REFACTORED: Use UIGraphicsHelper for Cancel button
    const cancelButton = UIGraphicsHelper.createButton(scene, {
      x: config.centerX + 20,
      y: buttonY,
      width: 100,
      height: 35,
      color: 0xf44336,
      depth: 1502,
      isOKButton: false
    });
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
    this._setupCancelButtonEvents(scene, selectionId, dialogElements, onCancel);
  }

  /**
   * Setup OK button events
   * @private
   */
  static _setupOKButtonEvents(scene, selectionId, selection, selectionState, dialogElements, onConfirm) {
    const okButton = dialogElements.buttonSection.okButton;

    okButton.on('pointerover', () => {
      if (selectionState.maxSelections === 0 || selectionState.selectedCards.length >= 1) {
        UIGraphicsHelper.setButtonColor(okButton, 0x66BB6A);
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
  static _setupCancelButtonEvents(scene, selectionId, dialogElements, onCancel) {
    const cancelButton = dialogElements.buttonSection.cancelButton;

    cancelButton.on('pointerover', () => {
      UIGraphicsHelper.setButtonColor(cancelButton, 0xf66659);
      scene.input.setDefaultCursor('pointer');
    });

    cancelButton.on('pointerout', () => {
      UIGraphicsHelper.setButtonColor(cancelButton, 0xf44336);
      scene.input.setDefaultCursor('default');
    });

    cancelButton.on('pointerdown', () => {
      // ✅ ENHANCED: Call dedicated onCancel callback if provided
      if (onCancel) {
        console.log('DialogUIManager: Calling dedicated cancel callback');
        onCancel({
          reason: 'user_cancelled',
          selectionId: selectionId,
          timestamp: Date.now(),
          dialogType: 'card_selection'
        });
      }
      
      this._cleanupDialog(scene, dialogElements);
      this._enableMainGameCardInteractions(scene);
      
      // Still emit the original event for backward compatibility
      scene.events.emit('dialog-cancelled', selectionId);
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
      UIGraphicsHelper.setButtonColor(okButton, 0x4CAF50);
      okText.setText('CLOSE');
      return;
    }

    if (selectionState.selectedCards.length >= 1) {
      UIGraphicsHelper.setButtonColor(okButton, 0x4CAF50);
      if (selectionState.maxSelections > 1) {
        okText.setText(`CONFIRM (${selectionState.selectedCards.length}/${selectionState.maxSelections})`);
      } else {
        okText.setText('CONFIRM');
      }
    } else {
      UIGraphicsHelper.setButtonColor(okButton, 0x888888);
      if (selectionState.maxSelections > 1) {
        okText.setText(`SELECT ${selectionState.maxSelections} CARDS`);
      } else {
        okText.setText('SELECT CARD');
      }
    }
  }

  // ✅ REMOVED: _setButtonColor method replaced by UIGraphicsHelper.setButtonColor

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

    // ============ INTERNAL ITEM RESOLUTION ============

  /**
   * Internal method to resolve items to eligibleCards format
   * @private
   * @param {Array} items - Array of item specifications
   * @param {Object} gameState - Current game state from gameStateManager
   * @returns {Array} Array of card objects for dialog display
   */
  static _resolveItems(items, gameState) {
    if (!Array.isArray(items)) {
      console.warn('DialogUIManager: items must be an array');
      return [];
    }
    
    console.log('🔍 DialogUIManager: Resolving', items.length, 'items');
    
    const resolved = [];
    
    items.forEach((item, index) => {
      try {
        const result = this._resolveItem(item, gameState, index);
        if (result) {
          resolved.push(result);
          console.log(`✅ Resolved item ${index}:`, item.dialogDisplayType, result.displayName || result.cardData?.name || 'Unknown');
        }
      } catch (error) {
        console.error(`❌ Failed to resolve item ${index}:`, item, error);
      }
    });
    
    console.log(`📊 DialogUIManager: Resolved ${resolved.length} total cards from ${items.length} items`);
    return resolved;
  }

  /**
   * Resolve single item to card object
   * @private
   */
  static _resolveItem(item, gameState, index) {
    if (!item || !item.dialogDisplayType) {
      console.warn('DialogUIManager: Invalid item - missing dialogDisplayType');
      return item;
    }
    
    switch (item.dialogDisplayType) {
      case 'slot':
        return this._resolveSlot(item, gameState, index);
      default:
        return item;
    }
  }

  /**
   * Resolve slot item (player/opponent zones)
   * @private
   */
  static _resolveSlot(item, gameState, index) {
    const { playerId, zone, cardUid } = item;
    
    if (!playerId || !zone) {
      console.warn('DialogUIManager: Slot item missing playerId or zone');
      return null;
    }
    
    // Get player data
    const player = gameState.gameEnv?.players?.[playerId];
    if (!player || !player.zones) {
      console.warn(`DialogUIManager: Player ${playerId} not found or missing zones`);
      return null;
    }
    
    // Get slot data
    const slot = player.zones[zone];
    if (!slot) {
      console.log(`DialogUIManager: Empty slot ${playerId}/${zone}`);
      return null;
    }
    
    // Optional specific card filter (only if cardUid specified)
    if (cardUid && slot.unit?.cardUid !== cardUid) {
      console.log(`DialogUIManager: Slot ${zone} unit cardUid ${slot.unit?.cardUid} != ${cardUid}`);
      return null;
    }
    
    // Allow slots with unit only, pilot only, or both unit and pilot
    if (!slot.unit && !slot.pilot) {
      console.log(`DialogUIManager: Slot ${zone} is completely empty`);
      return null;
    }
    
    // Build card object for dialog display
    return this._buildSlotCard(slot, { zone, playerId, cardUid, index });
  }

  /**
   * Build slot card object with unit+pilot data
   * @private
   */
  static _buildSlotCard(slot, metadata) {
    const { zone, playerId, cardUid, index } = metadata;
    const unit = slot.unit;
    const pilot = slot.pilot;
    
    // Calculate slot-level totals (unit + pilot combined)
    const { totalAP, totalHP } = CardStatCalculator.calculateSlotDataTotals(slot);
    
    // Determine primary card for display (unit if present, otherwise pilot)
    const primaryCard = unit || pilot;
    
    // Create display name
    let displayName;
    if (unit && pilot) {
      // Both unit and pilot present
      displayName = `${unit.cardData?.name || 'Unknown Unit'} + ${pilot.cardData?.name || 'Unknown Pilot'}`;
    } else if (unit) {
      // Unit only
      displayName = unit.cardData?.name || 'Unknown Unit';
    } else if (pilot) {
      // Pilot only
      displayName = pilot.cardData?.name || 'Unknown Pilot';
    } else {
      // Fallback (should not occur due to empty slot filtering)
      displayName = 'Empty Slot';
    }
    displayName += ` (${zone.replace('slot', 'Slot ')})`;
    
    // Create minimized card object for slot selection
    const cardObject = {
      // Essential identifiers - use primary card data
      cardId: primaryCard?.cardData?.id || primaryCard?.cardUid || 'unknown',
      cardUid: primaryCard?.cardUid || 'unknown',
      type : "slot",
      // Display data
      displayName: displayName,
      cardData: primaryCard?.cardData || primaryCard, // For Card component rendering
      
      // Slot context (minimized)
      zone: zone,
      playerId: playerId,
      isSlotTarget: !!(unit && pilot), // True when both unit and pilot present
      
      // Slot data for rendering
      unit: unit || null,
      pilot: pilot || null,
      
      // Stats for display
      totalAP: totalAP,
      totalHP: totalHP,
      
      // Selection metadata
      selectionIndex: index
    };
    
    console.log(`🎯 Built slot card: ${displayName} (AP: ${totalAP}, HP: ${totalHP})`);
    return cardObject;
  }

  /**
   * Resolve cardUID item (specific card references)
   * @private
   */
  static _resolveCardUID(item, gameState, index) {
    const { cardUid, preSelected = false } = item;
    
    if (!cardUid) {
      console.warn('DialogUIManager: CardUID item missing cardUid');
      return null;
    }
    
    // Find card in game state - check multiple locations
    let cardData = null;
    let foundLocation = null;
    
    // Check all players' hands, slots, etc.
    for (const playerId in gameState.gameEnv?.players || {}) {
      const player = gameState.gameEnv.players[playerId];
      
      // Check hand
      if (player.deck?.hand) {
        const handCard = player.deck.hand.find(card => card.cardUid === cardUid);
        if (handCard) {
          cardData = handCard.cardData;
          foundLocation = `${playerId}/hand`;
          break;
        }
      }
      
      // Check slots
      if (player.zones) {
        for (const zoneName in player.zones) {
          const zone = player.zones[zoneName];
          if (zone.unit?.cardUid === cardUid) {
            cardData = zone.unit.cardData;
            foundLocation = `${playerId}/${zoneName}/unit`;
            break;
          }
          if (zone.pilot?.cardUid === cardUid) {
            cardData = zone.pilot.cardData;
            foundLocation = `${playerId}/${zoneName}/pilot`;
            break;
          }
        }
        if (cardData) break;
      }
    }
    
    if (!cardData) {
      console.warn(`DialogUIManager: Card ${cardUid} not found in game state`);
      return null;
    }
    
    console.log(`🎴 Found card ${cardUid} in ${foundLocation}: ${cardData.name}`);
    
    // Create minimized card object for cardUID selection
    return {
      cardId: cardData.id || cardUid,
      cardUid: cardUid,
      type: "carduid",
      displayName: cardData.name || 'Unknown Card',
      cardData: cardData, // For Card component rendering
      selectionIndex: index,
      preSelected: preSelected
    };
  }

}