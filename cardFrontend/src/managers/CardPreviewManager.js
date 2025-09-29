/**
 * CardPreviewManager - Handles all card preview functionality
 * Extracted from GameScene.js to reduce complexity and improve maintainability
 */
import Card from '../components/Card.js';
import CardFactory from '../utils/CardFactory.js';
import { applySlotOverlaySet, applySlotTotalsVisibility, finalizeSlotOverlayState } from '../utils/PowerOverlayCoordinator.js';

export default class CardPreviewManager {
  constructor(gameScene) {
    this.scene = gameScene;
    this.gameStateManager = gameScene.gameStateManager;
    this.previewCard = null;
    this.previewPilotCard = null;
  }

  /**
   * Show card preview for hand cards - handles both simple and complex slot preview data
   */
  showCardPreview(cardData) {
    // Remove existing preview card if any
    this.hideCardPreview();
    console.log("showCardPreview111", JSON.stringify(cardData));

    if (!this.scene.cardPreviewZone || !cardData) {
      return;
    }

    if (cardData.pilot) {
      console.log("Showing slot preview with pilot:", cardData.cardData?.id, "+", cardData.pilot.cardData?.id, "for slot:", cardData.slotName);

      const slotData = {
        unit: cardData.cardData,
        pilot: cardData.pilot.cardData,
        fieldCardValue: cardData.fieldCardValue || null
      };

      cardData.cardData.isRested = cardData.cardData.isRested;
      cardData.pilot.cardData.isRested = cardData.cardData.isRested;

      const mockUnitCard = {
        cardData: cardData.cardData,
        getCardFullData: () => cardData.cardData
      };

      const mockPilotCard = {
        cardData: cardData.pilot.cardData,
        getCardFullData: () => cardData.pilot.cardData
      };

      this.showDualCardPreview(mockUnitCard, mockPilotCard, slotData);
    } else {
      console.log("Showing slot preview (unit only):", cardData?.id);

      // Step 0: prepare preview instance
      this.previewCard = this._createPreviewCard(cardData, this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y, 2000, false);
      this.previewCard.fullCardData = cardData;

      // Steps 1-3: align data, decide totals visibility, finalize overlay
      this._applyPreviewOverlay({
        unitCard: this.previewCard,
        pilotCard: null,
        unitData: cardData,
        pilotData: null,
        slotFieldValue: cardData.fieldCardValue || null,
        zone: this.previewCard.zoneContext?.zoneType || 'slot1'
      });
    }
  }

  /**
   * Hide card preview
   */
  hideCardPreview() {
    if (this.previewCard) {
      this.previewCard.destroy();
      this.previewCard = null;
    }
  }

  /**
   * Show enhanced preview for slot cards - displays both unit and pilot if present
   * @param {Card} hoveredCard - The card being hovered over
   */
  showSlotCardPreview(hoveredCard) {
    console.log("adsfadsdsf ",JSON.stringify(hoveredCard.fullCardData))
    
    // First, hide any existing preview
    this.hideSlotCardPreview();

    if (!this.scene.cardPreviewZone || !hoveredCard) {
      console.warn('[showSlotCardPreview] Missing cardPreviewZone or hoveredCard');
      return;
    }

    console.log('[showSlotCardPreview] Hovering over card:', hoveredCard.cardData?.id, 'cardTypeInSlot:', hoveredCard.cardTypeInSlot, 'isInZone:', hoveredCard.isInZone);

    // Check if SlotAreaManager exists
    if (!this.scene.slotAreaManager) {
      console.warn('[showSlotCardPreview] SlotAreaManager not available, using fallback preview');
      this.showCardPreview(hoveredCard.getCardFullData());
      return;
    }

    // Determine if this is a slot card and which slot/player it belongs to
    const slotInfo = this.getSlotInfoFromCard(hoveredCard);
    console.log('[showSlotCardPreview] Slot info:', slotInfo);

    if (!slotInfo) {
      // Not a slot card or couldn't detect slot, use regular preview
      console.log('[showSlotCardPreview] No slot info found, using fallback preview');
      this.showCardPreview(hoveredCard.getCardFullData());  // Use full data with current stats
      return;
    }
    
    // Get both unit and pilot cards from the slot
    const slotSnapshot = this.scene.slotAreaManager.getSlotOverlaySnapshot(hoveredCard);
    if (!slotSnapshot) {
      console.warn('[showSlotCardPreview] Slot snapshot missing, using fallback');
      this.showCardPreview(hoveredCard.getCardFullData());
      return;
    }

    const { slotCards, slotData, slotFieldValue } = slotSnapshot;
    console.log('[showSlotCardPreview] Slot cards:', slotSnapshot.slotInfo.slotName, slotCards);

    const isHoveringUnit = slotCards.unit === hoveredCard;
    const isHoveringPilot = slotCards.pilot === hoveredCard;
    console.log('[showSlotCardPreview] Hover detection:', { isHoveringUnit, isHoveringPilot });

    if (slotCards.unit && slotCards.pilot) {
      if (isHoveringUnit) {
        console.log('[showSlotCardPreview] Hovering over unit - showing dual preview');
        this.showDualCardPreview(slotCards.unit, slotCards.pilot, slotData);
      } else if (isHoveringPilot) {
        console.log('[showSlotCardPreview] Hovering over pilot - showing pilot only');
        const pilotData = slotData?.pilot || slotCards.pilot.getCardFullData();
        // Step 0: prepare preview instance for pilot-only view
        this.previewCard = this._createPreviewCard(pilotData, this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y, 2000, true);
        this.previewCard.fullCardData = pilotData;

        // Steps 1-3: align data, decide totals visibility, finalize overlay
        this._applyPreviewOverlay({
          unitCard: null,
          pilotCard: this.previewCard,
          unitData: null,
          pilotData,
          slotFieldValue,
          zone: this.previewCard.zoneContext?.zoneType || 'slot1'
        });
      } else {
        console.warn('[showSlotCardPreview] Could not determine hovered card type, using fallback');
        this.showCardPreview(hoveredCard.getCardFullData());
      }
    } else if (slotCards.unit || slotCards.pilot) {
      const singleCard = slotCards.unit || slotCards.pilot;
      console.log('[showSlotCardPreview] Showing single card preview for:', singleCard.cardData?.id);
      const singleData = singleCard.getCardFullData();
      const isUnit = slotCards.unit === singleCard;
      const zone = isUnit ? 'slot1' : 'hand';

      // Step 0: prepare preview instance for single slot card
      this.previewCard = this._createPreviewCard(singleData, this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y, 2000, zone === 'slot1');
      this.previewCard.fullCardData = singleData;

      // Steps 1-3: align data, decide totals visibility, finalize overlay
      this._applyPreviewOverlay({
        unitCard: isUnit ? this.previewCard : null,
        pilotCard: isUnit ? null : this.previewCard,
        unitData: isUnit ? singleData : null,
        pilotData: isUnit ? null : singleData,
        slotFieldValue,
        zone: this.previewCard.zoneContext?.zoneType || zone
      });
    } else {
      console.warn('[showSlotCardPreview] No cards found in slot, using fallback');
      this.showCardPreview(hoveredCard.getCardFullData());
    }
  }

  /**
   * Show dual card preview (unit + pilot)
   * @param {Card} unitCard - The unit card  
   * @param {Card} pilotCard - The pilot card  
   */
  showDualCardPreview(unitCard, pilotCard, slotData = null) {
    if (!this.scene.cardPreviewZone) return;

    // Step 0: create preview card pair using current slot data
    this.previewCard = CardFactory.createPreviewCard(this.scene, unitCard.getCardFullData(), this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y, {
      gameStateManager: this.gameStateManager,
      scale: 3.5,
      depth: 2000,
      interactive: false,
      zone: unitCard.zoneContext?.zoneType || 'slot1'
    });

    // Create pilot preview (145px below unit) - Use full card data with current stats  
    this.previewPilotCard = CardFactory.createPreviewCard(this.scene, pilotCard.getCardFullData(), this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y + 145, {
      gameStateManager: this.gameStateManager,
      scale: 3.5,
      depth: 1999, // Slightly behind unit
      interactive: false,
      zone: pilotCard.zoneContext?.zoneType || 'slot1'
    });

    if (this.previewCard?.setOverlayOverrides) {
      this.previewCard.setOverlayOverrides({ totalsVisible: false });
      this.previewCard.applyZoneOverlayRules?.();
      console.log('[CardPreviewManager] Hiding total labels on unit preview (pilot present)');
    }

    const unitData = unitCard.getCardFullData();
    const pilotData = pilotCard.getCardFullData();
    this.previewCard.fullCardData = unitData;
    this.previewPilotCard.fullCardData = pilotData;

    const slotFieldValue = (slotData && slotData.fieldCardValue)
      || unitData?.fieldCardValue
      || pilotData?.fieldCardValue
      || null;

    const overlayState = this._applyPreviewOverlay({
      unitCard: this.previewCard,
      pilotCard: this.previewPilotCard,
      unitData,
      pilotData,
      slotFieldValue,
      zone: this.previewPilotCard.zoneContext?.zoneType || 'slot1'
    });

    console.log('[CardPreviewManager] Showing dual preview totals:', overlayState);
    console.log('Showing dual preview:', unitCard.cardData?.id, '+', pilotCard.cardData?.id);
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
    // Step 1: align card data and base stats
    const overlayState = applySlotOverlaySet({
      unitCard: unitCard || null,
      pilotCard: pilotCard || null,
      unitData: unitData || null,
      pilotData: pilotData || null,
      slotFieldValue: slotFieldValue || null
    });

    // Step 2: decide which preview should surface combined totals
    applySlotTotalsVisibility(unitCard || null, pilotCard || null, {
      unitShowsTotals: overlayState.unitShowsTotals,
      pilotShowsTotals: overlayState.pilotShowsTotals,
      zone: zone || 'slot1'
    });

    // Step 3: push totals + rested badge into the overlays
    finalizeSlotOverlayState(overlayState);
    return overlayState;
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
