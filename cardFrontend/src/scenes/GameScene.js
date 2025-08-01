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
    this.zoneHighlights = [];
  }

  init(data) {
    console.log('GameScene init called with data:', data);
    this.gameStateManager = data.gameStateManager;
    this.apiManager = data.apiManager;
    this.isOnlineMode = data.isOnlineMode || false;
    this.isManualPollingMode = data.isManualPollingMode || false;
    this.shuffleAnimationPlayed = false; // Track if shuffle animation has been played
    this.drawPhaseAnimationPlayed = false; // Track if draw phase animation has been played
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
    
    // Demo mode uses real backend calls with test buttons, not mock data
    
    // Load leader cards data
    await this.loadLeaderCardsData();
    
    // Hide hand area during shuffling
    this.hideHandArea();
    
    // Initialize shuffle animation manager
    this.shuffleAnimationManager = new ShuffleAnimationManager(this);
    
    // Demo mode and online mode both wait for backend events to trigger animations
    console.log('Waiting for backend events to trigger game flow...');
    this.waitingForPlayers = true;
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
        left: { x: width * 0.5- 130- 50, y: startY + 100+ 0},
        right: { x:  width * 0.5 + 130 +  50, y: startY + 100+ 0},
        help: { x:width * 0.5- 130- 50, y:  startY + 100+ cardHeight + 10+ 15},
        sp: { x: width * 0.5 + 130 +  50, y:  startY + 100+ cardHeight + 10+ 15},
        leader: { x: width * 0.5, y: startY + 100+ 0},
        deck: { x: width * 0.5 - 130 -  50 - 130 - 50 , y: startY + 100+ cardHeight+10+15},
        leaderDeck: { x: width * 0.5 + 130 +  50 + 130 + 50 , y: startY + 100+ cardHeight+10+15},
        
      },
      // Player zones (bottom area)
      player: {
        top: { x: width * 0.5, y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70},
        left: { x: width * 0.5- 130- 50, y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 + cardHeight +30 },
        right: { x: width * 0.5 + 130 +  50,y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 + cardHeight +30 },
        help: { x: width * 0.5- 130- 50, y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70},
        sp: { x: width * 0.5 + 130 +  50, y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 },
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

      // Add zone click handling for card placement when card is selected
      dropZone.setInteractive();
      dropZone.on('pointerdown', (pointer) => {
        console.log('dropZone clicked');
        this.handleZoneClick(type, x, y);
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
    
    // Game info display (first player and opponent hand)
    this.createGameInfoDisplay();
    
    // Victory point labels
    this.createVictoryPointLabels();
    
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

  createGameInfoDisplay() {
    const { width, height } = this.cameras.main;
    
    // Position the combined display in the top-left area
    const displayX = 200;
    const displayY = 150;
    
    // Create single background for all labels (expanded height for 3 lines)
    const displayBg = this.add.graphics();
    displayBg.fillStyle(0x000000, 0.7);
    displayBg.fillRoundedRect(displayX - 70, displayY - 45, 220, 105, 5);
    displayBg.lineStyle(2, 0x888888);
    displayBg.strokeRoundedRect(displayX - 70, displayY - 45, 220, 105, 5);
    
    // First player label (top line)
    this.firstPlayerText = this.add.text(displayX-60, displayY-28, 'First Player: Unknown', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'left'
    });
    this.firstPlayerText.setOrigin(0, 0.5);
    
    // Opponent hand label (middle line)
    this.opponentHandCountText = this.add.text(displayX-60, displayY-4, 'Opponent Hand: 0', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#ffffff',
      align: 'left'
    });
    this.opponentHandCountText.setOrigin(0, 0.5);
    
    // Current turn label (bottom line)
    this.currentTurnText = this.add.text(displayX-60, displayY+20, 'Current Turn: Unknown', {
      fontSize: '16px',
      fontFamily: 'Arial',
      fill: '#FFD700', // Gold color to highlight turn info
      align: 'left'
    });
    this.currentTurnText.setOrigin(0, 0.5);
  }

  createOpponentHandDisplay() {
    // This method is now part of createGameInfoDisplay
    // Keeping empty method to avoid errors if called elsewhere
  }

  createFirstPlayerDisplay() {
    // This method is now part of createGameInfoDisplay
    // Keeping empty method to avoid errors if called elsewhere
  }

  createVictoryPointLabels() {
    const { width } = this.cameras.main;
    
    // Calculate positions based on leader deck positions
    const playerLeaderDeckPos = this.layout.player.leaderDeck;
    const opponentLeaderDeckPos = this.layout.opponent.leaderDeck;
    
    // Victory point labels positioned relative to leader decks
    const playerLabelOffsetY = 200; // Distance below player's leader deck
    const opponentLabelOffsetY = -150; // Distance above opponent's leader deck (moved higher to avoid card stack)
    
    // Player victory point label (below leader deck in bottom area)
    this.playerVictoryPointLabel = this.add.text(
      playerLeaderDeckPos.x, 
      playerLeaderDeckPos.y + playerLabelOffsetY, 
      'Victory Points: 0', 
      {
        fontSize: '18px',
        fontFamily: 'Arial Bold',
        fill: '#FFD700',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2
      }
    );
    this.playerVictoryPointLabel.setOrigin(0.5);
    
    // Opponent victory point label (above leader deck in top area)
    this.opponentVictoryPointLabel = this.add.text(
      opponentLeaderDeckPos.x, 
      opponentLeaderDeckPos.y + opponentLabelOffsetY, 
      'Victory Points: 0', 
      {
        fontSize: '18px',
        fontFamily: 'Arial Bold',
        fill: '#FFD700',
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2
      }
    );
    this.opponentVictoryPointLabel.setOrigin(0.5);
    
    // Add player name labels above victory points
    this.playerNameLabel = this.add.text(
      playerLeaderDeckPos.x, 
      playerLeaderDeckPos.y + playerLabelOffsetY - 30, 
      'Player', 
      {
        fontSize: '16px',
        fontFamily: 'Arial',
        fill: '#FFFFFF',
        align: 'center'
      }
    );
    this.playerNameLabel.setOrigin(0.5);
    
    // Opponent name label above victory points (further above leader deck)
    this.opponentNameLabel = this.add.text(
      opponentLeaderDeckPos.x, 
      opponentLeaderDeckPos.y + opponentLabelOffsetY - 30, 
      'Opponent', 
      {
        fontSize: '16px',
        fontFamily: 'Arial',
        fill: '#FFFFFF',
        align: 'center'
      }
    );
    this.opponentNameLabel.setOrigin(0.5);
    
    console.log('Victory point labels created at:');
    console.log(`Player: (${playerLeaderDeckPos.x}, ${playerLeaderDeckPos.y + playerLabelOffsetY})`);
    console.log(`Opponent: (${opponentLeaderDeckPos.x}, ${opponentLeaderDeckPos.y + opponentLabelOffsetY})`);
  }

  updateVictoryPointLabels() {
    if (!this.playerVictoryPointLabel || !this.opponentVictoryPointLabel) {
      return; // Labels not created yet
    }
    
    // Get current victory points from game state manager
    const playerVP = this.gameStateManager.getVictoryPoints();
    const opponent = this.gameStateManager.getOpponent();
    const opponentVP = this.gameStateManager.getVictoryPoints(opponent);
    
    // Debug logging to verify data mapping
    const gameState = this.gameStateManager.getGameState();
    console.log('Victory Points Debug Info:');
    console.log('  Player ID:', gameState.playerId);
    console.log('  Opponent ID:', opponent);
    console.log('  Victory Points Object:', gameState.gameEnv.victoryPoints);
    console.log('  Player VP:', playerVP);
    console.log('  Opponent VP:', opponentVP);
    
    // Update player victory point label
    this.playerVictoryPointLabel.setText(`Victory Points: ${playerVP}`);
    
    // Update opponent victory point label
    this.opponentVictoryPointLabel.setText(`Victory Points: ${opponentVP}`);
    
    // Update player names if available
    if (gameState.playerName) {
      this.playerNameLabel.setText(gameState.playerName);
    }
    
    // Try to get opponent name from game state
    const opponentData = this.gameStateManager.getPlayer(opponent);
    if (opponentData && opponentData.name) {
      this.opponentNameLabel.setText(opponentData.name);
    }
    
    // Add visual feedback for victory point changes
    if (playerVP >= 50) {
      this.playerVictoryPointLabel.setFill('#00FF00'); // Green for winner
      this.playerVictoryPointLabel.setFontSize('22px');
    } else if (playerVP > 0) {
      this.playerVictoryPointLabel.setFill('#FFD700'); // Gold for progress
    }
    
    if (opponentVP >= 50) {
      this.opponentVictoryPointLabel.setFill('#00FF00'); // Green for winner
      this.opponentVictoryPointLabel.setFontSize('22px');
    } else if (opponentVP > 0) {
      this.opponentVictoryPointLabel.setFill('#FFD700'); // Gold for progress
    }
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
      
      // Draw phase events
      this.gameStateManager.addEventListener('DRAW_PHASE_COMPLETE', (event) => {
        this.handleDrawPhaseComplete(event);
      });
      
      this.gameStateManager.addEventListener('PHASE_CHANGE', (event) => {
        console.log('Phase change event received:', event);
        this.handlePhaseChange(event);
      });
    }
    
    // Card interaction events
    this.events.on('card-select', (card) => {
      console.log(`GameScene: card-select event received for card ${card.cardData?.id}`);
      
      // First, deselect ALL OTHER hand cards silently (not the clicked one)
      this.playerHand.forEach(handCard => {
        if (handCard !== card && handCard.isSelected) {
          console.log(`Deselecting other card ${handCard.cardData?.id}`);
          handCard.deselectSilently();
        }
      });
      
      // Clear any existing zone highlights
      this.clearZoneHighlights();
      
      // Now select the clicked card
      console.log(`Selecting card ${card.cardData?.id}`);
      card.select();
      this.selectedCard = card;
      
      // Show zone highlights for valid placement options
      this.showZoneHighlights(card);
    });

    this.events.on('card-deselect', (card) => {
      // Handle card deselection - clear selected card and zone highlights
      if (this.selectedCard === card) {
        this.selectedCard = null;
        this.clearZoneHighlights();
      }
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

    // Add background click handler for deselecting cards
    this.input.on('pointerdown', (pointer, currentlyOver) => {
      // Only deselect if clicking on background (not on a card or zone)
      if (currentlyOver.length === 0 && this.selectedCard) {
        this.deselectAllHandCards();
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
    // Get hand from game state manager
    const hand = this.gameStateManager.getPlayerHand();
    this.updatePlayerHandWithCards(hand);
  }
  
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
        draggable: false,
        scale: 1.1,
        gameStateManager: this.gameStateManager,
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
          scale: 0.9,
          gameStateManager: this.gameStateManager
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
          scale: 0.9,
          gameStateManager: this.gameStateManager
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
    
    // Debug: Log current phase and animation state
    console.log('Online mode - phase:', gameState.gameEnv.phase, 'shuffleAnimationPlayed:', this.shuffleAnimationPlayed);
    
    // Check for READY_PHASE and trigger shuffle animation
    if (gameState.gameEnv.phase === 'READY_PHASE' && !this.shuffleAnimationPlayed) {
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
    
    // Check for DRAW_PHASE and trigger draw animation
    if (gameState.gameEnv.phase === 'DRAW_PHASE' && !this.drawPhaseAnimationPlayed) {
      const currentPlayer = gameState.gameEnv.currentPlayer;
      const currentPlayerId = this.gameStateManager.getCurrentPlayerId();
      
      if (currentPlayer === currentPlayerId) {
        this.drawPhaseAnimationPlayed = true;
        
        // Hide the new card temporarily (don't update hand UI yet)
        const currentHand = this.gameStateManager.getPlayerHand();
        const handWithoutNewCard = currentHand.slice(0, -1); // Remove the last card for animation
        
        // Temporarily update the displayed hand to not show the new card
        this.updatePlayerHandWithCards(handWithoutNewCard);
        
        this.playDrawCardAnimation(() => {
          // Show acknowledgment UI after animation completes
          this.showDrawPhaseAcknowledgment({
            playerId: currentPlayerId,
            cardCount: 1,
            newHandSize: currentHand.length
          });
        });
      }
    }
    
    // Debug logging for troubleshooting
    console.log('updateUI - phase:', gameState.gameEnv.phase, 'shuffleAnimationPlayed:', this.shuffleAnimationPlayed);
    
    // Update phase indicator with current player info
    const currentPhase = gameState.gameEnv.phase;
    const currentPlayer = gameState.gameEnv.currentPlayer;
    if (currentPhase) {
      this.updatePhaseIndicator(currentPhase, currentPlayer);
    }
    
    // Update current turn display
    this.updateCurrentTurnDisplay(currentPlayer);
    
    // Update round
    this.roundText.setText(`Round ${gameState.gameEnv.round} / 4`);
    
    // Update player info
    this.playerVPText.setText(`VP: ${this.gameStateManager.getVictoryPoints()}`);
    this.playerHandText.setText(`Hand: ${player && player.hand ? player.hand.length : 0}`);
    
    // Update opponent info
    this.opponentVPText.setText(`VP: ${this.gameStateManager.getVictoryPoints(opponent)}`);
    this.opponentHandText.setText(`Hand: ${opponentData && opponentData.hand ? opponentData.hand.length : 0}`);
    
    // Update victory point labels below leader decks
    this.updateVictoryPointLabels();
    
    // Update opponent hand count display
    if (this.opponentHandCountText) {
      const opponentHandCount = opponentData && opponentData.hand ? opponentData.hand.length : 0;
      this.opponentHandCountText.setText(`Opponent Hand: ${opponentHandCount}`);
    }
    
    // Update turn indicator
    const isCurrentPlayer = this.gameStateManager.isCurrentPlayer();
    this.endTurnButton.setTint(isCurrentPlayer ? 0xffffff : 0x888888);
  }

  canDropCardInZone(card, zoneType) {
    const cardData = card.getCardData();
    
    // First check basic card type compatibility (local validation)
    if (!card.canPlayInZone(zoneType)) {
      return false;
    }
    
    // Then check backend field effect restrictions via GameStateManager
    if (this.gameStateManager) {
      return this.gameStateManager.canPlayCardInZone(cardData, zoneType);
    }
    
    // Fallback to basic validation if GameStateManager not available
    return true;
  }

  async handleCardDrop(card, zoneType, x, y) {
    if (this.canDropCardInZone(card, zoneType)) {
      // Show loading state
      this.setUILoadingState(true);
      
      // Attempt to play card to server/update game state (include face-down state)
      const cardDataWithState = {
        ...card.getCardData(),
        faceDown: card.isFaceDown()
      };
      const success = await this.playCardToZone(cardDataWithState, zoneType);
      
      if (success) {
        // Move card to zone
        card.moveToPosition(x, y);
        card.options.draggable = false;
        
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
        
        // Deselect the card
        if (this.selectedCard === card) {
          this.selectedCard = null;
          this.clearZoneHighlights();
        }
        
        console.log(`Successfully played card ${card.getCardData().id} to ${zoneType}`);
      } else {
        // Return card to hand on failure
        card.returnToOriginalPosition();
      }
      
      // Clear loading state
      this.setUILoadingState(false);
    } else {
      // Return card to hand if not valid placement
      card.returnToOriginalPosition();
    }
  }

  async playCardToZone(cardData, zoneType) {
    console.log(`Playing card ${cardData.id} to ${zoneType} zone`);
    
    const gameState = this.gameStateManager.getGameState();
    
    // If in online mode, send API call to backend
    if (this.isOnlineMode && this.apiManager) {
      try {
        // Convert frontend card placement to backend action format
        const action = this.createBackendAction(cardData, zoneType);
        
        if (!action) {
          this.showErrorMessage('Failed to create valid action for backend.');
          return false;
        }
        
        console.log('Sending card play action to backend:', action);
        
        const response = await this.apiManager.playerAction(
          gameState.playerId, 
          gameState.gameId, 
          action
        );
        
        console.log('Card play action response:', response);
        
        // The backend will update the game state, which will be received via polling
        // No need to update local state here as it will come from the server
        
      } catch (error) {
        console.error('Failed to send card play action to backend:', error);
        
        // Show error to user
        this.showErrorMessage('Failed to play card. Please try again.');
        
        // Don't update local state on error - keep the card in hand
        return false;
      }
    } else {
      // Demo mode - update local state only
      console.log('Demo mode - updating local state only');
      const zones = { ...gameState.gameEnv.zones };
      if (!zones[gameState.playerId]) {
        zones[gameState.playerId] = {};
      }
      zones[gameState.playerId][zoneType] = cardData;
      
      this.gameStateManager.updateGameEnv({ zones });
    }
    
    return true;
  }

  createBackendAction(cardData, zoneType) {
    // Get the current hand from game state to find card index
    const hand = this.gameStateManager.getPlayerHand();
    
    // Find the index of this card in the player's hand
    // The frontend hand contains full card objects, but backend expects index from its card ID array
    const cardIndex = hand.findIndex(handCard => handCard.id === cardData.id);
    
    if (cardIndex === -1) {
      console.error(`Card ${cardData.id} not found in player hand`);
      console.log('Available hand cards:', hand.map(card => card.id));
      return null;
    }
    
    // Convert zone name to field index
    const fieldIndex = this.getFieldIndexFromZone(zoneType);
    
    if (fieldIndex === -1) {
      console.error(`Invalid zone type: ${zoneType}`);
      return null;
    }
    
    // Create action in backend expected format
    const action = {
      type: cardData.faceDown ? 'PlayCardBack' : 'PlayCard',
      card_idx: cardIndex,
      field_idx: fieldIndex
    };
    
    console.log(`Created backend action for card ${cardData.id}:`);
    console.log(`  - Frontend hand index: ${cardIndex}`);
    console.log(`  - Zone: ${zoneType} -> field_idx: ${fieldIndex}`);
    console.log(`  - Face down: ${cardData.faceDown} -> type: ${action.type}`);
    
    return action;
  }

  getFieldIndexFromZone(zoneType) {
    // Backend field indices: 0=top, 1=left, 2=right, 3=help, 4=sp
    const zoneToFieldMap = {
      'top': 0,
      'left': 1, 
      'right': 2,
      'help': 3,
      'sp': 4
    };
    
    return zoneToFieldMap[zoneType] !== undefined ? zoneToFieldMap[zoneType] : -1;
  }

  handleZoneClick(zoneType, x, y) {
    // Check if we have a selected card and it's currently our turn
    if (!this.selectedCard) {
      console.log('No card selected');
      return;
    }

    // Check if it's the current player's turn and in main phase
    const gameState = this.gameStateManager.getGameState();
    const currentPhase = this.gameStateManager.getCurrentPhase();
    const isCurrentPlayer = this.gameStateManager.isCurrentPlayer();
    
    if (!isCurrentPlayer) {
      console.log('Not your turn');
      return;
    }

    if (currentPhase !== 'MAIN_PHASE') {
      console.log('Not in main phase');
      return;
    }

    // Check if the selected card can be placed in this zone
    if (!this.canDropCardInZone(this.selectedCard, zoneType)) {
      const cardData = this.selectedCard.getCardData();
      
      // Check if it's a basic type compatibility issue
      if (!this.selectedCard.canPlayInZone(zoneType)) {
        console.log(`Card type ${cardData.type} cannot be placed in ${zoneType} zone`);
        this.showZoneRestrictionMessage(`${cardData.type.toUpperCase()} cards cannot be placed in ${zoneType.toUpperCase()} zone`);
      } else {
        // It's a field effect restriction from the leader/backend
        const restrictions = this.gameStateManager.getZoneRestrictions(null, zoneType);
        if (restrictions !== "ALL" && Array.isArray(restrictions)) {
          console.log(`Field effect restriction: Card type ${cardData.gameType} not allowed in ${zoneType} zone. Allowed types: ${restrictions.join(', ')}`);
          this.showZoneRestrictionMessage(`This zone only allows: ${restrictions.join(', ')}`);
        } else {
          console.log(`Cannot place ${cardData.id} in ${zoneType} zone due to field effects`);
          this.showZoneRestrictionMessage(`Cannot place this card in ${zoneType.toUpperCase()} zone due to field effects`);
        }
      }
      return;
    }

    // Place the card in the zone
    this.placeSelectedCardInZone(zoneType, x, y);
  }

  async placeSelectedCardInZone(zoneType, x, y) {
    if (!this.selectedCard) return;

    const card = this.selectedCard;
    const cardData = card.getCardData();

    // Show loading state
    this.setUILoadingState(true);

    // Attempt to play card to server/update game state (include face-down state)
    const cardDataWithState = {
      ...cardData,
      faceDown: card.isFaceDown()
    };
    const success = await this.playCardToZone(cardDataWithState, zoneType);

    if (success) {
      // Move card to zone position
      card.moveToPosition(x, y);
      card.options.draggable = false;
      card.deselect(); // Remove selection highlight

      // Remove from hand
      const handIndex = this.playerHand.indexOf(card);
      if (handIndex > -1) {
        this.playerHand.splice(handIndex, 1);
      }

      // Remove from hand container
      this.handContainer.remove(card);

      // Add to zone
      const zone = this.playerZones[zoneType];
      if (zone) {
        zone.card = card;
        zone.placeholder.setVisible(false);
      }

      // Clear selection and zone highlights
      this.selectedCard = null;
      this.clearZoneHighlights();

      // Reorganize remaining hand cards
      this.reorganizeHand();

      console.log(`Placed card ${cardData.id} in ${zoneType} zone via click`);
    } else {
      // On failure, keep card in hand and maintain selection
      console.log(`Failed to place card ${cardData.id} in ${zoneType} zone`);
    }

    // Clear loading state
    this.setUILoadingState(false);
  }

  showZoneHighlights(card) {
    // Clear any existing highlights
    this.clearZoneHighlights();
    
    // Check if it's the current player's turn and in main phase
    const currentPhase = this.gameStateManager.getCurrentPhase();
    const isCurrentPlayer = this.gameStateManager.isCurrentPlayer();
    
    if (!isCurrentPlayer || currentPhase !== 'MAIN_PHASE') {
      return;
    }

    // Initialize zone highlights array if not exists
    if (!this.zoneHighlights) {
      this.zoneHighlights = [];
    }

    // Check each zone and highlight if valid
    const zones = ['top', 'left', 'right', 'help', 'sp'];
    zones.forEach(zoneType => {
      const zone = this.playerZones[zoneType];
      if (zone && this.canDropCardInZone(card, zoneType)) {
        // Create a subtle highlight around the zone
        const highlight = this.add.graphics();
        highlight.lineStyle(3, 0x00ff00, 0.6); // Green with 60% opacity
        highlight.strokeRoundedRect(zone.x - 65, zone.y - 95, 130, 190, 8);
        
        // Add a pulsing effect
        this.tweens.add({
          targets: highlight,
          alpha: 0.3,
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        
        this.zoneHighlights.push(highlight);
      }
    });
  }

  clearZoneHighlights() {
    if (this.zoneHighlights) {
      this.zoneHighlights.forEach(highlight => {
        highlight.destroy();
      });
      this.zoneHighlights = [];
    }
  }

  showZoneRestrictionMessage(message) {
    // Clear any existing restriction message
    if (this.restrictionMessage) {
      this.restrictionMessage.destroy();
    }

    // Create a temporary message display
    const { width, height } = this.cameras.main;
    this.restrictionMessage = this.add.text(width / 2, height / 2 - 50, message, {
      fontSize: '18px',
      fontFamily: 'Arial Bold',
      fill: '#ff4444',
      backgroundColor: '#000000',
      padding: { x: 20, y: 10 },
      align: 'center'
    }).setOrigin(0.5).setDepth(2000);

    // Auto-remove after 3 seconds
    this.time.delayedCall(3000, () => {
      if (this.restrictionMessage) {
        this.restrictionMessage.destroy();
        this.restrictionMessage = null;
      }
    });
  }

  deselectAllHandCards() {
    // Deselect all hand cards silently without animations
    this.playerHand.forEach(handCard => {
      if (handCard.isSelected) {
        handCard.deselectSilently();
      }
    });
    this.selectedCard = null;
    this.clearZoneHighlights();
  }

  reorganizeHand() {
    if (this.playerHand.length === 0) return;
    
    const cardSpacing = Math.min(160, (this.cameras.main.width - 200) / this.playerHand.length);
    const startX = -(this.playerHand.length - 1) * cardSpacing / 2;
    
    this.playerHand.forEach((card, index) => {
      const newX = startX + (index * cardSpacing);
      card.moveToPosition(newX, 0, 300, false); // false = don't remove from container
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


  // Mock data methods removed - demo mode uses real backend calls

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
        gameStateManager: this.gameStateManager,
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
      gameStateManager: this.gameStateManager,
      usePreview: true, // Use preview images for leader deck display
      disableHighlight: true  // Disable selection highlight for leader deck cards
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
          gameStateManager: this.gameStateManager,
          usePreview: true,
          disableHighlight: true  // Disable selection highlight for leader cards
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
                      gameStateManager: this.gameStateManager,
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
    
    this.connectionStatusText = this.add.text(width-50, 30, statusText, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: statusColor,
      align: 'right'
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
      this.firstPlayerText.setText(`First Player: ${firstPlayerName}`);
    }
  }

  updateCurrentTurnDisplay(currentPlayer) {
    if (this.currentTurnText) {
      if (currentPlayer) {
        const currentPlayerId = this.gameStateManager.getCurrentPlayerId();
        const turnPlayerName = currentPlayer === currentPlayerId ? 'You' : 'Opponent';
        this.currentTurnText.setText(`Current Turn: ${turnPlayerName}`);
      } else {
        this.currentTurnText.setText('Current Turn: Unknown');
      }
    }
  }

  updateOpponentInfo(gameEnv) {
    const opponentId = this.gameStateManager.getOpponent();
    if (!opponentId) return;

    const opponentData = this.gameStateManager.getPlayer(opponentId);
    const opponentHandCount = opponentData?.hand?.length || 0;
    
    // Update existing opponent hand count display (created in createOpponentHandDisplay)
    if (this.opponentHandCountText) {
      this.opponentHandCountText.setText(`Opponent Hand: ${opponentHandCount}`);
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

  showErrorMessage(message) {
    // Remove existing error message
    if (this.errorMessageText) {
      this.errorMessageText.destroy();
    }
    
    // Create new error message text
    const { width } = this.cameras.main;
    this.errorMessageText = this.add.text(width / 2, 120, message, {
      fontSize: '18px',
      fontFamily: 'Arial',
      fill: '#FF6B6B',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2
    });
    this.errorMessageText.setOrigin(0.5);
    
    // Auto-hide after 4 seconds
    this.time.delayedCall(4000, () => {
      if (this.errorMessageText) {
        this.errorMessageText.destroy();
        this.errorMessageText = null;
      }
    });
  }

  setUILoadingState(isLoading) {
    if (isLoading) {
      // Create loading indicator if it doesn't exist
      if (!this.loadingIndicator) {
        const { width, height } = this.cameras.main;
        this.loadingIndicator = this.add.text(width / 2, height / 2, 'Processing...', {
          fontSize: '24px',
          fontFamily: 'Arial',
          fill: '#FFD700',
          align: 'center',
          stroke: '#000000',
          strokeThickness: 3
        });
        this.loadingIndicator.setOrigin(0.5);
        this.loadingIndicator.setDepth(1000); // Ensure it's on top
      }
      this.loadingIndicator.setVisible(true);
      
      // Disable input during loading
      this.input.enabled = false;
    } else {
      // Hide loading indicator
      if (this.loadingIndicator) {
        this.loadingIndicator.setVisible(false);
      }
      
      // Re-enable input
      this.input.enabled = true;
    }
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
      
      console.log('Debug: gameId:', gameId);

      if (!gameId) {
        throw new Error('No gameId found. Make sure demo was started from menu (creates game automatically).');
      }

      // Backend already knows player2Id from joinRoom call, so we can directly use 'playerId_2'
      const player2Id = 'playerId_2';
      
      console.log('Debug: Using player2Id:', player2Id);

      // Simulate player 2 calling redraw (startReady with wantRedraw = true)
      await this.apiManager.startReady(player2Id, gameId, true);

      this.showRoomStatus('Simulated Player 2 redraw (ready with redraw=true).');
    } catch (error) {
      console.error('Failed to simulate player 2 redraw:', error);
      this.showRoomStatus('Failed to simulate player 2 redraw: ' + error.message);
    }
  }

  handleDrawPhaseComplete(event) {
    console.log('Processing draw phase complete event:', event);
    
    // Update phase indicator  
    this.updatePhaseIndicator('DRAW_PHASE');
    
    // Check if this is the current player's draw event
    const currentPlayerId = this.gameStateManager.getCurrentPlayerId();
    
    if (event.data.playerId === currentPlayerId) {
      // Play draw card animation for current player
      this.playDrawCardAnimation(() => {
        // Show acknowledgment UI after animation completes
        this.showDrawPhaseAcknowledgment(event.data);
      });
    } else {
      // Show notification that opponent drew a card
      this.showRoomStatus(`Opponent drew a card (${event.data.newHandSize} cards in hand)`);
    }
  }

  handlePhaseChange(event) {
    console.log('Processing phase change event:', event);
    
    // Update phase indicator
    this.updatePhaseIndicator(event.data.phase);
    
    // Show phase change notification
    this.showRoomStatus(event.data.message || `Phase changed to ${event.data.phase}`);
  }

  showDrawPhaseAcknowledgment(drawData) {
    // Create acknowledgment UI overlay
    const width = this.scale.width;
    const height = this.scale.height;
    
    // Create semi-transparent overlay
    const overlay = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.5);
    overlay.setDepth(1000);
    
    // Create acknowledgment panel
    const panel = this.add.rectangle(width/2, height/2, 400, 200, 0x1a1a1a, 0.9);
    panel.setDepth(1001);
    panel.setStrokeStyle(2, 0x4a90e2);
    
    // Add text
    const titleText = this.add.text(width/2, height/2 - 40, 'DRAW PHASE', {
      fontSize: '24px',
      fill: '#4a90e2',
      fontFamily: 'Arial'
    });
    titleText.setOrigin(0.5);
    titleText.setDepth(1002);
    
    const messageText = this.add.text(width/2, height/2 - 10, `You drew 1 card`, {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    });
    messageText.setOrigin(0.5);
    messageText.setDepth(1002);
    
    const handSizeText = this.add.text(width/2, height/2 + 15, `Hand size: ${drawData.newHandSize}`, {
      fontSize: '14px',
      fill: '#cccccc',
      fontFamily: 'Arial'
    });
    handSizeText.setOrigin(0.5);
    handSizeText.setDepth(1002);
    
    // Add acknowledge button
    const button = this.add.rectangle(width/2, height/2 + 50, 120, 40, 0x4a90e2, 0.8);
    button.setDepth(1002);
    button.setStrokeStyle(1, 0x6ba3f5);
    button.setInteractive();
    
    const buttonText = this.add.text(width/2, height/2 + 50, 'Continue', {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'Arial'
    });
    buttonText.setOrigin(0.5);
    buttonText.setDepth(1003);
    
    // Handle button click
    button.on('pointerdown', () => {
      // Acknowledge the draw phase event
      this.acknowledgeDrawPhaseEvent();
      
      // Clean up UI
      overlay.destroy();
      panel.destroy();
      titleText.destroy();
      messageText.destroy();
      handSizeText.destroy();
      button.destroy();
      buttonText.destroy();
    });
    
    // Button hover effects
    button.on('pointerover', () => {
      button.setFillStyle(0x6ba3f5, 0.9);
    });
    
    button.on('pointerout', () => {
      button.setFillStyle(0x4a90e2, 0.8);
    });
  }

  async acknowledgeDrawPhaseEvent() {
    if (!this.isOnlineMode || !this.apiManager) {
      console.log('Not in online mode or no API manager - skipping acknowledgment');
      return;
    }
    
    try {
      // Get all unprocessed DRAW_PHASE_COMPLETE events
      const events = this.gameStateManager.getGameState().gameEnv.gameEvents || [];
      const drawPhaseEvents = events.filter(event => 
        event.type === 'DRAW_PHASE_COMPLETE' && !event.frontendProcessed
      );
      
      if (drawPhaseEvents.length > 0) {
        const eventIds = drawPhaseEvents.map(e => e.id);
        await this.apiManager.acknowledgeEvents(this.gameStateManager.getGameState().gameId, eventIds);
        console.log(`Acknowledged ${eventIds.length} draw phase events`);
      }
    } catch (error) {
      console.error('Failed to acknowledge draw phase events:', error);
      this.showRoomStatus('Failed to acknowledge draw phase: ' + error.message);
    }
  }

  shouldShowTurnInfo(phase) {
    // Only show turn info for phases where turns matter
    const turnBasedPhases = ['DRAW_PHASE', 'MAIN_PHASE', 'SP_PHASE'];
    return turnBasedPhases.includes(phase);
  }

  updatePhaseIndicator(phase, currentPlayer = null) {
    if (this.phaseText) {
      let displayText = '';
      switch(phase) {
        case 'DRAW_PHASE':
          displayText = 'DRAW PHASE';
          break;
        case 'MAIN_PHASE':
          displayText = 'MAIN PHASE';
          break;
        case 'SP_PHASE':
          displayText = 'SP PHASE';
          break;
        case 'BATTLE_PHASE':
          displayText = 'BATTLE PHASE';
          break;
        case 'READY_PHASE':
          displayText = 'READY PHASE';
          break;
        case 'WAITING_FOR_PLAYERS':
          displayText = 'WAITING FOR PLAYERS';
          break;
        case 'BOTH_JOINED':
          displayText = 'BOTH JOINED';
          break;
        case 'START_REDRAW':
          displayText = 'REDRAW PHASE';
          break;
        default:
          // Clean up any underscore-separated phases
          displayText = phase.replace(/_/g, ' ').toUpperCase();
      }
      
      // Add current player info for turn-based phases
      if (currentPlayer && this.shouldShowTurnInfo(phase)) {
        const currentPlayerId = this.gameStateManager.getCurrentPlayerId();
        const turnPlayer = currentPlayer === currentPlayerId ? 'Your Turn' : 'Opponent Turn';
        displayText += ` (${turnPlayer})`;
      }
      
      this.phaseText.setText(displayText);
    }
  }

  playDrawCardAnimation(onComplete) {
    // Get the current hand from game state (the new card should be the last one)
    const currentHand = this.gameStateManager.getPlayerHand();
    const newCardData = currentHand[currentHand.length - 1];
    
    // Process card data the same way the hand does
    let processedCardData = newCardData;
    if (typeof newCardData === 'string') {
      processedCardData = {
        id: newCardData,
        name: newCardData,
        cardType: this.getCardTypeFromId(newCardData)
      };
    }
    
    
    // Get deck position for animation start
    const playerDeckPosition = this.layout.player.deck;
    
    // Create temporary card at deck position (card back)
    const tempCard = this.add.image(playerDeckPosition.x, playerDeckPosition.y, 'card-back');
    
    // Set the card to hand card size immediately
    const scaleX = GAME_CONFIG.card.width / tempCard.width;
    const scaleY = GAME_CONFIG.card.height / tempCard.height;
    const handScale = Math.min(scaleX, scaleY) * 0.95 * 1.15; // Match hand card scale
    tempCard.setScale(handScale);
    tempCard.setDepth(2000); // Above everything else
    
    // Calculate spacing for current hand size
    const currentHandLength = this.playerHand.length; // Current cards displayed in hand
    const totalCards = currentHandLength + 1; // Including this new card
    const cardSpacing = Math.min(160, (this.cameras.main.width - 200) / totalCards);
    const startX = -(totalCards - 1) * cardSpacing / 2;
    const newCardX = startX + (currentHandLength * cardSpacing); // Position for new card (rightmost)
    
    // Convert to world coordinates
    const worldTargetX = this.handContainer.x + newCardX;
    const worldTargetY = this.handContainer.y;
    
    // Animate existing hand cards to slide left to make space for new card
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
            // Change to actual card image using the same logic as Card class
            const cardKey = `${processedCardData.id}-preview`;
            // Check if texture exists before setting it
            if (this.textures.exists(cardKey)) {
              tempCard.setTexture(cardKey);
            } else {
              // Fallback: try without -preview suffix
              const fallbackKey = processedCardData.id;
              if (this.textures.exists(fallbackKey)) {
                tempCard.setTexture(fallbackKey);
              }
              // If no texture found, keep card-back as fallback
            }
            
            // Recalculate scale for the new texture to maintain consistent card size
            const newScaleX = GAME_CONFIG.card.width / tempCard.width;
            const newScaleY = GAME_CONFIG.card.height / tempCard.height;
            const newHandScale = Math.min(newScaleX, newScaleY) * 0.95 * 1.15;
            
            // Update Y scale to match the new texture
            tempCard.setScale(0, newHandScale);
            
            // Flip back to visible with correct scale
            this.tweens.add({
              targets: tempCard,
              scaleX: newHandScale, // Flip back to visible with correct scale
              duration: 150,
              ease: 'Power2.easeOut',
              onComplete: () => {
                // Add a brief pause before showing acknowledgment
                this.time.delayedCall(200, () => {
                  // Remove temporary card
                  tempCard.destroy();
                  
                  // Update the UI to show the new card in hand
                  this.updatePlayerHand();
                  
                  // Call the completion callback
                  if (onComplete) {
                    onComplete();
                  }
                });
              }
            });
          }
        });
      }
    });
    
    // Add some visual flair - slight rotation during animation
    this.tweens.add({
      targets: tempCard,
      rotation: 0.1,
      duration: 300,
      ease: 'Power2.easeOut',
      yoyo: true
    });
  }

}