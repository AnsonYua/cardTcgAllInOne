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
   * Creates a card selection dialog UI
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
    
    // Larger dialog box to accommodate card list with images
    const dialogWidth = 600; // Wider to accommodate card images
    const cardSpacing = 80; // Match the spacing used below
    const dialogHeight = 300 + (eligibleCards.length * cardSpacing); // Dynamic height based on card count
    
    // Semi-transparent background covering the whole screen
    const overlay = scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(1500); // Above game elements but below dialog
    
    const dialogBg = scene.add.graphics();
    dialogBg.fillStyle(0x333333);
    dialogBg.fillRoundedRect(width/2 - dialogWidth/2, height/2 - dialogHeight/2, dialogWidth, dialogHeight, 10);
    dialogBg.lineStyle(2, 0x666666);
    dialogBg.strokeRoundedRect(width/2 - dialogWidth/2, height/2 - dialogHeight/2, dialogWidth, dialogHeight, 10);
    dialogBg.setDepth(1502);
    
    // Dialog title
    const titleText = scene.add.text(width/2, height/2 - dialogHeight/2 + 40, 'Card Selection Required', {
      fontSize: '20px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    titleText.setOrigin(0.5);
    titleText.setDepth(1502);
    
    // Description text
    const descText = scene.add.text(width/2, height/2 - dialogHeight/2 + 80, description, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffff99',
      align: 'center'
    });
    descText.setOrigin(0.5);
    descText.setDepth(1502);
    
    // Eligible cards list with images
    const cardListElements = [];
    const startY = height/2 - dialogHeight/2 + 120;
    
    eligibleCards.forEach((card, index) => {
      const cardY = startY + (index * cardSpacing);
      
      // Create card image (small preview)
      const cardImageKey = card.cardId; // Use cardId as texture key
      let cardImage;
      
      if (scene.textures.exists(cardImageKey)) {
        cardImage = scene.add.image(width/2 - 150, cardY, cardImageKey);
        cardImage.setScale(0.3); // Small scale for preview
        cardImage.setDepth(1502);
        cardListElements.push(cardImage);
      } else {
        // Fallback: create a placeholder rectangle if texture doesn't exist
        const placeholder = scene.add.graphics();
        placeholder.fillStyle(0x666666);
        placeholder.fillRoundedRect(width/2 - 170, cardY - 25, 40, 50, 5);
        placeholder.lineStyle(1, 0xffffff);
        placeholder.strokeRoundedRect(width/2 - 170, cardY - 25, 40, 50, 5);
        placeholder.setDepth(1502);
        cardListElements.push(placeholder);
        
        // Add card ID text on placeholder
        const idText = scene.add.text(width/2 - 150, cardY, card.cardId, {
          fontSize: '8px',
          fontFamily: 'Arial',
          fill: '#ffffff',
          align: 'center'
        });
        idText.setOrigin(0.5);
        idText.setDepth(1502);
        cardListElements.push(idText);
      }
      
      // Card info text (card name, zone, power) - positioned to the right of image
      const cardInfo = `${card.name} (${card.zone.toUpperCase()}) - Power: ${card.power}`;
      const cardText = scene.add.text(width/2 - 50, cardY, cardInfo, {
        fontSize: '14px',
        fontFamily: 'Arial',
        fill: '#ffffff',
        align: 'left'
      });
      cardText.setOrigin(0, 0.5); // Left-aligned, centered vertically
      cardText.setDepth(1502);
      cardListElements.push(cardText);
    });
    
    // OK button
    const okButton = scene.add.image(width/2, height/2 + dialogHeight/2 - 50, 'button');
    okButton.setScale(0.8);
    okButton.setInteractive();
    okButton.setTint(0x4CAF50);
    okButton.setDepth(1502);
    
    const okText = scene.add.text(width/2, height/2 + dialogHeight/2 - 50, 'OK', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    okText.setOrigin(0.5);
    okText.setDepth(1502);
    
    // Collect all dialog elements for cleanup
    const dialogElements = [overlay, dialogBg, titleText, descText, ...cardListElements, okButton, okText];
    
    // OK button handler
    okButton.on('pointerdown', () => {
      console.log('Card selection dialog OK clicked');
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