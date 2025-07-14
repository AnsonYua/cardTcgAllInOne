// CardAnimationHelper.js - Utility class for card animations and effects
export default class CardAnimationHelper {
  constructor(scene) {
    this.scene = scene;
    this.highlightedCards = new Set();
  }

  /**
   * Creates a standardized pulsing highlight animation
   * @param {Object|Array} cards - Card or array of cards to highlight
   * @param {Object} options - Animation options
   */
  addPulsingHighlight(cards, options = {}) {
    const defaults = {
      scaleMultiplier: 1.1,
      duration: 800,
      ease: 'Sine.easeInOut'
    };
    
    const config = { ...defaults, ...options };
    const cardArray = Array.isArray(cards) ? cards : [cards];
    
    cardArray.forEach(card => {
      if (!card || this.highlightedCards.has(card)) return;
      
      this.scene.tweens.add({
        targets: card,
        scaleX: card.scaleX * config.scaleMultiplier,
        scaleY: card.scaleY * config.scaleMultiplier,
        duration: config.duration,
        yoyo: true,
        repeat: -1,
        ease: config.ease
      });
      
      this.highlightedCards.add(card);
      card.redrawHighlight = true;
    });
  }

  /**
   * Removes pulsing highlight from cards
   * @param {Object|Array} cards - Card or array of cards to remove highlight from
   */
  removePulsingHighlight(cards) {
    const cardArray = Array.isArray(cards) ? cards : [cards];
    
    cardArray.forEach(card => {
      if (!card || !this.highlightedCards.has(card)) return;
      
      // Stop animation and reset scale
      this.scene.tweens.killTweensOf(card);
      if (card.redrawHighlight) {
        card.setScale(card.scaleX / 1.1, card.scaleY / 1.1);
        card.redrawHighlight = false;
      }
      
      this.highlightedCards.delete(card);
    });
  }

  /**
   * Removes all pulsing highlights
   */
  removeAllHighlights() {
    this.highlightedCards.forEach(card => {
      this.scene.tweens.killTweensOf(card);
      if (card.redrawHighlight) {
        card.setScale(card.scaleX / 1.1, card.scaleY / 1.1);
        card.redrawHighlight = false;
      }
    });
    this.highlightedCards.clear();
  }

  /**
   * Sets depth for multiple cards with optional offset
   * @param {Array} cards - Array of cards
   * @param {number} baseDepth - Base depth value
   * @param {number} offset - Offset between cards (default: 0)
   */
  setCardsDepth(cards, baseDepth, offset = 0) {
    if (!Array.isArray(cards)) cards = [cards];
    
    cards.forEach((card, index) => {
      if (card && card.setDepth) {
        card.setDepth(baseDepth + (index * offset));
      }
    });
  }

  /**
   * Animates card movement with standardized easing
   * @param {Object} card - Card to animate
   * @param {number} x - Target x position
   * @param {number} y - Target y position
   * @param {Object} options - Animation options
   * @returns {Promise} Promise that resolves when animation completes
   */
  animateCardMovement(card, x, y, options = {}) {
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
        x: x,
        y: y,
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

  /**
   * Creates a card flip animation (scale to 0 then back)
   * @param {Object} card - Card to flip
   * @param {Function} onMidFlip - Callback when card is at scale 0 (invisible)
   * @param {Object} options - Animation options
   * @returns {Promise} Promise that resolves when flip completes
   */
  flipCard(card, onMidFlip, options = {}) {
    const defaults = {
      duration: 150,
      ease: 'Power2.easeIn'
    };
    
    const config = { ...defaults, ...options };
    
    return new Promise((resolve) => {
      // First half: scale to 0
      this.scene.tweens.add({
        targets: card,
        scaleX: 0,
        duration: config.duration,
        ease: config.ease,
        onComplete: () => {
          // Callback for texture/content change
          if (onMidFlip) onMidFlip();
          
          // Second half: scale back to normal
          this.scene.tweens.add({
            targets: card,
            scaleX: card.scaleY, // Match Y scale
            duration: config.duration,
            ease: 'Power2.easeOut',
            onComplete: resolve
          });
        }
      });
    });
  }

  /**
   * Animates multiple cards repositioning with staggered timing
   * @param {Array} cards - Array of cards to reposition
   * @param {Array} positions - Array of {x, y} target positions
   * @param {Object} options - Animation options
   */
  repositionCards(cards, positions, options = {}) {
    const defaults = {
      duration: 300,
      ease: 'Power2.easeOut',
      stagger: 50
    };
    
    const config = { ...defaults, ...options };
    
    cards.forEach((card, index) => {
      if (!card || !positions[index]) return;
      
      setTimeout(() => {
        this.animateCardMovement(card, positions[index].x, positions[index].y, {
          duration: config.duration,
          ease: config.ease
        });
      }, index * config.stagger);
    });
  }

  /**
   * Creates a hover effect for cards
   * @param {Object} card - Card to add hover effect to
   * @param {Object} options - Hover options
   */
  addHoverEffect(card, options = {}) {
    const defaults = {
      hoverScale: 1.1,
      duration: 200,
      ease: 'Power2'
    };
    
    const config = { ...defaults, ...options };
    
    card.on('pointerover', () => {
      if (!card.isDragging) {
        this.scene.tweens.add({
          targets: card,
          scaleX: card.scaleX * config.hoverScale,
          scaleY: card.scaleY * config.hoverScale,
          duration: config.duration,
          ease: config.ease
        });
        
        this.scene.game.canvas.style.cursor = 'pointer';
      }
    });

    card.on('pointerout', () => {
      if (!card.isDragging && !card.isSelected) {
        this.scene.tweens.add({
          targets: card,
          scaleX: card.scaleX / config.hoverScale,
          scaleY: card.scaleY / config.hoverScale,
          duration: config.duration,
          ease: config.ease
        });
      }
      
      this.scene.game.canvas.style.cursor = 'default';
    });
  }
}