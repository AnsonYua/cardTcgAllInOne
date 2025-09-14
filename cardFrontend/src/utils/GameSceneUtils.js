/**
 * Utility class for handling GameScene-related operations
 */
import Card from '../components/Card.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

export default class GameSceneUtils {
  /**
   * Updates zones with card data from the backend
   * @param {Object} zonesData - Zone data from the backend
   * @param {Object} zones - Zone objects from the scene
   * @param {Object} scene - The GameScene instance
   * @param {boolean} isOpponent - Whether these are opponent zones
   */
  static updatePlayerZones(zonesData, zones, scene, isOpponent = false) {
    Object.entries(zonesData).forEach(([zoneType, cardData]) => {
      const zone = zones[zoneType];
      console.log('updateZones - cardData:', zoneType, "cardData:", JSON.stringify(cardData), "zone card:", !zone.card);
        
      if (zoneType === 'leader') {
        // Handle leader zone separately if needed
        return;
      }
      
      if (zone && cardData && !zone.card && cardData.length > 0) {
        console.log("debug cardData", JSON.stringify(cardData[0].cardData));
        const cardDataObject = scene.apiZoneCardDataToCardObject(cardData[0].cardData);
        console.log("debug cardData22", JSON.stringify(cardDataObject));
        
        const cardOptions = {
          scale: 0.9,
          gameStateManager: scene.gameStateManager,
          usePreview: true,
        };
        
  
        const card = new Card(scene, zone.x, zone.y, cardDataObject, cardOptions);
        zone.card = card;
        zone.placeholder.setVisible(false);

        // Disable interaction for cards placed in zones - they should not be clickable
        card.disableInteraction();

        // Set zone placement tracking for hover preview system
        card.setZonePlacement(true, zoneType, !isOpponent);
        console.log(`[GameSceneUtils] Set zone placement for card ${cardDataObject.id}: zone=${zoneType}, isPlayer=${!isOpponent}`);

        // The Card component now handles zone hover events automatically via setupInteraction()
        // No need to manually add hover events here as Card will emit zone-card-hover/unhover events
        // which GameScene listens for and handles with the new hover preview system
      }
    });
  }

  /**
   * Updates all zones (player and opponent) with data from the backend
   * @param {Object} scene - The GameScene instance
   * @param {Object} gameStateManager - The game state manager
   */
  static updateAllZones(scene, gameStateManager) {
    const playerZones = gameStateManager.getPlayerZones();
    const opponentId = gameStateManager.getOpponent();
    const opponentZones = gameStateManager.getPlayerZones(opponentId);
    
    console.log('updateZones - playerZones:', JSON.stringify(playerZones));
    
    // Update player zones
    this.updatePlayerZones(playerZones, scene.playerZones, scene, false);
    
    // Update opponent zones
    this.updatePlayerZones(opponentZones, scene.opponentZones, scene, true);
  }

  /**
   * Checks if a card can be dropped in a specific zone
   * @param {Object} card - The card object
   * @param {string} zoneType - The zone type
   * @param {Object} scene - The GameScene instance
   * @returns {boolean} - Whether the card can be dropped
   */
  static canPlaceCardInZone(card, zoneType, scene) {
    const cardData = card.getCardData();
    // First check basic card type compatibility (local validation)
    if (!card.canPlayInZone(zoneType)) {
      return false;
    }
    
    // Then check backend field effect restrictions via GameStateManager
    if (scene.gameStateManager) {
      // Pass the current playerId to ensure field effects are checked correctly
      const playerId = scene.gameStateManager.getCurrentPlayerId();
      return scene.gameStateManager.canPlayCardInZone(cardData, zoneType, playerId);
    }
    
    // Fallback to basic validation if GameStateManager not available
    return true;
  }

  /**
   * Creates a fully functional zone with Phaser objects
   * Consolidates zone creation logic from GameScene and ZoneManager
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} type - Zone type
   * @param {boolean} isPlayerZone - Whether it's a player zone
   * @returns {Object} - Zone object with placeholder, label, and interaction
   */
  static createZone(scene, x, y, type, isPlayerZone) {
    let placeholder;
    
    // Show deck cards for deck zones, placeholder for others
    if (type === 'deck') {
      const initialDeckStack = this.createDeckStack(scene, x, y, isPlayerZone ? 'player' : 'opponent');
      placeholder = initialDeckStack[0];
      
      // Store initial deck stacks on scene
      if (isPlayerZone) {
        scene.initialPlayerDeckStack = initialDeckStack;
      } else {
        scene.initialOpponentDeckStack = initialDeckStack;
      }
    } else if (type === 'cardPreview') {
      placeholder = scene.add.image(x, y, 'zone-placeholder');
    } else if (type === 'leaderDeck') {
      placeholder = scene.add.image(x, y, 'zone-placeholder');
    } else {
      placeholder = scene.add.image(x, y, 'zone-placeholder');
    }
    
    // Zone label
    const label = scene.add.text(x, y + 95, type.toUpperCase(), {
      fontSize: '12px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    label.setOrigin(0.5);
    
    // Zone-specific styling
    if (type === 'leaderDeck') {
      placeholder.setRotation(Math.PI / 2);
      label.setAlpha(0);
      placeholder.setAlpha(0);
      label.setY(label.y - 20);
    } else if (type === 'cardPreview') {
      placeholder.setScale(3);
      placeholder.setScale(0);
      label.setAlpha(0);
    } else if (type==='base'){
      label.setAlpha(0);
      placeholder.setAlpha(0);
    } else if (type.includes("row")){
      label.setAlpha(0);
      placeholder.setScale(0.55);
      placeholder.setAlpha(0);
    } else {
      label.setAlpha(0);
      placeholder.setAlpha(0);
    }
    
    // Zone interaction (only for player zones)
    let clickZone = null;
    if (isPlayerZone) {
      clickZone = scene.add.zone(x, y, 130, 190);
      clickZone.setData('zoneType', type);
      
      // Add zone click handling for card placement when card is selected
      clickZone.setInteractive();
      clickZone.on('pointerdown', (pointer) => {
        if (scene.handleZoneClick) {
          scene.handleZoneClick(type, x, y);
        }
      });
    }
    
    return {
      placeholder,
      label,
      clickZone,
      x,
      y,
      card: null,
      type,
      isPlayerZone
    };
  }

  /**
   * Creates a deck stack visualization
   * Consolidates deck creation logic from GameScene, ZoneManager, and CardManagerHelper
   * @param {Phaser.Scene} scene - The Phaser scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} owner - 'player' or 'opponent'
   * @param {Object} options - Options for deck creation
   * @returns {Array} - Array of deck card images
   */
  static createDeckStack(scene, x, y, owner, options = {}) {
    const config = {
      numCards: 5,
      stackOffset: 0,
      scale: 0.95,
      ...options
    };
    
    const deckCards = [];
    
    for (let i = 0; i < config.numCards; i++) {
      // Ensure pixel-perfect positioning
      const cardX = Math.round(x + (i * config.stackOffset));
      const cardY = Math.round(y - (i * config.stackOffset));
      const card = scene.add.image(cardX, cardY, GAME_CONFIG.imageKey.cardback);
      
      // Scale card to match game config dimensions
      const scaleX = GAME_CONFIG.card.width / card.width;
      const scaleY = GAME_CONFIG.card.height / card.height;
      const scale = Math.min(scaleX, scaleY) * config.scale;
      card.setScale(scale);
     
      card.setDepth(i);
      card.setOrigin(0.5, 0.5);
      
      // Store mask reference for cleanup if needed
      //card.roundedMask = maskShape;
      
      deckCards.push(card);
    }
    
    return deckCards;
  }

  /**
   * Clears all zone highlights
   * @param {Object} scene - The GameScene instance
   */
  static clearZoneHighlights(scene) {
    if (scene.zoneHighlights) {
      scene.zoneHighlights.forEach(highlight => {
        highlight.destroy();
      });
      scene.zoneHighlights = [];
    }
  }

  /**
   * Shows zone highlights for a specific card
   * @param {Object} card - The card object
   * @param {Object} scene - The GameScene instance
   */
  static showZoneHighlights(card, scene) {
    // Clear any existing highlights
    this.clearZoneHighlights(scene);
    
    console.log("show screen highlight")
    // Check if it's the current player's turn and in main phase
    const currentPhase = scene.gameStateManager.getCurrentPhase();
    const isCurrentPlayer = scene.gameStateManager.isCurrentPlayer();
    
    if (!isCurrentPlayer || currentPhase !== 'MAIN_PHASE') {
      return;
    }

    // Initialize zone highlights array if not exists
    if (!scene.zoneHighlights) {
      scene.zoneHighlights = [];
    }
    console.log("show screen hidelight22")
    // Check each zone and highlight if valid
    const zones = ['top', 'left', 'right', 'help', 'sp'];
    zones.forEach(zoneType => {
      const zone = scene.playerZones[zoneType];
      if (zone && this.canPlaceCardInZone(card, zoneType, scene)) {
        // Create a subtle highlight around the zone
        const highlight = scene.add.graphics();
        highlight.lineStyle(3, 0x00ff00, 0.6); // Green with 60% opacity
        highlight.strokeRoundedRect(zone.x - 65, zone.y - 95, 130, 190, 8);
        
        // Add a pulsing effect
        scene.tweens.add({
          targets: highlight,
          alpha: 0.3,
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        
        scene.zoneHighlights.push(highlight);
      }
    });
  }

  static convertCardSelectionToCardDataObject(card){
    // Handle case where card or cardId might be undefined
    if (!card || !card.cardId) {
      console.warn('convertCardSelectionToCardDataObject: Invalid card data', card);
      return {
        id: 'unknown',
        name: 'Unknown Card',
        cardType: 'character',
        type: 'character',
        power: 0,
        zone: [],
        traits: [],
        description: 'Card data unavailable'
      };
    }

    var cardType = "character"
    if(card.cardId.startsWith("c-") || card.cardId.startsWith("ST01-")){
      cardType = "character"
    }else if(card.cardId.startsWith("h-")){
      cardType = "utilityCard"
    }else if(card.cardId.startsWith("s-")){
      cardType = "leader"
    }else if(card.cardId.startsWith("R-")){
      cardType = "energy"
    }else if(card.cardId.startsWith("EXR-")){
      cardType = "energy"  
    }else if(card.cardId.startsWith("EXB-")){
      cardType = "base"
    }
    
    return {
      id: card.cardId,
      name: card.name || card.cardId,
      cardType: cardType,
      type: cardType,
      power: card.power || 0,
      zone: card.zone || [],
      traits: card.traits || [],
      description: card.description || '',
      cardUid: card.cardUid || card.cardId
    }
  }
  /**
   * Creates a card selection dialog UI with 3-section vertical layout
   * @param {string} selectionId - The selection ID
   * @param {Object} selection - The selection data with eligibleCards
   * @param {Object} scene - The GameScene instance
   * @param {Function} onConfirm - Callback when OK button is clicked
   * @returns {Object} Dialog interface with elements and cleanup function
   */
  static createCardSelectionDialog(selectionId, selection, scene, onConfirm) {
    const dialogConfig = this._createDialogConfig(scene, selection);
    
    // Disable main game card interactions to prevent selection conflicts
    this._disableMainGameCardInteractions(scene);
    
    // Support for future multi-section dialogs (currently single section)
    const numberOfSections = selection.numberOfSections || 1;
    console.log(`Creating card selection dialog with ${numberOfSections} section(s)`);
    
    const paginationState = {
      maxCardsPerPage: 4,
      totalPages: Math.ceil(selection.eligibleCards.length / 4),
      currentPage: 0
    };
    
    const selectionState = {
      maxSelections: selection.selectCount || 1,
      selectedCards: [],
      selectedCardHighlights: [],
      selectedCard: null,
      selectedCardHighlight: null,
      numberOfSections: numberOfSections  // Store for future multi-section support
    };
    
    const dialogElements = {
      overlay: null,
      dialogBg: null,
      titleSection: {},
      cardSection: {},
      buttonSection: {},
      cardListElements: [],
      paginationElements: {}
    };
    
    // Create main dialog structure
    this._createDialogBackground(scene, dialogConfig, dialogElements);
    this._createTitleSection(scene, dialogConfig, dialogElements);
    this._createCardSectionBackground(scene, dialogConfig, dialogElements);
    
    // Card display configuration
    const cardDisplayConfig = {
      cardDisplayWidth: 160,
      cardDisplayHeight: 220,
      cardSpacing: 25
    };
    
    // Create pagination controls if needed
    if (paginationState.totalPages > 1) {
      this._createPaginationControls(scene, dialogConfig, paginationState, dialogElements);
    }
    
    // Create card update and selection management
    const cardManager = this._createCardManager(
      scene, selection, dialogConfig, paginationState, selectionState, 
      cardDisplayConfig, dialogElements
    );
    
    // Create button section
    const buttonSection = this._createButtonSection(
      scene, selectionId, selection, dialogConfig, selectionState, 
      dialogElements, cardManager.updateOKButtonState, onConfirm
    );
    
    // Initial card display
    cardManager.updateCardDisplay();
    
    // Return cleanup function and initial elements for external cleanup
    const dialogInterface = {
      elements: this._getAllDialogElements(dialogElements),
      cleanup: () => this._cleanupDialog(scene, dialogElements)
    };
    
    return dialogInterface;
  }

  /**
   * Creates dialog configuration object
   * @private
   */
  static _createDialogConfig(scene, selection) {
    const { width, height } = scene.cameras.main;
    
    // Handle different dialog types with specific descriptions
    let description;
    if (selection.dialogType === 'SELECT_UNIT_FOR_PILOT') {
      description = selection.description || 'Choose which unit this pilot card should attach to';
    } else if (selection.effect) {
      description = `Select ${selection.selectCount} opponent character card(s) to ${selection.effect.type} ${selection.effect.value !== undefined ? 'to ' + selection.effect.value : ''}`;
    } else {
      description = selection.description || `Select ${selection.selectCount} card(s)`;
    }
    
    // Dynamic title based on dialog type
    let dialogTitle = 'Card Selection Required';
    if (selection.dialogType === 'SELECT_UNIT_FOR_PILOT') {
      dialogTitle = selection.title || 'Select Unit to Pilot';
    } else if (selection.title) {
      dialogTitle = selection.title;
    }
    
    // Check if dialog needs extra height for pilots or slot targets
    const hasSlotTargets = selection.eligibleCards?.some(card => 
      card.isSlotTarget || (card.pilot && card.unit)
    );
    const dialogHeight = hasSlotTargets ? 600 : 450; // Taller for pilot displays
    
    return {
      width: Math.min(900, width * 0.85),
      height: dialogHeight,
      centerX: width / 2,
      centerY: height / 2,
      screenWidth: width,
      screenHeight: height,
      title: dialogTitle,
      description: description,
      titleSectionHeight: 100,
      buttonSectionHeight: 70,
      get cardSectionHeight() { return this.height - this.titleSectionHeight - this.buttonSectionHeight; }
    };
  }

  /**
   * Creates the main dialog background and overlay
   * @private
   */
  static _createDialogBackground(scene, config, dialogElements) {
    // Semi-transparent background covering the whole screen
    dialogElements.overlay = scene.add.graphics();
    dialogElements.overlay.fillStyle(0x000000, 0.75);
    dialogElements.overlay.fillRect(0, 0, config.screenWidth, config.screenHeight);
    dialogElements.overlay.setDepth(1500);
    
    // Main dialog background
    dialogElements.dialogBg = scene.add.graphics();
    dialogElements.dialogBg.fillStyle(0x2a2a2a);
    dialogElements.dialogBg.fillRoundedRect(config.centerX - config.width/2, config.centerY - config.height/2, config.width, config.height, 15);
    dialogElements.dialogBg.lineStyle(3, 0x4a4a4a);
    dialogElements.dialogBg.strokeRoundedRect(config.centerX - config.width/2, config.centerY - config.height/2, config.width, config.height, 15);
    dialogElements.dialogBg.setDepth(1501);
  }

  /**
   * Creates the title section of the dialog
   * @private
   */
  static _createTitleSection(scene, config, dialogElements) {
    const titleSectionY = config.centerY - config.height/2 + config.titleSectionHeight/2;
    
    // Title section background
    dialogElements.titleSection.background = scene.add.graphics();
    dialogElements.titleSection.background.fillStyle(0x3a3a3a, 0.8);
    dialogElements.titleSection.background.fillRoundedRect(config.centerX - config.width/2 + 10, config.centerY - config.height/2 + 10, config.width - 20, config.titleSectionHeight - 20, 10);
    dialogElements.titleSection.background.setDepth(1502);
    
    // Main title
    dialogElements.titleSection.titleText = scene.add.text(config.centerX, titleSectionY - 25, config.title, {
      fontSize: '24px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    dialogElements.titleSection.titleText.setOrigin(0.5);
    dialogElements.titleSection.titleText.setDepth(1503);
    
    // Description text
    dialogElements.titleSection.descText = scene.add.text(config.centerX, titleSectionY + 15, config.description, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffd700',
      align: 'center',
      wordWrap: { width: config.width - 40 }
    });
    dialogElements.titleSection.descText.setOrigin(0.5);
    dialogElements.titleSection.descText.setDepth(1503);
  }

  /**
   * Creates the card section background and label
   * @private
   */
  static _createCardSectionBackground(scene, config, dialogElements) {
    const cardSectionY = config.centerY - config.height/2 + config.titleSectionHeight + config.cardSectionHeight/2;
    
    // Card section background
    dialogElements.cardSection.background = scene.add.graphics();
    dialogElements.cardSection.background.fillStyle(0x1a1a1a, 0.9);
    dialogElements.cardSection.background.fillRoundedRect(config.centerX - config.width/2 + 10, cardSectionY - config.cardSectionHeight/2 + 10, config.width - 20, config.cardSectionHeight - 20, 10);
    dialogElements.cardSection.background.lineStyle(1, 0x555555);
    dialogElements.cardSection.background.strokeRoundedRect(config.centerX - config.width/2 + 10, cardSectionY - config.cardSectionHeight/2 + 10, config.width - 20, config.cardSectionHeight - 20, 10);
    dialogElements.cardSection.background.setDepth(1502);
    
    // Card selection label
    dialogElements.cardSection.labelText = scene.add.text(config.centerX, cardSectionY - config.cardSectionHeight/2 + 30, 'Select a card:', {
      fontSize: '18px',
      fontFamily: 'Arial Bold',
      fill: '#cccccc',
      align: 'center'
    });
    dialogElements.cardSection.labelText.setOrigin(0.5);
    dialogElements.cardSection.labelText.setDepth(1503);
    
    dialogElements.cardSection.centerY = cardSectionY;
  }

  /**
   * Extracts card image and display information from direct card objects
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
    // Left arrow
    dialogElements.paginationElements.leftArrow = scene.add.graphics();
    dialogElements.paginationElements.leftArrow.fillStyle(0x888888);
    dialogElements.paginationElements.leftArrow.fillTriangle(
      config.centerX - config.width/2 + 40, dialogElements.cardSection.centerY,
      config.centerX - config.width/2 + 65, dialogElements.cardSection.centerY - 15,
      config.centerX - config.width/2 + 65, dialogElements.cardSection.centerY + 15
    );
    dialogElements.paginationElements.leftArrow.setDepth(1504);
    dialogElements.paginationElements.leftArrow.setInteractive(new Phaser.Geom.Rectangle(
      config.centerX - config.width/2 + 30, dialogElements.cardSection.centerY - 20, 45, 40
    ), Phaser.Geom.Rectangle.Contains);

    // Right arrow
    dialogElements.paginationElements.rightArrow = scene.add.graphics();
    dialogElements.paginationElements.rightArrow.fillStyle(0x888888);
    dialogElements.paginationElements.rightArrow.fillTriangle(
      config.centerX + config.width/2 - 40, dialogElements.cardSection.centerY,
      config.centerX + config.width/2 - 65, dialogElements.cardSection.centerY - 15,
      config.centerX + config.width/2 - 65, dialogElements.cardSection.centerY + 15
    );
    dialogElements.paginationElements.rightArrow.setDepth(1504);
    dialogElements.paginationElements.rightArrow.setInteractive(new Phaser.Geom.Rectangle(
      config.centerX + config.width/2 - 75, dialogElements.cardSection.centerY - 20, 45, 40
    ), Phaser.Geom.Rectangle.Contains);

    // Page info text
    dialogElements.paginationElements.pageInfoText = scene.add.text(
      config.centerX, 
      dialogElements.cardSection.centerY + config.cardSectionHeight/2 - 30, 
      `Page ${paginationState.currentPage + 1} of ${paginationState.totalPages}`, 
      {
        fontSize: '14px',
        fontFamily: 'Arial',
        fill: '#cccccc',
        align: 'center'
      }
    );
    dialogElements.paginationElements.pageInfoText.setOrigin(0.5);
    dialogElements.paginationElements.pageInfoText.setDepth(1504);
  }

  /**
   * Creates card management system with update and selection logic
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
    
    // Selection logic
    const selectCard = (card, cardX, cardsY) => {
      this._handleCardSelection(card, cardX, cardsY, selectionState, cardDisplayConfig, dialogElements);
      updateOKButtonState(); // Update button state after selection change
    };
    
    // OK button state update
    const updateOKButtonState = () => {
      this._updateOKButtonState(selectionState, dialogElements);
    };
    
    // Set up pagination event handlers
    if (dialogElements.paginationElements.leftArrow) {
      this._setupPaginationEvents(scene, paginationState, dialogElements, updateCardDisplay);
    }
    
    return { updateCardDisplay, selectCard, updateOKButtonState };
  }

  /**
   * Creates button section with OK and Cancel buttons and handlers
   * @private
   */
  static _createButtonSection(scene, selectionId, selection, config, selectionState, dialogElements, updateOKButtonState, onConfirm) {
    const buttonSectionY = config.centerY + config.height/2 - config.buttonSectionHeight/2;
    
    // Button section background
    dialogElements.buttonSection.background = scene.add.graphics();
    dialogElements.buttonSection.background.fillStyle(0x3a3a3a, 0.8);
    dialogElements.buttonSection.background.fillRoundedRect(
      config.centerX - config.width/2 + 10, 
      buttonSectionY - config.buttonSectionHeight/2 + 10, 
      config.width - 20, 
      config.buttonSectionHeight - 20, 
      10
    );
    dialogElements.buttonSection.background.setDepth(1502);
    
    // Button positioning - two buttons side by side with proper spacing
    const buttonSpacing = 240; // Further increased distance between buttons to prevent overlap
    const buttonScale = 0.8; // Scale buttons down slightly for better fit
    const okButtonX = config.centerX + buttonSpacing/2;
    const cancelButtonX = config.centerX - buttonSpacing/2;
    
    // OK button (right side)
    dialogElements.buttonSection.okButton = scene.add.image(okButtonX, buttonSectionY, 'button');
    dialogElements.buttonSection.okButton.setScale(buttonScale);
    dialogElements.buttonSection.okButton.setInteractive();
    dialogElements.buttonSection.okButton.setTint(0x888888);
    dialogElements.buttonSection.okButton.setDepth(1503);
    
    dialogElements.buttonSection.okText = scene.add.text(okButtonX, buttonSectionY, 'SELECT A CARD', {
      fontSize: '14px', // Slightly smaller font to fit better
      fontFamily: 'Arial Bold',
      fill: '#ffffff'
    });
    dialogElements.buttonSection.okText.setOrigin(0.5);
    dialogElements.buttonSection.okText.setDepth(1504);
    
    // Cancel button (left side)
    dialogElements.buttonSection.cancelButton = scene.add.image(cancelButtonX, buttonSectionY, 'button');
    dialogElements.buttonSection.cancelButton.setScale(buttonScale);
    dialogElements.buttonSection.cancelButton.setInteractive();
    dialogElements.buttonSection.cancelButton.setTint(0xf44336); // Red tint for cancel
    dialogElements.buttonSection.cancelButton.setDepth(1503);
    
    dialogElements.buttonSection.cancelText = scene.add.text(cancelButtonX, buttonSectionY, 'CANCEL', {
      fontSize: '14px', // Slightly smaller font to fit better
      fontFamily: 'Arial Bold',
      fill: '#ffffff'
    });
    dialogElements.buttonSection.cancelText.setOrigin(0.5);
    dialogElements.buttonSection.cancelText.setDepth(1504);
    
    // Button events
    this._setupOKButtonEvents(scene, selectionId, selection, selectionState, dialogElements, onConfirm);
    this._setupCancelButtonEvents(scene, dialogElements);
    
    // Initial button state
    updateOKButtonState();
    
    return dialogElements.buttonSection;
  }

  /**
   * Gets all dialog elements for cleanup
   * @private
   */
  static _getAllDialogElements(dialogElements) {
    const elements = [
      dialogElements.overlay,
      dialogElements.dialogBg,
      dialogElements.titleSection.background,
      dialogElements.titleSection.titleText,
      dialogElements.titleSection.descText,
      dialogElements.cardSection.background,
      dialogElements.cardSection.labelText,
      dialogElements.buttonSection.background,
      dialogElements.buttonSection.okButton,
      dialogElements.buttonSection.okText,
      dialogElements.buttonSection.cancelButton,
      dialogElements.buttonSection.cancelText
    ].filter(el => el);
    
    // Add all current card elements
    dialogElements.cardListElements.forEach(element => {
      if (element && !element.destroyed) {
        elements.push(element);
      }
    });
    
    // Add pagination elements if they exist
    Object.values(dialogElements.paginationElements).forEach(element => {
      if (element && !element.destroyed) {
        elements.push(element);
      }
    });
    
    return elements;
  }

  /**
   * Cleanup function for dialog
   * @private
   */
  static _cleanupDialog(scene, dialogElements) {
    // Stop any running tweens
    scene.tweens.killTweensOf(dialogElements.cardListElements);
    Object.values(dialogElements.paginationElements).forEach(element => {
      if (element) scene.tweens.killTweensOf(element);
    });
    
    // Clean up hover effects before destroying main elements
    this._cleanupHoverEffects(dialogElements.cardListElements);
    
    // Get all elements and destroy them
    const allElements = this._getAllDialogElements(dialogElements);
    allElements.forEach(element => {
      if (element && !element.destroyed) {
        element.destroy();
      }
    });
    
    // Clear arrays
    dialogElements.cardListElements.length = 0;
    
    // Re-enable main game card interactions
    this._enableMainGameCardInteractions(scene);
  }

  /**
   * Cleanup hover effects to prevent memory leaks
   * @private
   */
  static _cleanupHoverEffects(cardElements) {
    cardElements.forEach(element => {
      // Check if element has hover effect attached
      if (element && element.hoverEffect && !element.hoverEffect.destroyed) {
        element.hoverEffect.destroy();
        element.hoverEffect = null;
      }
      
      // Check for container-based hover effects
      if (element && element.type === 'Container' && element.hoverEffect && !element.hoverEffect.destroyed) {
        element.hoverEffect.destroy();
        element.hoverEffect = null;
      }
    });
  }

  /**
   * Creates a single card display element
   * @private
   */
  static _createSingleCardDisplay(scene, card, index, cardsStartX, cardsY, cardDisplayConfig, dialogElements, selectionState, animateDirection) {
    const cardX = cardsStartX + (index * (cardDisplayConfig.cardDisplayWidth + cardDisplayConfig.cardSpacing)) + cardDisplayConfig.cardDisplayWidth / 2;
    
    // Card container background
    const cardContainer = scene.add.graphics();
    cardContainer.fillStyle(0x333333);
    cardContainer.fillRoundedRect(cardX - cardDisplayConfig.cardDisplayWidth/2, cardsY - cardDisplayConfig.cardDisplayHeight/2, cardDisplayConfig.cardDisplayWidth, cardDisplayConfig.cardDisplayHeight, 8);
    cardContainer.lineStyle(2, 0x666666);
    cardContainer.strokeRoundedRect(cardX - cardDisplayConfig.cardDisplayWidth/2, cardsY - cardDisplayConfig.cardDisplayHeight/2, cardDisplayConfig.cardDisplayWidth, cardDisplayConfig.cardDisplayHeight, 8);
    cardContainer.setDepth(1503);
    dialogElements.cardListElements.push(cardContainer);
    
    // Extract card display info and create card element (can be Card component or Container)
    const { cardImageId, displayCardId } = this._extractCardDisplayInfo(card);
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
      }
      
      console.log(`Created Card component for dialog: ${displayCardId} with AP/HP display`);
      return cardComponent;
      
    } catch (error) {
      console.error('Error creating Card component for dialog, falling back to image:', error);
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
    
    
    // Create a container to hold unit and pilot cards
    const slotContainer = scene.add.container(cardX, cardsY);
    

    // Create pilot card if present (positioned below unit)
    let pilotCard = null;
    if (slotTarget.pilot) {
      const pilotData = this._prepareCardDataForDisplay(slotTarget.pilot.cardId, slotTarget.pilot.cardId, slotTarget.pilot);
      pilotCard = new Card(scene, 0, 23, pilotData, {
        usePreview: true,
        scale: dialogScale, // Slightly smaller for better visual hierarchy
        interactive: false, // Container will handle interaction
        showBackground: false,
        handleOutside: true
      });
      slotContainer.add(pilotCard);
    }


    // Create unit card (always present) - center if no pilot, otherwise position at top
    const unitY = slotTarget.pilot ? -20 : 0; // Center unit card when no pilot present
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
   * Fallback method for creating simple card image when Card component fails
   * @private
   */
  static _createFallbackCardImage(scene, cardX, cardsY, cardImageId, displayCardId, cardDisplayConfig) {
    const previewImageKey = `${cardImageId}_preview`;
    
    if (scene.textures.exists(previewImageKey)) {
      const cardImage = scene.add.image(cardX, cardsY, previewImageKey);
      const maxScale = Math.min((cardDisplayConfig.cardDisplayWidth - 16) / cardImage.width, (cardDisplayConfig.cardDisplayHeight - 16) / cardImage.height);
      cardImage.setScale(maxScale);
      cardImage.setDepth(1504);
      return cardImage;
    } else if (scene.textures.exists(cardImageId)) {
      const cardImage = scene.add.image(cardX, cardsY, cardImageId);
      const maxScale = Math.min((cardDisplayConfig.cardDisplayWidth - 16) / cardImage.width, (cardDisplayConfig.cardDisplayHeight - 16) / cardImage.height);
      cardImage.setScale(maxScale);
      cardImage.setDepth(1504);
      return cardImage;
    } else {
      // Fallback placeholder
      const placeholder = scene.add.graphics();
      placeholder.fillStyle(0x666666);
      placeholder.fillRoundedRect(cardX - cardDisplayConfig.cardDisplayWidth/2 + 8, cardsY - cardDisplayConfig.cardDisplayHeight/2 + 8, cardDisplayConfig.cardDisplayWidth - 16, cardDisplayConfig.cardDisplayHeight - 16, 8);
      placeholder.lineStyle(2, 0xffffff);
      placeholder.strokeRoundedRect(cardX - cardDisplayConfig.cardDisplayWidth/2 + 8, cardsY - cardDisplayConfig.cardDisplayHeight/2 + 8, cardDisplayConfig.cardDisplayWidth - 16, cardDisplayConfig.cardDisplayHeight - 16, 8);
      placeholder.setDepth(1504);
      return placeholder;
    }
  }

  /**
   * Prepare card data for Card component display
   * @private
   */
  static _prepareCardDataForDisplay(cardImageId, displayCardId, originalCard = null) {
    // Create compatible card data structure with actual card data if available
    const baseData = {
      id: cardImageId,
      cardId: displayCardId || cardImageId,
      cardType: 'unit',  // Default to unit type to ensure PowerOverlay shows
      ap: 2,            // Default AP value
      hp: 3,            // Default HP value
      power: 100        // Legacy power field for compatibility
    };

    // If original card data is available, extract actual values
    if (originalCard && typeof originalCard === 'object') {
      // Handle different card data structures
      const cardData = originalCard.cardData || originalCard;
      
      if (cardData) {
        // Extract card type
        if (cardData.cardType) {
          baseData.cardType = cardData.cardType;
        } else if (cardData.type) {
          baseData.cardType = cardData.type;
        }
        
        // Extract AP/HP values
        if (cardData.ap !== undefined) baseData.ap = cardData.ap;
        if (cardData.hp !== undefined) baseData.hp = cardData.hp;
        if (cardData.power !== undefined) baseData.power = cardData.power;
        
        // Extract other useful properties
        if (cardData.name) baseData.name = cardData.name;
        if (cardData.traits) baseData.traits = cardData.traits;
        if (cardData.effects) baseData.effects = cardData.effects;
        
        console.log(`Extracted card data for dialog: ${displayCardId}`, {
          cardType: baseData.cardType,
          ap: baseData.ap,
          hp: baseData.hp
        });
      }
    }

    return baseData;
  }

  /**
   * Prepares card data for preview - uses card data directly without conversion
   * @private
   */
  static _prepareCardDataForPreview(card) {
    // Direct unit object from zones (has cardData property)
    if (card.cardData) {
      return {
        cardData: card.cardData,
        cardUid: card.cardUid,
        slot: card.slot
      };
    }
    
    // Direct card data object (card data is at root level)
    if (card.id || card.cardId) {
      return {
        cardData: card,
        cardUid: card.cardUid || card.cardId || card.id
      };
    }
    
    // Fallback for unknown structures
    console.warn('Unknown card data structure in preview:', card);
    return {
      cardData: {
        id: 'unknown',
        name: 'Unknown Card',
        cardType: 'character',
        type: 'character'
      },
      cardUid: 'unknown'
    };
  }

  /**
   * Prepares slot data for preview display (unit + pilot combination)
   * @private
   */
  static _prepareSlotPreviewData(slotData) {
    if (!slotData || !slotData.unit) {
      console.warn('Invalid slot data for preview:', slotData);
      return this._prepareCardDataForPreview({
        id: 'unknown',
        name: 'Unknown Slot',
        cardType: 'character'
      });
    }

    // Create preview data structure that represents the slot composition
    const slotPreviewData = {
      cardData: slotData.unit.cardData || slotData.unit,
      cardUid: slotData.unit.cardUid || slotData.unit.cardId,
      slotName: slotData.slotName,
      isSlotPreview: true,
      // Include pilot information if present
      pilot: slotData.pilot ? {
        cardData: slotData.pilot.cardData || slotData.pilot,
        cardUid: slotData.pilot.cardUid || slotData.pilot.cardId
      } : null
    };

    console.log('Prepared slot preview data:', {
      unit: slotData.unit.cardId,
      pilot: slotData.pilot?.cardId || 'none',
      slot: slotData.slotName
    });

    return slotPreviewData;
  }

  /**
   * Sets up card interaction events for both regular cards and slot containers
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
   * Sets up interaction for slot containers (unit + pilot combinations)
   * @private
   */
  static _setupSlotContainerInteraction(scene, card, slotContainer, selectionState, cardX, cardsY, cardDisplayConfig, dialogElements) {
    // Set up proper interactive area for the container
    const interactiveWidth = cardDisplayConfig.cardDisplayWidth;
    const interactiveHeight = cardDisplayConfig.cardDisplayHeight;
    
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
    
    const handleContainerSelection = () => {
      console.log('Slot target selected:', slotContainer.slotData.slotName, slotContainer.slotData.unit.cardId);
      hideContainerHoverEffect(); // Clean up hover effect on selection
      this._handleCardSelection(slotContainer.slotData, cardX, cardsY, selectionState, cardDisplayConfig, dialogElements);
    };
    
    // Set up container-level interactions (fallback)
    slotContainer.on('pointerover', (pointer, localX, localY, event) => {
      // Only trigger if not already handled by child cards
      if (!event.stopped) {
        showContainerHoverEffect();
        const previewData = this._prepareSlotPreviewData(slotContainer.slotData);
        scene.showCardPreview(previewData);
      }
    });
    
    slotContainer.on('pointerout', (pointer, event) => {
      // Only trigger if not handled by child cards  
      if (!event.stopped) {
        hideContainerHoverEffect();
        scene.hideCardPreview();
      }
    });
    
    slotContainer.on('pointerdown', (pointer, localX, localY, event) => {
      // Only trigger if not already handled by child cards
      if (!event.stopped) {
        handleContainerSelection();
      }
    });
    
    // Set up interactions on individual cards within the container
    if (slotContainer.unitCard) {
      this._setupSlotCardInteraction(scene, slotContainer.unitCard, slotContainer.slotData.unit, slotContainer, 
        showContainerHoverEffect, hideContainerHoverEffect, handleContainerSelection);
    }
    
    if (slotContainer.pilotCard) {
      this._setupSlotCardInteraction(scene, slotContainer.pilotCard, slotContainer.slotData.pilot, slotContainer,
        showContainerHoverEffect, hideContainerHoverEffect, handleContainerSelection);
    }
  }

  /**
   * Sets up interaction for individual cards within slot containers
   * @private
   */
  static _setupSlotCardInteraction(scene, cardComponent, cardData, slotContainer, showHover, hideHover, handleSelection) {
    if (!cardComponent || !cardComponent.setInteractive) {
      return;
    }

    cardComponent.setInteractive();
    
    cardComponent.on('pointerover', (pointer, localX, localY, event) => {
      event.stopPropagation(); // Prevent container from also handling
      showHover();
      
      // Show preview for the entire slot (unit + pilot) instead of individual card
      const previewData = this._prepareSlotPreviewData(slotContainer.slotData);
      scene.showCardPreview(previewData);
    });
    
    cardComponent.on('pointerout', (pointer, event) => {
      event.stopPropagation(); // Prevent container from also handling
      hideHover();
      scene.hideCardPreview();
    });
    
    cardComponent.on('pointerdown', (pointer, localX, localY, event) => {
      event.stopPropagation(); // Prevent container from also handling
      handleSelection();
    });
  }

  /**
   * Sets up interaction for regular card components
   * @private
   */
  static _setupRegularCardInteraction(scene, card, cardComponent, selectionState, cardX, cardsY, cardDisplayConfig, dialogElements) {
    if (!cardComponent.setInteractive) {
      console.warn('Card component does not support setInteractive');
      return;
    }

    cardComponent.setInteractive();
    
    // Create hover frame highlighting functions with animation
    const showRegularCardHoverEffect = () => {
      if (!cardComponent.hoverEffect) {
        cardComponent.hoverEffect = scene.add.graphics();
        cardComponent.hoverEffect.lineStyle(3, 0x00ff00, 0.8);
        cardComponent.hoverEffect.strokeRoundedRect(
          cardX - cardDisplayConfig.cardDisplayWidth/2 - 2, 
          cardsY - cardDisplayConfig.cardDisplayHeight/2 - 2, 
          cardDisplayConfig.cardDisplayWidth + 4, 
          cardDisplayConfig.cardDisplayHeight + 4, 
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
              // Remove from dialog elements array
              const index = dialogElements.cardListElements.indexOf(cardComponent.hoverEffect);
              if (index > -1) {
                dialogElements.cardListElements.splice(index, 1);
              }
            }
          }
        });
      }
      scene.game.canvas.style.cursor = 'default';
    };
    
    cardComponent.on('pointerover', () => {
      showRegularCardHoverEffect();
      
      // Use card data directly - no conversion needed
      const previewData = this._prepareCardDataForPreview(card);
      scene.showCardPreview(previewData);
    });
    
    cardComponent.on('pointerout', () => {
      hideRegularCardHoverEffect();
      scene.hideCardPreview();
    });
    
    cardComponent.on('pointerdown', () => {
      console.log('Regular card selected:', card.cardId || card.id);
      hideRegularCardHoverEffect(); // Clean up hover effect on selection
      this._handleCardSelection(card, cardX, cardsY, selectionState, cardDisplayConfig, dialogElements);
    });
  }

  /**
   * Gets unique identifier for a card (handles both regular cards and slot targets)
   * @private
   */
  static _getCardIdentifier(card) {
    if (card.isSlotTarget) {
      // For slot targets, use slotName + unit cardId as unique identifier
      return `${card.slotName}_${card.unit?.cardId || card.unit?.id}`;
    } else {
      // For regular cards
      return card.cardId || card.id || card.cardUid;
    }
  }

  /**
   * Handles card selection logic
   * @private
   */
  static _handleCardSelection(card, cardX, cardsY, selectionState, cardDisplayConfig, dialogElements) {
    const cardId = this._getCardIdentifier(card);
    
    if (selectionState.maxSelections === 1) {
      // Single selection mode - always select new card and deselect previous
      const currentSelectedId = selectionState.selectedCard ? this._getCardIdentifier(selectionState.selectedCard) : null;
      const isCurrentlySelected = currentSelectedId === cardId;
      
      if (isCurrentlySelected) {
        // Deselect the currently selected card (toggle behavior)
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
   * Creates selection highlight for a card
   * @private
   */
  static _createSelectionHighlight(cardX, cardsY, cardDisplayConfig, dialogElements) {
    const highlight = dialogElements.cardSection.background.scene.add.graphics();
    highlight.lineStyle(4, 0x00ff00);
    highlight.strokeRoundedRect(
      cardX - cardDisplayConfig.cardDisplayWidth/2 - 2, 
      cardsY - cardDisplayConfig.cardDisplayHeight/2 - 2, 
      cardDisplayConfig.cardDisplayWidth + 4, 
      cardDisplayConfig.cardDisplayHeight + 4, 
      10
    );
    highlight.setDepth(1506);
    dialogElements.cardListElements.push(highlight);
    return highlight;
  }

  /**
   * Updates OK button state based on selection
   * @private
   */
  static _updateOKButtonState(selectionState, dialogElements) {
    const okButton = dialogElements.buttonSection.okButton;
    const okText = dialogElements.buttonSection.okText;
    
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

  /**
   * Sets up OK button event handlers
   * @private
   */
  static _setupOKButtonEvents(scene, selectionId, selection, selectionState, dialogElements, onConfirm) {
    const okButton = dialogElements.buttonSection.okButton;
    
    okButton.on('pointerover', () => {
      if (selectionState.selectedCards.length >= 1) {
        okButton.setTint(0x66BB6A);
        scene.input.setDefaultCursor('pointer');
      }
    });
    
    okButton.on('pointerout', () => {
      this._updateOKButtonState(selectionState, dialogElements);
      scene.input.setDefaultCursor('default');
    });
    
    okButton.on('pointerdown', () => {
      if (selectionState.selectedCards.length >= 1) {
        // Clean up the dialog UI
        this._cleanupDialog(scene, dialogElements);
        
        // Always return an array for consistency - supports future multi-section scenarios
        onConfirm(selectionId, selectionState.selectedCards, []);
      }
    });
  }

  /**
   * Sets up Cancel button event handlers
   * @private
   */
  static _setupCancelButtonEvents(scene, dialogElements) {
    const cancelButton = dialogElements.buttonSection.cancelButton;
    
    cancelButton.on('pointerover', () => {
      cancelButton.setTint(0xf66659); // Lighter red on hover
      scene.input.setDefaultCursor('pointer');
    });
    
    cancelButton.on('pointerout', () => {
      cancelButton.setTint(0xf44336); // Original red
      scene.input.setDefaultCursor('default');
    });
    
    cancelButton.on('pointerdown', () => {
      console.log('Card selection dialog cancelled by user');
      
      // Clean up the dialog UI
      this._cleanupDialog(scene, dialogElements);
      
      // No callback needed - cancellation just closes the dialog
      // The game should handle the lack of selection appropriately
    });
  }

  /**
   * Updates pagination control visibility
   * @private
   */
  static _updatePaginationVisibility(paginationState, dialogElements) {
    if (dialogElements.paginationElements.leftArrow) {
      dialogElements.paginationElements.leftArrow.setVisible(paginationState.currentPage > 0);
      dialogElements.paginationElements.leftArrow.setAlpha(paginationState.currentPage > 0 ? 1.0 : 0.3);
    }
    if (dialogElements.paginationElements.rightArrow) {
      dialogElements.paginationElements.rightArrow.setVisible(paginationState.currentPage < paginationState.totalPages - 1);
      dialogElements.paginationElements.rightArrow.setAlpha(paginationState.currentPage < paginationState.totalPages - 1 ? 1.0 : 0.3);
    }
    if (dialogElements.paginationElements.pageInfoText) {
      dialogElements.paginationElements.pageInfoText.setText(`Page ${paginationState.currentPage + 1} of ${paginationState.totalPages}`);
    }
  }

  /**
   * Sets up pagination event handlers
   * @private
   */
  static _setupPaginationEvents(scene, paginationState, dialogElements, updateCardDisplay) {
    const leftArrow = dialogElements.paginationElements.leftArrow;
    const rightArrow = dialogElements.paginationElements.rightArrow;
    
    leftArrow.on('pointerdown', () => {
      if (paginationState.currentPage > 0) {
        paginationState.currentPage--;
        updateCardDisplay('left');
      }
    });
    
    leftArrow.on('pointerover', () => {
      if (paginationState.currentPage > 0) {
        scene.game.canvas.style.cursor = 'pointer';
      }
    });
    
    leftArrow.on('pointerout', () => {
      scene.game.canvas.style.cursor = 'default';
    });
    
    rightArrow.on('pointerdown', () => {
      if (paginationState.currentPage < paginationState.totalPages - 1) {
        paginationState.currentPage++;
        updateCardDisplay('right');
      }
    });
    
    rightArrow.on('pointerover', () => {
      if (paginationState.currentPage < paginationState.totalPages - 1) {
        scene.game.canvas.style.cursor = 'pointer';
      }
    });
    
    rightArrow.on('pointerout', () => {
      scene.game.canvas.style.cursor = 'default';
    });
  }

  /**
   * Animates cards out with fade effect
   * @private
   */
  static _animateCardsOut(scene, cardElements, animateDirection) {
    const fadeOutPromises = cardElements.map(element => {
      if (element && element.setAlpha) {
        return new Promise(resolve => {
          scene.tweens.add({
            targets: element,
            alpha: 0,
            x: animateDirection === 'left' ? element.x + 50 : element.x - 50,
            duration: 200,
            ease: 'Power2.easeIn',
            onComplete: () => {
              if (element && element.destroy) {
                element.destroy();
              }
              resolve();
            }
          });
        });
      } else {
        if (element && element.destroy) {
          element.destroy();
        }
        return Promise.resolve();
      }
    });
    
    return Promise.all(fadeOutPromises);
  }

  /**
   * Animates card in with slide effect
   * @private
   */
  static _animateCardIn(scene, cardElement, cardContainer, cardX, cardsY, animateDirection, index) {
    if (cardElement) {
      const startX = animateDirection === 'left' ? cardX - 50 : cardX + 50;
      cardElement.setPosition(startX, cardsY);
      cardElement.setAlpha(0);
      
      scene.tweens.add({
        targets: cardElement,
        x: cardX,
        alpha: 1,
        duration: 300,
        delay: index * 50,
        ease: 'Power2.easeOut'
      });
    }
    
    if (cardContainer) {
      const startX = animateDirection === 'left' ? cardX - 50 : cardX + 50;
      cardContainer.x = startX - cardX;
      cardContainer.alpha = 0;
      
      scene.tweens.add({
        targets: cardContainer,
        x: 0,
        alpha: 1,
        duration: 300,
        delay: index * 50,
        ease: 'Power2.easeOut'
      });
    }
  }

  /**
   * Cleanup card elements array
   * @private
   */
  static _cleanupCardElements(cardElements) {
    cardElements.forEach(element => {
      if (element && element.destroy) {
        element.destroy();
      }
    });
  }

  /**
   * Disables main game card interactions when dialog is open
   * @private
   */
  static _disableMainGameCardInteractions(scene) {
    // Store current interaction state for restoration
    scene._dialogInteractionState = {
      playerHandCards: [],
      slotCards: []
    };
    
    // Disable player hand card interactions
    if (scene.playerHand) {
      scene.playerHand.forEach(card => {
        if (card && card.input && card.input.enabled) {
          scene._dialogInteractionState.playerHandCards.push(card);
          card.disableInteractive();
        }
      });
    }
    
    // Disable slot area card interactions
    if (scene.slotAreaManager) {
      // Deselect all slot cards to prevent green highlights
      scene.slotAreaManager.deselectAllSlotCards();
      
      // Disable interactions for all slot cards
      Object.entries(scene.slotAreaManager.playerSlotCards).forEach(([slotName, slotCards]) => {
        if (slotCards.unit && slotCards.unit.input && slotCards.unit.input.enabled) {
          scene._dialogInteractionState.slotCards.push(slotCards.unit);
          slotCards.unit.disableInteractive();
        }
        if (slotCards.pilot && slotCards.pilot.input && slotCards.pilot.input.enabled) {
          scene._dialogInteractionState.slotCards.push(slotCards.pilot);
          slotCards.pilot.disableInteractive();
        }
      });
      
      // Also disable opponent slot interactions to be safe
      Object.entries(scene.slotAreaManager.opponentSlotCards).forEach(([slotName, slotCards]) => {
        if (slotCards.unit && slotCards.unit.input && slotCards.unit.input.enabled) {
          slotCards.unit.disableInteractive();
        }
        if (slotCards.pilot && slotCards.pilot.input && slotCards.pilot.input.enabled) {
          slotCards.pilot.disableInteractive();
        }
      });
    }
    
    console.log('Main game card interactions disabled for dialog');
  }

  /**
   * Re-enables main game card interactions when dialog closes
   * @private
   */
  static _enableMainGameCardInteractions(scene) {
    if (!scene._dialogInteractionState) {
      console.warn('No interaction state stored to restore');
      return;
    }
    
    // Re-enable player hand card interactions
    scene._dialogInteractionState.playerHandCards.forEach(card => {
      if (card && !card.destroyed) {
        card.setInteractive();
      }
    });
    
    // Re-enable slot card interactions
    scene._dialogInteractionState.slotCards.forEach(card => {
      if (card && !card.destroyed) {
        card.setInteractive();
      }
    });
    
    // Re-enable opponent slot interactions
    if (scene.slotAreaManager) {
      Object.entries(scene.slotAreaManager.opponentSlotCards).forEach(([slotName, slotCards]) => {
        if (slotCards.unit && !slotCards.unit.destroyed) {
          slotCards.unit.setInteractive();
        }
        if (slotCards.pilot && !slotCards.pilot.destroyed) {
          slotCards.pilot.setInteractive();
        }
      });
    }
    
    // Clean up stored state
    delete scene._dialogInteractionState;
    
    console.log('Main game card interactions re-enabled after dialog close');
  }

  /**
   * Shows a zone restriction message
   * @param {string} message - The message to display
   * @param {Object} scene - The GameScene instance
   */
  static showZoneRestrictionMessage(message, scene) {
    // Clear any existing restriction message
    if (scene.restrictionMessage) {
      scene.restrictionMessage.destroy();
    }

    // Create a temporary message display
    const { width, height } = scene.cameras.main;
    scene.restrictionMessage = scene.add.text(width / 2, height / 2 - 50, message, {
      fontSize: '18px',
      fontFamily: 'Arial Bold',
      fill: '#ff4444',
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 },
      align: 'center'
    }).setOrigin(0.5).setDepth(2000);

    // Auto-remove after 3 seconds
    scene.time.delayedCall(3000, () => {
      if (scene.restrictionMessage) {
        scene.restrictionMessage.destroy();
        scene.restrictionMessage = null;
      }
    });
  }
} 