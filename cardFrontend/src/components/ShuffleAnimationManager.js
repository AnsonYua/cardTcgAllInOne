import { GAME_CONFIG } from '../config/gameConfig.js';

export default class ShuffleAnimationManager {
  constructor(scene) {
    this.scene = scene;
    this.playerDeckCards = [];
    this.opponentDeckCards = [];
    this.playerLeaderCards = [];
    this.opponentLeaderCards = [];
  }

  playShuffleDeckAnimation(layout, onComplete) {
    const { width, height } = this.scene.cameras.main;
    
    // Get deck positions from layout
    const playerDeckPos = layout.player.deck;
    const opponentDeckPos = layout.opponent.deck;
    
    // Create player deck in initial position
    this.playerDeckCards = [];
    this.opponentDeckCards = [];
    const numCards = 20;
    
    // Create player deck cards in initial position
    for (let i = 0; i < numCards; i++) {
      const card = this.scene.add.image(playerDeckPos.x + (i * 0), playerDeckPos.y - (i * 0), 'card-back');
      const scaleX = GAME_CONFIG.card.width / card.width;
      const scaleY = GAME_CONFIG.card.height / card.height;
      card.setScale(Math.min(scaleX, scaleY) * 0.95);
      card.setDepth(i);
      this.playerDeckCards.push(card);
    }
    
    // Create opponent deck cards in initial position
    for (let i = 0; i < numCards; i++) {
      const card = this.scene.add.image(opponentDeckPos.x + (i * 0), opponentDeckPos.y - (i * 0), 'card-back');
      const scaleX = GAME_CONFIG.card.width / card.width;
      const scaleY = GAME_CONFIG.card.height / card.height;
      card.setScale(Math.min(scaleX, scaleY) * 0.95);
      card.setDepth(i);
      this.opponentDeckCards.push(card);
    }
    
    // Show shuffle text at top of screen
    this.shuffleText = this.scene.add.text(width / 2, 80, 'Deck Shuffling', {
      fontSize: '36px',
      fontFamily: 'Arial Bold',
      fill: '#FFD700',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.shuffleText.setOrigin(0.5);
    this.shuffleText.setAlpha(0);
    
    // Start flashing animation that continues until shuffle is complete
    this.shuffleTextTween = this.scene.tweens.add({
      targets: this.shuffleText,
      alpha: 1,
      duration: 500,
      yoyo: true,
      repeat: -1, // Infinite repeat
      ease: 'Power2.easeInOut'
    });
    
    // Bring cards to front layer before starting animation
    this.playerDeckCards.forEach(card => card.setDepth(1000));
    for (let i = 0; i < this.playerDeckCards.length; i++) {
      this.playerDeckCards[i].setDepth(this.playerDeckCards.length - i);
    }
    
    // Start the new shuffle animation
    setTimeout(() => {
      this.performCustomShuffle(layout, onComplete);
    }, 500);
  }

  performCustomShuffle(layout, onComplete) {
    const { width, height } = this.scene.cameras.main;
    
    // Game board center for card placement during shuffle
    const boardCenterX = width / 2;
    const boardCenterY = height / 2;
    
    // Track completion of both decks
    let playerDeckComplete = false;
    let opponentDeckComplete = false;
    
    const checkBothComplete = () => {
      if (playerDeckComplete && opponentDeckComplete) {
        // Both decks shuffled, move to final positions
        this.moveDecksToFinalPositions(onComplete);
      }
    };
    
    // Start both deck shuffles simultaneously
    this.shufflePlayerDeck(layout.player.deck, boardCenterX, boardCenterY, () => {
      playerDeckComplete = true;
      checkBothComplete();
    });
    
    this.shuffleOpponentDeck(layout.opponent.deck, boardCenterX, boardCenterY, () => {
      opponentDeckComplete = true;
      checkBothComplete();
    });
  }

  shufflePlayerDeck(deckPosition, boardCenterX, boardCenterY, onComplete) {
    const shuffledOrder = this.getCustomShuffleOrder(this.playerDeckCards.length);
    let currentCardIndex = 0;
    const newStack = [];
    
    console.log('Player deck shuffling with custom method');
    
    const shuffleNextCard = () => {
      if (currentCardIndex >= shuffledOrder.length) {
        // Shuffle complete, move cards back to deck position
        this.moveShuffledCardsToDeck(this.playerDeckCards, deckPosition, onComplete);
        return;
      }
      
      const originalIndex = shuffledOrder[currentCardIndex];
      const card = this.playerDeckCards[originalIndex];
      card.setDepth(currentCardIndex);
      
      this.applyCustomShuffleLogic(card, newStack, currentCardIndex, 'player', () => {
        currentCardIndex++;
        setTimeout(() => {
          shuffleNextCard();
        }, 100);
      });
    };
    
    // Start shuffling
    shuffleNextCard();
  }

  shuffleOpponentDeck(deckPosition, boardCenterX, boardCenterY, onComplete) {
    const shuffledOrder = this.getCustomShuffleOrder(this.opponentDeckCards.length);
    let currentCardIndex = 0;
    const newStack = [];
    
    console.log('Opponent deck shuffling with custom method');
    
    const shuffleNextCard = () => {
      if (currentCardIndex >= shuffledOrder.length) {
        // Shuffle complete, move cards back to deck position
        this.moveShuffledCardsToDeck(this.opponentDeckCards, deckPosition, onComplete);
        return;
      }
      
      const originalIndex = shuffledOrder[currentCardIndex];
      const card = this.opponentDeckCards[originalIndex];
      this.applyCustomShuffleLogic(card, newStack, currentCardIndex, 'opponent', () => {
        currentCardIndex++;
        setTimeout(() => {
          shuffleNextCard();
        }, 100);
      });
    };
    
    // Start shuffling
    shuffleNextCard();
  }

  applyCustomShuffleLogic(card, newStack, cardIndex, deckType, onComplete) {
    const { width, height } = this.scene.cameras.main;
    const boardCenterX = width / 2;
    let boardCenterY = height / 2;
    
    // Calculate horizontal positions for the new stack
    const cardSpacing = 120; // Space between cards (increased to prevent overlap)
    const numberOfStacks = 5; // Total number of cards in deck
    
    // Different positions for player and opponent
    let stackStartX;
    if (deckType === 'player') {
      // Player stack on the left side
      stackStartX = boardCenterX - ((numberOfStacks - 1) * cardSpacing) / 2;
    } else {
      // Opponent stack on the right side
      stackStartX = boardCenterX - ((numberOfStacks - 1) * cardSpacing) / 2;
    }

    const startY = 45;
    const cardHeight = 160;

    if (deckType === 'player') {
      boardCenterY = startY + 100 + cardHeight + 10 + 15 + cardHeight + 70;
    } else {
      boardCenterY = startY + 100 + 10 + 15;
    }
    
    // Custom shuffle method: 5 columns × 2 rows layout
    const totalPositions = 10; // 5 columns × 2 rows
    const cardsPerRow = 5;
    const rowSpacing = 170; // Vertical spacing between rows
    
    if (cardIndex < totalPositions) {
      // First 10 cards go to the grid layout
      newStack.push(card);
      
      // Calculate row and column position
      const row = Math.floor(cardIndex / cardsPerRow); // 0 or 1
      const col = cardIndex % cardsPerRow; // 0, 1, 2, 3, or 4
      
      const targetX = stackStartX + (col * cardSpacing);
      const targetY = boardCenterY + 50 + (row * rowSpacing);
      
      this.scene.tweens.add({
        targets: card,
        x: targetX,
        y: targetY,
        rotation: 0,
        duration: 200,
        ease: 'Power2.easeInOut',
        onComplete: () => {
          onComplete();
        }
      });
    } else {
      // 11th card onwards go on top of the grid positions
      newStack.unshift(card); // Add to beginning (top) of stack
      
      // Calculate which position this card should go to
      const positionIndex = (cardIndex - totalPositions) % totalPositions; // 0-9 for grid positions
      const row = Math.floor(positionIndex / cardsPerRow); // 0 or 1
      const col = positionIndex % cardsPerRow; // 0, 1, 2, 3, or 4
      
      const targetX = stackStartX + (col * cardSpacing);
      
      // Calculate how many cards are already at this position to stack on top
      const cardsAtThisPosition = Math.floor((cardIndex - totalPositions) / totalPositions) + 1;
      const targetY = boardCenterY + 50 + (row * rowSpacing) - (cardsAtThisPosition * 5); // Stack vertically
      
      this.scene.tweens.add({
        targets: card,
        x: targetX,
        y: targetY,
        rotation: 0,
        duration: 200,
        ease: 'Power2.easeInOut',
        onComplete: () => {
          onComplete();
        }
      });
    }
  }

  moveShuffledCardsToDeck(deckCards, deckPosition, onComplete) {
    // Move all cards back to their deck position - top cards move first
    deckCards.reverse();
    deckCards.forEach((card, index) => {
      // First cards to move (index 0) should be on top of deck
      
      this.scene.tweens.add({
        targets: card,
        x: deckPosition.x,
        y: deckPosition.y,
        rotation: 0,
        duration: 400,
        delay: index * 50,
        ease: 'Power2.easeInOut',
        onStart: () => {
          setTimeout(() => {
            card.setDepth(index);
          }, 350);
        },
        onComplete: () => {
          if (index === deckCards.length - 1) {
            onComplete();
          }
        }
      });
    });
  }

  getCustomShuffleOrder(length) {
    // Create a custom shuffle order based on your method
    const order = Array.from({ length }, (_, i) => i);
    
    // Custom shuffle: take cards one by one from top to bottom, place first 4 in new stack, then 5th goes on top
    const shuffledOrder = [];
    const tempStack = [...order];
    
    while (tempStack.length > 0) {
      // Take card from top (index 0) instead of random
      const card = tempStack.splice(0, 1)[0];
      shuffledOrder.push(card);
    }
    
    return shuffledOrder;
  }

  moveDecksToFinalPositions(onComplete) {
    // First, move leader cards to leader deck positions
    this.moveLeaderCardsToLeaderDecks(() => {
      // Stop the flashing text and fade it out
      if (this.shuffleTextTween) {
        this.shuffleTextTween.stop();
      }
      
      if (this.shuffleText) {
        this.scene.tweens.add({
          targets: this.shuffleText,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            this.shuffleText.destroy();
            this.shuffleText = null;
          }
        });
      }
      
      // Call onComplete first to show deck stacks before fading out shuffle cards
      console.log('ShuffleAnimationManager: About to call onComplete callback');
      onComplete();
      
      // Then fade out the temporary shuffle cards after a brief delay
      setTimeout(() => {
        this.scene.tweens.add({
          targets: this.playerDeckCards,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            this.playerDeckCards.forEach(card => card.destroy());
          }
        });
        
        this.scene.tweens.add({
          targets: this.opponentDeckCards,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            this.opponentDeckCards.forEach(card => card.destroy());
          }
        });
      }, 200);
    });
  }

  moveLeaderCardsToLeaderDecks(onComplete) {
    const layout = this.scene.layout;
    const { width, height } = this.scene.cameras.main;
    
    // Get leader cards data from scene
    const leaderCards = this.scene.leaderCards || [];
    console.log('moveLeaderCardsToLeaderDecks - leaderCards:', leaderCards);
    
    // Create leader cards for each player as separate decks
    this.playerLeaderCards = [];
    this.opponentLeaderCards = [];
    
    // Get leader deck positions
    const playerLeaderDeckPos = layout.player.leaderDeck;
    const opponentLeaderDeckPos = layout.opponent.leaderDeck;
    
    // Get player and opponent leader cards from scene
    const playerLeaderCardsData = this.scene.playerLeaderCards || leaderCards;
    const opponentLeaderCardsData = this.scene.opponentLeaderCards || leaderCards;
    
    console.log('Creating leader cards - player data:', playerLeaderCardsData);
    console.log('Creating leader cards - opponent data:', opponentLeaderCardsData);
    
    // Create player leader cards starting from bottom of screen (separate deck)
    const playerStartY = height + 100; // Start below screen
    for (let i = 0; i < playerLeaderCardsData.length; i++) {
      const leaderCardData = playerLeaderCardsData[i];
      const cardContainer = this.createLeaderCardWithRoundedCorners(playerLeaderDeckPos.x, playerStartY, leaderCardData);
      cardContainer.setDepth(1000 + i);
      this.playerLeaderCards.push(cardContainer);
    }
    
    // Create opponent leader cards starting from top of screen (separate deck)
    const opponentStartY = -100; // Start above screen
    for (let i = 0; i < opponentLeaderCardsData.length; i++) {
      const leaderCardData = opponentLeaderCardsData[i];
      const cardContainer = this.createLeaderCardWithRoundedCorners(opponentLeaderDeckPos.x, opponentStartY, leaderCardData);
      cardContainer.setDepth(1000 + i);
      this.opponentLeaderCards.push(cardContainer);
    }
    
    // Animation completion tracking
    let completedAnimations = 0;
    const totalAnimations = this.playerLeaderCards.length + this.opponentLeaderCards.length;
    console.log(`Total leader card animations to run: ${totalAnimations} (player: ${this.playerLeaderCards.length}, opponent: ${this.opponentLeaderCards.length})`);
    
    const checkComplete = () => {
      completedAnimations++;
      console.log(`Leader card animation completed: ${completedAnimations}/${totalAnimations}`);
      if (completedAnimations >= totalAnimations) {
        console.log('All leader card animations completed, calling onComplete');
        onComplete();
      }
    };

    
    const totalLeaderCards = this.playerLeaderCards.length 
    // Animate player leader cards from bottom to top (upward slide)
    this.playerLeaderCards.forEach((card, index) => {
      card.setDepth(totalLeaderCards-index);
      const targetX = playerLeaderDeckPos.x;
      const targetY = playerLeaderDeckPos.y - (-index * 30);
      
      this.scene.tweens.add({
        targets: card,
        x: targetX,
        y: targetY,
        duration: 800,
        delay: index * 70,
        ease: 'Power2.easeOut',
        onComplete: checkComplete
      });
      
      // Also animate the border if it exists
      if (card.borderGraphics) {
        this.scene.tweens.add({
          targets: card.borderGraphics,
          x: targetX,
          y: targetY,
          duration: 800,
          delay: index * 70,
          ease: 'Power2.easeOut'
        });
      }
    });
    
    // Animate opponent leader cards from top to bottom (downward slide)
    this.opponentLeaderCards.forEach((card, index) => {
      card.setDepth(totalLeaderCards-index);
      const targetX = opponentLeaderDeckPos.x;
      const targetY = opponentLeaderDeckPos.y - (index * 30);
      
      this.scene.tweens.add({
        targets: card,
        x: targetX,
        y: targetY,
        duration: 800,
        delay: index * 70,
        ease: 'Power2.easeOut',
        onComplete: checkComplete
      });
      
      // Also animate the border if it exists
      if (card.borderGraphics) {
        this.scene.tweens.add({
          targets: card.borderGraphics,
          x: targetX,
          y: targetY,
          duration: 800,
          delay: index * 70,
          ease: 'Power2.easeOut'
        });
      }
    });
  }

  selectLeaderCard(playerType = 'player') {
    console.log(`selectLeaderCard called for ${playerType}`);
    
    // Validate input
    if (!playerType || (playerType !== 'player' && playerType !== 'opponent')) {
      console.error('Invalid playerType:', playerType);
      return;
    }

    const { width, height } = this.scene.cameras.main;
    const layout = this.scene.layout;
    
    if (!layout) {
      console.error('Layout not found in scene');
      return;
    }

    // Create configuration for the specified player type
    const config = this.getLeaderCardConfig(playerType, layout, width, height);
    
    // Create leader cards using the configuration
    this.createLeaderCards(config);
  }

  getLeaderCardConfig(playerType, layout, width, height) {
    const isPlayer = playerType === 'player';
    
    return {
      playerType: playerType,
      deckPosition: isPlayer ? layout.player?.leaderDeck : layout.opponent?.leaderDeck,
      leaderCardsData: isPlayer ? this.scene.playerLeaderCards : this.scene.opponentLeaderCards,
      startY: isPlayer ? height + 100 : -100, // Player starts below screen, opponent above
      targetArray: isPlayer ? this.playerLeaderCards : this.opponentLeaderCards,
      deckPositionKey: isPlayer ? 'player' : 'opponent'
    };
  }

  createLeaderCards(config) {
    const { playerType, deckPosition, leaderCardsData, startY, targetArray, deckPositionKey } = config;
    
    if (!deckPosition) {
      console.error(`${deckPositionKey} leader deck position not found`);
      return;
    }
    
    if (!leaderCardsData || !Array.isArray(leaderCardsData)) {
      console.error(`${deckPositionKey} leader cards data not found or invalid`);
      return;
    }

    console.log(`Creating ${leaderCardsData.length} ${playerType} leader cards`);
    
    // Clear existing leader cards
    targetArray.length = 0;
    
    // Create leader cards
    for (let i = 0; i < leaderCardsData.length; i++) {
      const leaderCardData = leaderCardsData[i];
      const cardContainer = this.createLeaderCardWithRoundedCorners(
        deckPosition.x, 
        startY, 
        leaderCardData
      );
      cardContainer.setDepth(1000 + i);
      targetArray.push(cardContainer);
    }
    
    console.log(`Created ${targetArray.length} ${playerType} leader cards`);
  }

  createLeaderCardWithRoundedCorners(x, y, cardData = null) {
    // Create the leader card image directly - always use card back during animation
    const leaderCard = this.scene.add.image(x, y, 'card-back-leader');
    const scaleX = GAME_CONFIG.card.width / leaderCard.width;
    const scaleY = GAME_CONFIG.card.height / leaderCard.height;
    leaderCard.setScale(Math.min(scaleX, scaleY) * 0.95);
    leaderCard.setRotation(Math.PI / 2); // Rotate 90 degrees (horizontal)
    
    // Create rounded border overlay to simulate rounded corners
    const borderGraphics = this.scene.add.graphics();
    borderGraphics.lineStyle(3, GAME_CONFIG.colors.cardBack, 1);
    borderGraphics.strokeRoundedRect(
      x - (GAME_CONFIG.card.width * 0.95) / 2, 
      y - (GAME_CONFIG.card.height * 0.95) / 2, 
      GAME_CONFIG.card.width * 0.95, 
      GAME_CONFIG.card.height * 0.95, 
      GAME_CONFIG.card.cornerRadius
    );
    borderGraphics.setRotation(Math.PI / 2); // Rotate border to match card
    
    // Store border reference for animation
    leaderCard.borderGraphics = borderGraphics;
    
    return leaderCard;
  }
}