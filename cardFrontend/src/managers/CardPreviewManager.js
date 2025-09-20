/**
 * CardPreviewManager - Handles all card preview functionality
 * Extracted from GameScene.js to reduce complexity and improve maintainability
 */
import Card from '../components/Card.js';
import CardStatCalculator from '../utils/CardStatCalculator.js';

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

    // Check if this is slot preview data (unit + pilot combination)
    if (cardData.isSlotPreview) {
      if (cardData.pilot) {
        console.log("Showing slot preview with pilot:", cardData.cardData?.id, "+", cardData.pilot.cardData?.id, "for slot:", cardData.slotName);
        // Create mock Card objects to reuse existing showDualCardPreview method
        const mockUnitCard = {
            cardData: cardData.cardData,
            getCardFullData: () => cardData.cardData
        };
        const mockPilotCard = {
            cardData: cardData.pilot.cardData,
            getCardFullData: () => cardData.pilot.cardData
        };
        this.showDualCardPreview(mockUnitCard, mockPilotCard);
      } else {
        console.log("Showing slot preview (unit only):", cardData.cardData?.id, "for slot:", cardData.slotName);
        // Use the regular single card preview logic for unit-only slots
        const displayCardData = cardData.cardData;
        this.previewCard = this._createPreviewCard(displayCardData, this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y, 2000);
        
        // Update total labels for unit-only slot preview
        if (this.previewCard && this.previewCard.updateTotalLabels) {
          // Create mock unit card for calculation
          const mockUnitCard = {
            fullCardData: cardData
          };
          
          // Calculate total stats (unit only, no pilot)
          const { totalAP, totalHP } = CardStatCalculator.calculateTotalInSlot(mockUnitCard, null);
          
          this.previewCard.updateTotalLabels(totalAP, totalHP);
          console.log(`[CardPreviewManager] Updated unit-only slot preview total labels: AP=${totalAP}, HP=${totalHP}`);
        }
        
        // Show total labels since this is a slot preview
        if (this.previewCard.powerOverlay && this.previewCard.powerOverlay.setTotalLabelsVisibility) {
          this.previewCard.powerOverlay.setTotalLabelsVisibility('slot1');
        }
      }
      return;
    }

    // Regular single card preview
    const displayCardData = cardData;
    this.previewCard = this._createPreviewCard(displayCardData, this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y, 2000);
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
      this.showCardPreview(hoveredCard.getCardData());
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
    const slotCards = this.scene.slotAreaManager.getSlotCards(slotInfo.playerType, slotInfo.slotName);
    console.log('[showSlotCardPreview] Slot cards:', slotInfo.slotName, slotCards);

    // Determine which card is being hovered over
    const isHoveringUnit = slotCards.unit === hoveredCard;
    const isHoveringPilot = slotCards.pilot === hoveredCard;

    console.log('[showSlotCardPreview] Hover detection:', { isHoveringUnit, isHoveringPilot });

    if (slotCards.unit && slotCards.pilot) {
      if (isHoveringUnit) {
        // Hovering over unit card - show dual preview (unit + pilot)
        console.log('[showSlotCardPreview] Hovering over unit - showing dual preview');
        this.showDualCardPreview(slotCards.unit, slotCards.pilot);
      } else if (isHoveringPilot) {
        // Hovering over pilot card - show only pilot
        console.log('[showSlotCardPreview] Hovering over pilot - showing pilot only');
        this.showCardPreview(slotCards.pilot.getCardFullData());  // Use full data with current stats
      } else {
        // Fallback if detection failed
        console.warn('[showSlotCardPreview] Could not determine hovered card type, using fallback');
        this.showCardPreview(hoveredCard.getCardFullData());  // Use full data with current stats
      }
    } else if (slotCards.unit || slotCards.pilot) {
      // Single card in slot
      const singleCard = slotCards.unit || slotCards.pilot;
      console.log('[showSlotCardPreview] Showing single card preview for:', singleCard.cardData?.id);
      this.showCardPreview(singleCard.getCardFullData());  // Use full data with current stats
    } else {
      console.warn('[showSlotCardPreview] No cards found in slot, using fallback');
      this.showCardPreview(hoveredCard.getCardFullData());  // Use full data with current stats
    }
  }

  /**
   * Show dual card preview (unit + pilot)
   * @param {Card} unitCard - The unit card  
   * @param {Card} pilotCard - The pilot card  
   */
  showDualCardPreview(unitCard, pilotCard) {
    if (!this.scene.cardPreviewZone) return;

    // Create unit preview (on top) - Use full card data with current stats
    this.previewCard = new Card(this.scene, this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y, unitCard.getCardFullData(), {
      scale: 3.5,
      gameStateManager: this.gameStateManager,
      usePreview: false,
      handleOutside: true // Disable selection for preview cards
    });
    this.previewCard.setDepth(2000);

    // Create pilot preview (145px below unit) - Use full card data with current stats  
    this.previewPilotCard = new Card(this.scene, this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y + 145, pilotCard.getCardFullData(), {
      scale: 3.5,
      gameStateManager: this.gameStateManager,
      usePreview: false,
      handleOutside: true // Disable selection for preview cards
    });
    this.previewPilotCard.setDepth(1999); // Slightly behind unit

    // Apply total labels visibility rule: only pilot shows totals when both present
    if (this.previewCard.powerOverlay && this.previewCard.powerOverlay.setTotalLabelsVisibility) {
      this.previewCard.powerOverlay.setTotalLabelsVisibility('hand'); // Hide unit total labels
      console.log('[CardPreviewManager] Hiding total labels on unit preview (pilot present)');
    }
    
    if (this.previewPilotCard.powerOverlay && this.previewPilotCard.powerOverlay.setTotalLabelsVisibility) {
      this.previewPilotCard.powerOverlay.setTotalLabelsVisibility('slot1'); // Show pilot total labels
      
      // Update pilot total stats to current values (representing combined unit+pilot stats)
      if (this.previewPilotCard.powerOverlay.updateTotalStats) {
        const { totalAP, totalHP } = CardStatCalculator.calculateTotalInSlot(unitCard, pilotCard);
        this.previewPilotCard.powerOverlay.updateTotalStats(totalAP, totalHP);
      }
      
      console.log('[CardPreviewManager] Showing total labels on pilot preview');
    }

    console.log('Showing dual preview:', unitCard.cardData?.id, '+', pilotCard.cardData?.id);
  }

  /**
   * Show slot preview with unit + pilot combination from selection dialog
   * @param {Object} slotPreviewData - Slot preview data with unit and pilot info
   */
  showSlotPreviewWithPilot(slotPreviewData) {
    if (!this.scene.cardPreviewZone) return;

    const unitCardData = slotPreviewData.cardData;
    const pilotCardData = slotPreviewData.pilot.cardData;

    // Create unit preview (on top)
    this.previewCard = new Card(this.scene, this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y, unitCardData, {
      scale: 3.5,
      gameStateManager: this.gameStateManager,
      usePreview: false,
      handleOutside: true // Disable selection for preview cards
    });
    this.previewCard.setDepth(2000);

    // Create pilot preview (145px below unit - same as existing dual preview)
    this.previewPilotCard = new Card(this.scene, this.scene.cardPreviewZone.x, this.scene.cardPreviewZone.y + 145, pilotCardData, {
      scale: 3.5,
      gameStateManager: this.gameStateManager,
      usePreview: false,
      handleOutside: true // Disable selection for preview cards
    });
    this.previewPilotCard.setDepth(1999);

    // Apply total labels visibility rule: only pilot shows totals when both present
    if (this.previewCard.powerOverlay && this.previewCard.powerOverlay.setTotalLabelsVisibility) {
      this.previewCard.powerOverlay.setTotalLabelsVisibility('hand'); // Hide unit total labels
      console.log('[CardPreviewManager] Hiding total labels on unit preview with pilot (selection dialog)');
    }
    
    if (this.previewPilotCard.powerOverlay && this.previewPilotCard.powerOverlay.setTotalLabelsVisibility) {
      this.previewPilotCard.powerOverlay.setTotalLabelsVisibility('slot1'); // Show pilot total labels
      
      // Update pilot total stats to current values
      if (this.previewPilotCard.powerOverlay.updateTotalStats) {
        const totalAP = CardStatCalculator.calculateTotalAP(pilotCardData);
        const totalHP = CardStatCalculator.calculateTotalHP(pilotCardData);
        this.previewPilotCard.powerOverlay.updateTotalStats(totalAP, totalHP);
      }
      
      console.log('[CardPreviewManager] Showing total labels on pilot preview (selection dialog)');
    }

    console.log('Showing slot preview from dialog:', unitCardData?.id, '+', pilotCardData?.id, 'for slot:', slotPreviewData.slotName);
  }

  /**
   * Creates a preview card component
   * @param {Object} cardData - The card data to display
   * @param {number} x - X position
   * @param {number} y - Y position  
   * @param {number} depth - Z depth for layering
   * @returns {Card} The created preview card component
   */
  _createPreviewCard(cardData, x, y, depth = 2000) {
    const previewCard = new Card(this.scene, x, y, cardData, {
      scale: 3.5,
      gameStateManager: this.gameStateManager,
      usePreview: false,
      interactive: false
    });

    previewCard.setDepth(depth);
    
    // Show total labels on preview cards (single card preview)
    if (previewCard.powerOverlay && previewCard.powerOverlay.setTotalLabelsVisibility) {
      previewCard.powerOverlay.setTotalLabelsVisibility('slot1'); // Show total labels
      
      // Update total stats to current values if available
      if (previewCard.updateTotalLabels && cardData) {
        const totalAP = CardStatCalculator.calculateTotalAP(cardData);
        const totalHP = CardStatCalculator.calculateTotalHP(cardData);
        previewCard.updateTotalLabels(totalAP, totalHP);
      }
      
      console.log('[CardPreviewManager] Showing total labels on single preview card');
    }
    
    return previewCard;
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