/**
 * Utility class for handling GameScene-related operations
 * Refactored: Dialog UI methods moved to DialogUIManager.js
 */
import { GAME_CONFIG } from '../config/gameConfig.js';

export default class GameSceneUtils {
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
    zoneBg.setAlpha(0);
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

}
