// GameAnimationManager.js - Handles all card animations, effects, and visual transitions
import { GAME_CONFIG } from '../config/gameConfig.js';
import Card from '../components/Card.js';
import ShuffleAnimationManager from '../components/ShuffleAnimationManager.js';

export default class GameAnimationManager {
  constructor(scene) {
    this.scene = scene;
    this.shuffleAnimationManager = null;
    this.highlightedCards = new Set();
  }

  init() {
    this.shuffleAnimationManager = new ShuffleAnimationManager(this.scene);
  }

  // Shuffle deck animation
  async playShuffleDeckAnimation(layout, onComplete) {
    return new Promise((resolve) => {
      this.shuffleAnimationManager.playShuffleDeckAnimation(layout, () => {
        if (onComplete) onComplete();
        resolve();
      });
    });
  }

  // Hand management animations
  animateHandCardPlacement(cards, handContainer) {
    if (!cards || cards.length === 0) return;
    
    const cardSpacing = Math.min(160, (this.scene.cameras.main.width - 200) / cards.length);
    const startX = -(cards.length - 1) * cardSpacing / 2;
    
    cards.forEach((card, index) => {
      const x = startX + (index * cardSpacing);
      card.x = x;
      card.y = 0;
      
      // Store original position for drag/drop
      card.originalPosition = { x, y: 0 };
      
      // Add to hand container
      handContainer.add(card);
    });
  }

  reorganizeHandCards(cards, handContainer) {
    if (!cards || cards.length === 0) return;
    
    const cardSpacing = Math.min(160, (this.scene.cameras.main.width - 200) / cards.length);
    const startX = -(cards.length - 1) * cardSpacing / 2;
    
    cards.forEach((card, index) => {
      const newX = startX + (index * cardSpacing);
      
      this.scene.tweens.add({
        targets: card,
        x: newX,
        duration: 300,
        ease: 'Power2.easeOut'
      });
      
      card.originalPosition.x = newX;
    });
  }

  // Leader card animations
  selectLeaderCard(playerType, leaderCardsArray, leaderDeckSource, zones, onComplete) {
    const leaderDeckZone = zones.leaderDeck;
    const leaderZone = zones.leader;
    
    if (!leaderDeckZone || !leaderZone || !leaderCardsArray || leaderCardsArray.length === 0) {
      console.log(`${playerType} leader card selection failed - missing requirements`);
      return;
    }

    const topCardIndex = 0;
    const topCard = leaderCardsArray[topCardIndex];
    const cardData = leaderDeckSource[leaderDeckSource.length - leaderCardsArray.length];
    
    if (!topCard || !cardData) {
      console.log(`${playerType} leader card selection failed - no card data`);
      return;
    }

    console.log(`Moving ${playerType} leader card to leader position:`, cardData.name);

    // Animate card movement and rotation
    this.scene.tweens.add({
      targets: topCard,
      x: leaderZone.x,
      y: leaderZone.y,
      rotation: 0,
      duration: 300,
      ease: 'Power2.easeInOut',
      onComplete: () => {
        // Remove card from deck array
        leaderCardsArray.splice(topCardIndex, 1);

        // Destroy animation card
        topCard.destroy();
        if (topCard.borderGraphics) {
          topCard.borderGraphics.destroy();
        }

        // Create final leader card
        const leaderCard = new Card(this.scene, leaderZone.x, leaderZone.y, cardData, {
          interactive: true,
          draggable: false,
          scale: 0.9,
          usePreview: true
        });
        
        // Set depth for dialog overlay
        leaderCard.setDepth(1001);
        
        // Add hover events
        leaderCard.on('pointerover', () => {
          this.scene.events.emit('card-preview-show', cardData);
        });
        
        leaderCard.on('pointerout', () => {
          this.scene.events.emit('card-preview-hide');
        });

        // Update zone
        leaderZone.card = leaderCard;
        if (leaderZone.placeholder) {
          leaderZone.placeholder.setVisible(false);
        }

        console.log(`${playerType} leader card ${cardData.name} placed in leader position`);

        // Reposition remaining cards
        this.repositionLeaderDeckCards(playerType, leaderCardsArray, leaderDeckZone);
        
        // Callback for game logic
        if (onComplete) onComplete(cardData);
      }
    });
  }

  repositionLeaderDeckCards(playerType, leaderCardsArray, leaderDeckZone) {
    if (!leaderCardsArray || !leaderDeckZone) return;

    const targetX = leaderDeckZone.x;
    const targetY = leaderDeckZone.y;

    leaderCardsArray.forEach((card, index) => {
      const newX = targetX;
      const offsetDirection = playerType === 'opponent' ? -1 : 1;
      const newY = targetY + (offsetDirection * index * 30);

      this.scene.tweens.add({
        targets: card,
        x: newX,
        y: newY,
        duration: 150,
        ease: 'Power2.easeOut'
      });

      if (card.borderGraphics) {
        this.scene.tweens.add({
          targets: card.borderGraphics,
          x: newX,
          y: newY,
          duration: 150,
          ease: 'Power2.easeOut'
        });
      }

      card.setDepth(1000 + leaderCardsArray.length - index);
    });
  }

  // Highlight animations
  highlightHandCards(cards) {
    if (!cards) return;
    
    cards.forEach(card => {
      if (this.highlightedCards.has(card)) return;
      
      this.scene.tweens.add({
        targets: card,
        scaleX: card.scaleX * 1.1,
        scaleY: card.scaleY * 1.1,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      
      card.redrawHighlight = true;
      this.highlightedCards.add(card);
    });
  }

  highlightLeaderCards(playerZones, opponentZones) {
    const leaderCards = [];
    
    if (playerZones.leader && playerZones.leader.card) {
      leaderCards.push(playerZones.leader.card);
    }
    
    if (opponentZones.leader && opponentZones.leader.card) {
      leaderCards.push(opponentZones.leader.card);
    }
    
    leaderCards.forEach(leaderCard => {
      if (this.highlightedCards.has(leaderCard)) return;
      
      this.scene.tweens.add({
        targets: leaderCard,
        scaleX: leaderCard.scaleX * 1.1,
        scaleY: leaderCard.scaleY * 1.1,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      
      leaderCard.redrawHighlight = true;
      this.highlightedCards.add(leaderCard);
    });
  }

  removeAllHighlights(cards, playerZones, opponentZones) {
    // Remove hand card highlights
    if (cards) {
      cards.forEach(card => {
        if (card.redrawHighlight) {
          this.scene.tweens.killTweensOf(card);
          card.setScale(1.1, 1.1); // Reset to original hand card scale
          card.redrawHighlight = false;
          this.highlightedCards.delete(card);
        }
      });
    }
    
    // Remove leader card highlights
    const leaderCards = [];
    if (playerZones.leader && playerZones.leader.card) {
      leaderCards.push(playerZones.leader.card);
    }
    if (opponentZones.leader && opponentZones.leader.card) {
      leaderCards.push(opponentZones.leader.card);
    }
    
    leaderCards.forEach(leaderCard => {
      if (leaderCard.redrawHighlight) {
        this.scene.tweens.killTweensOf(leaderCard);
        leaderCard.setScale(leaderCard.scaleX / 1.1, leaderCard.scaleY / 1.1);
        leaderCard.redrawHighlight = false;
        this.highlightedCards.delete(leaderCard);
      }
    });
  }

  setCardsDepth(cards, depth) {
    if (!cards) return;
    
    cards.forEach(card => {
      card.setDepth(depth);
    });
  }

  // Card addition animations
  animateCardsFromDeckToHand(cardsToAdd, layout, handContainer, existingHand) {
    const playerDeckPosition = layout.player.deck;
    
    cardsToAdd.forEach((cardData, index) => {
      setTimeout(() => {
        // Create temporary card at deck position
        const tempCard = this.scene.add.image(playerDeckPosition.x, playerDeckPosition.y, 'card-back');
        
        // Set scale to match hand cards
        const scaleX = GAME_CONFIG.card.width / tempCard.width;
        const scaleY = GAME_CONFIG.card.height / tempCard.height;
        const handScale = Math.min(scaleX, scaleY) * 0.95 * 1.15;
        tempCard.setScale(handScale);
        tempCard.setDepth(2000);
        
        // Calculate target position
        const currentHandLength = existingHand.length;
        const totalCards = currentHandLength + 1;
        const cardSpacing = Math.min(160, (this.scene.cameras.main.width - 200) / totalCards);
        const startX = -(totalCards - 1) * cardSpacing / 2;
        const newCardX = startX + (currentHandLength * cardSpacing);
        
        const worldTargetX = handContainer.x + newCardX;
        const worldTargetY = handContainer.y;
        
        // Slide existing cards
        this.slideHandCardsLeft(existingHand, totalCards, cardSpacing);
        
        // Animate new card to hand
        this.scene.tweens.add({
          targets: tempCard,
          x: worldTargetX,
          y: worldTargetY,
          duration: 500,
          ease: 'Power2.easeOut',
          onComplete: () => {
            this.flipCardToFace(tempCard, cardData, handContainer, newCardX, existingHand);
          }
        });
      }, index * 1000);
    });
  }

  flipCardToFace(tempCard, cardData, handContainer, targetX, existingHand) {
    // Flip animation: scale to 0
    this.scene.tweens.add({
      targets: tempCard,
      scaleX: 0,
      duration: 150,
      ease: 'Power2.easeIn',
      onComplete: () => {
        // Change texture to card face
        const cardKey = `${cardData.id}-preview`;
        tempCard.setTexture(cardKey);
        
        // Recalculate scale for new texture
        const newScaleX = GAME_CONFIG.card.width / tempCard.width;
        const newScaleY = GAME_CONFIG.card.height / tempCard.height;
        const newHandScale = Math.min(newScaleX, newScaleY) * 0.95 * 1.15;
        
        tempCard.setScale(0, newHandScale);
        
        // Flip back to visible
        this.scene.tweens.add({
          targets: tempCard,
          scaleX: newHandScale,
          duration: 150,
          ease: 'Power2.easeOut',
          onComplete: () => {
            this.convertTempCardToHandCard(tempCard, cardData, handContainer, targetX, existingHand);
          }
        });
      }
    });
  }

  convertTempCardToHandCard(tempCard, cardData, handContainer, targetX, existingHand) {
    // Calculate relative position
    const relativeX = tempCard.x - handContainer.x;
    const relativeY = tempCard.y - handContainer.y;
    
    // Create actual hand card
    const newCard = new Card(this.scene, relativeX, relativeY, cardData, {
      interactive: true,
      draggable: true,
      scale: 1.15,
      usePreview: true
    });
    
    // Set up drag and drop
    this.scene.input.setDraggable(newCard);
    
    // Add to hand
    existingHand.push(newCard);
    handContainer.add(newCard);
    
    // Set properties
    newCard.originalPosition = { x: relativeX, y: relativeY };
    newCard.setDepth(100);
    
    // Clean up temp card
    tempCard.destroy();
    
    console.log(`Card ${cardData.id} added to hand`);
  }

  slideHandCardsLeft(handCards, newTotalCards, cardSpacing) {
    const newStartX = -(newTotalCards - 1) * cardSpacing / 2;
    
    handCards.forEach((card, index) => {
      const newX = newStartX + (index * cardSpacing);
      
      this.scene.tweens.add({
        targets: card,
        x: newX,
        duration: 300,
        ease: 'Power2.easeOut'
      });
      
      card.originalPosition.x = newX;
    });
  }

  // Card movement animations
  animateCardMovement(card, targetX, targetY, options = {}) {
    const defaults = {
      duration: 300,
      ease: 'Power2.easeInOut',
      rotation: null,
      scale: null
    };
    
    const config = { ...defaults, ...options };
    
    return new Promise((resolve) => {
      const tweenConfig = {
        targets: card,
        x: targetX,
        y: targetY,
        duration: config.duration,
        ease: config.ease,
        onComplete: resolve
      };
      
      if (config.rotation !== null) {
        tweenConfig.rotation = config.rotation;
      }
      
      if (config.scale !== null) {
        tweenConfig.scaleX = config.scale;
        tweenConfig.scaleY = config.scale;
      }
      
      this.scene.tweens.add(tweenConfig);
    });
  }

  // Button click effects
  animateButtonClick(button, text, scale = 0.95, tint = 0x888888) {
    button.setTint(tint);
    button.setScale(button.scaleX * scale);
    text.setScale(text.scaleX * scale);
    
    this.scene.time.delayedCall(100, () => {
      button.clearTint();
      button.setScale(button.scaleX / scale);
      text.setScale(text.scaleX / scale);
    });
  }

  // Getters for shuffle animation manager
  getShuffleAnimationManager() {
    return this.shuffleAnimationManager;
  }

  // Clean up
  destroy() {
    this.highlightedCards.clear();
    if (this.shuffleAnimationManager) {
      // ShuffleAnimationManager cleanup if needed
    }
  }
}