import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import Card from '../components/Card.js';
import ShuffleAnimationManager from '../components/ShuffleAnimationManager.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    
    this.gameStateManager = null;
    this.playerHand = [];
    this.playerZones = {};
    this.opponentZones = {};
    this.selectedCard = null;
    this.draggedCard = null;
    this.shuffleAnimationManager = null;
    this.cardPreviewZone = null;
    this.previewCard = null;
    this.leaderCards = [];
  }

  init(data) {
    console.log('GameScene init called with data:', data);
    this.gameStateManager = data.gameStateManager;
    this.apiManager = data.apiManager;
    this.isOnlineMode = data.isOnlineMode || false;
    this.isManualPollingMode = data.isManualPollingMode || false;
    this.shuffleAnimationPlayed = false; // Track if shuffle animation has been played
  }

  async create() {
    console.log('GameScene create method called');
    console.log('Initial game state:', this.gameStateManager?.getGameState());
    this.createBackground();
    this.createGameBoard();
    this.createUI();
    this.setupEventListeners();
    
    // Start polling if in online mode and not manual polling mode
    if (this.isOnlineMode && this.apiManager && !this.isManualPollingMode) {
      console.log('Starting API polling...');
      this.gameStateManager.startPolling(this.apiManager);
    } else if (this.isManualPollingMode) {
      console.log('Manual polling mode enabled - use test button to poll');
    }
    
    // Load mock hand data only in offline mode
    if (!this.isOnlineMode) {
      await this.loadMockHandData();
    }
    
    // Load leader cards data
    await this.loadLeaderCardsData();
    
    // Hide hand area during shuffling
    this.hideHandArea();
    
    // Initialize shuffle animation manager
    this.shuffleAnimationManager = new ShuffleAnimationManager(this);
    
    // Only play animation immediately in demo mode
    // In online mode, wait for both players to be ready
    if (!this.isOnlineMode) {
      console.log('Demo mode - starting shuffle animation...');
      this.playShuffleDeckAnimation().then(() => {
        console.log('Shuffle animation completed, selecting leader cards...');
        // Automatically select leader cards for demo mode
        // The redraw dialog will be shown automatically when both leader cards are placed
        this.selectLeaderCard('player');
        this.selectLeaderCard('opponent');
      });
    } else {
      console.log('Online mode - waiting for both players to be ready before starting animation...');
      this.waitingForPlayers = true;
    }
  }

  createBackground() {
    const { width, height } = this.cameras.main;
    
    // Create gradient background
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x0f3460, 0x0f3460, 0x16213e, 0x16213e, 1);
    graphics.fillRect(0, 0, width, height);
    
    // Add table texture
    const tableGraphics = this.add.graphics();
    tableGraphics.fillStyle(0x2d5016);
    tableGraphics.fillRoundedRect(50, 50, width - 100, height - 140, 20);
    tableGraphics.lineStyle(4, 0x8b4513);
    tableGraphics.strokeRoundedRect(50, 50, width - 100, height - 140, 20);
  }

  createGameBoard() {
    console.log('createGameBoard called');
    const { width, height } = this.cameras.main;
    // card size 130x190
    // Define layout positions

    const startY = 45;
    const cardHeight = 160;
    this.layout = {
      functionalArea: {
        cardPreview: {
          x: width * 0.5 + 130 +  50 + 130 + 80 + 130 + 130 ,
          y: startY + 100+ cardHeight
        },
      },
      // Opponent zones (top area)
      opponent: {
        top: { x: width * 0.5, y:  startY + 100+ cardHeight + 10+ 15},
        left: { x:width * 0.5- 130- 50, y:  startY + 100+ cardHeight + 10+ 15},
        right: { x: width * 0.5 + 130 +  50, y:  startY + 100+ cardHeight + 10+ 15},
        help: { x: width * 0.5- 130- 50, y: startY + 100+ 0},
        sp: { x:  width * 0.5 + 130 +  50, y: startY + 100+ 0},
        leader: { x: width * 0.5, y: startY + 100+ 0},
        deck: { x: width * 0.5 - 130 -  50 - 130 - 50 , y: startY + 100+ cardHeight+10+15},
        leaderDeck: { x: width * 0.5 + 130 +  50 + 130 + 50 , y: startY + 100+ cardHeight+10+15},
        
      },
      // Player zones (bottom area)
      player: {
        top: { x: width * 0.5, y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70},
        left: { x: width * 0.5- 130- 50, y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70},
        right: { x: width * 0.5 + 130 +  50, y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 },
        help: { x: width * 0.5- 130- 50, y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 + cardHeight +30 },
        sp: { x: width * 0.5 + 130 +  50,y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 + cardHeight +30 },
        leader: { x: width * 0.5, y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 + cardHeight +30},
        deck: { x: width * 0.5 + 130 + 50+130+50 , y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70},
        leaderDeck: { x: width * 0.5 - 130 - 50 - 130 - 70 , y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 + 50}
      },
      // Battle area (center)
      //battle: { x: width * 0.5, y: height * 0.45 },
      // Hand area (bottom)
      hand: { x: width * 0.5, y: height * 0.85 }
    };
    
    this.createZones();
    //this.createBattleArea();
  }

  createZones() {
    
    // Create opponent zones
    this.opponentZones = {};
    console.log('About to iterate over opponent zones');
    const opponentEntries = Object.entries(this.layout.opponent);
    console.log('Opponent entries:', opponentEntries);
    opponentEntries.forEach(([zoneType, position]) => {
      console.log('Processing zone:', zoneType);
      const zone = this.createZone(position.x, position.y, zoneType, false);
      this.opponentZones[zoneType] = zone;
    });
    
    // Create player zones
    this.playerZones = {};
    Object.entries(this.layout.player).forEach(([zoneType, position]) => {
      const zone = this.createZone(position.x, position.y, zoneType, true);
      this.playerZones[zoneType] = zone;
    });

    Object.entries(this.layout.functionalArea).forEach(([zoneType, position]) => {
      const zone = this.createZone(position.x, position.y, zoneType, false);
      if (zoneType === 'cardPreview') {
        this.cardPreviewZone = zone;
      }
    });
    
    // Add zone labels
    this.addZoneLabels();
    
    // Create deck visualizations
    this.createDeckVisualizations();
  }
  
 
  createZone(x, y, type, isPlayerZone) {
    let placeholder;
    
    // Show deck cards for deck zones, placeholder for others
    if (type === 'deck') {
      // Create deck stack for initial display
      const initialDeckStack = this.createDeckStack(x, y, isPlayerZone ? 'player' : 'opponent');
      placeholder = initialDeckStack[0]; // Use the first card as the main placeholder reference
      
      // Store the initial deck stacks for later reference
      if (isPlayerZone) {
        this.initialPlayerDeckStack = initialDeckStack;
      } else {
        this.initialOpponentDeckStack = initialDeckStack;
      }
    } else if (type === 'cardPreview') {
      placeholder = this.add.image(x, y, 'zone-placeholder');
    } else if (type === 'leaderDeck') {
      // Create placeholder for leaderDeck zones
      placeholder = this.add.image(x, y, 'zone-placeholder');
    } else {
      // Zone placeholder for non-deck zones
      placeholder = this.add.image(x, y, 'zone-placeholder');
    }
    
    // Zone label
    const label = this.add.text(x, y + 95, type.toUpperCase(), {
      fontSize: '12px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    label.setOrigin(0.5);
    if(type === 'leaderDeck' ) {
      placeholder.setRotation(Math.PI / 2); // Rotate 90 degrees
      label.setAlpha(1); // Show the label
      label.setY(label.y - 20); // Move label up by 5 pixels
    }else if(type === 'cardPreview'){
      placeholder.setScale(3);
      label.setAlpha(0); 
    }else{
      label.setAlpha(1); // Show the label
    }
    
    // Zone interaction (only for player zones)
    if (isPlayerZone) {
      const dropZone = this.add.zone(x, y, 130, 190);
      dropZone.setRectangleDropZone(130, 190);
      dropZone.setData('zoneType', type);
      
      // Visual feedback for drop zones
      dropZone.on('dragenter', (pointer, gameObject) => {
        if (this.canDropCardInZone(gameObject, type)) {
          const highlight = this.add.image(x, y, 'zone-highlight');
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

  createBattleArea() {
    const { x, y } = this.layout.battle;
    
    // Battle area background
    const battleBg = this.add.graphics();
    battleBg.fillStyle(0x4a4a4a, 0.3);
    battleBg.fillRoundedRect(x - 200, y - 100, 400, 200, 10);
    battleBg.lineStyle(2, 0x888888);
    battleBg.strokeRoundedRect(x - 200, y - 100, 400, 200, 10);
    
    // Battle results display
    this.battleResultsText = this.add.text(x, y, 'Battle Area', {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    this.battleResultsText.setOrigin(0.5);
  }

  addZoneLabels() {
    const { width } = this.cameras.main;
    
    // Opponent area label
    /*
    this.add.text(width * 0.4, this.layout.opponent.top.y - 120, 'OPPONENT ZONES', {
      fontSize: '16px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
    
    // Player area label
    this.add.text(width * 0.4, this.layout.player.top.y - 120, 'YOUR ZONES', {
      fontSize: '16px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
    */
  }

  createDeckVisualizations() {
    // Use the initial deck stacks created in createZone as the main deck stacks
    this.playerDeckStack = this.initialPlayerDeckStack || [];
    this.opponentDeckStack = this.initialOpponentDeckStack || [];
    
    // The initial deck stacks are already visible, so no need to hide them
  }

  createDeckStack(x, y, owner) {
    // Create a stack of card backs to represent the deck
    const numCards = 5;
    const stackOffset = 1;
    const deckCards = [];
    
    for (let i = 0; i < numCards; i++) {
      // Ensure pixel-perfect positioning
      const cardX = Math.round(x + (i * stackOffset));
      const cardY = Math.round(y - (i * stackOffset));
      const card = this.add.image(cardX, cardY, 'card-back');
      
      // Scale card to match our card config dimensions
      const scaleX = GAME_CONFIG.card.width / card.width;
      const scaleY = GAME_CONFIG.card.height / card.height;
      const scale = Math.min(scaleX, scaleY) * 0.95;
      card.setScale(scale);
      
      // Ensure crisp rendering
      card.setDepth(i);
      card.setOrigin(0.5, 0.5); // Center origin for crisp rendering
      
      deckCards.push(card);
      
      // Store reference for potential updates
      if (owner === 'player') {
        if (!this.playerDeckCards) this.playerDeckCards = [];
        this.playerDeckCards.push(card);
      } else {
        if (!this.opponentDeckCards) this.opponentDeckCards = [];
        this.opponentDeckCards.push(card);
      }
    }
    
    return deckCards;
  }

  createUI() {
    const { width, height } = this.cameras.main;
    
    // Top UI bar
    this.createTopUI();
    
    // Connection status indicator
    this.createConnectionStatus();
    
    // Phase indicator
    this.phaseText = this.add.text(width / 2, 35, 'MAIN PHASE', {
      fontSize: '20px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    this.phaseText.setOrigin(0.5);
    
    // Opponent hand count display
    this.createOpponentHandDisplay();
    
    // First player display
    this.createFirstPlayerDisplay();
    
    // Action buttons
    this.createActionButtons();
    
    // Hand area
    this.createHandArea();
  }

  createTopUI() {
    const { width } = this.cameras.main;
    
    // Create UI background
    const uiBg = this.add.graphics();
    uiBg.fillStyle(0x000000, 0.5);
    uiBg.fillRect(0, 0, width, 50);
    
    // Player info (left side)
    const gameState = this.gameStateManager.getGameState();
    const player = this.gameStateManager.getPlayer();
    const opponent = this.gameStateManager.getOpponent();
    const opponentData = this.gameStateManager.getPlayer(opponent);
    
    this.playerInfoText = this.add.text(50, 5, `You: ${gameState.playerName}`, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    
    this.playerVPText = this.add.text(-100, 30, `VP: ${this.gameStateManager.getVictoryPoints()}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: '#4CAF50'
    });
    
    this.playerHandText = this.add.text(-100, 50, `Hand: ${player && player.hand ? player.hand.length : 0}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    
    // Opponent info (right side)
    this.opponentInfoText = this.add.text(width - 50, 5, `Opponent: ${opponentData ? opponentData.name : 'Unknown'}`, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    this.opponentInfoText.setOrigin(1, 0);
    
    this.opponentVPText = this.add.text(width +1000, 30, `VP: ${this.gameStateManager.getVictoryPoints(opponent)}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: '#FF5722'
    });
    this.opponentVPText.setOrigin(1, 0);
    
    this.opponentHandText = this.add.text(width+1000, 50, `Hand: ${opponentData && opponentData.hand ? opponentData.hand.length : 0}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    this.opponentHandText.setOrigin(1, 0);
    
    // Round info (center)
    this.roundText = this.add.text(width / 2, 15, `Round ${this.gameStateManager.getCurrentRound()} / 4`, {
      fontSize: '18px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    });
    this.roundText.setOrigin(0.5);
  }

  createActionButtons() {
    const { width, height } = this.cameras.main;
    
    // End Turn button
    this.endTurnButton = this.add.image(width - 120, height - 60, 'button');
    this.endTurnButton.setScale(0.8);
    this.endTurnButton.setInteractive();
    
    const endTurnText = this.add.text(width - 120, height - 60, 'End Turn', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    endTurnText.setOrigin(0.5);
    
    this.endTurnButton.on('pointerdown', () => {
      // Click visual effect
      this.endTurnButton.setTint(0x888888);
      this.endTurnButton.setScale(0.76);
      endTurnText.setScale(0.95);
      
      this.time.delayedCall(100, () => {
        this.endTurnButton.clearTint();
        this.endTurnButton.setScale(0.8);
        endTurnText.setScale(1);
      });
      
      this.time.delayedCall(50, () => this.endTurn());
    });
    
    // Menu button
    this.menuButton = this.add.image( 0+130, height - 60, 'button');
    this.menuButton.setScale(0.8);
    this.menuButton.setInteractive();
    
    const menuText = this.add.text( 0+130, height - 60, 'Menu', {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    menuText.setOrigin(0.5);
    
    this.menuButton.on('pointerdown', () => {
      // Click visual effect
      this.menuButton.setTint(0x888888);
      this.menuButton.setScale(0.95);
      menuText.setScale(0.95);
      
      this.time.delayedCall(100, () => {
        this.menuButton.clearTint();
        this.menuButton.setScale(1);
        menuText.setScale(1);
      });
      
      this.time.delayedCall(50, () => this.openMenu());
    });


    // button for testing
      this.testLeaderButton = this.add.image( 0+130, height - 120, 'button');
      this.testLeaderButton.setScale(0.8);
      this.testLeaderButton.setInteractive();
      
      const testLeaderButtonText = this.add.text( 0+130, height - 120, 'Test Leader', {
        fontSize: '14px',
        fontFamily: 'Arial',
        fill: '#ffffff'
      });
      testLeaderButtonText.setOrigin(0.5);
      
      this.testLeaderButton.on('pointerdown', () => {
        // Click visual effect
        this.testLeaderButton.setTint(0x888888);
        this.testLeaderButton.setScale(0.76);
        testLeaderButtonText.setScale(0.95);
        
        this.time.delayedCall(100, () => {
          this.testLeaderButton.clearTint();
          this.testLeaderButton.setScale(0.8);
          testLeaderButtonText.setScale(1);
        });
        
        this.time.delayedCall(50, () => this.selectLeaderCard());
      });

    // Test Opponent Leader button
    this.testOpponentLeaderButton = this.add.image(0+130, height - 180, 'button');
    this.testOpponentLeaderButton.setScale(0.8);
    this.testOpponentLeaderButton.setInteractive();
    
    const testOpponentLeaderButtonText = this.add.text(0+130, height - 180, 'Test Opp Leader', {
      fontSize: '12px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    testOpponentLeaderButtonText.setOrigin(0.5);
    
    this.testOpponentLeaderButton.on('pointerdown', () => {
      // Click visual effect
      this.testOpponentLeaderButton.setTint(0x888888);
      this.testOpponentLeaderButton.setScale(0.76);
      testOpponentLeaderButtonText.setScale(0.95);
      
      this.time.delayedCall(100, () => {
        this.testOpponentLeaderButton.clearTint();
        this.testOpponentLeaderButton.setScale(0.8);
        testOpponentLeaderButtonText.setScale(1);
      });
      
      this.time.delayedCall(50, () => this.selectLeaderCard('opponent'));
    });

    // Test Add Card button
    this.testAddCardButton = this.add.image(0+130, height - 240, 'button');
    this.testAddCardButton.setScale(0.8);
    this.testAddCardButton.setInteractive();
    
    const testAddCardButtonText = this.add.text(0+130, height - 240, 'Test Add Card', {
      fontSize: '12px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    testAddCardButtonText.setOrigin(0.5);
    
    this.testAddCardButton.on('pointerdown', () => {
      // Click visual effect
      this.testAddCardButton.setTint(0x888888);
      this.testAddCardButton.setScale(0.76);
      testAddCardButtonText.setScale(0.95);
      
      this.time.delayedCall(100, () => {
        this.testAddCardButton.clearTint();
        this.testAddCardButton.setScale(0.8);
        testAddCardButtonText.setScale(1);
      });
      
      this.time.delayedCall(50, () => this.testAddCard());
    });

    // Test buttons (only show in manual polling mode)
    if (this.isManualPollingMode) {
      // Test Polling button
      this.testPollingButton = this.add.image(0+130, height - 300, 'button');
      this.testPollingButton.setScale(0.8);
      this.testPollingButton.setInteractive();
      
      const testPollingButtonText = this.add.text(0+130, height - 300, 'Test Polling', {
        fontSize: '12px',
        fontFamily: 'Arial',
        fill: '#ffffff'
      });
      testPollingButtonText.setOrigin(0.5);
      
      this.testPollingButton.on('pointerdown', () => {
        // Click visual effect
        this.testPollingButton.setTint(0x888888);
        this.testPollingButton.setScale(0.76);
        testPollingButtonText.setScale(0.95);
        
        this.time.delayedCall(100, () => {
          this.testPollingButton.clearTint();
          this.testPollingButton.setScale(0.8);
          testPollingButtonText.setScale(1);
        });
        
        this.time.delayedCall(50, () => this.testPolling());
      });

      // Simulate Player 2 Join button
      this.testJoinPlayer2Button = this.add.image(0+130, height - 360, 'button');
      this.testJoinPlayer2Button.setScale(0.8);
      this.testJoinPlayer2Button.setInteractive();
      
      const testJoinPlayer2ButtonText = this.add.text(0+130, height - 360, 'Player 2 Join', {
        fontSize: '12px',
        fontFamily: 'Arial',
        fill: '#ffffff'
      });
      testJoinPlayer2ButtonText.setOrigin(0.5);
      
      this.testJoinPlayer2Button.on('pointerdown', () => {
        // Click visual effect
        this.testJoinPlayer2Button.setTint(0x888888);
        this.testJoinPlayer2Button.setScale(0.76);
        testJoinPlayer2ButtonText.setScale(0.95);
        
        this.time.delayedCall(100, () => {
          this.testJoinPlayer2Button.clearTint();
          this.testJoinPlayer2Button.setScale(0.8);
          testJoinPlayer2ButtonText.setScale(1);
        });
        
        this.time.delayedCall(50, () => this.simulatePlayer2Join());
      });

      // Simulate Player 2 Redraw button
      this.testPlayer2RedrawButton = this.add.image(0+130, height - 420, 'button');
      this.testPlayer2RedrawButton.setScale(0.8);
      this.testPlayer2RedrawButton.setInteractive();
      
      const testPlayer2RedrawButtonText = this.add.text(0+130, height - 420, 'P2 Redraw', {
        fontSize: '12px',
        fontFamily: 'Arial',
        fill: '#ffffff'
      });
      testPlayer2RedrawButtonText.setOrigin(0.5);
      
      this.testPlayer2RedrawButton.on('pointerdown', () => {
        // Click visual effect
        this.testPlayer2RedrawButton.setTint(0x888888);
        this.testPlayer2RedrawButton.setScale(0.76);
        testPlayer2RedrawButtonText.setScale(0.95);
        
        this.time.delayedCall(100, () => {
          this.testPlayer2RedrawButton.clearTint();
          this.testPlayer2RedrawButton.setScale(0.8);
          testPlayer2RedrawButtonText.setScale(1);
        });
        
        this.time.delayedCall(50, () => this.simulatePlayer2Redraw());
      });
    }

  }

  createOpponentHandDisplay() {
    const { width, height } = this.cameras.main;
    
    // Position the display in the top-right area near opponent zones
    const displayX =  200;
    const displayY = 120;
    
    // Background for the display
    const displayBg = this.add.graphics();
    displayBg.fillStyle(0x000000, 0.7);
    displayBg.fillRoundedRect(displayX - 70, displayY - 20, 220, 45, 5);
    displayBg.lineStyle(2, 0x888888);
    displayBg.strokeRoundedRect(displayX - 70, displayY - 20, 220, 45, 5);
    
    // Label text
    this.opponentHandLabel = this.add.text(displayX+30, displayY, 'Opponent Hand:', {
      fontSize: '24px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    this.opponentHandLabel.setOrigin(0.5);
    
    // Count text
    this.opponentHandCountText = this.add.text(displayX+130, displayY +1 , '0', {
      fontSize: '25px',
      fontFamily: 'Arial Bold',
      fill: '#FFD700',
      align: 'center'
    });
    this.opponentHandCountText.setOrigin(0.5);
  }

  createFirstPlayerDisplay() {
    const { width, height } = this.cameras.main;
    
    // Position the display in the top-left area
    const displayX = 200;
    const displayY = 180;
    
    // Background for the display
    const displayBg = this.add.graphics();
    displayBg.fillStyle(0x000000, 0.7);
    displayBg.fillRoundedRect(displayX - 70, displayY - 20, 220, 45, 5);
    displayBg.lineStyle(2, 0x888888);
    displayBg.strokeRoundedRect(displayX - 70, displayY - 20, 220, 45, 5);
    
    // Label text
    this.firstPlayerLabel = this.add.text(displayX+30, displayY, 'First Player:', {
      fontSize: '24px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    this.firstPlayerLabel.setOrigin(0.5);
    
    // First player text
    this.firstPlayerText = this.add.text(displayX+130, displayY +1 , 'Unknown', {
      fontSize: '25px',
      fontFamily: 'Arial Bold',
      fill: '#4CAF50',
      align: 'center'
    });
    this.firstPlayerText.setOrigin(0.5);
  }

  createHandArea() {
    const { width, height } = this.cameras.main;
    
    // Hand background
    const handBg = this.add.graphics();
    handBg.fillStyle(0x000000, 0);
    //fillRoundedRect(x, y, width, height, [radius])
    handBg.fillRoundedRect(50, height - 220, width - 100, 170, 10);
    
    // Hand label
    /*
    this.add.text(width / 2, height - 210, 'YOUR HAND', {
      fontSize: '14px',
      fontFamily: 'Arial Bold',
      fill: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
    */
    this.handContainer = this.add.container(width / 2, height - 120);
  }

  setupEventListeners() {
    // Game state event handlers (for online mode)
    if (this.isOnlineMode && this.gameStateManager) {
      // Register event handlers with GameStateManager
      this.gameStateManager.addEventListener('ROOM_CREATED', (event) => {
        console.log('Room created event received:', event);
        this.showRoomStatus('Room created - waiting for player 2...');
      });
      
      this.gameStateManager.addEventListener('PLAYER_JOINED', (event) => {
        console.log('Player joined event received:', event);
        this.showRoomStatus('Both players joined - hands dealt!');
        this.displayGameInfo();
        this.showRedrawDialog();
      });
      
      this.gameStateManager.addEventListener('PLAYER_READY', (event) => {
        console.log('Player ready event received:', event);
        this.showRoomStatus(`Player ${event.data.playerId} is ready!`);
      });
      
      this.gameStateManager.addEventListener('GAME_PHASE_START', (event) => {
        console.log('Game phase start event received - both players ready!', event);
        this.showRoomStatus('Game started!');
        if (this.waitingForPlayers) {
          this.waitingForPlayers = false;
          this.playShuffleDeckAnimation();
        }
      });
      
      this.gameStateManager.addEventListener('INITIAL_HAND_DEALT', (event) => {
        console.log('Initial hand dealt event received:', event);
      });
    }
    
    // Card interaction events
    this.events.on('card-select', (card) => {
      if (this.selectedCard && this.selectedCard !== card) {
        this.selectedCard.deselect();
      }
      this.selectedCard = card;
    });
    
    this.events.on('card-drag-start', (card) => {
      this.draggedCard = card;
      // Hide preview when dragging starts
      this.hideCardPreview();
    });
    
    this.events.on('card-drag-end', (card) => {
      this.draggedCard = null;
    });
    
    // Card hover events for preview
    this.events.on('card-hover', (card) => {
      // Only show preview for hand cards (not dragging)
      if (!this.draggedCard && this.playerHand.includes(card)) {
        this.showCardPreview(card.getCardData());
      }
    });
    
    this.events.on('card-unhover', (card) => {
      // Hide preview when not hovering
      if (!this.draggedCard) {
        this.hideCardPreview();
      }
    });
  }

  updateGameState() {
    this.updatePlayerHand();
    this.updateLeaderCardsFromBackend();
    this.updateZones();
    this.updateUI();
  }

  updateLeaderCardsFromBackend() {
    // In online mode, extract leader cards from backend response
    if (this.isOnlineMode) {
      const gameState = this.gameStateManager.getGameState();
      const player = this.gameStateManager.getPlayer();
      const opponent = this.gameStateManager.getOpponent();
      const opponentData = this.gameStateManager.getPlayer(opponent);
      
      if (player && player.deck && player.deck.leader) {
        console.log('Updating player leader cards from backend:', player.deck.leader);
        
        // Convert leader card IDs to card objects
        this.leaderCards = player.deck.leader.map(cardId => ({
          id: cardId,
          name: cardId,
          cardType: 'leader',
          type: 'leader'
        }));
        
        // Set up both player and opponent leader cards for the shuffle animation
        this.playerLeaderCards = [...this.leaderCards];
        
        if (opponentData && opponentData.deck && opponentData.deck.leader) {
          console.log('Updating opponent leader cards from backend:', opponentData.deck.leader);
          this.opponentLeaderCards = opponentData.deck.leader.map(cardId => ({
            id: cardId,
            name: cardId,
            cardType: 'leader',
            type: 'leader'
          }));
        }
        
        console.log('Leader cards updated - player:', this.playerLeaderCards.length, 'opponent:', this.opponentLeaderCards?.length || 0);
      }
    }
  }

  updatePlayerHand() {
    // Clear existing hand
    this.playerHand.forEach(card => card.destroy());
    this.playerHand = [];
    this.handContainer.removeAll();
    
    // Get hand from game state manager
    const hand = this.gameStateManager.getPlayerHand();
    
    console.log('updatePlayerHand - hand data:', JSON.stringify(hand));
    if (!hand || hand.length === 0) {
      console.log('No hand data found, returning early');
      return;
    }
    
    // Calculate card positions
    const cardSpacing = Math.min(160, (this.cameras.main.width - 200) / hand.length);
    const startX = -(hand.length - 1) * cardSpacing / 2;
    
    // Create cards
    hand.forEach((cardData, index) => {
      let processedCardData = cardData;
      if (typeof cardData === 'string') {
        processedCardData = {
          id: cardData,
          name: cardData,
          cardType: this.getCardTypeFromId(cardData)
        };
      }
      
      const x = startX + (index * cardSpacing);
      const card = new Card(this, x, 0, processedCardData, {
        interactive: true,
        draggable: true,
        scale: 1.1,
        usePreview: true
      });
      
      this.input.setDraggable(card);
      this.playerHand.push(card);
      this.handContainer.add(card);
    });
  }

  updateZones() {
    const playerZones = this.gameStateManager.getPlayerZones();
    const opponentId = this.gameStateManager.getOpponent();
    const opponentZones = this.gameStateManager.getPlayerZones(opponentId);
    
    // Update player zones
    Object.entries(playerZones).forEach(([zoneType, cardData]) => {
      const zone = this.playerZones[zoneType];
      if (zone && cardData && !zone.card) {
        const card = new Card(this, zone.x, zone.y, cardData, {
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
        const card = new Card(this, zone.x, zone.y, cardData, {
          interactive: false,
          faceDown: cardData.faceDown || false,
          scale: 0.9
        });
        zone.card = card;
        zone.placeholder.setVisible(false);
      }
    });
  }

  updateUI() {
    const gameState = this.gameStateManager.getGameState();
    const player = this.gameStateManager.getPlayer();
    const opponent = this.gameStateManager.getOpponent();
    console.log('card data : opponent', opponent);
    const opponentData = this.gameStateManager.getPlayer(opponent);
    
    // Debug: Log current room status and animation state
    console.log('Online mode - roomStatus:', gameState.gameEnv.roomStatus, 'shuffleAnimationPlayed:', this.shuffleAnimationPlayed);
    
    // Check for READY_PHASE room status and trigger shuffle animation
    if (gameState.gameEnv.roomStatus === 'READY_PHASE' && !this.shuffleAnimationPlayed) {
      console.log('READY_PHASE detected - triggering shuffle animation and redraw dialog');
      console.log('Game state during READY_PHASE:', JSON.stringify(gameState, null, 2));
      this.shuffleAnimationPlayed = true;
      this.showRoomStatus('Both players joined - hands dealt!');
      this.displayGameInfo();
      
      // Play shuffle animation then show redraw dialog
      this.playShuffleDeckAnimation().then(() => {
        console.log('Online mode - shuffle animation completed, selecting leader cards...');
        this.selectLeaderCard('player');
        this.selectLeaderCard('opponent');
      });
    }
    
    // Debug logging for troubleshooting
    console.log('updateUI - roomStatus:', gameState.gameEnv.roomStatus, 'shuffleAnimationPlayed:', this.shuffleAnimationPlayed);
    
    // Update phase
    this.phaseText.setText(gameState.gameEnv.phase.toUpperCase() + ' PHASE');
    
    // Update round
    this.roundText.setText(`Round ${gameState.gameEnv.round} / 4`);
    
    // Update player info
    this.playerVPText.setText(`VP: ${this.gameStateManager.getVictoryPoints()}`);
    this.playerHandText.setText(`Hand: ${player && player.hand ? player.hand.length : 0}`);
    
    // Update opponent info
    this.opponentVPText.setText(`VP: ${this.gameStateManager.getVictoryPoints(opponent)}`);
    this.opponentHandText.setText(`Hand: ${opponentData && opponentData.hand ? opponentData.hand.length : 0}`);
    
    // Update opponent hand count display
    if (this.opponentHandCountText) {
      const opponentHandCount = opponentData && opponentData.hand ? opponentData.hand.length : 0;
      this.opponentHandCountText.setText(opponentHandCount.toString());
    }
    
    // Update turn indicator
    const isCurrentPlayer = this.gameStateManager.isCurrentPlayer();
    this.endTurnButton.setTint(isCurrentPlayer ? 0xffffff : 0x888888);
  }

  canDropCardInZone(card, zoneType) {
    const cardData = card.getCardData();
    return card.canPlayInZone(zoneType);
  }

  handleCardDrop(card, zoneType, x, y) {
    if (this.canDropCardInZone(card, zoneType)) {
      // Move card to zone
      card.moveToPosition(x, y);
      card.options.draggable = false;
      
      // Update game state (this would normally be sent to server)
      this.playCardToZone(card.getCardData(), zoneType);
      
      // Remove from hand
      const handIndex = this.playerHand.indexOf(card);
      if (handIndex > -1) {
        this.playerHand.splice(handIndex, 1);
        this.handContainer.remove(card);
        this.reorganizeHand();
      }
      
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

  playCardToZone(cardData, zoneType) {
    // This would normally make an API call to the backend
    console.log(`Playing card ${cardData.id} to ${zoneType} zone`);
    
    // For demo purposes, just update local state
    const gameState = this.gameStateManager.getGameState();
    const zones = { ...gameState.gameEnv.zones };
    if (!zones[gameState.playerId]) {
      zones[gameState.playerId] = {};
    }
    zones[gameState.playerId][zoneType] = cardData;
    
    this.gameStateManager.updateGameEnv({ zones });
  }

  reorganizeHand() {
    if (this.playerHand.length === 0) return;
    
    const cardSpacing = Math.min(160, (this.cameras.main.width - 200) / this.playerHand.length);
    const startX = -(this.playerHand.length - 1) * cardSpacing / 2;
    
    this.playerHand.forEach((card, index) => {
      const newX = startX + (index * cardSpacing);
      card.moveToPosition(newX, 0);
      card.originalPosition.x = newX;
    });
  }

  endTurn() {
    if (!this.gameStateManager.isCurrentPlayer()) {
      console.log('Not your turn');
      return;
    }
    
    console.log('Ending turn...');
    // This would normally make an API call to end the turn
  }

  openMenu() {
    // Return to menu scene
    this.scene.start('MenuScene');
  }

  playShuffleDeckAnimation() {
    return new Promise((resolve) => {
      // Hide the initial deck stacks during shuffle
      if (this.playerDeckStack) {
        this.playerDeckStack.forEach(card => card.setVisible(false));
      }
      if (this.opponentDeckStack) {
        this.opponentDeckStack.forEach(card => card.setVisible(false));
      }
      
      this.shuffleAnimationManager.playShuffleDeckAnimation(this.layout, () => {
        console.log('Shuffle animation manager callback triggered');
        // Show deck stacks immediately to maintain deck visibility
        this.showDeckStacks();
        
        // Show hand area and update game state after shuffle animation completes
        this.showHandArea();
        this.updateGameState();
        
        console.log('About to resolve shuffle animation promise');
        // Resolve the promise
        resolve();
      });
    });
  }


  getCardTypeFromId(cardId) {
    if (cardId.startsWith('c-')) return 'character';
    if (cardId.startsWith('h-')) return 'help';
    if (cardId.startsWith('sp-')) return 'sp';
    if (cardId.startsWith('s-')) return 'leader';
    return 'unknown';
  }

  createMockHandData() {
    // Create simple mock hand data for testing card display
    return [
      {
        id: 'c-1',
        name: '總統特朗普',
        cardType: 'character',
        gameType: '愛國者',
        power: 100,
        traits: ['特朗普家族']
      },
      {
        id: 'c-2', 
        name: '前總統特朗普(YMCA)',
        cardType: 'character',
        gameType: '右翼',
        power: 80,
        traits: ['特朗普家族']
      },
      {
        id: 'h-1',
        name: 'Deep State',
        cardType: 'help'
      },
      {
        id: 'sp-2',
        name: '減息周期',
        cardType: 'sp'
      },
      {
        id: 's-1',
        name: '特朗普',
        cardType: 'leader',
        gameType: '右翼',
        initialPoint: 110
      }
    ];
  }

  async loadMockHandData() {
    try {
      console.log('Loading mock hand data...');
      const response = await fetch('/handCards.json');
      const mockData = await response.json();
      
      if (mockData.success) {
        console.log('Mock hand data loaded:', mockData.data);
        
        // Setup mock game state with hand cards
        this.gameStateManager.initializeGame('mock-game', mockData.data.playerId, 'Test Player');
        
        // Update game state with mock hand data
        this.gameStateManager.updateGameEnv({
          phase: GAME_CONFIG.phases.MAIN,
          currentPlayer: mockData.data.playerId,
          players: {
            [mockData.data.playerId]: {
              id: mockData.data.playerId,
              name: 'Test Player',
              hand: mockData.data.handCards
            }
          }
        });
        
        console.log('Mock game state setup complete');
        
        // Debug: Check if the game state was set correctly
        const gameState = this.gameStateManager.getGameState();
        console.log('Current game state:', gameState);
        console.log('Current player hand:', this.gameStateManager.getPlayerHand());
        
        // Don't update hand display yet - wait for shuffle animation to complete
      } else {
        console.error('Failed to load mock hand data');
      }
    } catch (error) {
      console.error('Error loading mock hand data:', error);
    }
  }

  showDeckStacks() {
    // Show the permanent deck stacks directly without animation
    this.playerDeckStack.forEach((card, index) => {
      card.setVisible(true);
      card.setAlpha(1); // Full opacity for crisp rendering
    });
    
    this.opponentDeckStack.forEach((card, index) => {
      card.setVisible(true);
      card.setAlpha(1); // Full opacity for crisp rendering
    });
  }

  hideHandArea() {
    // Hide the hand container during shuffling
    if (this.handContainer) {
      this.handContainer.setVisible(false);
    }
  }

  showHandArea() {
    // Show the hand container after shuffling
    if (this.handContainer) {
      this.handContainer.setVisible(true);
    }
    
   
  }

  showCardPreview(cardData) {
    // Remove existing preview card if any
    this.hideCardPreview();
    
    if (this.cardPreviewZone && cardData) {
      // Create a larger preview card using original (full-detail) images
      this.previewCard = new Card(this, this.cardPreviewZone.x, this.cardPreviewZone.y, cardData, {
        interactive: false,
        draggable: false,
        scale: 3.5, // Large scale for preview
        usePreview: false // Use original full-detail images for preview
      });
      
      // Set high depth to appear on top
      this.previewCard.setDepth(2000);
    }
  }

  hideCardPreview() {
    if (this.previewCard) {
      this.previewCard.destroy();
      this.previewCard = null;
    }
  }

  async loadLeaderCardsData() {
    try {
      console.log('Loading leader cards data...');
      
      // Try to get leader cards from API/game state first
      if (this.isOnlineMode && this.gameStateManager) {
        const gameState = this.gameStateManager.getGameState();
        const player = this.gameStateManager.getPlayer();
        
        // Check if player has leader cards in deck
        if (player && player.deck && player.deck.leader) {
          console.log('Loading leader cards from API game state:', player.deck.leader);
          
          // Convert leader card IDs to card objects (need to load from backend card database)
          const baseLeaderCards = await this.convertCardIdsToObjects(player.deck.leader, 'leader');
          
          // Create separate shuffled decks for player and opponent
          this.playerLeaderCards = [...baseLeaderCards];  // Copy for player
          this.opponentLeaderCards = [...baseLeaderCards]; // Copy for opponent
          
          // Shuffle both decks separately
          this.shuffleArray(this.playerLeaderCards);
          this.shuffleArray(this.opponentLeaderCards);
          
          console.log('Player leader cards shuffled:', this.playerLeaderCards);
          console.log('Opponent leader cards shuffled:', this.opponentLeaderCards);
          
          // Keep this.leaderCards for backwards compatibility (use player's deck)
          this.leaderCards = this.playerLeaderCards;
          return;
        }
      }
      
      // Fallback to static file for demo mode
      console.log('Loading leader cards from static file (demo mode)...');
      const response = await fetch('/leaderCards.json');
      const mockData = await response.json();
      
      if (mockData.success) {
        console.log('Leader cards data loaded from file:', mockData.data);
        const baseLeaderCards = mockData.data.leaderCards;
        
        // Create separate shuffled decks for player and opponent
        this.playerLeaderCards = [...baseLeaderCards];  // Copy for player
        this.opponentLeaderCards = [...baseLeaderCards]; // Copy for opponent
        
        // Shuffle both decks separately
        this.shuffleArray(this.playerLeaderCards);
        this.shuffleArray(this.opponentLeaderCards);
        
        console.log('Player leader cards shuffled (demo):', this.playerLeaderCards);
        console.log('Opponent leader cards shuffled (demo):', this.opponentLeaderCards);
        
        // Keep this.leaderCards for backwards compatibility (use player's deck)
        this.leaderCards = this.playerLeaderCards;
      } else {
        console.error('Failed to load leader cards data');
      }
    } catch (error) {
      console.error('Error loading leader cards data:', error);
    }
  }

  async convertCardIdsToObjects(cardIds, cardType) {
    // For now, create basic card objects from IDs
    // In the future, this could fetch from backend card database
    return cardIds.map(cardId => ({
      id: cardId,
      name: cardId, // Use ID as name for now
      type: cardType || this.getCardTypeFromId(cardId),
      power: cardType === 'character' ? Math.floor(Math.random() * 5) + 1 : undefined // Mock power for characters
    }));
  }

  shuffleArray(array) {
    // Fisher-Yates shuffle algorithm
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  updateLeaderDecks() {
    // Update player leader deck
    const playerLeaderZone = this.playerZones.leaderDeck;
    if (playerLeaderZone && this.leaderCards.length > 0) {
      this.createLeaderDeckDisplay(playerLeaderZone, 'player');
    }
    
    // Update opponent leader deck
    const opponentLeaderZone = this.opponentZones.leaderDeck;
    if (opponentLeaderZone && this.leaderCards.length > 0) {
      this.createLeaderDeckDisplay(opponentLeaderZone, 'opponent');
    }
  }

  createLeaderDeckDisplay(zone, owner) {
    // Clear existing placeholder
    if (zone.placeholder) {
      zone.placeholder.destroy();
    }
    
    // Create a stack of leader cards (showing top card)
    const topCard = this.leaderCards[0]; // Show the first leader card on top
    const card = new Card(this, zone.x, zone.y, topCard, {
      interactive: true,
      draggable: false,
      scale: 0.9,
      usePreview: true // Use preview images for leader deck display
    });
    
    // Rotate the card 90 degrees to match the original leaderDeck orientation
    card.setRotation(Math.PI / 2);
    
    // Store the card in the zone
    zone.card = card;
    zone.placeholder = card; // Update placeholder reference
    
    console.log(`Created leader deck display for ${owner} with card:`, topCard.id);
  }

  selectLeaderCard(playerType = 'player') {
    console.log(`selectLeaderCard called for ${playerType}`);
    
    const zones = playerType === 'player' ? this.playerZones : this.opponentZones;
    const leaderDeckZone = zones.leaderDeck;
    const leaderZone = zones.leader;
    
    if (!leaderDeckZone || !leaderZone) {
      console.log(`${playerType} leader zones not found`);
      return;
    }

    const leaderCardsArray = playerType === 'player' ? 
      this.shuffleAnimationManager?.playerLeaderCards : 
      this.shuffleAnimationManager?.opponentLeaderCards;

    const leaderDeckSource = playerType === 'player' ? this.playerLeaderCards : this.opponentLeaderCards;

    if (!this.shuffleAnimationManager || !leaderCardsArray || leaderCardsArray.length === 0) {
      console.log(`No ${playerType} leader cards available in deck`);
      return;
    }

    // Atomically get and remove the top card from both the visual and data arrays
    console.log('leaderCardsArray:', JSON.stringify(leaderCardsArray));
    const topCard = leaderCardsArray.shift();
    console.log('leaderCardsArray:2', JSON.stringify(leaderCardsArray));
    const cardData = leaderDeckSource.shift();

    if (!topCard || !cardData) {
      console.error(`Mismatch between visual and data arrays for ${playerType} leader deck.`);
      return;
    }

    console.log(`Moving ${playerType} leader card to leader position:`, cardData.name);

    this.tweens.add({
      targets: topCard,
      x: leaderZone.x,
      y: leaderZone.y,
      rotation: 0,
      duration: 300,
      ease: 'Power2.easeInOut',
      onComplete: () => {
        topCard.destroy();
        if (topCard.borderGraphics) {
          topCard.borderGraphics.destroy();
        }

        if (leaderZone.card) {
          leaderZone.card.destroy();
        }

        const leaderCard = new Card(this, leaderZone.x, leaderZone.y, cardData, {
          interactive: true,
          draggable: false,
          scale: 0.9,
          usePreview: true
        });
    
        leaderCard.on('pointerover', () => this.showCardPreview(cardData));
        leaderCard.on('pointerout', () => this.hideCardPreview());

        leaderZone.card = leaderCard;
        leaderCard.setDepth(1001);
        
        if (leaderZone.placeholder) {
          leaderZone.placeholder.setVisible(false);
        }

        console.log(`${playerType} leader card ${cardData.name} placed in leader position`);

        this.repositionLeaderDeckCards(playerType);
        
        if (!this.leaderCardsPlaced) {
          this.leaderCardsPlaced = 0;
        }
        this.leaderCardsPlaced++;
        
        if (this.leaderCardsPlaced === 2) {
          console.log('Both leader cards placed, starting highlight animations');
          
          this.playerHand.forEach(card => card.setDepth(1001));
          if (this.handContainer) {
            this.handContainer.setDepth(1001);
          }
          
          this.time.delayedCall(50, () => {
            this.highlightHandCards();
            this.highlightLeaderCards();
            this.showRedrawDialog();
          });
        }
      }
    });
  }

  repositionLeaderDeckCards(playerType = 'player') {
    // Get the appropriate arrays and zones based on player type
    const leaderCardsArray = playerType === 'player' ? 
      this.shuffleAnimationManager?.playerLeaderCards : 
      this.shuffleAnimationManager?.opponentLeaderCards;
    
    const zones = playerType === 'player' ? this.playerZones : this.opponentZones;
    const leaderDeckZone = zones.leaderDeck;

    if (!this.shuffleAnimationManager || !leaderCardsArray || !leaderDeckZone) {
      return;
    }

    // Get the target position for the top card (same as original leaderDeck position)
    const targetX = leaderDeckZone.x;
    const targetY = leaderDeckZone.y;

    // Animate remaining cards to their new positions
    leaderCardsArray.forEach((card, index) => {
      // Calculate the new position based on the stacking offset
      const newX = targetX;
      
      // For opponent, stack cards ABOVE the leader deck position (negative offset)
      // For player, stack cards BELOW the leader deck position (positive offset)
      const offsetDirection = playerType === 'opponent' ? -1 : 1;
      const newY = targetY + (offsetDirection * index * 30);

      // Animate card to new position
      this.tweens.add({
        targets: card,
        x: newX,
        y: newY,
        duration: 150,
        ease: 'Power2.easeOut'
      });

      // Also animate the border graphics if they exist
      if (card.borderGraphics) {
        this.tweens.add({
          targets: card.borderGraphics,
          x: newX,
          y: newY,
          duration: 150,
          ease: 'Power2.easeOut'
        });
      }

      // Update depth to maintain proper stacking order
      card.setDepth(1000 + leaderCardsArray.length - index);
    });
  }


  async testAddCard() {
    try {
      console.log('Loading add card data...');
      const response = await fetch('/addNewHand.json');
      const addCardData = await response.json();
      
      if (addCardData.success) {
        console.log('Add card data loaded:', addCardData.data);
        
        const { playerId, handCardsToAdd } = addCardData.data;
        const isPlayerTarget = playerId === 'player-1';
        
        console.log(`Adding ${handCardsToAdd.length} cards to ${isPlayerTarget ? 'player' : 'opponent'} hand`);
        
        if (isPlayerTarget) {
          // Add cards to player hand with animation
          this.addCardsToPlayerHand(handCardsToAdd);
        } else {
          // Add cards to opponent hand (update count display)
          this.addCardsToOpponentHand(handCardsToAdd);
        }
      } else {
        console.error('Failed to load add card data');
      }
    } catch (error) {
      console.error('Error loading add card data:', error);
    }
  }

  addCardsToPlayerHand(cardsToAdd) {
    // Get current game state to update
    const gameState = this.gameStateManager.getGameState();
    const player = this.gameStateManager.getPlayer();
    
    if (!player || !player.hand) {
      console.error('Player hand not found');
      return;
    }

    // Add cards to game state first
    const updatedHand = [...player.hand, ...cardsToAdd];
    
    // Update game state
    this.gameStateManager.updateGameEnv({
      players: {
        ...gameState.gameEnv.players,
        [gameState.playerId]: {
          ...player,
          hand: updatedHand
        }
      }
    });

    // Animate cards from deck to hand
    this.animateCardsFromDeckToHand(cardsToAdd);
  }

  addCardsToOpponentHand(cardsToAdd) {
    // Get current game state to update
    const gameState = this.gameStateManager.getGameState();
    const opponent = this.gameStateManager.getOpponent();
    const opponentData = this.gameStateManager.getPlayer(opponent);
    
    if (!opponentData || !opponentData.hand) {
      console.error('Opponent hand not found');
      return;
    }

    // Add cards to opponent's hand in game state
    const updatedOpponentHand = [...opponentData.hand, ...cardsToAdd];
    
    // Update game state
    this.gameStateManager.updateGameEnv({
      players: {
        ...gameState.gameEnv.players,
        [opponent]: {
          ...opponentData,
          hand: updatedOpponentHand
        }
      }
    });

    // Update UI to reflect new opponent hand count
    this.updateUI();
    
    console.log(`Added ${cardsToAdd.length} cards to opponent hand`);
  }

  animateCardsFromDeckToHand(cardsToAdd) {
    const playerDeckPosition = this.layout.player.deck;
    
    // Animate each new card sequentially with individual slide animations
    cardsToAdd.forEach((cardData, index) => {
      setTimeout(() => {
        // Create temporary card at deck position (card back)
        const tempCard = this.add.image(playerDeckPosition.x, playerDeckPosition.y, 'card-back');
        
        // Set the card to hand card size immediately
        const scaleX = GAME_CONFIG.card.width / tempCard.width;
        const scaleY = GAME_CONFIG.card.height / tempCard.height;
        const handScale = Math.min(scaleX, scaleY) * 0.95 * 1.15; // Match hand card scale
        tempCard.setScale(handScale);
        tempCard.setDepth(2000);
        
        // Calculate spacing for current hand size + this new card
        const currentHandLength = this.playerHand.length; // Current cards in hand
        const totalCards = currentHandLength + 1; // Including this new card
        const cardSpacing = Math.min(160, (this.cameras.main.width - 200) / totalCards);
        const startX = -(totalCards - 1) * cardSpacing / 2;
        const newCardX = startX + (currentHandLength * cardSpacing); // Position for new card
        
        // Convert to world coordinates
        const worldTargetX = this.handContainer.x + newCardX;
        const worldTargetY = this.handContainer.y;
        
        // Animate existing hand cards to slide left to make space for this card
        this.slideHandCardsLeft(totalCards, cardSpacing);
        
        // Animate new card from deck to hand position
        this.tweens.add({
          targets: tempCard,
          x: worldTargetX,
          y: worldTargetY,
          duration: 500,
          ease: 'Power2.easeOut',
          onComplete: () => {
            // Flip animation: card back to card face
            this.tweens.add({
              targets: tempCard,
              scaleX: 0, // Flip to invisible
              duration: 150,
              ease: 'Power2.easeIn',
              onComplete: () => {
                // Change to actual card image
                const cardKey = `${cardData.id}-preview`;
                tempCard.setTexture(cardKey);
                
                // Recalculate scale for the new texture to maintain consistent card size
                const newScaleX = GAME_CONFIG.card.width / tempCard.width;
                const newScaleY = GAME_CONFIG.card.height / tempCard.height;
                const newHandScale = Math.min(newScaleX, newScaleY) * 0.95 * 1.15;
                
                // Update Y scale to match the new texture
                tempCard.setScale(0, newHandScale);
                
                // Flip back to visible with correct scale
                this.tweens.add({
                  targets: tempCard,
                  scaleX: newHandScale, // Use properly calculated scale for new texture
                  duration: 150,
                  ease: 'Power2.easeOut',
                  onComplete: () => {
                    // Calculate position relative to hand container
                    const relativeX = tempCard.x - this.handContainer.x;
                    const relativeY = tempCard.y - this.handContainer.y;
                    
                    // Convert temporary card to actual hand card
                    const newCard = new Card(this, relativeX, relativeY, cardData, {
                      interactive: true,
                      draggable: true,
                      scale: 1.15,
                      usePreview: true
                    });
                    
                    // Set up drag and drop
                    this.input.setDraggable(newCard);
                    
                    // Add to hand array and container
                    this.playerHand.push(newCard);
                    this.handContainer.add(newCard);
                    
                    // Update original position for drag/drop
                    newCard.originalPosition.x = relativeX;
                    newCard.originalPosition.y = relativeY;
                    
                    // Set proper depth
                    newCard.setDepth(100);
                    
                    // Destroy temporary card
                    tempCard.destroy();
                    
                    console.log(`Card ${cardData.id} added to hand at position ${this.playerHand.length - 1} at (${relativeX}, ${relativeY})`);
                  }
                });
              }
            });
          }
        });
      }, index * 1000); // 1000ms delay between each card to allow slide + flip animations to complete
    });
  }

  slideHandCardsLeft(newTotalCards, cardSpacing) {
    // Recalculate positions for all existing cards with new spacing
    const newStartX = -(newTotalCards - 1) * cardSpacing / 2;
    
    this.playerHand.forEach((card, index) => {
      const newX = newStartX + (index * cardSpacing);
      
      // Animate existing cards to new positions
      this.tweens.add({
        targets: card,
        x: newX,
        duration: 300,
        ease: 'Power2.easeOut'
      });
      
      // Update original position for drag/drop functionality
      card.originalPosition.x = newX;
    });
  }

  createConnectionStatus() {
    const { width } = this.cameras.main;
    
    // Connection status indicator (top right)
    const statusText = this.isOnlineMode ? '🟢 Online' : '🔴 Demo';
    const statusColor = this.isOnlineMode ? '#51CF66' : '#FF6B6B';
    
    this.connectionStatusText = this.add.text(width - 20, 20, statusText, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: statusColor
    });
    this.connectionStatusText.setOrigin(1, 0);
  }

  async testPolling() {
    if (!this.isOnlineMode || !this.apiManager) {
      console.log('Not in online mode or no API manager available');
      return;
    }

    const gameState = this.gameStateManager.getGameState();
    console.log('Manual polling test triggered...');
    console.log('Polling for playerId:', gameState.playerId, 'gameId:', gameState.gameId);
    
    try {
      // Perform a single poll manually
      const response = await this.apiManager.getPlayer(gameState.playerId, gameState.gameId);
      
      if (response && response.gameEnv) {
        console.log('Polling response received:', response);
        this.gameStateManager.updateGameEnv(response.gameEnv);
        
        // Process any events
        await this.gameStateManager.acknowledgeEvents(this.apiManager);
        
        // Update UI with any changes
        this.updateGameState();
        
        console.log('Manual polling completed successfully');
      } else {
        console.log('No game environment received from polling');
      }
    } catch (error) {
      console.error('Manual polling failed:', error);
      
      if (error.message.includes('404')) {
        console.log('Game not found on backend. In demo mode, you need to create the game on backend first.');
        console.log('You can either:');
        console.log('1. Create a real game through the API, or');
        console.log('2. Use the backend test endpoints to inject a game state');
      }
    }
  }

  async simulatePlayer2Join() {
    try {
      const gameState = this.gameStateManager.getGameState();
      const gameId = gameState.gameId;
      
      console.log('Simulating player 2 joining room with gameId:', gameId);
      
      if (!gameId) {
        throw new Error('No gameId found. Make sure game was created first.');
      }
      
      // Call joinRoom API to simulate player 2 joining using the correct gameId
      const response = await this.apiManager.joinRoom(gameId, 'Demo Opponent');
      console.log('Player 2 join response:', response);
      
      // Don't update game state immediately - let user poll to see changes
      console.log('Player 2 join API call completed. Use polling to see the changes.');
      
      this.showRoomStatus('Player 2 joined! Use polling to see changes.');
      
    } catch (error) {
      console.error('Failed to simulate player 2 join:', error);
      this.showRoomStatus('Failed to simulate player 2 join: ' + error.message);
    }
  }

  displayGameInfo() {
    const gameState = this.gameStateManager.getGameState();
    const gameEnv = gameState.gameEnv;
    
    if (gameEnv && gameEnv.firstPlayer !== undefined && gameEnv.players) {
      const playerIds = Object.keys(gameEnv.players);
      if (playerIds.length < 2) return;

      // Determine which player goes first
      const firstPlayerId = gameEnv.firstPlayer === 0 ? playerIds[0] : playerIds[1];
      const isCurrentPlayerFirst = firstPlayerId === gameState.playerId;
      
      // Display first player info
      const firstPlayerText = isCurrentPlayerFirst ? 'You go first!' : 'Opponent goes first!';
      this.showRoomStatus(`${firstPlayerText} (First player: ${firstPlayerId})`);
      
      // Update first player display
      this.updateFirstPlayerDisplay(isCurrentPlayerFirst);
      
      // Display hand count info near opponent area
      this.updateOpponentInfo(gameEnv);
      
      console.log('Game Info:', {
        firstPlayer: firstPlayerId,
        currentPlayerIsFirst: isCurrentPlayerFirst,
        player1Hand: gameEnv.players[playerIds[0]]?.deck?.hand?.length || 0,
        player2Hand: gameEnv.players[playerIds[1]]?.deck?.hand?.length || 0
      });
    }
  }

  updateFirstPlayerDisplay(isCurrentPlayerFirst) {
    if (this.firstPlayerText) {
      const firstPlayerName = isCurrentPlayerFirst ? 'You' : 'Opponent';
      this.firstPlayerText.setText(firstPlayerName);
      
      // Change color based on who goes first
      const color = isCurrentPlayerFirst ? '#4CAF50' : '#FF5722'; // Green for you, Red for opponent
      this.firstPlayerText.setFill(color);
    }
  }

  updateOpponentInfo(gameEnv) {
    const opponentId = this.gameStateManager.getOpponent();
    if (!opponentId) return;

    const opponentData = this.gameStateManager.getPlayer(opponentId);
    const opponentHandCount = opponentData?.hand?.length || 0;
    
    // Update existing opponent hand count display (created in createOpponentHandDisplay)
    if (this.opponentHandCountText) {
      this.opponentHandCountText.setText(opponentHandCount.toString());
    }
  }

  showRedrawDialog() {
    // Note: Hand cards and leader cards are already highlighted after selectLeaderCard completes
    
    // Create modal-like dialog
    const { width, height } = this.cameras.main;
    
    // Semi-transparent background covering the whole screen
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(1000); // Put overlay above most elements
    
    // Bring hand cards to front (above the overlay)
    this.playerHand.forEach(card => {
      card.setDepth(1001); // Hand cards above overlay
    });
    
    // Also bring the hand container to front if it exists
    if (this.handContainer) {
      this.handContainer.setDepth(1001);
    }
    
    // Bring leader cards to front (above the overlay) - same as hand cards
    console.log('DEBUG: Setting leader card depths...');
    if (this.playerZones.leader && this.playerZones.leader.card) {
      console.log('DEBUG: Player leader card found, setting depth to 1001');
      this.playerZones.leader.card.setDepth(1001);
      console.log('DEBUG: Player leader card depth is now:', this.playerZones.leader.card.depth);
    } else {
      console.log('DEBUG: Player leader card NOT found');
    }
    if (this.playerZones.leaderDeck && this.playerZones.leaderDeck.card) {
      console.log('DEBUG: Player leader deck card found, setting depth to 1001');
      this.playerZones.leaderDeck.card.setDepth(1001);
      console.log('DEBUG: Player leader deck card depth is now:', this.playerZones.leaderDeck.card.depth);
    } else {
      console.log('DEBUG: Player leader deck card NOT found');
    }
    if (this.opponentZones.leader && this.opponentZones.leader.card) {
      console.log('DEBUG: Opponent leader card found, setting depth to 1001');
      this.opponentZones.leader.card.setDepth(1001);
      console.log('DEBUG: Opponent leader card depth is now:', this.opponentZones.leader.card.depth);
    } else {
      console.log('DEBUG: Opponent leader card NOT found');
    }
    if (this.opponentZones.leaderDeck && this.opponentZones.leaderDeck.card) {
      console.log('DEBUG: Opponent leader deck card found, setting depth to 1001');
      this.opponentZones.leaderDeck.card.setDepth(1001);
      console.log('DEBUG: Opponent leader deck card depth is now:', this.opponentZones.leaderDeck.card.depth);
    } else {
      console.log('DEBUG: Opponent leader deck card NOT found');
    }
    
    // Dialog box
    const dialogBg = this.add.graphics();
    dialogBg.fillStyle(0x333333);
    dialogBg.fillRoundedRect(width/2 - 200, height/2 - 100, 400, 200, 10);
    dialogBg.lineStyle(2, 0x666666);
    dialogBg.strokeRoundedRect(width/2 - 200, height/2 - 100, 400, 200, 10);
    dialogBg.setDepth(1002); // Dialog above overlay and hand cards
    
    // Dialog text
    const dialogText = this.add.text(width/2, height/2 - 50, 'Do you want to redraw your hand?', {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'center'
    });
    dialogText.setOrigin(0.5);
    dialogText.setDepth(1002);
    
    // Yes button
    const yesButton = this.add.image(width/2 - 80, height/2 + 30, 'button');
    yesButton.setScale(0.8);
    yesButton.setInteractive();
    yesButton.setTint(0x4CAF50);
    yesButton.setDepth(1002);
    
    const yesText = this.add.text(width/2 - 80, height/2 + 30, 'Yes', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    yesText.setOrigin(0.5);
    yesText.setDepth(1002);
    
    // No button
    const noButton = this.add.image(width/2 + 80, height/2 + 30, 'button');
    noButton.setScale(0.8);
    noButton.setInteractive();
    noButton.setTint(0xF44336);
    noButton.setDepth(1002);
    
    const noText = this.add.text(width/2 + 80, height/2 + 30, 'No', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff'
    });
    noText.setOrigin(0.5);
    noText.setDepth(1002);
    
    // Button handlers
    yesButton.on('pointerdown', () => this.handleRedrawChoice(true, [overlay, dialogBg, dialogText, yesButton, yesText, noButton, noText]));
    noButton.on('pointerdown', () => this.handleRedrawChoice(false, [overlay, dialogBg, dialogText, yesButton, yesText, noButton, noText]));
  }

  highlightHandCards() {
    // Add a pulsing effect to all hand cards (no tint overlay)
    this.playerHand.forEach(card => {
      // Create a pulsing animation on the card container
      this.tweens.add({
        targets: card,
        scaleX: card.scaleX * 1.1,
        scaleY: card.scaleY * 1.1,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      
      // Store reference to remove later
      if (!card.redrawHighlight) {
        card.redrawHighlight = true;
      }
    });
    
  }
  
  highlightLeaderCards() {
    console.log('highlightLeaderCards called');
    
    // Highlight player leader card
    if (this.playerZones.leader && this.playerZones.leader.card) {
      console.log('Player leader card found, starting highlight');
      const leaderCard = this.playerZones.leader.card;
      this.tweens.add({
        targets: leaderCard,
        scaleX: leaderCard.scaleX * 1.1,
        scaleY: leaderCard.scaleY * 1.1,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      leaderCard.redrawHighlight = true;
    } else {
      console.log('Player leader card not found for highlighting');
    }
    
    // Highlight opponent leader card
    if (this.opponentZones.leader && this.opponentZones.leader.card) {
      console.log('Opponent leader card found, starting highlight');
      const leaderCard = this.opponentZones.leader.card;
      this.tweens.add({
        targets: leaderCard,
        scaleX: leaderCard.scaleX * 1.1,
        scaleY: leaderCard.scaleY * 1.1,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      leaderCard.redrawHighlight = true;
    } else {
      console.log('Opponent leader card not found for highlighting');
    }
  }

  removeHandCardHighlight() {
    // Remove highlight effects from hand cards
    this.playerHand.forEach(card => {
      if (card.redrawHighlight) {
        // Stop pulsing animation and reset scale
        this.tweens.killTweensOf(card);
        card.setScale(1.1, 1.1); // Reset to original scale
        
        card.redrawHighlight = false;
      }
    });
    
    // Also remove leader card highlights
    this.removeLeaderCardHighlight();
  }
  
  removeLeaderCardHighlight() {
    console.log('removeLeaderCardHighlight called');
    
    // Remove player leader card highlight
    if (this.playerZones.leader && this.playerZones.leader.card) {
      const leaderCard = this.playerZones.leader.card;
      console.log('Player leader card found, redrawHighlight:', leaderCard.redrawHighlight);
      
      // Kill any tweens targeting this card regardless of highlight flag
      this.tweens.killTweensOf(leaderCard);
      // Reset scale to normal
      leaderCard.setScale(0.9, 0.9); // Leader cards use 0.9 scale
      leaderCard.redrawHighlight = false;
    }
    
    // Remove opponent leader card highlight
    if (this.opponentZones.leader && this.opponentZones.leader.card) {
      const leaderCard = this.opponentZones.leader.card;
      console.log('Opponent leader card found, redrawHighlight:', leaderCard.redrawHighlight);
      
      // Kill any tweens targeting this card regardless of highlight flag
      this.tweens.killTweensOf(leaderCard);
      // Reset scale to normal
      leaderCard.setScale(0.9, 0.9); // Leader cards use 0.9 scale
      leaderCard.redrawHighlight = false;
    }
  }

  async handleRedrawChoice(wantRedraw, dialogElements) {
    // Remove dialog elements
    dialogElements.forEach(element => element.destroy());
    
    // Remove hand card highlighting
    this.removeHandCardHighlight();
    
    // Remove leader card highlighting
    this.removeLeaderCardHighlight();
    
    // Reset hand cards depth to normal
    this.playerHand.forEach(card => {
      card.setDepth(0); // Reset to default depth
    });
    
    // Reset hand container depth if it exists
    if (this.handContainer) {
      this.handContainer.setDepth(0);
    }
    
    // Reset leader cards depth to normal - same as hand cards
    if (this.playerZones.leader && this.playerZones.leader.card) {
      this.playerZones.leader.card.setDepth(0);
    }
    if (this.playerZones.leaderDeck && this.playerZones.leaderDeck.card) {
      this.playerZones.leaderDeck.card.setDepth(0);
    }
    if (this.opponentZones.leader && this.opponentZones.leader.card) {
      this.opponentZones.leader.card.setDepth(0);
    }
    if (this.opponentZones.leaderDeck && this.opponentZones.leaderDeck.card) {
      this.opponentZones.leaderDeck.card.setDepth(0);
    }
    
    try {
      const gameState = this.gameStateManager.getGameState();
      console.log(`Player chose redraw: ${wantRedraw}`);
      
      // Call startReady with redraw choice
      await this.apiManager.startReady(gameState.playerId, gameState.gameId, wantRedraw);
      
      this.showRoomStatus(`Ready sent (redraw: ${wantRedraw}). Poll to see if both players ready.`);
      
    } catch (error) {
      console.error('Failed to send ready status:', error);
      this.showRoomStatus('Failed to send ready status: ' + error.message);
    }
  }

  showRoomStatus(message) {
    // Remove existing room status text
    if (this.roomStatusText) {
      this.roomStatusText.destroy();
    }
    
    // Create new room status text
    const { width } = this.cameras.main;
    this.roomStatusText = this.add.text(250, 80, message, {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#FFD700',
      align: 'left'
    });
    this.roomStatusText.setOrigin(0.5);
    
    // Auto-hide after 5 seconds
    this.time.delayedCall(5000, () => {
      if (this.roomStatusText) {
        this.roomStatusText.destroy();
        this.roomStatusText = null;
      }
    });
  }

  destroy() {
    // Stop polling when scene is destroyed
    if (this.gameStateManager) {
      this.gameStateManager.stopPolling();
    }
    
    // Call parent destroy
    super.destroy();
  }

  async simulatePlayer2Redraw() {
    try {
      const gameState = this.gameStateManager.getGameState();
      const gameId = gameState.gameId;
      // Find player 2's ID
      const playerIds = Object.keys(gameState.gameEnv.players || {});
      const player2Id = playerIds.find(id => id !== gameState.playerId);

      if (!gameId || !player2Id) {
        throw new Error('No gameId or player2Id found. Make sure both players are in the game.');
      }

      // Simulate player 2 calling redraw (startReady with wantRedraw = true)
      await this.apiManager.startReady(player2Id, gameId, true);

      this.showRoomStatus('Simulated Player 2 redraw (ready with redraw=true).');
    } catch (error) {
      console.error('Failed to simulate player 2 redraw:', error);
      this.showRoomStatus('Failed to simulate player 2 redraw: ' + error.message);
    }
  }

}