import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/gameConfig.js';
import ShuffleAnimationManager from '../components/ShuffleAnimationManager.js';
import BaseAndShieldAreaManager from '../components/BaseAndShieldAreaManager.js';
import EnergyAreaManager from '../components/EnergyAreaManager.js';
import SlotAreaManager from '../components/SlotAreaManager.js';
import BoardLayoutManager from '../managers/BoardLayoutManager.js';
import ZoneManager from '../managers/ZoneManager.js';
import GameSceneUtils from '../utils/GameSceneUtils.js';
import CardAnimationUtils from '../utils/CardAnimationUtils.js';
import CardActionHandler from '../handlers/CardActionHandler.js';
import DeployEffectHandler from '../handlers/DeployEffectHandler.js';
import ActionButtonManager from '../systems/ActionButtonManager.js';
import DialogManager from '../managers/DialogManager.js';
import TrashManager from '../managers/TrashManager.js';
import UIMessageManager from '../managers/UIMessageManager.js';
import CardInteractionManager from '../managers/CardInteractionManager.js';
import ResourceManager from '../managers/ResourceManager.js';
import FrontEventProcessor from '../managers/FrontEventProcessor.js';
import GameApiService from '../services/GameApiService.js';
import GameFlowManager from '../managers/GameFlowManager.js';
import GameSceneUIManager from '../managers/GameSceneUIManager.js';
import CardPreviewManager from '../managers/CardPreviewManager.js';
import HandCardManager from '../managers/HandCardManager.js';

export default class GameScene extends Phaser.Scene {
  constructor(config = { key: 'GameScene' }) {
    super(config);
    this.inGamePlayerId = "";
    this.gameStateManager = null;
    this.playerHand = [];
    this.shuffleAnimationManager = null;
    this.isTestMode = false;
    this.firstShuffleAnimationComplete = false;

    // Manager instances
    this.baseAndShieldManager = null;
    this.energyAreaManager = null;
    this.slotAreaManager = null;
    this.boardLayoutManager = null;
    this.zoneManager = null;
    this.opponentBase = null;
    this.dialogManager = null;
    this.uiMessageManager = null;
    this.cardInteractionManager = null;
    this.resourceManager = null;
    this.deployEffectHandler = null;
    this.gameApiService = null;
    this.gameFlowManager = null;
    this.uiManager = null;
    this.cardPreviewManager = null;
    this.handCardManager = null;
    this.trashManager = null;

    // Legacy zone references (will be managed by ZoneManager)
    this.playerZones = {};
    this.opponentZones = {};
    this.cardPreviewZone = null;
    this.layout = null;

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
    this.deployEffectHandler = new DeployEffectHandler(this, this.gameStateManager, this.apiManager);
    this.actionButtonManager = new ActionButtonManager(this);
    this.dialogManager = new DialogManager(this);
    this.frontEventProcessor = new FrontEventProcessor(this);
    


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
    tableGraphics.fillRoundedRect(50, 0, width - 100, height - 140, 20);
    tableGraphics.lineStyle(4, 0x8b4513);
    tableGraphics.strokeRoundedRect(50, 0, width - 100, height - 140, 20);
  }

  createGameBoard() {
    console.log('[GameScene] createGameBoard called');
    
    // Initialize layout manager and generate layout
    this.boardLayoutManager = new BoardLayoutManager(this);
    this.layout = this.boardLayoutManager.createLayout();
    
    // Initialize UI message manager
    this.uiMessageManager = new UIMessageManager(this);
    
    // Initialize GameApiService with UIMessageManager
    this.gameApiService = new GameApiService(this.apiManager, this.gameStateManager, this.uiMessageManager);
    
    // Initialize card interaction manager
    this.cardInteractionManager = new CardInteractionManager(this, this.gameStateManager);
    
    // Initialize resource manager
    this.resourceManager = new ResourceManager(this);
    
    // Initialize game flow manager
    this.gameFlowManager = new GameFlowManager(this);
    
    // Initialize UI manager
    this.uiManager = new GameSceneUIManager(this);
    
    // Initialize card preview manager
    this.cardPreviewManager = new CardPreviewManager(this);
    
    // Initialize hand card manager
    this.handCardManager = new HandCardManager(this);
    
    // Initialize trash manager (before zone creation)
    this.trashManager = new TrashManager(this);
    
    // Initialize zone manager and create zones (this calls createZones which needs trashManager)
    this.zoneManager = new ZoneManager(this, this.layout);
    this.zoneManager.createZones();
    
    // Update legacy zone references for backward compatibility
    this.playerZones = this.zoneManager.getPlayerZones();
    this.opponentZones = this.zoneManager.getOpponentZones();
    this.cardPreviewZone = this.zoneManager.cardPreviewZone;
    
    console.log('[GameScene] Board layout and zones created successfully');
  }

  // Legacy createZones method - now handled by ZoneManager
  // This method is called from createGameBoard via the ZoneManager
  createZones() {
    console.log('[GameScene] createZones called - delegating to ZoneManager');
    
    // This method is now called through ZoneManager.createZones()
    // Adding additional setup that wasn't moved to ZoneManager
    this.createDeckVisualizations();
    this.trashManager.initialize();
  }




  createDeckVisualizations() {
    // Use the initial deck stacks created in createZone as the main deck stacks
    this.playerDeckStack = this.initialPlayerDeckStack || [];
    this.opponentDeckStack = this.initialOpponentDeckStack || [];

    // The initial deck stacks are already visible, so no need to hide them
  }


  createUI() {
    // Delegate UI creation to UIManager
    this.uiManager.createAllUI();
  }

  // UI creation methods moved to GameSceneUIManager

  // UI creation methods moved to GameSceneUIManager
  
  setupEventListeners() {

    
    /*
    Zone card selection events - consolidated handlers for all slot cards
    hand card will reach here
    card in dialog will not reach here
    */
    this.events.on('card-select', (card) => {
      console.log(`GameScene: card-select event received for card ${card.cardData?.id}`);

      // Use helper method for consistent card selection
      this.selectCard(card, 'hand');
    });

    this.events.on('card-deselect', (card) => {
      // Use helper method for consistent card deselection
      this.deselectCard(card);
    });


    // Card hover events for preview
    this.events.on('card-hover', (card) => {
      // Only show preview for hand cards
      if (this.handCardManager.isCardInHand(card)) {
        this.cardPreviewManager.showCardPreviewWithZone(card.getCardFullData(),"card-hover");
      }
    });

    this.events.on('card-unhover', (card) => {
      // Hide preview when not hovering
      this.cardPreviewManager.hideCardPreview();
    });

    /*
    Zone card selection events - consolidated handlers for all slot cards
    base/slot card can will reach here
    hand card will not reach here
    card in dialog will not reach here
    */
    this.events.on('zone-card-select', (card) => {
      console.log(`GameScene: zone-card-select event received for card ${card?.id}`);

      // Use helper method for consistent card selection
      this.selectCard(card, 'zone');
    });

    this.events.on('zone-card-deselect', (card) => {
      console.log(`GameScene: zone-card-deselect event received for card ${card.cardData?.id}`);
      
      // Use helper method for consistent card deselection
      this.deselectCard(card);
      console.log(`Cleared selected card state for zone card ${card.cardData?.id}`);
    });

    /*
     * Fired when a board-card emits hover/unhover (Card.emitLocationAwareEvent with isInZone=true)
     * - Base / slot cards drive this path
     * - Hand cards emit the plain card-hover instead
     * - Dialog cards only reach here if their zone is set to a slot/base
     */
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

      if (card.isInZone) {
        this.cardPreviewManager.showCardPreviewWithZone(card.getCardFullData(),"zone-card-hover");
      }

    });

    this.events.on('zone-card-unhover', (card) => {
      // Hide preview for zone cards (same as hand cards)
      if (card.isInZone) {
        this.cardPreviewManager.hideSlotCardPreview();
      }
    });

  }

  updateGameState() {
    this.updateUI();
  }

  /**
   * Helper method to handle common gameEnv update pattern
   * @param {Object} gameEnv - Game environment data from API response
   * @param {boolean} updateHand - Whether to trigger hand update scenario
   */
  handleGameEnvUpdate(gameEnv, updateHand = false) {
    if (updateHand) {
      this.gameStateManager.checkHandUIDChangesAndSetScenario(
        gameEnv, 
        '', 
        this.handContainer, 
        { value: this.isSetScenoria }
      );
    }
    this.gameStateManager.updateGameEnv(gameEnv);
    this.updateGameState();
  }

  /**
   * Helper method to handle card selection with consistent behavior
   * @param {Object} card - The card to select
   * @param {string} cardType - Type of card ('hand' or 'zone')
   */
  selectCard(card, cardType = 'hand') {
    console.log(`Selecting ${cardType} card ${card.cardData?.id}`);
    
    // Deselect all cards first
    this.deselectAllCards();
    
    // Select the target card
    card.select();
    this.gameStateManager.setSelectedCard(card);
    
    // Show dynamic action buttons
    this.actionButtonManager.showDynamicActionsForCard(card);
  }

  /**
   * Helper method to handle card deselection with consistent behavior
   * @param {Object} card - The card to deselect
   */
  deselectCard(card) {
    if (this.gameStateManager.getSelectedCard() === card) {
      this.gameStateManager.setSelectedCard(null);
      this.actionButtonManager.hideDynamicActionButtons();
    }
  }



  updateCurrentPlayerHand() {
    this.handCardManager.updateCurrentPlayerHand();
  }
  
  updatePlayerHand() {
    this.handCardManager.updatePlayerHand();
  }

  updatePlayerHandWithCards(hand) {
    this.handCardManager.updatePlayerHandWithCards(hand);
  }

  apiZoneCardDataToCardObject(cardData) {
    return {
      id: cardData.id,
      name: cardData.id,
      cardType: cardData.cardType,
      type: cardData.cardType
    }
  }

  updateBattlePrompt() {
    if (!this.battlePromptContainer) {
      return;
    }

    const gameState = this.gameStateManager.getGameState();
    const battle = gameState.gameEnv?.currentBattle;
    const playerId = gameState.playerId;

    if (battle && battle.status === 'ACTION_STEP') {
      const isParticipant = battle.attackingPlayerId === playerId || battle.defendingPlayerId === playerId;
      const confirmations = battle.confirmations || {};
      const playerConfirmed = isParticipant ? confirmations[playerId] === true : false;
      const opponentId = battle.attackingPlayerId === playerId ? battle.defendingPlayerId : battle.attackingPlayerId;
      const opponentConfirmed = opponentId ? confirmations[opponentId] === true : false;
      const bothConfirmed = playerConfirmed && opponentConfirmed;

      let promptMessage;
      if (isParticipant) {
        if (bothConfirmed) {
          promptMessage = '双方已确认，可以结算战斗';
        } else if (playerConfirmed) {
          promptMessage = '已确认，等待对手完成行动';
        } else {
          promptMessage = '行动步骤：使用指令卡或确认行动完成';
        }
      } else {
        promptMessage = opponentConfirmed ? '对手已确认，等待另一方完成行动' : '行动步骤：等待对手处理';
      }

      this.battlePromptText?.setText(promptMessage);
      this.battlePromptContainer.setVisible(true);

      if (isParticipant) {
        this.confirmBattleButton?.setVisible(true);
        this.confirmBattleButtonText?.setVisible(true);

        if (playerConfirmed) {
          this.confirmBattleButton?.disableInteractive();
          this.confirmBattleButtonText?.setText('已确认');
          this.confirmBattleButton?.setFillStyle(0x2a8f4e, 0.85);
        } else {
          this.confirmBattleButton?.setInteractive({ useHandCursor: true });
          this.confirmBattleButton?.setFillStyle(0x1a37b8, 0.95);
          this.confirmBattleButtonText?.setText('确认行动完成');
        }

        if (bothConfirmed) {
          this.resolveBattleButton?.setVisible(true);
          this.resolveBattleButtonText?.setVisible(true);
          this.resolveBattleButton?.setInteractive({ useHandCursor: true });
          this.resolveBattleButton?.setFillStyle(0x2a8f4e, 0.95);
        } else {
          this.resolveBattleButton?.setVisible(true);
          this.resolveBattleButtonText?.setVisible(true);
          this.resolveBattleButton?.disableInteractive();
          this.resolveBattleButton?.setFillStyle(0x2a8f4e, 0.4);
        }
      } else {
        this.confirmBattleButton?.setVisible(false);
        this.confirmBattleButtonText?.setVisible(false);
        this.confirmBattleButton?.disableInteractive();
        this.resolveBattleButton?.setVisible(false);
        this.resolveBattleButtonText?.setVisible(false);
        this.resolveBattleButton?.disableInteractive();
      }
    } else {
      this.battlePromptContainer.setVisible(false);
      this.confirmBattleButton?.disableInteractive();
      this.resolveBattleButton?.disableInteractive();
    }
  }

  updateUI() {
    // Update managers first
    this.baseAndShieldManager.updateAll();
    this.energyAreaManager.updateEnergyAreas();
    this.slotAreaManager.updateSlotAreas();
    this.updateCardInteractionStates();

    // Delegate complex game flow logic to GameFlowManager
    this.gameFlowManager.updateGameFlow();

    // Update battle prompt UI if action step is active
    this.updateBattlePrompt();
  }

  canPlaceCardInZone(card, zoneType) {
    return GameSceneUtils.canPlaceCardInZone(card, zoneType, this);
  }

  getFieldIndexFromZone(zoneType) {
    return GameSceneUtils.getFieldIndexFromZone(zoneType);
  }


  showZoneRestrictionMessage(message) {
    GameSceneUtils.showZoneRestrictionMessage(message, this);
  }

  /**
   * Deselect all cards (hand cards, slot cards, and base cards) and clear zone highlights
   * @param {boolean} clearGameState - Whether to also clear the selected card from game state (default: false)
   */
  deselectAllCards(clearGameState = false) {
    console.log("🔍 deselectAllCards called")
    console.log("🔍 baseAndShieldManager exists:", !!this.baseAndShieldManager)
    console.log("🔍 baseAndShieldManager type:", typeof this.baseAndShieldManager)
    
    // Deselect all hand cards using HandCardManager
    this.handCardManager.deselectAllHandCards();

    // Deselect all slot cards - delegate to SlotAreaManager
    if (this.slotAreaManager) {
      this.slotAreaManager.deselectAllSlotCards();
    }
    
    // ✅ NEW: Deselect all base cards - delegate to BaseAndShieldAreaManager
    // ✅ FIXED: Use correct property name (baseAndShieldManager, not baseAndShieldAreaManager)
    if (this.baseAndShieldManager) {
      console.log("✅ Calling baseAndShieldManager methods")
      this.baseAndShieldManager.deselectAllBaseCards();
      // Also deselect shield cards for completeness
      this.baseAndShieldManager.deselectAllShieldCards();
    } else {
      console.warn("❌ baseAndShieldManager is not available:", this.baseAndShieldManager)
    }

    // Optionally clear the selected card from game state
    if (clearGameState) {
      this.gameStateManager.setSelectedCard(null);
    }
  }


  async endTurn() {
    if (!this.gameStateManager.isCurrentPlayer()) {
      console.log('Not your turn');
      this.showRoomStatus('Not your turn to end turn');
      return;
    }

    try {
      // ✅ SIMPLIFIED: GameApiService handles scenario flag and updateGameState automatically
      await this.gameApiService.endTurn(this);
    } catch (error) {
      console.error('Error ending turn:', error);
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

  /**
   * Creates a preview card component
   * @param {Object} cardData - The card data to display
   * @param {number} x - X position
   * @param {number} y - Y position  
   * @param {number} depth - Z depth for layering
   * @returns {Card} The created preview card component
   */
  // _createPreviewCard method moved to CardPreviewManager

  hideCardPreview() {
    this.cardPreviewManager.hideCardPreview();
  }


  /**
   * Hide slot card preview (includes dual preview)
   */
  hideSlotCardPreview() {
    this.cardPreviewManager.hideSlotCardPreview();
  }


  _createPreviewCard(cardData, x, y, depth = 2000) {
    return this.cardPreviewManager._createPreviewCard(cardData, x, y, depth);
  }

  getSlotInfoFromCard(card) {
    return this.cardPreviewManager.getSlotInfoFromCard(card);
  }

  // Getter properties to maintain compatibility with existing code
  get previewCard() {
    return this.cardPreviewManager ? this.cardPreviewManager.previewCard : null;
  }

  set previewCard(value) {
    if (this.cardPreviewManager) {
      this.cardPreviewManager.previewCard = value;
    }
  }

  get previewPilotCard() {
    return this.cardPreviewManager ? this.cardPreviewManager.previewPilotCard : null;
  }

  set previewPilotCard(value) {
    if (this.cardPreviewManager) {
      this.cardPreviewManager.previewPilotCard = value;
    }
  }

  addCardsToPlayerHand(cardsToAdd) {
    this.handCardManager.addCardsToPlayerHand(cardsToAdd);
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

  // animateCardsFromDeckToHand method moved to HandCardManager


  async simulatePlayer2Join() {
    try {
      const gameState = this.gameStateManager.getGameState();
      const gameId = gameState.gameId;

      console.log('Simulating player 2 joining room with gameId:', gameId);

      if (!gameId) {
        throw new Error('No gameId found. Make sure game was created first.');
      }

      // Call joinRoom API to simulate player 2 joining using the correct gameId
      const result = await this.gameApiService.joinRoom(gameId, 'Demo Opponent');
      console.log('Player 2 join response:', result);

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
    this.cardPreviewManager.setCardsAboveOverlay();

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
    this.cardPreviewManager.setCardsAboveOverlay();
  }



  highlightHandCards() {
    this.cardPreviewManager.highlightHandCards();
  }

  highlightLeaderCards() {
    console.log('highlightLeaderCards called');
    // Note: Leader zone highlighting is no longer needed as leader zones do not exist in new structure
    console.log('Leader zone highlighting skipped - leader zones no longer exist');
  }

  removeHandCardHighlight() {
    this.cardPreviewManager.removeHandCardHighlight();
  }

  removeLeaderCardHighlight() {
    console.log('removeLeaderCardHighlight called');
    // Note: Leader zone highlighting cleanup is no longer needed as leader zones do not exist in new structure
    console.log('Leader zone highlight cleanup skipped - leader zones no longer exist');
  }

  async handleRedrawChoice(wantRedraw) {
    // DialogManager handles dialog cleanup automatically
    console.log('GameScene: Handling redraw choice:', wantRedraw);

    // Remove hand card highlighting
    this.cardPreviewManager.removeHandCardHighlight();

    // Remove leader card highlighting
    this.removeLeaderCardHighlight();

    // Reset hand cards depth to normal using HandCardManager
    this.handCardManager.resetHandCardsDepth();

    // Reset leaderDeck cards depth to normal - same as hand cards
    if (this.playerZones.leaderDeck && this.playerZones.leaderDeck.card) {
      this.playerZones.leaderDeck.card.setDepth(0);
    }
    if (this.opponentZones.leaderDeck && this.opponentZones.leaderDeck.card) {
      this.opponentZones.leaderDeck.card.setDepth(0);
    }

    try {
      const gameState = this.gameStateManager.getGameState();
      console.log(`Player chose redraw: ${wantRedraw}`);

      // Call startReady with redraw choice
      await this.gameApiService.startReady(wantRedraw);

    } catch (error) {
      console.error('Failed to send ready status:', error);
      this.showRoomStatus('Failed to send ready status: ' + error.message);
    }
  }



  showRoomStatus(message) {
    this.uiMessageManager.showRoomStatus(message);
  }

  showErrorMessage(message) {
    this.uiMessageManager.showErrorMessage(message);
  }

  showSuccessMessage(message) {
    this.uiMessageManager.showSuccessMessage(message);
  }

  setUILoadingState(isLoading) {
    this.uiMessageManager.setUILoadingState(isLoading);
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

    // Clean up new managers
    if (this.cardPreviewManager) {
      this.cardPreviewManager.destroy();
      this.cardPreviewManager = null;
    }

    if (this.handCardManager) {
      this.handCardManager.destroy();
      this.handCardManager = null;
    }

    // Clean up action button manager
    if (this.actionButtonManager) {
      this.actionButtonManager.destroy();
      this.actionButtonManager = null;
    }

    // Clean up hover preview resources
    this.hideCardPreview();
    this.hideSlotCardPreview();


    // Clean up deploy effect handler
    if (this.deployEffectHandler) {
      this.deployEffectHandler.destroy();
      this.deployEffectHandler = null;
    }

    // Clean up all dialogs using DialogManager
    if (this.dialogManager) {
      this.dialogManager.destroy();
      this.dialogManager = null;
    }

    // Call parent destroy
    super.destroy();
  }

  updatePhaseIndicator(phase, currentPlayer = null) {
    this.uiMessageManager.updatePhaseIndicator(phase, currentPlayer, this.gameStateManager);
  }



  /**
   * Load all card resources using ResourceManager
   * Delegates to ResourceManager for centralized resource management
   */
  async loadCardResources() {
    return await this.resourceManager.loadCardResources();
  }

  /**
   * Get Phaser texture key from image path
   * Delegates to ResourceManager for consistent key generation
   * @param {string} imagePath - Image file path
   * @returns {string} Phaser texture key
   */
  getImageKey(imagePath) {
    return this.resourceManager.getImageKey(imagePath);
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

      default:
        console.log(`[GameScene] Unhandled event type: ${event.type}`, event);
    }
  }

  // Old static action button method removed - now using dynamic ActionButtonManager




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

  /**
   * Update card interaction states based on current turn
   * Delegates to CardInteractionManager for centralized management
   */
  updateCardInteractionStates() {
    this.cardInteractionManager.updateAllCardInteractionStates();
  }

}
