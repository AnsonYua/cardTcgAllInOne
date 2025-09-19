/**
 * Utility class for handling GameScene-related operations
 * Refactored: Dialog UI methods moved to DialogUIManager.js
 */
import Card from '../components/Card.js';
import { GAME_CONFIG } from '../config/gameConfig.js';
import DialogUIManager from '../managers/DialogUIManager.js';

export default class GameSceneUtils {
  /**
   * Updates zones with card data from the backend
   * @param {Object} zonesData - Zone data from the backend
   * @param {Object} zones - Zone objects from the scene
   * @param {Object} scene - The GameScene instance
   * @param {boolean} isOpponent - Whether these are opponent zones
   */
  static updatePlayerZones(zonesData, zones, scene, isOpponent = false) {
    if (!zonesData || !zones) {
      console.warn('Missing zone data or zone objects');
      return;
    }

    // Process each zone
    Object.keys(zonesData).forEach(zoneKey => {
      const zoneData = zonesData[zoneKey];
      const zoneObject = zones[zoneKey];
      
      if (!zoneObject) {
        console.warn(`Zone object not found for key: ${zoneKey}`);
        return;
      }

      // Clear existing cards in the zone (except for special zones)
      if (zoneObject.cards) {
        zoneObject.cards.forEach(card => {
          if (card && card.destroy) {
            card.destroy();
          }
        });
        zoneObject.cards = [];
      }

      // Add new cards based on zone data
      if (zoneData && (zoneData.cards || zoneData.length > 0)) {
        const cardsToAdd = zoneData.cards || zoneData;
        cardsToAdd.forEach((cardData, index) => {
          try {
            const cardPosition = this.calculateCardPosition(zoneObject, index);
            const card = new Card(scene, cardPosition.x, cardPosition.y, cardData);
            
            if (zoneObject.cards) {
              zoneObject.cards.push(card);
            }
          } catch (error) {
            console.error('Error creating card:', error);
          }
        });
      }
    });
  }

  /**
   * Updates all zones for both players
   * @param {Object} scene - The GameScene instance
   * @param {Object} gameStateManager - Game state manager
   */
  static updateAllZones(scene, gameStateManager) {
    const gameState = gameStateManager.getGameState();
    
    if (gameState.gameEnv && gameState.gameEnv.zones) {
      // Update player zones
      if (scene.playerZones && gameState.gameEnv.zones[gameState.playerId]) {
        this.updatePlayerZones(gameState.gameEnv.zones[gameState.playerId], scene.playerZones, scene, false);
      }
      
      // Update opponent zones
      const opponentId = Object.keys(gameState.gameEnv.zones).find(id => id !== gameState.playerId);
      if (opponentId && scene.opponentZones && gameState.gameEnv.zones[opponentId]) {
        this.updatePlayerZones(gameState.gameEnv.zones[opponentId], scene.opponentZones, scene, true);
      }
    }
  }

  /**
   * Checks if a card can be placed in a specific zone
   * @param {Object} card - Card object
   * @param {string} zoneType - Type of zone
   * @param {Object} scene - Scene instance
   * @returns {boolean} Whether the card can be placed
   */
  static canPlaceCardInZone(card, zoneType, scene) {
    if (!card || !zoneType) return false;
    
    // Basic zone compatibility logic
    const cardType = card.type || card.cardData?.type;
    
    switch (zoneType) {
      case 'hand':
        return true; // Cards can always go to hand
      case 'deck':
      case 'leaderDeck':
        return true; // Cards can go to deck zones
      case 'slot1':
      case 'slot2':
      case 'slot3':
      case 'slot4':
      case 'slot5':
      case 'slot6':
        return ['unit', 'character', 'pilot'].includes(cardType);
      case 'base':
        return cardType === 'base';
      default:
        return false;
    }
  }

  /**
   * Creates a game zone
   * @param {Object} scene - Phaser scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} type - Zone type
   * @param {boolean} isPlayerZone - Whether this is a player zone
   * @returns {Object} Zone object
   */
  static createZone(scene, x, y, type, isPlayerZone) {
    const zoneWidth = GAME_CONFIG.ZONE_WIDTH || 120;
    const zoneHeight = GAME_CONFIG.ZONE_HEIGHT || 160;
    
    // Create zone background
    const zoneBg = scene.add.graphics();
    zoneBg.fillStyle(isPlayerZone ? 0x004400 : 0x440000, 0.3);
    zoneBg.fillRoundedRect(x - zoneWidth/2, y - zoneHeight/2, zoneWidth, zoneHeight, 8);
    zoneBg.lineStyle(2, isPlayerZone ? 0x008800 : 0x880000, 0.7);
    zoneBg.strokeRoundedRect(x - zoneWidth/2, y - zoneHeight/2, zoneWidth, zoneHeight, 8);
    // Create interactive area
    const interactive = scene.add.zone(x, y, zoneWidth, zoneHeight);
    interactive.setDropZone();
    interactive.setInteractive();
    
    // Create zone object
    const zone = {
      x: x,
      y: y,
      width: zoneWidth,
      height: zoneHeight,
      type: type,
      isPlayerZone: isPlayerZone,
      background: zoneBg,
      interactive: interactive,
      cards: [],
      isEmpty: () => zone.cards.length === 0,
      addCard: (card) => zone.cards.push(card),
      removeCard: (card) => {
        const index = zone.cards.indexOf(card);
        if (index > -1) zone.cards.splice(index, 1);
      },
      clear: () => {
        zone.cards.forEach(card => {
          if (card && card.destroy) card.destroy();
        });
        zone.cards = [];
      }
    };
    
    return zone;
  }

  /**
   * Creates a deck stack display
   * @param {Object} scene - Phaser scene
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} owner - Deck owner
   * @param {Object} options - Additional options
   * @returns {Object} Deck stack object
   */
  static createDeckStack(scene, x, y, owner, options = {}) {
    const {
      cardCount = 0,
      faceDown = true,
      showCount = true,
      scale = 1
    } = options;
    
    const deckContainer = scene.add.container(x, y);
    
    // Create deck background
    const deckBg = scene.add.graphics();
    deckBg.fillStyle(0x2a2a2a);
    deckBg.fillRoundedRect(-60, -80, 120, 160, 8);
    deckBg.lineStyle(2, 0x666666);
    deckBg.strokeRoundedRect(-60, -80, 120, 160, 8);
    deckContainer.add(deckBg);
    
    // Add card count text if enabled
    if (showCount) {
      const countText = scene.add.text(0, 0, cardCount.toString(), {
        fontSize: '16px',
        fontFamily: 'Arial Bold',
        fill: '#ffffff',
        align: 'center'
      });
      countText.setOrigin(0.5);
      deckContainer.add(countText);
    }
    
    deckContainer.setScale(scale);
    
    return {
      container: deckContainer,
      background: deckBg,
      countText: showCount ? countText : null,
      cardCount: cardCount,
      updateCount: (newCount) => {
        if (showCount && countText) {
          countText.setText(newCount.toString());
        }
      }
    };
  }

  /**
   * Creates a card selection dialog with pagination and interactive elements
   * @param {string} selectionId - Unique identifier for the selection
   * @param {Object} selection - Selection configuration object
   * @param {Phaser.Scene} scene - Phaser scene instance
   * @param {Function} onConfirm - Callback when user confirms selection
   * @returns {Object} Dialog interface with cleanup method
   */
  static createCardSelectionDialog(selectionId, selection, scene, onConfirm) {
    // Delegate to DialogUIManager
    return DialogUIManager.createCardSelectionDialog(selectionId, selection, scene, onConfirm);
  }

  /**
   * Creates a custom button dialog for specific interactions
   * @param {Object} selection - Selection configuration with custom buttons
   * @param {Phaser.Scene} scene - Phaser scene instance  
   * @param {Function} onConfirm - Callback when user confirms
   * @returns {Object} Dialog interface
   */
  static createCustomButtonDialog(selection, scene, onConfirm) {
    // Delegate to DialogUIManager
    return DialogUIManager.createCustomButtonDialog(selection, scene, onConfirm);
  }

  /**
   * Calculate card position within a zone
   * @param {Object} zone - Zone object
   * @param {number} index - Card index
   * @returns {Object} Position {x, y}
   */
  static calculateCardPosition(zone, index) {
    // Simple positioning logic - can be enhanced
    return {
      x: zone.x + (index * 5), // Slight offset for stacking effect
      y: zone.y + (index * 2)
    };
  }

  /**
   * Show zone restriction message to user
   * @param {string} message - Message to display
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
      align: 'center',
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 }
    });
    scene.restrictionMessage.setOrigin(0.5);
    scene.restrictionMessage.setDepth(2000);
    
    // Auto-hide after 3 seconds
    scene.time.delayedCall(3000, () => {
      if (scene.restrictionMessage) {
        scene.restrictionMessage.destroy();
        scene.restrictionMessage = null;
      }
    });
  }

  /**
   * Utility method to get card display data for preview
   * @param {Object} card - Card object
   * @returns {Object} Preview data
   */
  static _prepareCardDataForPreview(card) {
    if (!card) return null;
    
    return {
      id: card.cardId || card.id,
      name: card.cardData?.name || card.name || 'Unknown',
      hp: card.currentHP || card.cardData?.hp || 0,
      ap: card.currentAP || card.cardData?.ap || 0,
      description: card.cardData?.description || '',
      type: card.cardData?.type || 'unknown'
    };
  }

  /**
   * Prepare slot preview data for unit+pilot combinations
   * @param {Object} slotData - Slot data with unit and pilot
   * @returns {Object} Combined preview data
   */
  static _prepareSlotPreviewData(slotData) {
    if (!slotData || !slotData.unit) return null;
    
    const unit = slotData.unit;
    const pilot = slotData.pilot || slotData.pilotCard;
    
    // Calculate combined stats
    const unitAP = unit.currentAP || unit.cardData?.ap || 0;
    const unitHP = unit.currentHP || unit.cardData?.hp || 0;
    const pilotAP = pilot ? (pilot.currentAP || pilot.cardData?.ap || 0) : 0;
    const pilotHP = pilot ? (pilot.currentHP || pilot.cardData?.hp || 0) : 0;
    
    return {
      id: unit.cardData?.id || unit.cardId,
      name: unit.cardData?.name || 'Unit',
      hp: unitHP + pilotHP,
      ap: unitAP + pilotAP,
      description: `${unit.cardData?.name || 'Unit'}${pilot ? ` + ${pilot.cardData?.name || 'Pilot'}` : ''}`,
      type: 'slot_combination',
      unitData: this._prepareCardDataForPreview(unit),
      pilotData: pilot ? this._prepareCardDataForPreview(pilot) : null
    };
  }
}