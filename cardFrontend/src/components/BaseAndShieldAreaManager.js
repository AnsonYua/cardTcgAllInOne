import CardFactory from '../utils/CardFactory.js';
import { mergeCardZoneData, applyOverlayPipeline } from '../utils/CardDisplayUtils.js';
import OverlayStatUtils from '../utils/OverlayStatUtils.js';
export default class BaseAndShieldAreaManager {
  constructor(scene, gameStateManager) {
    this.scene = scene;
    this.gameStateManager = gameStateManager;
    
    // Shield area cards
    this.playerShieldCards = [];
    this.opponentShieldCards = [];
    
    // Base area cards
    this.playerBaseCards = [];
    this.opponentBaseCards = [];
  }

  // ============ SHIELD AREA MANAGEMENT ============

  updateShieldAreas() {
    this.updatePlayerShields();
    this.updateOpponentShields();
  }

  updatePlayerShields() {
    const shieldData = this.gameStateManager.getMyShieldAreaCard();
    const zones = this.scene.playerZones;
    this.updateShieldArea('player', shieldData, zones.leaderDeck, this.playerShieldCards, 50);
  }

  updateOpponentShields() {
    const shieldData = this.gameStateManager.getOpponentShieldAreaCard();
    const zones = this.scene.opponentZones;
    this.updateShieldArea('opponent', shieldData, zones.leaderDeck, this.opponentShieldCards, -50);
  }

  updateShieldArea(playerType, shieldData, deckZone, cardArray, offsetY) {
    if (shieldData.length !== cardArray.length) {
      // Clear existing cards
      cardArray.forEach(card => card.destroy());
      cardArray.length = 0;

      // Create new cards
      const baseY = deckZone.y + offsetY;
      const yDirection = playerType === 'opponent' ? 1 : -1;
      
      shieldData.forEach((cardData, i) => {
        console.log(`${playerType} shield card information:`, JSON.stringify(cardData));
        
        const card = this.createShieldCard(cardData, deckZone.x, baseY- yDirection*100 + (20 * i * yDirection), i);
        cardArray.push(card);
      });
    }
    cardArray.forEach(card => card.active = false);
  }

  createShieldCard(cardData, x, y, index) {
    return CardFactory.createShieldCard(this.scene, cardData, x, y, {
      gameStateManager: this.gameStateManager,
      index,
      scale: 0.85
    });
  }

  // ============ BASE AREA MANAGEMENT ============

  updateBaseAreas() {
    this.updatePlayerBase();
    this.updateOpponentBase();
  }

  updatePlayerBase() {
    const baseData = this.gameStateManager.getMyBaseAreaCard();
    this.updateBaseArea('player', baseData, this.playerBaseCards, this.playerShieldCards);
  }

  updateOpponentBase() {
    const baseData = this.gameStateManager.getOpponentBaseAreaCard();
    this.updateBaseArea('opponent', baseData, this.opponentBaseCards, this.opponentShieldCards);
  }

  updateBaseArea(playerType, baseData, cardArray, shieldCardArray) {
    const basePosition = this.resolveBasePosition(playerType, shieldCardArray);

    if (!basePosition) {
      console.warn(`[BaseAndShieldAreaManager] Base position not found for ${playerType}`);
      return;
    }

    this.updateBaseAreaComprehensive({
      playerType,
      baseData,
      cardArray,
      position: basePosition
    });
  }

  resolveBasePosition(playerType, shieldCardArray) {
    if (shieldCardArray && shieldCardArray.length > 0) {
      const anchor = shieldCardArray[shieldCardArray.length - 1];
      if (anchor) {
        const offset = playerType === 'player' ? -80 : 80;
        return { x: anchor.x, y: anchor.y + offset };
      }
    }

    const zones = playerType === 'player' ? this.scene.playerZones : this.scene.opponentZones;
    if (zones?.base) {
      return { x: zones.base.x, y: zones.base.y };
    }

    if (zones?.leaderDeck) {
      return { x: zones.leaderDeck.x, y: zones.leaderDeck.y };
    }

    return null;
  }

  updateBaseAreaComprehensive({ playerType, baseData, cardArray, position }) {
    const baseCardData = baseData?.[0] || null;

    if (!baseCardData) {
      this.destroyBaseCards(cardArray);
      return;
    }

    const baseCard = this.prepareBaseCardInstance({ cardArray, cardData: baseCardData, position, playerType });
    if (!baseCard) {
      return;
    }

    const slotFieldValue = OverlayStatUtils.buildSingleCardTotals(baseCardData);

    // Reuse the same overlay pipeline as slot cards so base previews stay consistent
    applyOverlayPipeline({
      unitCard: baseCard,
      pilotCard: null,
      unitData: baseCardData,
      pilotData: null,
      slotFieldValue,
      zone: 'base'
    });

    cardArray.forEach(card => {
      if (card) {
        card.active = false;
      }
    });
  }

  prepareBaseCardInstance({ cardArray, cardData, position, playerType }) {
    const existing = cardArray[0] || null;

    if (!cardData) {
      this.destroyBaseCards(cardArray);
      return null;
    }

    if (!existing) {
      const created = CardFactory.createBaseCard(this.scene, cardData, position.x, position.y, {
        gameStateManager: this.gameStateManager,
        scale: 0.9,
        isPlayerZone: playerType === 'player'
      });
      cardArray.length = 0;
      cardArray.push(created);
      this.configureBaseCardInteraction(created, cardData, playerType);
      return created;
    }

    mergeCardZoneData(existing, cardData);
    existing.setPosition(position.x, position.y);
    this.configureBaseCardInteraction(existing, cardData, playerType);
    return existing;
  }

  destroyBaseCards(cardArray) {
    cardArray.forEach(card => card?.destroy?.());
    cardArray.length = 0;
  }

  /**
   * Update existing base card with new data (similar to SlotAreaManager.updateExistingSlotCard)
   * @param {Card} card - Existing base card to update
   * @param {Object} cardData - New card data
   */
  updateExistingBaseCard(card, cardData, playerType = 'player') {
    if (!card || !cardData) {
      console.warn('[BaseAndShieldAreaManager] updateExistingBaseCard called with invalid parameters');
      return;
    }

    mergeCardZoneData(card, cardData);

    const slotFieldValue = OverlayStatUtils.buildSingleCardTotals(cardData);

    applyOverlayPipeline({
      unitCard: card,
      pilotCard: null,
      unitData: cardData,
      pilotData: null,
      slotFieldValue,
      zone: 'base'
    });

    this.configureBaseCardInteraction(card, cardData, playerType);
  }

  configureBaseCardInteraction(card, cardData, playerType) {
    if (!card) {
      return;
    }

    const isPlayerBase = playerType === 'player';
    const rules = Array.isArray(cardData?.effects?.rules) ? cardData.effects.rules : [];
    const hasActivatedAbility = rules.some(rule => rule && rule.type === 'activated');
    const isRested = this.isBaseCardRested(cardData);
    const shouldEnable = isPlayerBase && hasActivatedAbility && !isRested;

    card.setZonePlacement(true, 'base', isPlayerBase);

    if (shouldEnable) {
      if (!card._baseInteractionInitialized && typeof card.setupInteraction === 'function') {
        card.setupInteraction();
        card._baseInteractionInitialized = true;
      }

      if (typeof card.setInteractive === 'function') {
        card.setInteractive(true);
      }

      card.isInteractionDisabled = false;
      return;
    }

    if (typeof card.disableInteractive === 'function') {
      card.disableInteractive();
    } else if (typeof card.setInteractive === 'function') {
      card.setInteractive(false);
    }

    if (typeof card.disableInteraction === 'function') {
      card.disableInteraction();
    }

    card.isInteractionDisabled = true;
  }

  isBaseCardRested(cardData) {
    const candidates = [
      cardData?.isRested,
      cardData?.cardData?.isRested,
      cardData?.status,
      cardData?.cardState?.status
    ];

    for (const value of candidates) {
      if (typeof value === 'boolean') {
        return value;
      }
      if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        if (normalized === 'rested' || normalized === 'tapped') {
          return true;
        }
        if (normalized === 'active' || normalized === 'ready') {
          return false;
        }
      }
    }

    return false;
  }


  /**
   * Update total AP and HP labels for base cards
   * Base cards should show total labels since they are in the 'base' zone
   * @param {Card} card - Base card to update
   */
  updateBaseCardTotalLabels(card) {
    if (!card || !card.fullCardData) {
      console.warn('[BaseAndShieldAreaManager] updateBaseCardTotalLabels called with invalid card');
      return;
    }
    console.log(`[BaseAndShieldAreaManager] Updating base card total labels for card:`, card.cardData?.id);
    
    const slotFieldValue = OverlayStatUtils.buildSingleCardTotals(card.fullCardData);

    applyOverlayPipeline({
      unitCard: card,
      pilotCard: null,
      unitData: card.fullCardData,
      pilotData: null,
      slotFieldValue,
      zone: 'base'
    });
  }

  /**
   * Force update all base card total labels (useful for fixing sync issues)
   * @param {string} playerType - 'player', 'opponent', or 'all' for both
   */
  updateAllBaseCardTotalLabels(playerType = 'all') {
    console.log(`[BaseAndShieldAreaManager] Force updating all base card total labels for: ${playerType}`);
    
    const updateCards = (cards, type) => {
      cards.forEach(card => {
        if (card && card.fullCardData) {
          this.updateBaseCardTotalLabels(card);
          console.log(`[BaseAndShieldAreaManager] Force updated ${type} base card total labels:`, card.cardData?.id);
        }
      });
    };
    
    if (playerType === 'all' || playerType === 'player') {
      updateCards(this.playerBaseCards, 'player');
    }
    
    if (playerType === 'all' || playerType === 'opponent') {
      updateCards(this.opponentBaseCards, 'opponent');
    }
  }

  // ============ COMBINED UPDATE METHOD ============

  updateAll() {
    this.updateShieldAreas();
    this.updateBaseAreas();
  }

  // ============ CLEANUP ============

  destroy() {
    // Clean up all cards
    [...this.playerShieldCards, ...this.opponentShieldCards, 
     ...this.playerBaseCards, ...this.opponentBaseCards].forEach(card => {
      if (card && card.destroy) {
        card.destroy();
      }
    });
    
    // Clear arrays
    this.playerShieldCards.length = 0;
    this.opponentShieldCards.length = 0;
    this.playerBaseCards.length = 0;
    this.opponentBaseCards.length = 0;
  }

  // ============ SELECTION MANAGEMENT ============

  /**
   * Deselect all base cards (both player and opponent) silently without animations
   */
  deselectAllBaseCards() {
    // Deselect all player base cards
    console.log("dafadsfasdfadsdsfds ",JSON.stringify(this.playerBaseCards))
    this.playerBaseCards.forEach((card, index) => {
      if (card && card.isSelected) {
        console.log(`Deselecting player base card ${card.cardData?.id || index}`);
        card.deselectSilently();
      }
    });

    // Deselect all opponent base cards
    this.opponentBaseCards.forEach((card, index) => {
      if (card && card.isSelected) {
        console.log(`Deselecting opponent base card ${card.cardData?.id || index}`);
        card.deselectSilently();
      }
    });
  }

  /**
   * Deselect all shield cards (both player and opponent) silently without animations
   */
  deselectAllShieldCards() {
    // Deselect all player shield cards
    this.playerShieldCards.forEach((card, index) => {
      if (card && card.isSelected) {
        console.log(`Deselecting player shield card ${card.cardData?.id || index}`);
        card.deselectSilently();
      }
    });

    // Deselect all opponent shield cards
    this.opponentShieldCards.forEach((card, index) => {
      if (card && card.isSelected) {
        console.log(`Deselecting opponent shield card ${card.cardData?.id || index}`);
        card.deselectSilently();
      }
    });
  }

  // ============ UTILITY METHODS ============

  getShieldCardCount(isOpponent = false) {
    return isOpponent ? this.opponentShieldCards.length : this.playerBaseCards.length;
  }

  getBaseCardCount(isOpponent = false) {
    return isOpponent ? this.opponentBaseCards.length : this.playerBaseCards.length;
  }

  getAllCards() {
    return [
      ...this.playerShieldCards,
      ...this.opponentShieldCards,
      ...this.playerBaseCards,
      ...this.opponentBaseCards
    ];
  }
}
