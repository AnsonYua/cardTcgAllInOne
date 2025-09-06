import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import Card from '../components/Card.js';
import ShuffleAnimationManager from '../components/ShuffleAnimationManager.js';
import BaseAndShieldAreaManager from '../components/BaseAndShieldAreaManager.js';
import EnergyAreaManager from '../components/EnergyAreaManager.js';
import SlotAreaManager from '../components/SlotAreaManager.js';
import GameSceneUtils from '../utils/GameSceneUtils.js';
import { ZoneMapping } from '../utils/ZoneMapping.js';
import CardAnimationUtils from '../utils/CardAnimationUtils.js';
import CardActionHandler from '../handlers/CardActionHandler.js';
import ActionButtonManager from '../systems/ActionButtonManager.js';
import DialogManager from '../managers/DialogManager.js';

export default class GameScene extends Phaser.Scene {
  constructor(config = { key: 'GameScene' }) {
    super(config);
    this.inGamePlayerId = "";
    this.gameStateManager = null;
    this.playerHand = [];
    this.playerZones = {};
    this.opponentZones = {};
    this.draggedCard = null;
    this.shuffleAnimationManager = null;
    this.cardPreviewZone = null;
    this.previewCard = null;
    this.previewPilotCard = null;
    this.zoneHighlights = [];
    this.isTestMode = false;
    this.firstShuffleAnimationComplete = false;

    this.baseAndShieldManager = null;
    this.energyAreaManager = null;
    this.slotAreaManager = null;
    this.opponentBase = null;
    this.dialogManager = null;

    this.isSetScenoria = false;
  }

  init(data) {
    console.log('GameScene init called with data:', data);
    this.gameStateManager = data.gameStateManager;
    this.apiManager = data.apiManager;
    this.isManualPollingMode = data.isManualPollingMode || false;
    this.gameMode = data.gameMode || 'host';  // 'host' or 'join' mode
    this.shuffleAnimationPlayed = false; // Track if shuffle animation has been played
    
    // Initialize managers
    this.baseAndShieldManager = new BaseAndShieldAreaManager(this, this.gameStateManager);
    this.energyAreaManager = new EnergyAreaManager(this, this.gameStateManager);
    this.slotAreaManager = new SlotAreaManager(this, this.gameStateManager);
    this.cardActionHandler = new CardActionHandler(this, this.gameStateManager, this.apiManager);
    this.actionButtonManager = new ActionButtonManager(this);
    this.dialogManager = new DialogManager(this);
 
    console.log('GameScene initialized with mode:', this.gameMode);
    console.log('Manual polling mode:', this.isManualPollingMode);
  }

  async create() {
    console.log('GameScene create method called');
    console.log('Initial game state:', this.gameStateManager?.getGameState());
    
    // Set up API manager reference in GameStateManager for card selection
    if (this.apiManager && this.gameStateManager) {
      this.gameStateManager.setApiManager(this.apiManager);
    }
    
    this.createBackground();
    this.createGameBoard();
    this.createUI();
    this.setupEventListeners();
    
    // Start polling if not in manual polling mode
    if (this.apiManager && !this.isManualPollingMode) {
      console.log('Starting automatic API polling...');
      this.gameStateManager.startPolling(this.apiManager);
    } else if (this.isManualPollingMode) {
      console.log('Manual polling mode enabled - use test buttons to poll');
    }
    
    // Demo mode uses real backend calls with test buttons, not mock data
    
    // Load leader cards data
    
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
    const playerStartX = -50;
    this.layout = {
      functionalArea: {
        cardPreview: {
          x: width * 0.5 + 730,
          y: startY + 200+ cardHeight
        },
      },
      // Opponent zones (top area)
      opponent: {
        "slot1": { x: playerStartX + width * 0.5 - 320, 
               y:  startY + 100+ cardHeight + 10+ 15},
        "slot2": { x: playerStartX + width * 0.5-200 + 10, 
                y:  startY + 100+ cardHeight + 10+ 15},
        "slot3": { x: playerStartX + width * 0.5 -80 + 20, 
                 y:  startY + 100+ cardHeight + 10+ 15},
        "slot4": { x:playerStartX + width * 0.5 + 40 + 30, 
                y:  startY + 100+ cardHeight + 10+ 15},
        "slot5": { x: playerStartX + width * 0.5+160 + 40, 
              y:  startY + 100+ cardHeight + 10+ 15},
        "slot6": {  x: playerStartX + width * 0.5 +280 + 50, 
                  y:  startY + 100+ cardHeight + 10+ 15},
        "deck": { x: width * 0.5 - 500, 
                y: startY + 100+ cardHeight+10+15},
        leaderDeck: { x: width * 0.5 + 430 , y: startY + 100+ cardHeight+10+15},
        base:{ x: width * 0.5 + 430 , y: startY + 130 + cardHeight+10+15},
        // New row with 10 columns above existing zones (opponent is flipped)
        row2: this.generateOpponentRow2Slots(playerStartX, width, startY-100, cardHeight)
      },
      // Player zones (bottom area)
    
      player: {
        "slot1": { x: playerStartX + width * 0.5 - 320, 
              y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 },
        "slot2":{ x: playerStartX + width * 0.5-200 + 10, 
               y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70},
        "slot3": { x: playerStartX + width * 0.5 -80 + 20, 
               y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70},
        "slot4": { x: playerStartX + width * 0.5 + 40 + 30, 
                  y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 },
        "slot5": { x: playerStartX + width * 0.5+160 + 40, 
           y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70},
        "slot6": { x: playerStartX + width * 0.5 +280 + 50,
           y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 },
        deck: { x: width * 0.5 + 420 , 
                y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70},
        leaderDeck: { x: width * 0.5 - 550 , 
                      y: startY + 100+ cardHeight + 10+ 15 +cardHeight + 70 + 50},
        base: { x: width * 0.5 - 550 , 
                      y: startY + 70+ cardHeight + 10+ 15 +cardHeight + 70 + 50},
        // New row with 10 columns below existing zones
        row2: this.generateRow2Slots(playerStartX, width, startY+100, cardHeight)
      },
      // Battle area (center)
      //battle: { x: width * 0.5, y: height * 0.45 },
      // Hand area (bottom)
      hand: { x: width * 0.5, y: height * 0.85 }
    };
    
    this.createZones();
  }

  generateRow2Slots(playerStartX, width, startY, cardHeight) {
    const slots = [];
    const slotCount = 12;
    const slotSpacing = 70; // Space between each slot
    const rowY = startY + 100 + cardHeight + 10 + 15 + cardHeight + 70 + 80; // Below existing zones
    
    // Calculate starting X to center the 10 slots
    const totalWidth = (slotCount - 1) * slotSpacing;
    const startX = (width * 0.5) - (totalWidth / 2)-10;
    
    // Generate 10 slot positions
    for (let i = 0; i < slotCount; i++) {
      slots.push({
        x: startX + (i * slotSpacing),
        y: rowY,
        index: i
      });
    }
    
    return slots;
  }

  generateOpponentRow2Slots(playerStartX, width, startY, cardHeight) {
    const slots = [];
    const slotCount = 12;
    const slotSpacing = 70; // Space between each slot
    const rowY = startY + 100 + cardHeight + 10 + 15 - 80; // Above existing opponent zones
    
    // Calculate starting X to center the 10 slots
    const totalWidth = (slotCount - 1) * slotSpacing;
    const startX = (width * 0.5) - (totalWidth / 2)-80;
    
    // Generate 10 slot positions
    for (let i = 0; i < slotCount; i++) {
      slots.push({
        x: startX + (i * slotSpacing),
        y: rowY,
        index: i
      });
    }
    
    return slots;
  }

  createZones() {
    
    // Create opponent zones
    this.opponentZones = {};
    console.log('About to iterate over opponent zones');
    const opponentEntries = Object.entries(this.layout.opponent);
    console.log('Opponent entries:', opponentEntries);
    opponentEntries.forEach(([zoneType, position]) => {
      console.log('Processing zone:', zoneType);
      if (zoneType === 'row2') {
        // Create row2 slots as an array of zones
        this.opponentZones[zoneType] = position.map((slot, index) => {
          return GameSceneUtils.createZone(this, slot.x, slot.y, `row2_${index}`, false);
        });
      } else {
        const zone = GameSceneUtils.createZone(this, position.x, position.y, zoneType, false);
        this.opponentZones[zoneType] = zone;
      }
    });
    
    // Create player zones
    this.playerZones = {};
    Object.entries(this.layout.player).forEach(([zoneType, position]) => {
      if (zoneType === 'row2') {
        // Create row2 slots as an array of zones
        this.playerZones[zoneType] = position.map((slot, index) => {
          return GameSceneUtils.createZone(this, slot.x, slot.y, `row2_${index}`, true);
        });
      } else {
        const zone = GameSceneUtils.createZone(this, position.x, position.y, zoneType, true);
        this.playerZones[zoneType] = zone;
      }
    });

    Object.entries(this.layout.functionalArea).forEach(([zoneType, position]) => {
      const zone = GameSceneUtils.createZone(this, position.x, position.y, zoneType, false);
      if (zoneType === 'cardPreview') {
        this.cardPreviewZone = zone;
      }
    });
    
    // Add zone labels
    this.addZoneLabels();
    
    // Create deck visualizations
    this.createDeckVisualizations();
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

  createHandArea() {
    const { width, height } = this.cameras.main;
    
    // Hand background
    const handBg = this.add.graphics();
    handBg.fillStyle(0x000000, 0);
    //fillRoundedRect(x, y, width, height, [radius])
    handBg.fillRoundedRect(50, height - 220, width - 100, 170, 10);
    
    this.handContainer = this.add.container(width / 2-50, height - 120);
    
    // Create action button row above hand area
    // Initialize dynamic action button system
    this.actionButtonManager.initialize();
  }

  setupEventListeners() {
    
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
      this.gameStateManager.setSelectedCard(card);
      
      // Show dynamic action buttons based on card type and effects
      this.showDynamicActionsForCard(card);
      
    });

    this.events.on('card-deselect', (card) => {
      // Handle card deselection - clear selected card and zone highlights
      if (this.gameStateManager.getSelectedCard() === card) {
        this.gameStateManager.setSelectedCard(null);
        this.clearZoneHighlights();
        
        // Hide dynamic action buttons when card is deselected  
        this.hideDynamicActionButtons();
      }
    });
    
    this.events.on('card-drag-start', (card) => {
      this.draggedCard = card;
      // Hide all previews when dragging starts
      this.hideCardPreview();
    });
    
    this.events.on('card-drag-end', (card) => {
      this.draggedCard = null;
    });
    
    // Card hover events for preview
    this.events.on('card-hover', (card) => {
      // Only show preview for hand cards (not dragging)
      if (!this.draggedCard && this.playerHand.includes(card)) {
        this.showCardPreview(card.getCardFullData());
      }
    });
    
    this.events.on('card-unhover', (card) => {
      // Hide preview when not hovering
      if (!this.draggedCard) {
        this.hideCardPreview();
      }
    });
    
    // Zone card hover events - enhanced for unit+pilot dual preview
    this.events.on('zone-card-hover', (card) => {
      console.log('[zone-card-hover] Event triggered for card:', {
        cardId: card.cardData?.id,
        cardType: card.cardData?.cardType,
        cardTypeInSlot: card.cardTypeInSlot,
        isInZone: card.isInZone,
        zonePlacement: card.zonePlacement,
        x: card.x,
        y: card.y
      });
      
      if (!this.draggedCard && card.isInZone) {
        if (!card.isFaceDown() || this.isTestMode) {
          try {
            this.showSlotCardPreview(card);
          } catch (error) {
            console.error('[zone-card-hover] Error in showSlotCardPreview, using fallback:', error);
            this.showCardPreview(card.getCardData());
          }
        }
      }
    });
    
    this.events.on('zone-card-unhover', (card) => {
      // Hide preview for zone cards (same as hand cards)
      if (!this.draggedCard && card.isInZone) {
        this.hideSlotCardPreview();
      }
    });

    // Add background click handler for deselecting cards
    this.input.on('pointerdown', (pointer, currentlyOver) => {
      // Only deselect if clicking on background (not on a card or zone)
      if (currentlyOver.length === 0 && this.gameStateManager.getSelectedCard()) {
        this.deselectAllHandCards();
        // Hide action buttons when clicking background
        this.hideDynamicActionButtons();
      }
    });
  }

  updateGameState() {
    //this.updatePlayerHand();
    //this.updateZones();
    this.updateUI();
  }

  showCardSelectionDialog(selectionId, selection) {
    console.log('GameScene: Delegating card selection dialog to DialogManager:', selectionId, selection);
    
    // All callers must provide their own callback - no fallback needed
    if (!selection.callback) {
      console.error('Card selection requires a callback function');
      return;
    }
    
    // Use DialogManager to handle the dialog
    return this.dialogManager.showCardSelectionDialog(
      selectionId, 
      selection, 
      selection.callback
    );
  }

  updateCurrentPlayerHand(){
    const handDetails =  this.gameStateManager.getPlayerHand()
    const newHand = handDetails.slice(0, Math.min(handDetails.length, this.playerHand.length));
    console.log("new hand  "+JSON.stringify(newHand))
    this.updatePlayerHandWithCards(newHand)
  }
  updatePlayerHand() {
    // Get hand from game state manager
    const handDetails =  this.gameStateManager.getPlayerHand()
    console.log('updatePlayerHand - hand data:', JSON.stringify(handDetails));
    this.updatePlayerHandWithCards(handDetails);
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

  apiZoneCardDataToCardObject(cardData){
    return {
      id: cardData.id,
      name: cardData.id,
      cardType: cardData.cardType,
      type: cardData.cardType
    }
  }

  updateZones() {
    GameSceneUtils.updateAllZones(this, this.gameStateManager);
  }

  updatePlayerZones(zonesData, zones, isOpponent = false) {
    GameSceneUtils.updatePlayerZones(zonesData, zones, this, isOpponent);
  }

  updateUI() {
    const gameState = this.gameStateManager.getGameState();
    const player = this.gameStateManager.getPlayer();
    const opponent = this.gameStateManager.getOpponent();
    console.log('card data : opponent', opponent);
    const opponentData = this.gameStateManager.getPlayer(opponent);
    

    this.baseAndShieldManager.updateAll();
    this.energyAreaManager.updateEnergyAreas();
    this.slotAreaManager.updateSlotAreas();
    
    if(this.isSetScenoria){
      this.isSetScenoria = false;
      this.updatePlayerHand();
    }


    const unprocessedEvent = this.gameStateManager.getUnprocessGameEvents();
    if(unprocessedEvent.length > 0) {
      // Process events one by one using GameStateManager queue logic
      this.gameStateManager.processEventQueue(
        (event) => this.handleSingleEvent(event),
        () => {
          console.log('[GameScene] All events processed, continuing with game flow');
          this.updateUI();
        }
      );
      return;
    }

    // Debug: Log current phase and animation state
    console.log('Online mode - phase:', gameState.gameEnv.phase, 'shuffleAnimationPlayed:', this.shuffleAnimationPlayed);
    
    if(this.isTestMode) {
      if(gameState.gameEnv.phase === 'MAIN_PHASE') {
        this.displayGameInfo();
        this.showDeckStacks();
        // Show hand area and update game state after shuffle animation completes
        this.showHandArea();
      }
    }

    // Check for READY_PHASE and trigger shuffle animation
    if (gameState.gameEnv.phase === 'REDRAW_PHASE' && !this.shuffleAnimationPlayed) {
      console.log('READY_PHASE detected - triggering shuffle animation and redraw dialog');
      console.log('Game state during READY_PHASE:', JSON.stringify(gameState, null, 2));
      this.shuffleAnimationPlayed = true;
      this.showRoomStatus('Both players joined - hands dealt!');
      this.displayGameInfo();
      
      // Load card resources before shuffle animation
      this.loadCardResources().then(() => {
        console.log('[GameScene] Card resources loaded, starting shuffle animation');
        
        if(this.firstShuffleAnimationComplete == false){
          this.playShuffleDeckAnimation().then(() => {
            console.log('Online mode - shuffle animation completed, selecting leader cards...');
            this.firstShuffleAnimationComplete = true
            this.updatePlayerHand();
            this.showRedrawDialog();
          });
        }
      }).catch((error) => {
        console.warn('[GameScene] Failed to load card resources, proceeding with fallback:', error);
        
        // Continue with shuffle animation even if resource loading fails
        this.playShuffleDeckAnimation().then(() => {
          console.log('Online mode - shuffle animation completed (with resource loading fallback), selecting leader cards...');
          // Leader card selection removed
          this.updatePlayerHand();
        });
      });
    }
    
    if (this.gameStateManager.getPlayer().confirmIsRedraw &&
        this.firstShuffleAnimationComplete){
        this.updatePlayerHand();
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
    this.opponentHandText.setText(`Hand: ${opponentData && opponentData.deck.hand ? opponentData.deck.hand.length : 0}`);
    
    
    // Update opponent hand count display
    if (this.opponentHandCountText) {
      const opponentHandCount = opponentData && opponentData.deck?.hand ? opponentData.deck.hand.length : 0;
      this.opponentHandCountText.setText(`Opponent Hand: ${opponentHandCount}`);
    }
    
    // Update turn indicator
    const isCurrentPlayer = this.gameStateManager.isCurrentPlayer();
    this.endTurnButton.setTint(isCurrentPlayer ? 0xffffff : 0x888888);
  }

  canDropCardInZone(card, zoneType) {
    return GameSceneUtils.canDropCardInZone(card, zoneType, this);
  }

  getFieldIndexFromZone(zoneType) {
    return GameSceneUtils.getFieldIndexFromZone(zoneType);
  }

  showZoneHighlights(card) {
    GameSceneUtils.showZoneHighlights(card, this);
  }

  clearZoneHighlights() {
    GameSceneUtils.clearZoneHighlights(this);
  }

  showZoneRestrictionMessage(message) {
    GameSceneUtils.showZoneRestrictionMessage(message, this);
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
        
        // Set zone placement for hover preview system
        card.setZonePlacement(true, zoneType, true); // true = player zone
        console.log(`[GameScene] Card ${card.cardData?.id} placed in player zone: ${zoneType}`);
        
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
          
          // Show power overlay for character cards in character zones
          if (card.cardData?.type === 'character' && 
              ['top', 'left', 'right'].includes(zoneType)) {
            card.setPowerOverlayVisible(true, true);
          }
        }
        
        // Deselect the card
        if (this.gameStateManager.getSelectedCard() === card) {
          this.gameStateManager.setSelectedCard(null);
          this.clearZoneHighlights();
          // Hide action buttons when card is placed
          this.actionButtonManager.hide();
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
    
    // Send API call to backend if API manager available
    if (this.apiManager) {
      try {
        // Get the cardUID from the hand for the new simplified API
        const cardUID = this.getCardUIDFromHand(cardData);
        
        if (!cardUID) {
          this.showErrorMessage('Card not found in hand.');
          return false;
        }
        
        console.log('Sending card play to backend:', { cardUID, zone: zoneType });
        
        const response = await this.apiManager.playCard(
          gameState.playerId, 
          gameState.gameId, 
          cardUID
        );
        
        console.log('Card play response:', response);
        
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

  getCardUIDFromHand(cardData) {
    // Get the current hand from game state to find card UID
    const hand = this.gameStateManager.getPlayerHand();
    
    // Find the actual UID of this card in the player's hand
    // Backend hand contains UID strings like "c-1_1754551822157_24"
    // Frontend cardData.id is the base ID like "c-1"
    // We need to find the actual UID that matches this base ID
    const cardUID = hand.find(handCardUID => {
      // Extract base card ID from UID (before first underscore)
      const baseCardId = typeof handCardUID === 'string' 
        ? handCardUID.split('_')[0] 
        : handCardUID.id;
      return baseCardId === cardData.id;
    });
    
    if (!cardUID) {
      console.error(`Card ${cardData.id} not found in player hand`);
      console.log('Available hand cards (UIDs):', hand);
      console.log('Looking for base card ID:', cardData.id);
      return null;
    }
    
    return cardUID;
  }

  createBackendAction(cardData, zoneType) {
    // Get the cardUID using helper method
    const cardUID = this.getCardUIDFromHand(cardData);
    
    if (!cardUID) {
      return null;
    }
    
    // Validate and normalize zone name using ZoneMapping utility
    const normalizedZone = ZoneMapping.normalizeZone(zoneType);
    
    if (!normalizedZone) {
      console.error(`Invalid zone type: ${zoneType}`);
      return null;
    }
    
    // Create action in new UID/zone-based format
    const action = {
      type: cardData.faceDown ? 'PlayCardBack' : 'PlayCard',
      cardUID: cardUID,
      zone: normalizedZone
    };
    
    console.log(`Created backend action for card ${cardData.id} (NEW UID/ZONE FORMAT):`);
    console.log(`  - Card UID: ${cardUID}`);
    console.log(`  - Zone: ${normalizedZone}`);
    console.log(`  - Face down: ${cardData.faceDown} -> type: ${action.type}`);
    
    return action;
  }

  handleZoneClick(zoneType, x, y) {
    // Check if we have a selected card and it's currently our turn
    if (!this.gameStateManager.getSelectedCard()) {
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
    const selectedCard = this.gameStateManager.getSelectedCard();
    if (!this.canDropCardInZone(selectedCard, zoneType)) {
      const cardData = selectedCard.getCardData();
      
      // Check if it's a basic type compatibility issue
      if (!selectedCard.canPlayInZone(zoneType)) {
        console.log(`Card type ${cardData.type} cannot be placed in ${zoneType} zone`);
        this.showZoneRestrictionMessage(`${cardData.type.toUpperCase()} cards cannot be placed in ${zoneType.toUpperCase()} zone`);
      } else {
        // It's a field effect restriction from the leader/backend
        const restrictions = this.gameStateManager.getZoneRestrictions(null, zoneType);
        if (restrictions !== "ALL" && Array.isArray(restrictions)) {
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
    const card = this.gameStateManager.getSelectedCard();
    if (!card) return;
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
      
      // Disable card interaction - cards in zones should not be clickable
      card.disableInteraction();
      
      // Set zone placement for hover preview system
      card.setZonePlacement(true, zoneType, true); // true = player zone
      console.log(`[GameScene] Card ${card.cardData?.id} placed in player zone: ${zoneType}`);

      // Activate power overlay for character cards in character zones
      if (cardData.type === 'character' && ['top', 'left', 'right'].includes(zoneType.toLowerCase())) {
        console.log('[GameScene] Activating power overlay for character card in zone:', zoneType);
        card.setPowerOverlayVisible(true);
        card.updatePowerOverlay();
      }

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
        
        // Show power overlay for character cards in character zones
        if (card.cardData?.type === 'character' && 
            ['top', 'left', 'right'].includes(zoneType)) {
          card.setPowerOverlayVisible(true, true);
        }
      }

      // Clear selection and zone highlights
      this.gameStateManager.setSelectedCard(null);
      this.clearZoneHighlights();
      // Hide action buttons when card is placed
      this.hideActionButtons();

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
    GameSceneUtils.showZoneHighlights(card, this);
  }

  clearZoneHighlights() {
    GameSceneUtils.clearZoneHighlights(this);
  }

  showZoneRestrictionMessage(message) {
    GameSceneUtils.showZoneRestrictionMessage(message, this);
  }

  deselectAllHandCards() {
    // Deselect all hand cards silently without animations
    this.playerHand.forEach(handCard => {
      if (handCard.isSelected) {
        handCard.deselectSilently();
      }
    });
    this.gameStateManager.setSelectedCard(null);
    this.clearZoneHighlights();
    // Hide action buttons when all cards deselected
    this.hideActionButtons();
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

  async endTurn() {
    if (!this.gameStateManager.isCurrentPlayer()) {
      console.log('Not your turn');
      this.showRoomStatus('Not your turn to end turn');
      return;
    }
    
    try {
      const gameState = this.gameStateManager.getGameState();
      const gameId = gameState.gameId;
      const playerId = gameState.playerId;
      
      if (!gameId || !playerId) {
        throw new Error('Missing gameId or playerId');
      }
      
      console.log(`Ending turn for player: ${playerId}`);
      this.showRoomStatus('Ending turn...');
      
      const response = await this.apiManager.endTurn(gameId, playerId);
      
      if (response && response.success) {
        console.log('Turn ended successfully:', response);
        this.showRoomStatus('Turn ended successfully');
        
        // Update game state if returned in response
        if (response.gameEnv) {
          this.gameStateManager.updateGameEnv(response.gameEnv);
          this.updateGameState();
        }
      } else {
        throw new Error(response?.error || 'Failed to end turn');
      }
      
    } catch (error) {
      console.error('Error ending turn:', error);
      this.showRoomStatus(`Failed to end turn: ${error.message}`);
    }
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
    console.log("showCardPreview", cardData);
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

  /**
   * Show enhanced preview for slot cards - displays both unit and pilot if present
   * @param {Card} hoveredCard - The card being hovered over
   */
  showSlotCardPreview(hoveredCard) {
    // First, hide any existing preview
    this.hideSlotCardPreview();
    
    if (!this.cardPreviewZone || !hoveredCard) {
      console.warn('[showSlotCardPreview] Missing cardPreviewZone or hoveredCard');
      return;
    }

    console.log('[showSlotCardPreview] Hovering over card:', hoveredCard.cardData?.id, 'cardTypeInSlot:', hoveredCard.cardTypeInSlot, 'isInZone:', hoveredCard.isInZone);

    // Check if SlotAreaManager exists
    if (!this.slotAreaManager) {
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
      this.showCardPreview(hoveredCard.cardData);  // Direct access - no conversion
      return;
    }

    // Get both unit and pilot cards from the slot
    const slotCards = this.slotAreaManager.getSlotCards(slotInfo.playerType, slotInfo.slotName);
    console.log('[showSlotCardPreview] Slot cards:', slotInfo.slotName, slotCards);
    
    if (slotCards.unit && slotCards.pilot) {
      // Dual preview: show both unit and pilot
      console.log('[showSlotCardPreview] Showing dual preview');
      this.showDualCardPreview(slotCards.unit, slotCards.pilot);
    } else if (slotCards.unit || slotCards.pilot) {
      // Single card in slot
      const singleCard = slotCards.unit || slotCards.pilot;
      console.log('[showSlotCardPreview] Showing single card preview for:', singleCard.cardData?.id);
      this.showCardPreview(singleCard.cardData);  // Direct access - no conversion
    } else {
      console.warn('[showSlotCardPreview] No cards found in slot, using fallback');
      this.showCardPreview(hoveredCard.cardData);  // Direct access - no conversion
    }
  }

  /**
   * Show dual card preview with unit on top and pilot 25px below
   * @param {Card} unitCard - The unit card
   * @param {Card} pilotCard - The pilot card  
   */
  showDualCardPreview(unitCard, pilotCard) {
    if (!this.cardPreviewZone) return;
    
    // Create unit preview (on top) - Direct card data access
    this.previewCard = new Card(this, this.cardPreviewZone.x, this.cardPreviewZone.y, unitCard.cardData, {
      interactive: false,
      draggable: false,
      scale: 3.5,
      gameStateManager: this.gameStateManager,
      usePreview: false
    });
    this.previewCard.setDepth(2000);
    
    // Create pilot preview (25px below unit) - Direct card data access  
    this.previewPilotCard = new Card(this, this.cardPreviewZone.x, this.cardPreviewZone.y + 70, pilotCard.cardData, {
      interactive: false,
      draggable: false,
      scale: 3.5,
      gameStateManager: this.gameStateManager,
      usePreview: false
    });
    this.previewPilotCard.setDepth(1999); // Slightly behind unit
    
    console.log('Showing dual preview:', unitCard.cardData?.id, '+', pilotCard.cardData?.id);
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
   * Determine slot information from a hovered card
   * @param {Card} card - The card being hovered
   * @returns {Object|null} Slot info with playerType and slotName, or null if not a slot card
   */
  getSlotInfoFromCard(card) {
    console.log('[getSlotInfoFromCard] Analyzing card:', card.cardData?.id, 'cardTypeInSlot:', card.cardTypeInSlot);
    
    // First approach: Check if this card has slot-specific properties
    // This might not always be set, so we'll also try direct slot scanning
    
    if (!this.slotAreaManager) {
      console.warn('[getSlotInfoFromCard] SlotAreaManager not available');
      return null;
    }
    
    // Check player slots by scanning all slots
    for (let i = 1; i <= 6; i++) {
      const slotName = `slot${i}`;
      const slotCards = this.slotAreaManager.getSlotCards('player', slotName);
      console.log(`[getSlotInfoFromCard] Checking player ${slotName}:`, slotCards);
      
      if (slotCards.unit === card) {
        console.log(`[getSlotInfoFromCard] Found as unit in player ${slotName}`);
        return { playerType: 'player', slotName };
      }
      if (slotCards.pilot === card) {
        console.log(`[getSlotInfoFromCard] Found as pilot in player ${slotName}`);
        return { playerType: 'player', slotName };
      }
    }
    
    // Check opponent slots
    for (let i = 1; i <= 6; i++) {
      const slotName = `slot${i}`;
      const slotCards = this.slotAreaManager.getSlotCards('opponent', slotName);
      console.log(`[getSlotInfoFromCard] Checking opponent ${slotName}:`, slotCards);
      
      if (slotCards.unit === card) {
        console.log(`[getSlotInfoFromCard] Found as unit in opponent ${slotName}`);
        return { playerType: 'opponent', slotName };
      }
      if (slotCards.pilot === card) {
        console.log(`[getSlotInfoFromCard] Found as pilot in opponent ${slotName}`);
        return { playerType: 'opponent', slotName };
      }
    }
    
    console.log('[getSlotInfoFromCard] Card not found in any slot');
    return null;
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
        CardAnimationUtils.slideHandCardsLeft(this, totalCards, cardSpacing);
        
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


  createConnectionStatus() {
    const { width } = this.cameras.main;
    
    // Connection status indicator (top right)
    const statusText = this.isManualPollingMode ? '🎮 Demo Mode' : '🟢 Live Game';
    const statusColor = this.isManualPollingMode ? '#FFD700' : '#51CF66';
    
    this.connectionStatusText = this.add.text(width-50, 30, statusText, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fill: statusColor,
      align: 'right'
    });
    this.connectionStatusText.setOrigin(1, 0);
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
    
    const opponentId = this.gameStateManager.getOpponent();
    const opponentData = this.gameStateManager.getPlayer(opponentId);

    if (gameEnv && gameEnv.firstPlayer !== undefined && gameEnv.players) {
      const playerIds = Object.keys(gameEnv.players);
      if (playerIds.length < 2) return;

      // Determine which player goes first
      const firstPlayerId = gameEnv.firstPlayer === 0 ? playerIds[0] : playerIds[1];
      const isCurrentPlayerFirst = firstPlayerId === gameState.playerId;
      
      // Display first player info
      const firstPlayerText = isCurrentPlayerFirst ? 'You go first!' : 'Opponent goes first!';
      this.showRoomStatus(`${firstPlayerText} (First player: ${firstPlayerId})`);
   
      this.opponentInfoText.setText(`Opponent: ${opponentData ? opponentData.name : 'Unknown'}`);
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
    console.log("updateFirstPlayerDisplay 11", isCurrentPlayerFirst);
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
    console.log('GameScene: Showing redraw dialog via DialogManager');
    
    // Handle special depth requirements for redraw dialog (bring cards to front)
    this.setCardsAboveOverlay();
    
    // Use DialogManager for consistent dialog handling
    return this.dialogManager.showConfirmationDialog(
      {
        title: 'Redraw Hand',
        message: 'Do you want to redraw your hand?',
        confirmText: 'Yes',
        cancelText: 'No',
        width: 400,
        height: 200
      },
      () => this.handleRedrawChoice(true),  // onConfirm
      () => this.handleRedrawChoice(false)  // onCancel
    );
  }

  /**
   * Set cards above overlay for redraw dialog visibility
   */
  setCardsAboveOverlay() {
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

  async handleRedrawChoice(wantRedraw) {
    // DialogManager handles dialog cleanup automatically
    console.log('GameScene: Handling redraw choice:', wantRedraw);
    
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
    
    // Set high depth to ensure status messages appear above all game elements
    this.roomStatusText.setDepth(2000);
    
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
    
    // Set high depth to ensure error messages appear above all game elements (leader cards use depth 1001)
    this.errorMessageText.setDepth(2000);
    
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
    
    // Clean up base and shield area manager
    if (this.baseAndShieldManager) {
      this.baseAndShieldManager.destroy();
      this.baseAndShieldManager = null;
    }

    // Clean up energy area manager
    if (this.energyAreaManager) {
      this.energyAreaManager.destroy();
      this.energyAreaManager = null;
    }

    // Clean up slot area manager
    if (this.slotAreaManager) {
      this.slotAreaManager.destroy();
      this.slotAreaManager = null;
    }

    // Clean up action button manager
    if (this.actionButtonManager) {
      this.actionButtonManager.destroy();
      this.actionButtonManager = null;
    }

    // Clean up hover preview resources
    this.hideCardPreview();
    this.hideSlotCardPreview();
    
    
    // Clean up all dialogs using DialogManager
    if (this.dialogManager) {
      this.dialogManager.destroy();
      this.dialogManager = null;
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

  handlePhaseChange(event) {
    console.log('Processing phase change event:', event);
    
    // Update phase indicator
    this.updatePhaseIndicator(event.data.phase);
    
    // Show phase change notification
    this.showRoomStatus(event.data.message || `Phase changed to ${event.data.phase}`);
  }



  shouldShowTurnInfo(phase) {
    // Only show turn info for phases where turns matter
    const turnBasedPhases = ['DRAW_PHASE', 'MAIN_PHASE', 'SP_PHASE'];
    return turnBasedPhases.includes(phase);
  }

  updatePhaseIndicator(phase, currentPlayer = null) {
    if(phase == null){
      return;
    }
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
          console.log('Unknown phase:', phase);
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







  async loadCardResources() {
    try {
      const apiUrl = GAME_CONFIG.api.getFullUrl(GAME_CONFIG.api.endpoints.gameResource);
      console.log('[GameScene] Fetching deck data from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: GAME_CONFIG.api.headers,
        signal: AbortSignal.timeout(GAME_CONFIG.api.timeout)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const deckData = await response.json();
      console.log('[GameScene] Deck data received:', deckData);
      
      // Process deck data to extract unique card images
      const allCardPaths = new Set();
      
      if (deckData.decks) {
        Object.keys(deckData.decks).forEach(deckKey => {
          const deck = deckData.decks[deckKey];
          if (deck.cards && Array.isArray(deck.cards)) {
            deck.cards.forEach(cardPath => {
              const imagePath = cardPath.endsWith('.png') ? cardPath : `${cardPath}.png`;
              allCardPaths.add(imagePath);
            });
          }
        });
      }
      
      const uniqueCardPaths = Array.from(allCardPaths);
      console.log(`[GameScene] Found ${uniqueCardPaths.length} unique cards to load:`, uniqueCardPaths);
      
      // Load images into Phaser texture manager
      const loadPromises = [];
      const timestamp = Date.now();
      
      uniqueCardPaths.forEach(imagePath => {
        const imageKey = this.getImageKey(imagePath);
        
        // Load full-size image
        const fullImageUrl = `${GAME_CONFIG.api.getImageUrl(imagePath)}?t=${timestamp}`;
        const fullPromise = new Promise((resolve, reject) => {
          this.load.image(imageKey, fullImageUrl);
          this.load.once(`filecomplete-image-${imageKey}`, () => {
            console.log(`[GameScene] Loaded: ${imageKey}`);
            resolve();
          });
          this.load.once(`loaderror`, (file) => {
            if (file.key === imageKey) {
              console.warn(`[GameScene] Failed to load: ${imageKey}`);
              reject(new Error(`Failed to load ${imageKey}`));
            }
          });
        });
        loadPromises.push(fullPromise);
        
        // Load preview image
        const previewKey = `${imageKey}-preview`;
        const previewImageUrl = `${GAME_CONFIG.api.getPreviewImageUrl(imagePath)}?t=${timestamp}`;
        const previewPromise = new Promise((resolve, reject) => {
          this.load.image(previewKey, previewImageUrl);
          this.load.once(`filecomplete-image-${previewKey}`, () => {
            console.log(`[GameScene] Loaded preview: ${previewKey}`);
            resolve();
          });
          this.load.once(`loaderror`, (file) => {
            if (file.key === previewKey) {
              console.warn(`[GameScene] Failed to load preview: ${previewKey}`);
              reject(new Error(`Failed to load ${previewKey}`));
            }
          });
        });
        loadPromises.push(previewPromise);
      });
      
      // Start loading and wait for completion
      this.load.start();
      await Promise.allSettled(loadPromises);
      
      console.log('[GameScene] Card resource loading complete');
      
    } catch (error) {
      console.error('[GameScene] Error loading card resources:', error);
      throw error;
    }
  }
  
  getImageKey(imagePath) {
    // Extract filename from path and remove extension
    const filename = imagePath.split('/').pop();
    return filename.replace(/\.[^/.]+$/, "");
  }
  
  async handleSingleEvent(event) {
    console.log("handlesingle event ", JSON.stringify(event))
    switch (event.type) {
      case 'CARD_DRAWN':
        console.log("card drawn event")
        await CardAnimationUtils.playDrawCardAnimation(this, event);
        break;
      case 'PLAYER_REDRAW':
        this.updateCurrentPlayerHand()
        break;
      
      /*
      case 'CARD_PLAYED':
        this.handleCardPlayedEvent(event);
        break;
        
      case 'PHASE_CHANGE':
        this.handlePhaseChangeEvent(event);
        break;
        
      case 'TURN_SWITCH':
        this.handleTurnSwitchEvent(event);
        break;
        
      case 'BATTLE_CALCULATED':
        this.handleBattleCalculatedEvent(event);
        break;
        
      case 'ERROR_OCCURRED':
        this.handleErrorEvent(event);
        break;
      */
      default:
        console.log(`[GameScene] Unhandled event type: ${event.type}`, event);
    }
  }
  
  handleCardPlayedEvent(event) {
    console.log('[GameScene] Handling CARD_PLAYED event:', event.data);
    // Update UI based on card played
    this.updateGameState();
  }
  
  handlePhaseChangeEvent(event) {
    console.log('[GameScene] Handling PHASE_CHANGE event:', event.data);
    // Update phase display
    this.updateGameState();
  }
  
  handleTurnSwitchEvent(event) {
    console.log('[GameScene] Handling TURN_SWITCH event:', event.data);
    // Update turn indicators
    this.updateGameState();
  }
  
  handleBattleCalculatedEvent(event) {
    console.log('[GameScene] Handling BATTLE_CALCULATED event:', event.data);
    // Trigger battle result animation
    this.updateGameState();
  }
  
  handleErrorEvent(event) {
    console.error('[GameScene] Handling ERROR event:', event.data);
    // Show error message to user
    this.showRoomStatus(`Error: ${event.data.message || 'Unknown error occurred'}`, 3000);
  }
  

  // Old static action button method removed - now using dynamic ActionButtonManager
  
  /**
   * Show dynamic actions for selected card
   */
  showDynamicActionsForCard(selectedCard) {
    if (!selectedCard) {
      this.hideDynamicActionButtons();
      return;
    }

    // Build game context for action validation
    const gameState = this.gameStateManager.getGameState();
    const gameContext = {
      phase: gameState.gameEnv?.phase || 'MAIN_PHASE',
      baseZoneAvailable: this.isBaseZoneAvailable(),
      canPlayNormally: this.canPlayCardNormally(selectedCard)
    };

    // Show dynamic actions based on card type and context
    this.actionButtonManager.showActionsForCard(selectedCard, gameContext);
  }
  
  /**
   * Hide dynamic action buttons
   */
  hideDynamicActionButtons() {
    this.actionButtonManager.hide();
  }


  /**
   * Helper: Check if base zone is available
   */
  isBaseZoneAvailable() {
    // TODO: Check if base zone can accept cards
    return true; // Placeholder
  }

  /**
   * Helper: Check if card can be played normally in current context
   */
  canPlayCardNormally(selectedCard) {
    // TODO: Check phase restrictions, zone availability, etc.
    return true; // Placeholder
  }
  
  handleActionButtonClick(action, effectData = null) {
    const selectedCard = this.gameStateManager.getSelectedCard();
    this.cardActionHandler.handleAction(action, selectedCard, effectData);
  }
  
  // Card action methods moved to CardActionHandler class

  // Duplicate destroy method removed - merged into main destroy method above

}