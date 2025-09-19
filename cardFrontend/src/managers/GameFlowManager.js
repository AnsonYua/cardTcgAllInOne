/**
 * GameFlowManager - Handles game flow, phase transitions, and the complex updateUI logic
 * Extracted from GameScene.js to reduce complexity and improve maintainability
 */
export default class GameFlowManager {
  constructor(gameScene) {
    this.scene = gameScene;
    this.gameStateManager = gameScene.gameStateManager;
  }

  /**
   * Main game flow update method - extracted from GameScene.updateUI()
   * This was the largest method in GameScene (~140 lines)
   */
  updateGameFlow() {
    const gameState = this.gameStateManager.getGameState();
    
    // Handle scenario flag
    if (this.scene.isSetScenoria) {
      this.scene.isSetScenoria = false;
      this.scene.updatePlayerHand();
    }

    // Process unprocessed events
    if (this.handleUnprocessedEvents()) {
      return; // Stop if events are being processed
    }

    // Process event queue
    if (this.handleEventQueue()) {
      return; // Stop if blocking event was processed
    }

    // Handle phase-specific logic
    this.handlePhaseLogic(gameState);

    // Handle redraw confirmation
    this.handleRedrawConfirmation();

    // Update UI elements
    this.updateGameUIElements(gameState);
  }

  /**
   * Handle unprocessed events from game state
   */
  handleUnprocessedEvents() {
    const unprocessedEvent = this.gameStateManager.getUnprocessGameEvents();
    if (unprocessedEvent.length > 0) {
      this.gameStateManager.processEventQueue(
        (event) => this.scene.handleSingleEvent(event),
        () => {
          console.log('[GameFlowManager] All events processed, continuing with game flow');
          this.updateGameFlow();
        }
      );
      return true;
    }
    return false;
  }

  /**
   * Handle event processor queue
   */
  handleEventQueue() {
    const eventProcessed = this.scene.eventProcessor.processAllEvents();
    if (eventProcessed) {
      console.log('[GameFlowManager] Event processed by EventProcessor, stopping UI update');
      return true;
    }
    return false;
  }

  /**
   * Handle phase-specific game logic
   */
  handlePhaseLogic(gameState) {
    const currentPhase = gameState.gameEnv.phase;
    
    console.log('Game flow - phase:', currentPhase, 'shuffleAnimationPlayed:', this.scene.shuffleAnimationPlayed);

    // Test mode logic
    if (this.scene.isTestMode && currentPhase === 'MAIN_PHASE') {
      this.handleTestModeMainPhase();
    }

    // Redraw phase logic
    if (currentPhase === 'REDRAW_PHASE' && !this.scene.shuffleAnimationPlayed) {
      this.handleRedrawPhase(gameState);
    }
  }

  /**
   * Handle test mode main phase
   */
  handleTestModeMainPhase() {
    this.scene.displayGameInfo();
    this.scene.showDeckStacks();
    this.scene.showHandArea();
  }

  /**
   * Handle redraw phase with animation sequence
   */
  handleRedrawPhase(gameState) {
    console.log('REDRAW_PHASE detected - triggering shuffle animation and redraw dialog');
    console.log('Game state during REDRAW_PHASE:', JSON.stringify(gameState, null, 2));
    
    this.scene.shuffleAnimationPlayed = true;
    this.scene.showRoomStatus('Both players joined - hands dealt!');
    this.scene.displayGameInfo();

    this.loadResourcesAndAnimate();
  }

  /**
   * Load resources and trigger animation sequence
   */
  async loadResourcesAndAnimate() {
    try {
      await this.scene.loadCardResources();
      console.log('[GameFlowManager] Card resources loaded, starting shuffle animation');
      
      if (!this.scene.firstShuffleAnimationComplete) {
        await this.scene.playShuffleDeckAnimation();
        console.log('Shuffle animation completed, updating hand and showing redraw dialog');
        this.scene.firstShuffleAnimationComplete = true;
        this.scene.updatePlayerHand();
        this.scene.showRedrawDialog();
      }
    } catch (error) {
      console.warn('[GameFlowManager] Failed to load card resources, proceeding with fallback:', error);
      await this.handleAnimationFallback();
    }
  }

  /**
   * Handle animation fallback when resource loading fails
   */
  async handleAnimationFallback() {
    await this.scene.playShuffleDeckAnimation();
    console.log('Shuffle animation completed (with resource loading fallback)');
    this.scene.updatePlayerHand();
  }

  /**
   * Handle redraw confirmation logic
   */
  handleRedrawConfirmation() {
    if (this.gameStateManager.getPlayer().confirmIsRedraw && 
        this.scene.firstShuffleAnimationComplete) {
      this.scene.updatePlayerHand();
    }
  }

  /**
   * Update UI elements based on game state
   */
  updateGameUIElements(gameState) {
    const currentPhase = gameState.gameEnv.phase;
    const currentPlayer = gameState.gameEnv.currentPlayer;
    
    // Update phase indicator
    if (currentPhase) {
      this.scene.updatePhaseIndicator(currentPhase, currentPlayer);
    }

    // Update current turn display
    this.scene.updateCurrentTurnDisplay(currentPlayer);

    // Update opponent hand count
    this.updateOpponentHandCount();

    // Update turn indicator
    this.updateTurnIndicator();
  }

  /**
   * Update opponent hand count display
   */
  updateOpponentHandCount() {
    if (this.scene.opponentHandCountText) {
      const opponent = this.gameStateManager.getOpponent();
      const opponentData = this.gameStateManager.getPlayer(opponent);
      const opponentHandCount = opponentData && opponentData.deck?.hand ? opponentData.deck.hand.length : 0;
      this.scene.opponentHandCountText.setText(`Opponent Hand: ${opponentHandCount}`);
    }
  }

  /**
   * Update turn indicator button
   */
  updateTurnIndicator() {
    const isCurrentPlayer = this.gameStateManager.isCurrentPlayer();
    this.scene.endTurnButton.setTint(isCurrentPlayer ? 0xffffff : 0x888888);
  }
}