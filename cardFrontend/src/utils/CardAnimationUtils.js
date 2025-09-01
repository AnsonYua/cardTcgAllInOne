/**
 * CardAnimationUtils - Centralized card animation system for GameScene
 * 
 * This utility class contains all card animation functions extracted from GameScene
 * to reduce file size and improve maintainability. Handles:
 * - Card draw animations from deck to hand
 * - Card movement to hand from search effects
 * - Hand card sliding and positioning
 * - Unified animation system for consistency
 */
import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import Card from '../components/Card.js';

export default class CardAnimationUtils {
  
  /**
   * Unified card animation function for both draw and move-to-hand scenarios
   * @param {Phaser.Scene} scene - The Phaser scene instance
   * @param {Object} options - Animation configuration
   * @param {string} options.cardId - Card ID to animate
   * @param {number} options.targetHandLength - Final hand length after this card
   * @param {number} options.cardIndex - Index position in target hand (default: rightmost)
   * @param {Function} options.onComplete - Completion callback (optional)
   * @param {boolean} options.isPromise - Return promise vs. use callback (default: false)
   * @returns {Promise|void} - Promise if isPromise=true, void otherwise
   */
  static animateCardToHandUnified(scene, options) {
    const { 
      card, 
      targetHandLength, 
      cardIndex = targetHandLength - 1, 
      onComplete, 
      isPromise = false 
    } = options;

    const executeAnimation = (resolve) => {
    
      // Process card data consistently
      let processedCardData = card;
      
      // Get deck position for animation start
      const playerDeckPosition = this.getPlayerDeckPosition(scene);
      
      // Create temporary card at deck position
      const tempCard = scene.add.image(playerDeckPosition.x, playerDeckPosition.y, GAME_CONFIG.imageKey.cardback);
      
      // Set proper scale matching hand cards
      const scaleX = GAME_CONFIG.card.width / tempCard.width;
      const scaleY = GAME_CONFIG.card.height / tempCard.height;
      const handScale = Math.min(scaleX, scaleY) * 0.95 * 1.15;
      tempCard.setScale(handScale);
      tempCard.setDepth(2000);
      
      // Calculate positioning with unified logic
      const cardSpacing = Math.min(160, (scene.cameras.main.width - 200) / targetHandLength);
      const startX = -(targetHandLength - 1) * cardSpacing / 2;
      const newCardX = startX + (cardIndex * cardSpacing);
      
      // Convert to world coordinates
      const worldTargetX = scene.handContainer.x + newCardX;
      const worldTargetY = scene.handContainer.y;
      
      // Slide existing hand cards to make space
      this.slideHandCardsLeft(scene, targetHandLength, cardSpacing);
      
      // Stage 1: Move card to position
      scene.tweens.add({
        targets: tempCard,
        x: worldTargetX,
        y: worldTargetY,
        duration: 500,
        ease: 'Power2.easeOut',
        onComplete: () => {
          // Stage 2: Flip to change texture
          scene.tweens.add({
            targets: tempCard,
            scaleX: 0,
            duration: 150,
            ease: 'Power2.easeIn',
            onComplete: () => {
              console.log("update card info ", JSON.stringify(processedCardData))
              // Change to actual card texture
              const cardKey = `${processedCardData.cardData.id}-preview`;
              if (scene.textures.exists(cardKey)) {
                tempCard.setTexture(cardKey);
              } else {
                const fallbackKey = processedCardData.cardData.id;
                if (scene.textures.exists(fallbackKey)) {
                  tempCard.setTexture(fallbackKey);
                }
              }
              
              // Recalculate scale for new texture
              const newScaleX = GAME_CONFIG.card.width / tempCard.width;
              const newScaleY = GAME_CONFIG.card.height / tempCard.height;
              const newHandScale = Math.min(newScaleX, newScaleY) * 0.95 * 1.15;
              tempCard.setScale(0, newHandScale);
              
              // Stage 3: Flip back to visible
              scene.tweens.add({
                targets: tempCard,
                scaleX: newHandScale,
                duration: 150,
                ease: 'Power2.easeOut',
                onComplete: () => {
                  // Create actual Card object in hand
                  const relativeX = tempCard.x - scene.handContainer.x;
                  const relativeY = tempCard.y - scene.handContainer.y;
                  
                  const newCard = new Card(scene, relativeX, relativeY, processedCardData, {
                    interactive: true,
                    draggable: true,
                    scale: 1.1,
                    gameStateManager: scene.gameStateManager,
                    usePreview: true
                  });
                  
                  scene.input.setDraggable(newCard);
                  scene.playerHand.push(newCard);
                  scene.handContainer.add(newCard);
                  newCard.originalPosition = { x: relativeX, y: relativeY };
                  
                  // Cleanup and completion
                  scene.time.delayedCall(200, () => {
                    tempCard.destroy();
                    if (onComplete) onComplete();
                    if (resolve) resolve();
                  });
                }
              });
            }
          });
        }
      });
    };

    if (isPromise) {
      return new Promise(executeAnimation);
    } else {
      executeAnimation();
    }
  }

  /**
   * Animate card draw from deck to hand (promise-based)
   * @param {Phaser.Scene} scene - The Phaser scene instance
   * @returns {Promise} - Promise that resolves when animation completes
   */
  static playDrawCardAnimation(scene) {
    // Get the current hand from game state (the new card should be the last one)
    const currentHand = scene.gameStateManager.getPlayerHand();
    const lastCard = currentHand[currentHand.length - 1];
    
    // Handle both string and object formats for card data
    const newCardData = lastCard
    
    const totalCards = scene.playerHand.length + 1; // Including this new card
    
    // Use unified animation with promise-based completion
    return this.animateCardToHandUnified(scene, {
      card: newCardData,
      targetHandLength: totalCards,
      cardIndex: scene.playerHand.length, // Position at end (rightmost)
      isPromise: true
    });
  }

  /**
   * Animate card movement to hand from search effects (promise-based)
   * @param {Phaser.Scene} scene - The Phaser scene instance
   * @param {Object} moveData - Move data with cardId
   * @param {number} cardIndex - Index in the movement queue
   * @returns {Promise} - Animation completion promise
   */
  static animateCardToHand(scene, moveData, cardIndex) {
    const { cardId } = moveData;
    const currentTargetLength = scene.initialHandSize + cardIndex + 1;
    
    return this.animateCardToHandUnified(scene, {
      card: cardId,
      targetHandLength: currentTargetLength,
      cardIndex: scene.initialHandSize + cardIndex,
      isPromise: true
    });
  }

  /**
   * Slide existing hand cards left to make space for new cards
   * @param {Phaser.Scene} scene - The Phaser scene instance
   * @param {number} newTotalCards - New total number of cards in hand
   * @param {number} cardSpacing - Spacing between cards
   */
  static slideHandCardsLeft(scene, newTotalCards, cardSpacing) {
    // Recalculate positions for all existing cards with new spacing
    const newStartX = -(newTotalCards - 1) * cardSpacing / 2;
    
    scene.playerHand.forEach((card, index) => {
      const newX = newStartX + (index * cardSpacing);
      
      // Animate existing cards to new positions
      scene.tweens.add({
        targets: card,
        x: newX,
        duration: 300,
        ease: 'Power2.easeOut'
      });
      
      // Update original position for drag/drop functionality
      card.originalPosition = { x: newX, y: card.y };
    });
  }

  /**
   * Get player deck position for animation start point
   * @param {Phaser.Scene} scene - The Phaser scene instance
   * @returns {Object} - Position with x, y coordinates
   */
  static getPlayerDeckPosition(scene) {
    // Use existing deck position logic (same as playDrawCardAnimation)
    const width = scene.scale.width;
    const height = scene.scale.height;
    
    return {
      x: width * 0.9,  // Right side for player deck
      y: height * 0.65 // Below center
    };
  }

  /**
   * Get card type from card ID
   * @param {string} cardId - Card ID (e.g., "c-1", "h-2", "sp-3", "s-4")
   * @returns {string} - Card type ("character", "help", "sp", "leader", or "unknown")
   */
  static getCardTypeFromId(cardId) {
    if (cardId.startsWith('c-')) return 'character';
    if (cardId.startsWith('h-')) return 'help';
    if (cardId.startsWith('sp-')) return 'sp';
    if (cardId.startsWith('s-')) return 'leader';
    return 'unknown';
  }

  /**
   * Wait for a specified delay using Phaser's time system
   * @param {Phaser.Scene} scene - The Phaser scene instance
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} - Promise that resolves after the delay
   */
  static waitForDelay(scene, ms) {
    return new Promise(resolve => {
      scene.time.delayedCall(ms, resolve);
    });
  }

  /**
   * Process card move queue sequentially with animations
   * @param {Phaser.Scene} scene - The Phaser scene instance
   * @returns {Promise} - Promise that resolves when all animations complete
   */
  static async processCardMoveQueue(scene) {
    if (scene.processingCardMoves || !scene.cardMoveQueue?.length) {
      return;
    }
    
    scene.processingCardMoves = true;
    console.log(`Processing ${scene.cardMoveQueue.length} card moves sequentially`);
    
    // Store initial hand and queue sizes for consistent positioning
    scene.initialHandSize = scene.playerHand.length;
    scene.initialQueueSize = scene.cardMoveQueue.length;
    
    // Process each card move with animation (sliding handled per card for proper timing)
    for (let i = 0; i < scene.cardMoveQueue.length; i++) {
      const moveData = scene.cardMoveQueue[i];
      await this.animateCardToHand(scene, moveData, i);
      // Small delay between animations for visual clarity can be added here if needed
      // await this.waitForDelay(scene, 200); 
    }
    
    // Acknowledge all processed events (backend sync now fixed)
    try {
      if (scene.cardMoveQueue.length > 0) {
        const eventIds = scene.cardMoveQueue.map(moveData => moveData.event.id);
        await scene.apiManager.acknowledgeEvents(scene.gameStateManager.getGameState().gameId, eventIds);
        console.log(`Acknowledged ${eventIds.length} CARD_MOVED_TO_HAND events`);
      }
    } catch (error) {
      console.error('Failed to acknowledge card move events:', error);
      scene.showRoomStatus('Failed to acknowledge card moves: ' + error.message);
    }
    
    // Update UI after all animations complete - backend sync is now fixed
    scene.updateGameState();
    
    // Show completion message
    const cardCount = scene.cardMoveQueue.length;
    scene.showRoomStatus(`${cardCount} card(s) added to hand from deck search`);
    
    // Clear queue and reset flag
    scene.cardMoveQueue = [];
    scene.processingCardMoves = false;
    
    // Reset initial size tracking for next batch
    scene.initialQueueSize = null;
    scene.initialHandSize = null;
  }
}