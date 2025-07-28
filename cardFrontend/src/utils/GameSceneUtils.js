/**
 * Utility class for handling GameScene-related operations
 */
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
          interactive: false,
          scale: 0.9,
          gameStateManager: scene.gameStateManager
        };
        
        // Add faceDown option for opponent cards
        if (isOpponent) {
          cardOptions.faceDown = cardData.faceDown || false;
        }
        
        const Card = scene.constructor.Card || require('../components/Card').default;
        const card = new Card(scene, zone.x, zone.y, cardDataObject, cardOptions);
        zone.card = card;
        zone.placeholder.setVisible(false);
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