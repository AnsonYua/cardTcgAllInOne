// EventManager.js - Handles all game events, interactions, and event coordination
export default class EventManager {
  constructor(scene) {
    this.scene = scene;
    this.eventHandlers = new Map();
  }

  init(managers) {
    this.uiManager = managers.ui;
    this.zoneManager = managers.zone;
    this.gameLogicManager = managers.gameLogic;
    this.animationManager = managers.animation;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.setupUIEvents();
    this.setupGameStateEvents();
    this.setupCardInteractionEvents();
    this.setupAnimationEvents();
    this.setupAPIEvents();
  }

  setupUIEvents() {
    // UI button events
    this.scene.events.on('ui-end-turn', () => {
      this.gameLogicManager.endTurn();
    });
    
    this.scene.events.on('ui-menu', () => {
      this.scene.scene.start('MenuScene');
    });
    
    this.scene.events.on('ui-test-leader', () => {
      this.gameLogicManager.selectLeaderCard('player');
    });
    
    this.scene.events.on('ui-test-opponent-leader', () => {
      this.gameLogicManager.selectLeaderCard('opponent');
    });
    
    this.scene.events.on('ui-test-add-card', () => {
      this.gameLogicManager.testAddCard();
    });
    
    this.scene.events.on('ui-test-polling', () => {
      this.gameLogicManager.testPolling();
    });
    
    this.scene.events.on('ui-test-join-player2', () => {
      this.gameLogicManager.simulatePlayer2Join();
    });
    
    // UI update events
    this.scene.events.on('ui-update-needed', () => {
      this.updateUI();
    });
    
    this.scene.events.on('room-status', (message) => {
      this.uiManager.showRoomStatus(message);
    });
  }

  setupGameStateEvents() {
    // Game state management events
    this.scene.events.on('hand-updated', (cards) => {
      this.animationManager.animateHandCardPlacement(cards, this.uiManager.getHandContainer());
    });
    
    this.scene.events.on('hand-reorganize-needed', (cards) => {
      this.animationManager.reorganizeHandCards(cards, this.uiManager.getHandContainer());
    });
    
    this.scene.events.on('zones-update-needed', () => {
      this.zoneManager.updateZones(this.gameLogicManager.gameStateManager);
    });
    
    // Card drop handling
    this.scene.events.on('card-dropped', (data) => {
      this.handleCardDrop(data);
    });
  }

  setupCardInteractionEvents() {
    // Card selection and interaction
    this.scene.events.on('card-select', (card) => {
      if (this.selectedCard && this.selectedCard !== card) {
        this.selectedCard.deselect();
      }
      this.selectedCard = card;
    });
    
    this.scene.events.on('card-drag-start', (card) => {
      this.draggedCard = card;
      this.scene.events.emit('card-preview-hide');
    });
    
    this.scene.events.on('card-drag-end', (card) => {
      this.draggedCard = null;
    });
    
    // Card hover events for preview
    this.scene.events.on('card-hover', (card) => {
      if (!this.draggedCard && this.gameLogicManager.getPlayerHand().includes(card)) {
        this.scene.events.emit('card-preview-show', card.getCardData());
      }
    });
    
    this.scene.events.on('card-unhover', (card) => {
      if (!this.draggedCard) {
        this.scene.events.emit('card-preview-hide');
      }
    });
    
    // Card preview events
    this.scene.events.on('card-preview-show', (cardData) => {
      this.zoneManager.showCardPreview(cardData);
    });
    
    this.scene.events.on('card-preview-hide', () => {
      this.zoneManager.hideCardPreview();
    });
  }

  setupAnimationEvents() {
    // Animation coordination events
    this.scene.events.on('leader-card-select-requested', (data) => {
      this.handleLeaderCardSelection(data);
    });
    
    this.scene.events.on('highlight-cards-for-redraw', () => {
      this.startRedrawHighlight();
    });
    
    this.scene.events.on('animate-cards-from-deck', (cardsToAdd) => {
      this.animationManager.animateCardsFromDeckToHand(
        cardsToAdd,
        this.zoneManager.getLayout(),
        this.uiManager.getHandContainer(),
        this.gameLogicManager.getPlayerHand()
      );
    });
    
    this.scene.events.on('shuffle-animation-complete', () => {
      this.handleShuffleComplete();
    });
  }

  setupAPIEvents() {
    // Online mode events
    if (this.scene.isOnlineMode && this.gameLogicManager.gameStateManager) {
      this.setupOnlineGameEvents();
    }
  }

  setupOnlineGameEvents() {
    const gameStateManager = this.gameLogicManager.gameStateManager;
    
    gameStateManager.addEventListener('ROOM_CREATED', (event) => {
      console.log('Room created event received:', event);
      this.uiManager.showRoomStatus('Room created - waiting for player 2...');
    });
    
    gameStateManager.addEventListener('PLAYER_JOINED', (event) => {
      console.log('Player joined event received:', event);
      this.uiManager.showRoomStatus('Both players joined - hands dealt!');
      this.displayGameInfo();
      this.showRedrawDialog();
    });
    
    gameStateManager.addEventListener('PLAYER_READY', (event) => {
      console.log('Player ready event received:', event);
      this.uiManager.showRoomStatus(`Player ${event.data.playerId} is ready!`);
    });
    
    gameStateManager.addEventListener('GAME_PHASE_START', (event) => {
      console.log('Game phase start event received - both players ready!', event);
      this.uiManager.showRoomStatus('Game started!');
      if (this.scene.waitingForPlayers) {
        this.scene.waitingForPlayers = false;
        this.startShuffleAnimation();
      }
    });
    
    gameStateManager.addEventListener('INITIAL_HAND_DEALT', (event) => {
      console.log('Initial hand dealt event received:', event);
    });
  }

  // Event handlers
  handleCardDrop(data) {
    const { card, zoneType, position } = data;
    
    // Remove from hand
    const playerHand = this.gameLogicManager.getPlayerHand();
    const handIndex = playerHand.indexOf(card);
    if (handIndex > -1) {
      playerHand.splice(handIndex, 1);
      this.uiManager.getHandContainer().remove(card);
      this.scene.events.emit('hand-reorganize-needed', playerHand);
    }
    
    // Update game logic
    this.gameLogicManager.playCardToZone(card.getCardData(), zoneType);
  }

  handleLeaderCardSelection(data) {
    const { playerType, onComplete } = data;
    
    // Get appropriate zones and cards based on player type
    const zones = playerType === 'player' ? 
      this.zoneManager.getPlayerZones() : 
      this.zoneManager.getOpponentZones();
    
    const animationManager = this.animationManager.getShuffleAnimationManager();
    const leaderCardsArray = playerType === 'player' ? 
      animationManager?.playerLeaderCards : 
      animationManager?.opponentLeaderCards;
    
    const leaderDeckSource = playerType === 'player' ? 
      this.gameLogicManager.getPlayerLeaderCards() : 
      this.gameLogicManager.getOpponentLeaderCards();
    
    // Perform the selection animation
    this.animationManager.selectLeaderCard(
      playerType,
      leaderCardsArray,
      leaderDeckSource,
      zones,
      onComplete
    );
  }

  startRedrawHighlight() {
    // Set depths for dialog overlay
    const playerHand = this.gameLogicManager.getPlayerHand();
    this.animationManager.setCardsDepth(playerHand, 1001);
    
    if (this.uiManager.getHandContainer()) {
      this.uiManager.getHandContainer().setDepth(1001);
    }
    
    // Start highlight animations
    this.animationManager.highlightHandCards(playerHand);
    this.animationManager.highlightLeaderCards(
      this.zoneManager.getPlayerZones(),
      this.zoneManager.getOpponentZones()
    );
  }

  handleShuffleComplete() {
    this.zoneManager.showDeckStacks();
    this.uiManager.showHandArea();
    this.gameLogicManager.updateGameState();
    
    // Automatically select leader cards
    this.gameLogicManager.selectLeaderCard('player');
    this.gameLogicManager.selectLeaderCard('opponent');
  }

  // Complex event flows
  async startShuffleAnimation() {
    this.zoneManager.hideDeckStacks();
    
    await this.animationManager.playShuffleDeckAnimation(
      this.zoneManager.getLayout(),
      () => this.scene.events.emit('shuffle-animation-complete')
    );
  }

  showRedrawDialog() {
    const dialogButtons = [
      {
        text: 'Yes',
        tint: 0x4CAF50,
        callback: () => this.handleRedrawChoice(true)
      },
      {
        text: 'No',
        tint: 0xF44336,
        callback: () => this.handleRedrawChoice(false)
      }
    ];
    
    this.uiManager.createDialog(
      'Redraw Hand',
      'Do you want to redraw your hand?',
      dialogButtons
    );
  }

  handleRedrawChoice(wantRedraw) {
    // Remove highlights
    this.animationManager.removeAllHighlights(
      this.gameLogicManager.getPlayerHand(),
      this.zoneManager.getPlayerZones(),
      this.zoneManager.getOpponentZones()
    );
    
    // Reset depths
    this.resetCardDepths();
    
    // Handle the choice
    this.gameLogicManager.handleRedrawChoice(wantRedraw);
  }

  resetCardDepths() {
    const playerHand = this.gameLogicManager.getPlayerHand();
    this.animationManager.setCardsDepth(playerHand, 0);
    
    if (this.uiManager.getHandContainer()) {
      this.uiManager.getHandContainer().setDepth(0);
    }
    
    // Reset leader card depths
    const playerZones = this.zoneManager.getPlayerZones();
    const opponentZones = this.zoneManager.getOpponentZones();
    
    if (playerZones.leader && playerZones.leader.card) {
      playerZones.leader.card.setDepth(0);
    }
    if (playerZones.leaderDeck && playerZones.leaderDeck.card) {
      playerZones.leaderDeck.card.setDepth(0);
    }
    if (opponentZones.leader && opponentZones.leader.card) {
      opponentZones.leader.card.setDepth(0);
    }
    if (opponentZones.leaderDeck && opponentZones.leaderDeck.card) {
      opponentZones.leaderDeck.card.setDepth(0);
    }
  }

  updateUI() {
    const gameState = this.gameLogicManager.gameStateManager.getGameState();
    const player = this.gameLogicManager.gameStateManager.getPlayer();
    const opponent = this.gameLogicManager.gameStateManager.getOpponent();
    const opponentData = this.gameLogicManager.gameStateManager.getPlayer(opponent);
    
    // Check for READY_PHASE and trigger shuffle animation
    if (gameState.gameEnv.roomStatus === 'READY_PHASE' && !this.scene.shuffleAnimationPlayed) {
      console.log('READY_PHASE detected - triggering shuffle animation and redraw dialog');
      this.scene.shuffleAnimationPlayed = true;
      this.uiManager.showRoomStatus('Both players joined - hands dealt!');
      this.displayGameInfo();
      
      this.startShuffleAnimation().then(() => {
        this.showRedrawDialog();
      });
    }
    
    // Update UI elements
    const gameData = {
      playerName: gameState.playerName,
      playerVP: this.gameLogicManager.gameStateManager.getVictoryPoints(),
      playerHandCount: player ? player.hand.length : 0,
      opponentName: opponentData ? opponentData.name : 'Unknown',
      opponentVP: this.gameLogicManager.gameStateManager.getVictoryPoints(opponent),
      opponentHandCount: opponentData ? opponentData.hand.length : 0,
      round: gameState.gameEnv.round
    };
    
    this.uiManager.updateTopUI(gameData);
    this.uiManager.updatePhase(gameState.gameEnv.phase);
    this.uiManager.updateOpponentHandCount(gameData.opponentHandCount);
    
    // Update turn indicator
    const isCurrentPlayer = this.gameLogicManager.gameStateManager.isCurrentPlayer();
    this.uiManager.updateTurnIndicator(isCurrentPlayer);
  }

  displayGameInfo() {
    const gameState = this.gameLogicManager.gameStateManager.getGameState();
    const gameEnv = gameState.gameEnv;
    
    if (gameEnv && gameEnv.firstPlayer !== undefined) {
      const player1Id = gameEnv.playerId_1;
      const player2Id = gameEnv.playerId_2;
      const firstPlayerId = gameEnv.firstPlayer === 0 ? player1Id : player2Id;
      const isCurrentPlayerFirst = firstPlayerId === gameState.playerId;
      
      const firstPlayerText = isCurrentPlayerFirst ? 'You go first!' : 'Opponent goes first!';
      this.uiManager.showRoomStatus(`${firstPlayerText} (First player: ${firstPlayerId})`);
      
      // Update opponent hand count using existing display
      const opponentId = gameState.playerId === player1Id ? player2Id : player1Id;
      const opponentHandCount = gameEnv[opponentId]?.deck?.hand?.length || 0;
      this.uiManager.updateOpponentHandCount(opponentHandCount);
      
      console.log('Game Info:', {
        firstPlayer: firstPlayerId,
        currentPlayerIsFirst: isCurrentPlayerFirst,
        player1Hand: gameEnv[player1Id]?.deck?.hand?.length || 0,
        player2Hand: gameEnv[player2Id]?.deck?.hand?.length || 0
      });
    }
  }

  // Register custom event handler
  on(eventName, handler) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, []);
    }
    this.eventHandlers.get(eventName).push(handler);
    this.scene.events.on(eventName, handler);
  }

  // Emit custom event
  emit(eventName, data) {
    this.scene.events.emit(eventName, data);
  }

  // Clean up
  destroy() {
    // Remove all custom event handlers
    this.eventHandlers.forEach((handlers, eventName) => {
      handlers.forEach(handler => {
        this.scene.events.off(eventName, handler);
      });
    });
    this.eventHandlers.clear();
  }
}