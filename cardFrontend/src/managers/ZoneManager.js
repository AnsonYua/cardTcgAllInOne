// ZoneManager.js - Handles game zones, card placement, and zone interactions
import { GAME_CONFIG } from '../config/gameConfig.js';
import Card from '../components/Card.js';

export default class ZoneManager {
  constructor(scene) {
    this.scene = scene;
    this.playerZones = {};
    this.opponentZones = {};
    this.cardPreviewZone = null;
    this.previewCard = null;
  }

  init(layout) {
    this.layout = layout;
    this.createZones();
    this.createDeckVisualizations();
  }

  createZones() {
    // Create opponent zones
    this.opponentZones = {};
    Object.entries(this.layout.opponent).forEach(([zoneType, position]) => {
      const zone = this.createZone(position.x, position.y, zoneType, false);
      this.opponentZones[zoneType] = zone;
    });
    
    // Create player zones
    this.playerZones = {};
    Object.entries(this.layout.player).forEach(([zoneType, position]) => {
      const zone = this.createZone(position.x, position.y, zoneType, true);
      this.playerZones[zoneType] = zone;
    });

    // Create functional areas
    Object.entries(this.layout.functionalArea).forEach(([zoneType, position]) => {
      const zone = this.createZone(position.x, position.y, zoneType, false);
      if (zoneType === 'cardPreview') {
        this.cardPreviewZone = zone;
      }
    });
  }

  createZone(x, y, type, isPlayerZone) {
    let placeholder;
    
    // Show deck cards for deck zones, placeholder for others
    if (type === 'deck') {
      const initialDeckStack = this.createDeckStack(x, y, isPlayerZone ? 'player' : 'opponent');
      placeholder = initialDeckStack[0];
      
      // Store initial deck stacks
      if (isPlayerZone) {
        this.initialPlayerDeckStack = initialDeckStack;
      } else {
        this.initialOpponentDeckStack = initialDeckStack;
      }
    } else if (type === 'cardPreview') {
      placeholder = this.scene.add.image(x, y, 'zone-placeholder');
    } else if (type === 'leaderDeck') {
      placeholder = this.scene.add.image(x, y, 'zone-placeholder');
    } else {
      placeholder = this.scene.add.image(x, y, 'zone-placeholder');
    }
    
    // Zone label
    const label = this.scene.add.text(x, y + 95, type.toUpperCase(), {
      fontSize: '12px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    label.setOrigin(0.5);
    
    // Zone-specific styling
    if (type === 'leaderDeck') {
      placeholder.setRotation(Math.PI / 2);
      label.setAlpha(1);
      label.setY(label.y - 20);
    } else if (type === 'cardPreview') {
      placeholder.setScale(3);
      label.setAlpha(0);
    } else {
      label.setAlpha(1);
    }
    
    // Zone interaction (only for player zones)
    if (isPlayerZone) {
      this.setupZoneInteraction(x, y, type);
    }
    
    return {
      placeholder,
      label,
      x,
      y,
      card: null,
      type,
      isPlayerZone
    };
  }

  setupZoneInteraction(x, y, type) {
    const dropZone = this.scene.add.zone(x, y, 130, 190);
    dropZone.setRectangleDropZone(130, 190);
    dropZone.setData('zoneType', type);
    
    // Visual feedback for drop zones
    dropZone.on('dragenter', (pointer, gameObject) => {
      if (this.canDropCardInZone(gameObject, type)) {
        const highlight = this.scene.add.image(x, y, 'zone-highlight');
        highlight.setTint(GAME_CONFIG.colors.success);
        dropZone.setData('highlight', highlight);
      }
    });
    
    dropZone.on('dragleave', () => {
      const highlight = dropZone.getData('highlight');
      if (highlight) {
        highlight.destroy();
        dropZone.setData('highlight', null);
      }
    });
    
    dropZone.on('drop', (pointer, gameObject) => {
      this.handleCardDrop(gameObject, type, x, y);
      const highlight = dropZone.getData('highlight');
      if (highlight) {
        highlight.destroy();
        dropZone.setData('highlight', null);
      }
    });
  }

  createDeckStack(x, y, owner) {
    const numCards = 5;
    const stackOffset = 1;
    const deckCards = [];
    
    for (let i = 0; i < numCards; i++) {
      const cardX = Math.round(x + (i * stackOffset));
      const cardY = Math.round(y - (i * stackOffset));
      const card = this.scene.add.image(cardX, cardY, 'card-back');
      
      const scaleX = GAME_CONFIG.card.width / card.width;
      const scaleY = GAME_CONFIG.card.height / card.height;
      const scale = Math.min(scaleX, scaleY) * 0.95;
      card.setScale(scale);
      
      card.setDepth(i);
      card.setOrigin(0.5, 0.5);
      
      deckCards.push(card);
    }
    
    return deckCards;
  }

  createDeckVisualizations() {
    this.playerDeckStack = this.initialPlayerDeckStack || [];
    this.opponentDeckStack = this.initialOpponentDeckStack || [];
  }

  // Zone interaction logic
  canDropCardInZone(card, zoneType) {
    return card.canPlayInZone(zoneType);
  }

  handleCardDrop(card, zoneType, x, y) {
    if (this.canDropCardInZone(card, zoneType)) {
      // Move card to zone
      card.moveToPosition(x, y);
      card.options.draggable = false;
      
      // Emit event for game logic to handle
      this.scene.events.emit('card-dropped', {
        card: card,
        zoneType: zoneType,
        position: { x, y }
      });
      
      // Update zone
      const zone = this.playerZones[zoneType];
      if (zone) {
        zone.card = card;
        zone.placeholder.setVisible(false);
      }
    } else {
      // Return card to hand
      card.returnToOriginalPosition();
    }
  }

  // Update zones with new card data
  updateZones(gameStateManager) {
    const playerZones = gameStateManager.getPlayerZones();
    const opponentId = gameStateManager.getOpponent();
    const opponentZones = gameStateManager.getPlayerZones(opponentId);
    
    // Update player zones
    Object.entries(playerZones).forEach(([zoneType, cardData]) => {
      const zone = this.playerZones[zoneType];
      if (zone && cardData && !zone.card) {
        const card = new Card(this.scene, zone.x, zone.y, cardData, {
          interactive: false,
          scale: 0.9
        });
        zone.card = card;
        zone.placeholder.setVisible(false);
      }
    });
    
    // Update opponent zones
    Object.entries(opponentZones).forEach(([zoneType, cardData]) => {
      const zone = this.opponentZones[zoneType];
      if (zone && cardData && !zone.card) {
        const card = new Card(this.scene, zone.x, zone.y, cardData, {
          interactive: false,
          faceDown: cardData.faceDown || false,
          scale: 0.9
        });
        zone.card = card;
        zone.placeholder.setVisible(false);
      }
    });
  }

  // Card preview functionality
  showCardPreview(cardData) {
    this.hideCardPreview();
    
    if (this.cardPreviewZone && cardData) {
      this.previewCard = new Card(this.scene, this.cardPreviewZone.x, this.cardPreviewZone.y, cardData, {
        interactive: false,
        draggable: false,
        scale: 3.5,
        usePreview: false
      });
      
      this.previewCard.setDepth(2000);
    }
  }

  hideCardPreview() {
    if (this.previewCard) {
      this.previewCard.destroy();
      this.previewCard = null;
    }
  }

  // Deck stack visibility
  showDeckStacks() {
    this.playerDeckStack.forEach(card => {
      card.setVisible(true);
      card.setAlpha(1);
    });
    
    this.opponentDeckStack.forEach(card => {
      card.setVisible(true);
      card.setAlpha(1);
    });
  }

  hideDeckStacks() {
    if (this.playerDeckStack) {
      this.playerDeckStack.forEach(card => card.setVisible(false));
    }
    if (this.opponentDeckStack) {
      this.opponentDeckStack.forEach(card => card.setVisible(false));
    }
  }

  // Getters
  getPlayerZones() {
    return this.playerZones;
  }

  getOpponentZones() {
    return this.opponentZones;
  }

  getCardPreviewZone() {
    return this.cardPreviewZone;
  }

  getLayout() {
    return this.layout;
  }

  // Clean up resources
  destroy() {
    this.hideCardPreview();
    
    // Clean up zones
    [this.playerZones, this.opponentZones].forEach(zones => {
      Object.values(zones).forEach(zone => {
        if (zone.placeholder) zone.placeholder.destroy();
        if (zone.label) zone.label.destroy();
        if (zone.card) zone.card.destroy();
      });
    });
    
    this.playerZones = {};
    this.opponentZones = {};
  }
}