/**
 * HandCardManager - Handles all hand card functionality
 * Extracted from GameScene.js to reduce complexity and improve maintainability
 */
import Card from '../components/Card.js';
import HandUtils from '../utils/HandUtils.js';

export default class HandCardManager {
  constructor(gameScene) {
    this.scene = gameScene;
    this.gameStateManager = gameScene.gameStateManager;
    this.playerHand = [];
    this.handContainer = null;
  }

  /**
   * Initialize hand container
   */
  createHandContainer() {
    const { width, height } = this.scene.cameras.main;
    this.handContainer = this.scene.add.container(width / 2 - 50, height - 120);
    
    // Store reference in scene for backward compatibility
    this.scene.handContainer = this.handContainer;
    this.scene.playerHand = this.playerHand;
  }

  /**
   * Update current player hand (partial update)
   */
  updateCurrentPlayerHand() {
    const handDetails = this.gameStateManager.getPlayerHand();
    const newHand = handDetails.slice(0, Math.min(handDetails.length, this.playerHand.length));
    console.log("new hand  " + JSON.stringify(newHand));
    this.updatePlayerHandWithCards(newHand);
  }

  /**
   * Update player hand (full update)
   */
  updatePlayerHand() {
    // Get hand from game state manager
    const handDetails = this.gameStateManager.getPlayerHand();
    console.log('updatePlayerHand - hand data:', JSON.stringify(handDetails));
    this.updatePlayerHandWithCards(handDetails);
  }

  /**
   * Update player hand with specific cards
   * @param {Array} hand - Array of card data
   */
  updatePlayerHandWithCards(hand) {
    // Clear existing hand
    this.playerHand.forEach(card => card.destroy());
    this.playerHand = [];
    this.handContainer.removeAll();

    console.log('updatePlayerHand - hand data:', JSON.stringify(hand));
    if (!hand || hand.length === 0) {
      console.log('No hand data found, returning early');
      return;
    }

    // Calculate card positions
    const cardSpacing = Math.min(160, (this.scene.cameras.main.width - 200) / hand.length);
    const startX = -(hand.length - 1) * cardSpacing / 2;

    // Create cards
    hand.forEach((cardData, index) => {
      console.log("sadfadsfdsafdasfdfsdadssdss")
      let processedCardData = cardData;
      const x = startX + (index * cardSpacing);
      const card = new Card(this.scene, x, 0, processedCardData, {
        scale: 1.1,
        gameStateManager: this.gameStateManager,
        usePreview: true
      });

      card.setZoneContext('hand', {
        isInZone: false,
        isPlayerZone: true
      });

      if (card.setFieldCardValue) {
        card.setFieldCardValue(processedCardData.fieldCardValue, {
          source: 'card'
        });
      }

      this.playerHand.push(card);
      this.handContainer.add(card);
    });

    // Update scene reference for backward compatibility
    this.scene.playerHand = this.playerHand;
  }

  /**
   * Reorganize hand cards with proper spacing
   */
  reorganizeHand() {
    if (this.playerHand.length === 0) return;

    const cardSpacing = Math.min(160, (this.scene.cameras.main.width - 200) / this.playerHand.length);
    const startX = -(this.playerHand.length - 1) * cardSpacing / 2;

    this.playerHand.forEach((card, index) => {
      const newX = startX + (index * cardSpacing);
      card.moveToPosition(newX, 0, 300, false); // false = don't remove from container
      card.originalPosition.x = newX;
    });
  }

  /**
   * Deselect all hand cards
   */
  deselectAllHandCards() {
    this.playerHand.forEach(handCard => {
      if (handCard.isSelected) {
        console.log(`Deselecting hand card ${handCard.cardData?.id}`);
        handCard.deselectSilently();
      }
    });
  }

  /**
   * Add cards to player hand with animation
   * @param {Array} cardsToAdd - Array of card data to add
   */
  addCardsToPlayerHand(cardsToAdd) {
    // Get current game state to update
    const gameState = this.gameStateManager.getGameState();
    const currentPlayer = this.gameStateManager.getCurrentPlayerId();
    
    if (!gameState.gameEnv?.players?.[currentPlayer]?.deck?.hand) {
      console.error('Cannot add cards - player hand not found in game state');
      return;
    }

    cardsToAdd.forEach((cardData, index) => {
      // Add card to game state first
      gameState.gameEnv.players[currentPlayer].deck.hand.push(cardData.id);

      // Calculate position for new card (rightmost position)
      const currentHandLength = this.playerHand.length; // Current cards in hand
      const totalCards = currentHandLength + 1; // Including this new card
      const cardSpacing = Math.min(160, (this.scene.cameras.main.width - 200) / totalCards);
      const startX = -(totalCards - 1) * cardSpacing / 2;
      const newCardX = startX + (currentHandLength * cardSpacing); // Position for new card

      // Convert to world coordinates
      const worldTargetX = this.handContainer.x + newCardX;
      const worldTargetY = this.handContainer.y;

      // Animate existing hand cards to slide left to make space for this card
      this.reorganizeHand();

      // Create temporary card at deck position for animation
      const deckPosition = this.scene.layout?.player?.deck || { x: 100, y: 100 };
      const tempCard = new Card(this.scene, deckPosition.x, deckPosition.y, cardData, {
        scale: 1.1,
        gameStateManager: this.gameStateManager,
        usePreview: true
      });

      tempCard.setZoneContext('hand', {
        isInZone: false,
        isPlayerZone: true
      });

      if (tempCard.setFieldCardValue) {
        tempCard.setFieldCardValue(cardData.fieldCardValue, {
          source: 'card'
        });
      }

      // Set high depth so it appears above other cards during animation
      tempCard.setDepth(1000);

      // Animate card from deck to hand
      this.scene.tweens.add({
        targets: tempCard,
        x: worldTargetX,
        y: worldTargetY,
        duration: 800,
        ease: 'Power2',
        delay: index * 200, // Stagger multiple cards
        onComplete: () => {
          // Calculate position relative to hand container
          const relativeX = tempCard.x - this.handContainer.x;
          const relativeY = tempCard.y - this.handContainer.y;

          // Convert temporary card to actual hand card
          const newCard = new Card(this.scene, relativeX, relativeY, cardData, {
            scale: 1.1,
            gameStateManager: this.gameStateManager,
            usePreview: true
          });

          newCard.setZoneContext('hand', {
            isInZone: false,
            isPlayerZone: true
          });

          if (newCard.setFieldCardValue) {
            newCard.setFieldCardValue(cardData.fieldCardValue, {
              source: 'card'
            });
          }

          // Add to hand array and container
          this.playerHand.push(newCard);
          this.handContainer.add(newCard);

          // Set proper depth
          newCard.setDepth(0);

          // Destroy temporary card
          tempCard.destroy();

          console.log(`Card ${cardData.id} added to hand at position ${this.playerHand.length - 1} at (${relativeX}, ${relativeY})`);

          // Update scene reference for backward compatibility
          this.scene.playerHand = this.playerHand;
        }
      });
    });

    console.log(`Adding ${cardsToAdd.length} cards to hand with animation`);
  }

  /**
   * Show/hide hand area
   */
  hideHandArea() {
    if (this.handContainer) {
      this.handContainer.setVisible(false);
    }
  }

  showHandArea() {
    if (this.handContainer) {
      this.handContainer.setVisible(true);
    }
  }

  /**
   * Check if a card is in the player's hand
   * @param {Card} card - Card to check
   * @returns {boolean} True if card is in hand
   */
  isCardInHand(card) {
    return this.playerHand.includes(card);
  }

  /**
   * Reset hand cards depth to normal
   */
  resetHandCardsDepth() {
    this.playerHand.forEach(card => {
      card.setDepth(0); // Reset to default depth
    });

    // Reset hand container depth if it exists
    if (this.handContainer) {
      this.handContainer.setDepth(0);
    }
  }

  /**
   * Set hand cards above overlay (for dialogs)
   */
  setHandCardsAboveOverlay() {
    this.playerHand.forEach(card => {
      card.setDepth(1001); // Hand cards above overlay
    });

    // Also bring the hand container to front if it exists
    if (this.handContainer) {
      this.handContainer.setDepth(1001);
    }
  }

  /**
   * Get hand size
   * @returns {number} Number of cards in hand
   */
  getHandSize() {
    return this.playerHand.length;
  }

  /**
   * Get hand cards array (read-only)
   * @returns {Array} Copy of hand cards array
   */
  getHandCards() {
    return [...this.playerHand];
  }

  /**
   * Clean up hand resources
   */
  destroy() {
    // Destroy all hand cards
    this.playerHand.forEach(card => card.destroy());
    this.playerHand = [];

    // Destroy hand container
    if (this.handContainer) {
      this.handContainer.destroy();
      this.handContainer = null;
    }

    // Clear scene references
    if (this.scene) {
      this.scene.playerHand = [];
      this.scene.handContainer = null;
    }
  }
}
