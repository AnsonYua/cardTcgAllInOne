/**
 * Utility class for handling GameScene-related operations
 */
import Card from '../components/Card.js';

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
        console.log("debug cardData", JSON.stringify(cardData[0].cardDetails[0]));
        const cardDataObject = scene.apiZoneCardDataToCardObject(cardData[0].cardDetails[0]);
        console.log("debug cardData22", JSON.stringify(cardDataObject));
        
        const cardOptions = {
          interactive: true, // Enable interaction for hover events
          draggable: false,  // But disable dragging for zone cards
          scale: 0.9,
          gameStateManager: scene.gameStateManager,
          usePreview: true,
        };
        
        // Add faceDown option for opponent cards
        if (isOpponent) {
          cardOptions.faceDown = cardData.faceDown || false;
        }
        
        const card = new Card(scene, zone.x, zone.y, cardDataObject, cardOptions);
        zone.card = card;
        zone.placeholder.setVisible(false);

        // Add hover events using scene methods
        // Note: Card's setupInteraction() already handles basic pointer events
        // We need to remove the default listeners first, then add our custom ones
        zone.card.removeAllListeners('pointerover');
        zone.card.removeAllListeners('pointerout');
        zone.card.on('pointerover', () => {
          if (!zone.card.isDragging) {
            scene.game.canvas.style.cursor = 'pointer';
            scene.showCardPreview(cardDataObject);
          }
        });
        zone.card.on('pointerout', () => {
          if (!zone.card.isDragging) {
            scene.game.canvas.style.cursor = 'default';
            scene.hideCardPreview();
          }
        });
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
  static canDropCardInZone(card, zoneType, scene) {
    const cardData = card.getCardData();
    
    // First check basic card type compatibility (local validation)
    if (!card.canPlayInZone(zoneType)) {
      return false;
    }
    
    // Then check backend field effect restrictions via GameStateManager
    if (scene.gameStateManager) {
      return scene.gameStateManager.canPlayCardInZone(cardData, zoneType);
    }
    
    // Fallback to basic validation if GameStateManager not available
    return true;
  }

  /**
   * Gets the field index from a zone type
   * @param {string} zoneType - The zone type
   * @returns {number} - The field index
   */
  static getFieldIndexFromZone(zoneType) {
    // Backend field indices: 0=top, 1=left, 2=right, 3=help, 4=sp
    const zoneToFieldMap = {
      'top': 0,
      'left': 1, 
      'right': 2,
      'help': 3,
      'sp': 4
    };
    
    return zoneToFieldMap[zoneType] !== undefined ? zoneToFieldMap[zoneType] : -1;
  }

  /**
   * Creates a zone object with standard properties
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} type - Zone type
   * @param {boolean} isPlayerZone - Whether it's a player zone
   * @returns {Object} - Zone object
   */
  static createZone(x, y, type, isPlayerZone) {
    return {
      x,
      y,
      type,
      isPlayerZone,
      card: null,
      placeholder: null
    };
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

    // Check each zone and highlight if valid
    const zones = ['top', 'left', 'right', 'help', 'sp'];
    zones.forEach(zoneType => {
      const zone = scene.playerZones[zoneType];
      if (zone && this.canDropCardInZone(card, zoneType, scene)) {
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

  /**
   * Creates a card selection dialog UI with 3-section vertical layout
   * @param {string} selectionId - The selection ID
   * @param {Object} selection - The selection data with eligibleCards
   * @param {Object} scene - The GameScene instance
   * @param {Function} onConfirm - Callback when OK button is clicked
   * @returns {Array} Array of dialog elements for cleanup
   */
  static createCardSelectionDialog(selectionId, selection, scene, onConfirm) {
    const { width, height } = scene.cameras.main;
    const eligibleCards = selection.eligibleCards;
    const description = selection.effect ? 
      `Select ${selection.selectCount} opponent character card(s) to ${selection.effect.type} ${selection.effect.value !== undefined ? 'to ' + selection.effect.value : ''}` :
      `Select ${selection.selectCount} card(s)`;
    
    // Dialog dimensions with fixed height for better layout
    const dialogWidth = Math.min(800, width * 0.9); // Responsive width, max 800px
    const dialogHeight = 500; // Fixed height for consistent 3-section layout
    const dialogX = width / 2;
    const dialogY = height / 2;
    
    // Section heights
    const titleSectionHeight = 120;
    const buttonSectionHeight = 80;
    const cardSectionHeight = dialogHeight - titleSectionHeight - buttonSectionHeight;
    
    // Semi-transparent background covering the whole screen
    const overlay = scene.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(1500);
    
    // Main dialog background
    const dialogBg = scene.add.graphics();
    dialogBg.fillStyle(0x2a2a2a);
    dialogBg.fillRoundedRect(dialogX - dialogWidth/2, dialogY - dialogHeight/2, dialogWidth, dialogHeight, 15);
    dialogBg.lineStyle(3, 0x4a4a4a);
    dialogBg.strokeRoundedRect(dialogX - dialogWidth/2, dialogY - dialogHeight/2, dialogWidth, dialogHeight, 15);
    dialogBg.setDepth(1501);
    
    // ===============================
    // SECTION 1: TITLE SECTION (TOP)
    // ===============================
    const titleSectionY = dialogY - dialogHeight/2 + titleSectionHeight/2;
    
    // Title section background
    const titleBg = scene.add.graphics();
    titleBg.fillStyle(0x3a3a3a, 0.8);
    titleBg.fillRoundedRect(dialogX - dialogWidth/2 + 10, dialogY - dialogHeight/2 + 10, dialogWidth - 20, titleSectionHeight - 20, 10);
    titleBg.setDepth(1502);
    
    // Main title
    const titleText = scene.add.text(dialogX, titleSectionY - 25, 'Card Selection Required', {
      fontSize: '24px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    titleText.setOrigin(0.5);
    titleText.setDepth(1503);
    
    // Description text
    const descText = scene.add.text(dialogX, titleSectionY + 15, description, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffd700',
      align: 'center',
      wordWrap: { width: dialogWidth - 40 }
    });
    descText.setOrigin(0.5);
    descText.setDepth(1503);
    
    // ==========================================
    // SECTION 2: CARD SELECTION SECTION (MIDDLE)
    // ==========================================
    const cardSectionY = titleSectionY + titleSectionHeight/2 + cardSectionHeight/2;
    
    // Card section background
    const cardBg = scene.add.graphics();
    cardBg.fillStyle(0x1a1a1a, 0.9);
    cardBg.fillRoundedRect(dialogX - dialogWidth/2 + 10, cardSectionY - cardSectionHeight/2 + 10, dialogWidth - 20, cardSectionHeight - 20, 10);
    cardBg.lineStyle(1, 0x555555);
    cardBg.strokeRoundedRect(dialogX - dialogWidth/2 + 10, cardSectionY - cardSectionHeight/2 + 10, dialogWidth - 20, cardSectionHeight - 20, 10);
    cardBg.setDepth(1502);
    
    // Card selection label
    const cardLabelText = scene.add.text(dialogX, cardSectionY - cardSectionHeight/2 + 30, 'Select a card:', {
      fontSize: '18px',
      fontFamily: 'Arial Bold',
      fill: '#cccccc',
      align: 'center'
    });
    cardLabelText.setOrigin(0.5);
    cardLabelText.setDepth(1503);
    
    // Cards arranged horizontally and centered
    const cardListElements = [];
    const cardDisplayWidth = 180; // Increased card display width
    const cardDisplayHeight = 240; // Increased card display height
    const cardSpacing = 30; // Increased space between cards
    const totalCardsWidth = (eligibleCards.length * cardDisplayWidth) + ((eligibleCards.length - 1) * cardSpacing);
    const cardsStartX = dialogX - totalCardsWidth / 2;
    const cardsY = cardSectionY + 10; // Adjusted position for larger cards
    
    eligibleCards.forEach((card, index) => {
      const cardX = cardsStartX + (index * (cardDisplayWidth + cardSpacing)) + cardDisplayWidth / 2;
      
      // Card container background
      const cardContainer = scene.add.graphics();
      cardContainer.fillStyle(0x333333);
      cardContainer.fillRoundedRect(cardX - cardDisplayWidth/2, cardsY - cardDisplayHeight/2, cardDisplayWidth, cardDisplayHeight, 8);
      cardContainer.lineStyle(2, 0x666666);
      cardContainer.strokeRoundedRect(cardX - cardDisplayWidth/2, cardsY - cardDisplayHeight/2, cardDisplayWidth, cardDisplayHeight, 8);
      cardContainer.setDepth(1503);
      cardListElements.push(cardContainer);
      
      // Use preview image key instead of cardId for image display
      const previewImageKey = `${card.cardId}-preview`;
      let cardImage;
      
      if (scene.textures.exists(previewImageKey)) {
        // Use preview image and scale to fill the entire container
        cardImage = scene.add.image(cardX, cardsY, previewImageKey);
        const maxScale = Math.min((cardDisplayWidth - 16) / cardImage.width, (cardDisplayHeight - 16) / cardImage.height);
        cardImage.setScale(maxScale);
        cardImage.setDepth(1504);
        cardListElements.push(cardImage);
      } else if (scene.textures.exists(card.cardId)) {
        // Fallback to regular card image
        cardImage = scene.add.image(cardX, cardsY, card.cardId);
        const maxScale = Math.min((cardDisplayWidth - 16) / cardImage.width, (cardDisplayHeight - 16) / cardImage.height);
        cardImage.setScale(maxScale);
        cardImage.setDepth(1504);
        cardListElements.push(cardImage);
      } else {
        // Fallback placeholder using the full container size
        const placeholder = scene.add.graphics();
        placeholder.fillStyle(0x666666);
        placeholder.fillRoundedRect(cardX - cardDisplayWidth/2 + 8, cardsY - cardDisplayHeight/2 + 8, cardDisplayWidth - 16, cardDisplayHeight - 16, 8);
        placeholder.lineStyle(2, 0xffffff);
        placeholder.strokeRoundedRect(cardX - cardDisplayWidth/2 + 8, cardsY - cardDisplayHeight/2 + 8, cardDisplayWidth - 16, cardDisplayHeight - 16, 8);
        placeholder.setDepth(1504);
        cardListElements.push(placeholder);
        
        // Card ID on placeholder
        const idText = scene.add.text(cardX, cardsY, card.cardId, {
          fontSize: '14px',
          fontFamily: 'Arial',
          fill: '#ffffff',
          align: 'center'
        });
        idText.setOrigin(0.5);
        idText.setDepth(1505);
        cardListElements.push(idText);
        cardImage = placeholder; // Use placeholder for hover events
      }
      
      // Make the card interactive for hover events
      if (cardImage && cardImage.setInteractive) {
        cardImage.setInteractive();
        
        // Create card data object for preview
        const cardDataObject = {
          cardId: card.cardId,
          name: card.name,
          power: card.power,
          zone: card.zone,
          gameType: card.gameType,
          traits: card.traits || [],
          description: card.description || ''
        };
        
        // Add hover events
        cardImage.on('pointerover', () => {
          scene.game.canvas.style.cursor = 'pointer';
          scene.showCardPreview(cardDataObject);
        });
        
        cardImage.on('pointerout', () => {
          scene.game.canvas.style.cursor = 'default';
          scene.hideCardPreview();
        });
      }
    });
    
    // ===================================
    // SECTION 3: BUTTON SECTION (BOTTOM)
    // ===================================
    const buttonSectionY = cardSectionY + cardSectionHeight/2 + buttonSectionHeight/2;
    
    // Button section background
    const buttonBg = scene.add.graphics();
    buttonBg.fillStyle(0x3a3a3a, 0.8);
    buttonBg.fillRoundedRect(dialogX - dialogWidth/2 + 10, buttonSectionY - buttonSectionHeight/2 + 10, dialogWidth - 20, buttonSectionHeight - 20, 10);
    buttonBg.setDepth(1502);
    
    // OK button (larger and more prominent)
    const okButton = scene.add.image(dialogX, buttonSectionY, 'button');
    okButton.setScale(1.0);
    okButton.setInteractive();
    okButton.setTint(0x4CAF50);
    okButton.setDepth(1503);
    
    const okText = scene.add.text(dialogX, buttonSectionY, 'CONFIRM SELECTION', {
      fontSize: '18px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff'
    });
    okText.setOrigin(0.5);
    okText.setDepth(1504);
    
    // Button hover effect
    okButton.on('pointerover', () => {
      okButton.setTint(0x66BB6A);
      scene.input.setDefaultCursor('pointer');
    });
    okButton.on('pointerout', () => {
      okButton.setTint(0x4CAF50);
      scene.input.setDefaultCursor('default');
    });
    
    // Collect all dialog elements for cleanup
    const dialogElements = [
      overlay, dialogBg, titleBg, titleText, descText,
      cardBg, cardLabelText, ...cardListElements,
      buttonBg, okButton, okText
    ];
    
    // OK button handler
    okButton.on('pointerdown', () => {
      console.log('Card selection confirmed');
      onConfirm(selectionId, eligibleCards[0], dialogElements);
    });
    
    return dialogElements;
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