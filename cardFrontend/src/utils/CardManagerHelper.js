// CardManagerHelper.js - Utility class for card management operations
import Card from '../components/Card.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

export default class CardManagerHelper {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Creates a card with standardized options
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} cardData - Card data
   * @param {Object} options - Card options
   * @returns {Card} Created card
   */
  createCard(x, y, cardData, options = {}) {
    const defaults = {
      interactive: true,
      draggable: false,
      scale: 1,
      usePreview: false
    };
    
    const config = { ...defaults, ...options };
    return new Card(this.scene, x, y, cardData, config);
  }

  /**
   * Creates multiple cards from data array
   * @param {Array} cardsData - Array of card data
   * @param {Object} positionConfig - Position configuration
   * @param {Object} cardOptions - Card options
   * @returns {Array} Array of created cards
   */
  createCards(cardsData, positionConfig, cardOptions = {}) {
    const cards = [];
    
    cardsData.forEach((cardData, index) => {
      const position = this.calculateCardPosition(index, cardsData.length, positionConfig);
      const card = this.createCard(position.x, position.y, cardData, cardOptions);
      cards.push(card);
    });
    
    return cards;
  }

  /**
   * Calculates card position in a layout
   * @param {number} index - Card index
   * @param {number} totalCards - Total number of cards
   * @param {Object} config - Position configuration
   * @returns {Object} {x, y} position
   */
  calculateCardPosition(index, totalCards, config) {
    const defaults = {
      centerX: 0,
      centerY: 0,
      spacing: 160,
      maxWidth: this.scene.cameras.main.width - 200
    };
    
    const posConfig = { ...defaults, ...config };
    const cardSpacing = Math.min(posConfig.spacing, posConfig.maxWidth / totalCards);
    const startX = posConfig.centerX - (totalCards - 1) * cardSpacing / 2;
    
    return {
      x: startX + (index * cardSpacing),
      y: posConfig.centerY
    };
  }

  /**
   * Reorganizes cards in a container with new spacing
   * @param {Array} cards - Array of cards to reorganize
   * @param {Object} container - Container to reorganize cards in
   * @param {Object} options - Reorganization options
   */
  reorganizeCards(cards, container, options = {}) {
    if (cards.length === 0) return;
    
    const defaults = {
      spacing: 160,
      maxWidth: this.scene.cameras.main.width - 200,
      animationDuration: 300,
      updateOriginalPosition: true
    };
    
    const config = { ...defaults, ...options };
    const cardSpacing = Math.min(config.spacing, config.maxWidth / cards.length);
    const startX = -(cards.length - 1) * cardSpacing / 2;
    
    cards.forEach((card, index) => {
      const newX = startX + (index * cardSpacing);
      
      if (config.animationDuration > 0) {
        this.scene.tweens.add({
          targets: card,
          x: newX,
          duration: config.animationDuration,
          ease: 'Power2.easeOut'
        });
      } else {
        card.x = newX;
      }
      
      if (config.updateOriginalPosition && card.originalPosition) {
        card.originalPosition.x = newX;
      }
    });
  }

  /**
   * Creates a deck stack visualization
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {Object} options - Stack options
   * @returns {Array} Array of deck cards
   */
  createDeckStack(x, y, options = {}) {
    const defaults = {
      numCards: 5,
      stackOffset: 1,
      texture: 'card-back',
      scale: 0.95,
      owner: 'player'
    };
    
    const config = { ...defaults, ...options };
    const deckCards = [];
    
    for (let i = 0; i < config.numCards; i++) {
      const cardX = Math.round(x + (i * config.stackOffset));
      const cardY = Math.round(y - (i * config.stackOffset));
      const card = this.scene.add.image(cardX, cardY, config.texture);
      
      // Scale card to match game config
      const scaleX = GAME_CONFIG.card.width / card.width;
      const scaleY = GAME_CONFIG.card.height / card.height;
      const scale = Math.min(scaleX, scaleY) * config.scale;
      card.setScale(scale);
      
      card.setDepth(i);
      card.setOrigin(0.5, 0.5);
      
      deckCards.push(card);
    }
    
    return deckCards;
  }

  /**
   * Sets up drag and drop for a card
   * @param {Card} card - Card to set up drag and drop for
   * @param {Object} options - Drag options
   */
  setupCardDragAndDrop(card, options = {}) {
    const defaults = {
      draggable: true,
      interactive: true
    };
    
    const config = { ...defaults, ...options };
    
    if (config.interactive) {
      card.setInteractive();
    }
    
    if (config.draggable) {
      this.scene.input.setDraggable(card);
    }
  }

  /**
   * Converts card ID to card object
   * @param {string} cardId - Card ID
   * @param {string} cardType - Optional card type override
   * @returns {Object} Card data object
   */
  convertCardIdToObject(cardId, cardType = null) {
    return {
      id: cardId,
      name: cardId,
      type: cardType || this.getCardTypeFromId(cardId),
      power: cardType === 'character' ? Math.floor(Math.random() * 5) + 1 : undefined
    };
  }

  /**
   * Converts array of card IDs to card objects
   * @param {Array} cardIds - Array of card IDs
   * @param {string} cardType - Optional card type override
   * @returns {Array} Array of card data objects
   */
  convertCardIdsToObjects(cardIds, cardType = null) {
    return cardIds.map(cardId => this.convertCardIdToObject(cardId, cardType));
  }

  /**
   * Gets card type from ID
   * @param {string} cardId - Card ID
   * @returns {string} Card type
   */
  getCardTypeFromId(cardId) {
    if (cardId.startsWith('c-')) return 'character';
    if (cardId.startsWith('h-')) return 'help';
    if (cardId.startsWith('sp-')) return 'sp';
    if (cardId.startsWith('s-')) return 'leader';
    return 'unknown';
  }

  /**
   * Shuffles an array using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Removes card from hand array and container
   * @param {Card} card - Card to remove
   * @param {Array} handArray - Hand array to remove from
   * @param {Container} container - Container to remove from
   * @returns {boolean} True if card was removed
   */
  removeCardFromHand(card, handArray, container) {
    const handIndex = handArray.indexOf(card);
    if (handIndex > -1) {
      handArray.splice(handIndex, 1);
      if (container && container.remove) {
        container.remove(card);
      }
      return true;
    }
    return false;
  }

  /**
   * Adds card to hand array and container
   * @param {Card} card - Card to add
   * @param {Array} handArray - Hand array to add to
   * @param {Container} container - Container to add to
   */
  addCardToHand(card, handArray, container) {
    handArray.push(card);
    if (container && container.add) {
      container.add(card);
    }
  }
}