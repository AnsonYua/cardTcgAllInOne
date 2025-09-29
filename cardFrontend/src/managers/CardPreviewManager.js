/**
 * CardPreviewManager - Handles all card preview functionality
 * Extracted from GameScene.js to reduce complexity and improve maintainability
 */
import CardFactory from '../utils/CardFactory.js';
import { applyOverlayPipeline } from '../utils/CardDisplayUtils.js';
import SlotAreaManager from '../components/SlotAreaManager.js';

export default class CardPreviewManager {
  constructor(gameScene) {
    this.scene = gameScene;
    this.gameStateManager = gameScene.gameStateManager;
    this.previewCard = null;
    this.previewPilotCard = null;
  }


  showCardPreviewWithZone(cardData, _zoneType) {
    this.hideCardPreview();
    if (this.previewPilotCard) {
      this.previewPilotCard.destroy();
      this.previewPilotCard = null;
    }
    if (!this.scene.cardPreviewZone || !cardData) {
      return;
    }

    const matchSlotData = SlotAreaManager.getSlotFromCarduid(this.gameStateManager, cardData.carduid);
    if (matchSlotData) {
      const slotFieldValue = matchSlotData.slotData?.fieldCardValue || null;
      const unitSource = matchSlotData.slotData?.unit || null;
      const pilotSource = matchSlotData.slotData?.pilot || null;
      const unitData = unitSource || null;
      const pilotData = pilotSource || null;
      const previewX = this.scene.cardPreviewZone.x;
      const previewY = this.scene.cardPreviewZone.y;
      const zoneLabel = matchSlotData.slotName || 'slot1';

      if (unitData && pilotData) {
        this.previewCard = this._createPreviewCard(unitData, previewX, previewY, 2000, true);
        this.previewCard.fullCardData = unitData;

        this.previewPilotCard = this._createPreviewCard(pilotData, previewX, previewY + 145, 1999, true);
        this.previewPilotCard.fullCardData = pilotData;
        
        applyOverlayPipeline({
          unitCard: this.previewCard,
          pilotCard: this.previewPilotCard,
          unitData,
          pilotData,
          slotFieldValue,
          zone: zoneLabel
        });
      } else if (unitData) {
        this.previewCard = this._createPreviewCard(unitData, previewX, previewY, 2000, true);
        this.previewCard.fullCardData = unitData;
        this.previewPilotCard = null;
        
        applyOverlayPipeline({
          unitCard: this.previewCard,
          pilotCard: null,
          unitData,
          pilotData: null,
          slotFieldValue,
          zone: zoneLabel
        });
      }
      return;
    }

    if (cardData.cardData.cardType == "base" && _zoneType != "card-hover") {
      console.log("_zoneType1111 ",_zoneType)
      this.previewCard = this._createPreviewCard(cardData, this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y, 2000, false);
      this.previewCard.fullCardData = cardData.cardData || cardData;
      this.previewPilotCard = null;

      const baseData = cardData;
      const slotFieldValue = cardData.fieldCardValue;

      applyOverlayPipeline({
        unitCard: this.previewCard,
        pilotCard: null,
        unitData: baseData,
        pilotData: null,
        slotFieldValue,
        zone: 'base'
      });
      return;
    }

    this.previewCard = this._createPreviewCard(cardData, this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y, 2000, false);
    this.previewCard.fullCardData = cardData;
    this.previewPilotCard = null;
  }
 

  /**
   * Hide card preview
   */
  hideCardPreview() {
    if (this.previewCard) {
      this.previewCard.destroy();
      this.previewCard = null;
    }
    if (this.previewPilotCard) {
      this.previewPilotCard.destroy();
      this.previewPilotCard = null;
    }
  }


  /**
   * Creates a preview card component
   * @param {Object} cardData - The card data to display
   * @param {number} x - X position
   * @param {number} y - Y position  
   * @param {number} depth - Z depth for layering
   * @returns {Card} The created preview card component
   */
  _createPreviewCard(cardData, x, y, depth = 2000, showTotals = true) {
    const inferredCardType = cardData?.cardType || cardData?.cardData?.cardType;
    const wantsBaseOverlay = inferredCardType === 'base';
    const shouldShowTotals = showTotals || wantsBaseOverlay;
    const targetZone = wantsBaseOverlay ? 'base' : (shouldShowTotals ? 'slot1' : 'hand');

    return CardFactory.createPreviewCard(this.scene, cardData, x, y, {
      gameStateManager: this.gameStateManager,
      scale: 3.5,
      depth,
      interactive: false,
      zone: targetZone,
      fieldCardValue: cardData?.fieldCardValue || null
    });
  }

  _applyPreviewOverlay({ unitCard, pilotCard, unitData, pilotData, slotFieldValue, zone }) {
    // Mirrors slot/base overlay sequencing so previews always match board values
    return applyOverlayPipeline({
      unitCard: unitCard || null,
      pilotCard: pilotCard || null,
      unitData: unitData || null,
      pilotData: pilotData || null,
      slotFieldValue: slotFieldValue || null,
      zone: zone || 'slot1'
    });
  }

  /**
   * Determine slot information from a hovered card
   * @param {Card} card - The card being hovered
   * @returns {Object|null} Slot info with playerType and slotName, or null if not a slot card
   */
  getSlotInfoFromCard(card) {
    try {
      // Use SlotAreaManager to determine slot info
      if (this.scene.slotAreaManager) {
        return this.scene.slotAreaManager.getSlotInfoFromCard(card);
      }
      
      console.warn('[CardPreviewManager] SlotAreaManager not available for slot detection');
      return null;
    } catch (error) {
      console.error('[CardPreviewManager] Error determining slot info:', error);
      return null;
    }
  }

  /**
   * Hide slot card preview (includes dual preview)
   */
  hideSlotCardPreview() {
    // Hide main preview card
    if (this.previewCard) {
      this.previewCard.destroy();
      this.previewCard = null;
    }

    // Hide pilot preview card
    if (this.previewPilotCard) {
      this.previewPilotCard.destroy();
      this.previewPilotCard = null;
    }
  }

  /**
   * Set cards above overlay for redraw dialog visibility
   */
  setCardsAboveOverlay() {
    // Use HandCardManager to set hand cards above overlay
    this.scene.handCardManager.setHandCardsAboveOverlay();

    // Bring all zone cards to front (above the overlay)
    console.log('DEBUG: Setting zone card depths...');

    // Handle player zones
    if (this.scene.playerZones) {
      Object.entries(this.scene.playerZones).forEach(([zoneName, zone]) => {
        if (zone && zone.card) {
          console.log(`DEBUG: Player ${zoneName} card found, setting depth to 1001`);
          zone.card.setDepth(1001);
          console.log(`DEBUG: Player ${zoneName} card depth is now:`, zone.card.depth);
        }
      });
    }

    // Handle opponent zones  
    if (this.scene.opponentZones) {
      Object.entries(this.scene.opponentZones).forEach(([zoneName, zone]) => {
        if (zone && zone.card) {
          console.log(`DEBUG: Opponent ${zoneName} card found, setting depth to 1001`);
          zone.card.setDepth(1001);
          console.log(`DEBUG: Opponent ${zoneName} card depth is now:`, zone.card.depth);
        }
      });
    }

    // Bring preview cards to front if they exist
    if (this.previewCard) {
      this.previewCard.setDepth(1001);
    }
    if (this.previewPilotCard) {
      this.previewPilotCard.setDepth(1001);
    }

    console.log('[CardPreviewManager] Cards set above overlay for dialog visibility');
  }

  /**
   * Highlight hand cards with pulsing effect
   */
  highlightHandCards() {
    const handCards = this.scene.handCardManager.getHandCards();
    handCards.forEach(card => {
      // Add a pulsing scale effect
      this.scene.tweens.add({
        targets: card,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });

    console.log('[CardPreviewManager] Hand cards highlighted with pulsing effect');
  }

  /**
   * Remove hand card highlight effects
   */
  removeHandCardHighlight() {
    const handCards = this.scene.handCardManager.getHandCards();
    handCards.forEach(card => {
      // Stop all tweens on the card
      this.scene.tweens.killTweensOf(card);
      
      // Reset scale
      card.setScale(1.1);
    });

    console.log('[CardPreviewManager] Hand card highlights removed');
  }

  /**
   * Clean up all preview resources
   */
  destroy() {
    this.hideCardPreview();
    this.hideSlotCardPreview();
    this.removeHandCardHighlight();
  }
}
