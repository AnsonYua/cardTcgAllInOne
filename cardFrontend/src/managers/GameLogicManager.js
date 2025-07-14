// GameLogicManager.js - Handles pure game logic, state management, and business rules
import { GAME_CONFIG } from '../config/gameConfig.js';
import Card from '../components/Card.js';

export default class GameLogicManager {
  constructor(scene) {
    this.scene = scene;
    this.playerHand = [];
    this.leaderCards = [];
    this.playerLeaderCards = [];
    this.opponentLeaderCards = [];
    this.leaderCardsPlaced = 0;
  }

  init(gameStateManager, apiManager, isOnlineMode) {
    this.gameStateManager = gameStateManager;
    this.apiManager = apiManager;
    this.isOnlineMode = isOnlineMode;
  }

  // Game state update logic
  async updateGameState() {
    await this.updatePlayerHand();
    this.scene.events.emit('zones-update-needed');
    this.scene.events.emit('ui-update-needed');
  }

  async updatePlayerHand() {
    // Clear existing hand
    this.playerHand.forEach(card => card.destroy());
    this.playerHand = [];
    
    // Get hand from game state
    const gameState = this.gameStateManager.getGameState();
    const playerId = this.gameStateManager.gameState.playerId;
    
    let hand = this.gameStateManager.getPlayerHand();
    
    // Fallback logic for finding hand data
    if (!hand || hand.length === 0) {
      hand = this.findHandDataFallback(gameState, playerId);
    }
    
    if (!hand || hand.length === 0) {
      console.log('No hand data found, returning early');
      return;
    }
    
    // Process and create cards
    const processedCards = await this.processHandCards(hand);
    this.playerHand = processedCards;
    
    // Emit event for UI to handle visual updates
    this.scene.events.emit('hand-updated', this.playerHand);
  }

  findHandDataFallback(gameState, playerId) {
    console.log('Standard getPlayerHand failed, trying direct access...');
    
    if (gameState.gameEnv[playerId]) {
      if (gameState.gameEnv[playerId].hand) {
        return gameState.gameEnv[playerId].hand;
      } else if (gameState.gameEnv[playerId].deck && gameState.gameEnv[playerId].deck.hand) {
        return gameState.gameEnv[playerId].deck.hand;
      }
    }
    
    // Use mock data for testing
    console.log('No hand data found anywhere, using mock data for testing...');
    return this.createMockHandData();
  }

  async processHandCards(hand) {
    const processedCards = [];
    
    hand.forEach((cardData, index) => {
      // Convert card ID string to card object if needed
      let processedCardData = cardData;
      if (typeof cardData === 'string') {
        processedCardData = {
          id: cardData,
          name: cardData,
          cardType: this.getCardTypeFromId(cardData)
        };
      }
      
      const card = new Card(this.scene, 0, 0, processedCardData, {
        interactive: true,
        draggable: true,
        scale: 1.1,
        usePreview: true
      });
      
      // Set up drag and drop
      this.scene.input.setDraggable(card);
      processedCards.push(card);
    });
    
    return processedCards;
  }

  // Card playing logic
  playCardToZone(cardData, zoneType) {
    console.log(`Playing card ${cardData.id} to ${zoneType} zone`);
    
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
    
    this.scene.events.emit('hand-reorganize-needed', this.playerHand);
  }

  // Leader card management
  async loadLeaderCardsData() {
    try {
      console.log('Loading leader cards data...');
      
      // Try API first if online
      if (this.isOnlineMode && this.gameStateManager) {
        const apiData = await this.loadLeaderCardsFromAPI();
        if (apiData) return;
      }
      
      // Fallback to static file
      await this.loadLeaderCardsFromFile();
    } catch (error) {
      console.error('Error loading leader cards data:', error);
    }
  }

  async loadLeaderCardsFromAPI() {
    const gameState = this.gameStateManager.getGameState();
    const player = this.gameStateManager.getPlayer();
    
    if (player && player.deck && player.deck.leader) {
      console.log('Loading leader cards from API game state:', player.deck.leader);
      
      const baseLeaderCards = await this.convertCardIdsToObjects(player.deck.leader, 'leader');
      this.setupLeaderCardDecks(baseLeaderCards);
      return true;
    }
    return false;
  }

  async loadLeaderCardsFromFile() {
    console.log('Loading leader cards from static file (demo mode)...');
    const response = await fetch('/leaderCards.json');
    const mockData = await response.json();
    
    if (mockData.success) {
      console.log('Leader cards data loaded from file:', mockData.data);
      const baseLeaderCards = mockData.data.leaderCards;
      this.setupLeaderCardDecks(baseLeaderCards);
    }
  }

  setupLeaderCardDecks(baseLeaderCards) {
    // Create separate shuffled decks for player and opponent
    this.playerLeaderCards = [...baseLeaderCards];
    this.opponentLeaderCards = [...baseLeaderCards];
    
    // Shuffle both decks separately
    this.shuffleArray(this.playerLeaderCards);
    this.shuffleArray(this.opponentLeaderCards);
    
    // Backwards compatibility
    this.leaderCards = this.playerLeaderCards;
    
    console.log('Leader cards setup complete');
  }

  selectLeaderCard(playerType = 'player') {
    // Emit event for animation manager to handle
    this.scene.events.emit('leader-card-select-requested', {
      playerType,
      onComplete: (cardData) => this.onLeaderCardPlaced(playerType, cardData)
    });
  }

  onLeaderCardPlaced(playerType, cardData) {
    this.leaderCardsPlaced++;
    
    // Start highlighting after both leader cards are placed
    if (this.leaderCardsPlaced === 2) {
      console.log('Both leader cards placed, starting highlight animations');
      this.scene.events.emit('highlight-cards-for-redraw');
    }
  }

  // Game actions
  endTurn() {
    if (!this.gameStateManager.isCurrentPlayer()) {
      console.log('Not your turn');
      return;
    }
    
    console.log('Ending turn...');
    // API call logic would go here
  }

  // Test methods
  async testAddCard() {
    try {
      console.log('Loading add card data...');
      const response = await fetch('/addNewHand.json');
      const addCardData = await response.json();
      
      if (addCardData.success) {
        const { playerId, handCardsToAdd } = addCardData.data;
        const isPlayerTarget = playerId === 'player-1';
        
        if (isPlayerTarget) {
          this.addCardsToPlayerHand(handCardsToAdd);
        } else {
          this.addCardsToOpponentHand(handCardsToAdd);
        }
      }
    } catch (error) {
      console.error('Error loading add card data:', error);
    }
  }

  addCardsToPlayerHand(cardsToAdd) {
    // Update game state
    const gameState = this.gameStateManager.getGameState();
    const player = this.gameStateManager.getPlayer();
    
    if (!player || !player.hand) {
      console.error('Player hand not found');
      return;
    }

    const updatedHand = [...player.hand, ...cardsToAdd];
    
    this.gameStateManager.updateGameEnv({
      players: {
        ...gameState.gameEnv.players,
        [gameState.playerId]: {
          ...player,
          hand: updatedHand
        }
      }
    });

    // Emit event for animation
    this.scene.events.emit('animate-cards-from-deck', cardsToAdd);
  }

  addCardsToOpponentHand(cardsToAdd) {
    // Similar logic for opponent
    const gameState = this.gameStateManager.getGameState();
    const opponent = this.gameStateManager.getOpponent();
    const opponentData = this.gameStateManager.getPlayer(opponent);
    
    if (!opponentData || !opponentData.hand) {
      console.error('Opponent hand not found');
      return;
    }

    const updatedOpponentHand = [...opponentData.hand, ...cardsToAdd];
    
    this.gameStateManager.updateGameEnv({
      players: {
        ...gameState.gameEnv.players,
        [opponent]: {
          ...opponentData,
          hand: updatedOpponentHand
        }
      }
    });

    this.scene.events.emit('ui-update-needed');
  }

  // API integration
  async testPolling() {
    if (!this.isOnlineMode || !this.apiManager) {
      console.log('Not in online mode or no API manager available');
      return;
    }

    const gameState = this.gameStateManager.getGameState();
    console.log('Manual polling test triggered...');
    
    try {
      const response = await this.apiManager.getPlayer(gameState.playerId, gameState.gameId);
      
      if (response && response.gameEnv) {
        console.log('Polling response received:', response);
        this.gameStateManager.updateGameEnv(response.gameEnv);
        
        await this.gameStateManager.acknowledgeEvents(this.apiManager);
        await this.updateGameState();
        
        console.log('Manual polling completed successfully');
      }
    } catch (error) {
      console.error('Manual polling failed:', error);
      this.handlePollingError(error);
    }
  }

  handlePollingError(error) {
    if (error.message.includes('404')) {
      console.log('Game not found on backend. In demo mode, you need to create the game on backend first.');
    }
  }

  async simulatePlayer2Join() {
    try {
      const gameState = this.gameStateManager.getGameState();
      const gameId = gameState.gameId;
      
      if (!gameId) {
        throw new Error('No gameId found. Make sure game was created first.');
      }
      
      const response = await this.apiManager.joinRoom(gameId, 'Demo Opponent');
      console.log('Player 2 join response:', response);
      
      this.scene.events.emit('room-status', 'Player 2 joined! Use polling to see changes.');
    } catch (error) {
      console.error('Failed to simulate player 2 join:', error);
      this.scene.events.emit('room-status', 'Failed to simulate player 2 join: ' + error.message);
    }
  }

  async handleRedrawChoice(wantRedraw) {
    try {
      const gameState = this.gameStateManager.getGameState();
      console.log(`Player chose redraw: ${wantRedraw}`);
      
      await this.apiManager.startReady(gameState.playerId, gameState.gameId, wantRedraw);
      
      this.scene.events.emit('room-status', `Ready sent (redraw: ${wantRedraw}). Poll to see if both players ready.`);
    } catch (error) {
      console.error('Failed to send ready status:', error);
      this.scene.events.emit('room-status', 'Failed to send ready status: ' + error.message);
    }
  }

  // Utility methods
  async convertCardIdsToObjects(cardIds, cardType) {
    return cardIds.map(cardId => ({
      id: cardId,
      name: cardId,
      type: cardType || this.getCardTypeFromId(cardId),
      power: cardType === 'character' ? Math.floor(Math.random() * 5) + 1 : undefined
    }));
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  getCardTypeFromId(cardId) {
    if (cardId.startsWith('c-')) return 'character';
    if (cardId.startsWith('h-')) return 'help';
    if (cardId.startsWith('sp-')) return 'sp';
    if (cardId.startsWith('s-')) return 'leader';
    return 'unknown';
  }

  createMockHandData() {
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
        
        this.gameStateManager.initializeGame('mock-game', mockData.data.playerId, 'Test Player');
        
        this.gameStateManager.updateGameEnv({
          phase: GAME_CONFIG.phases.MAIN,
          currentPlayer: mockData.data.playerId,
          players: {
            [mockData.data.playerId]: {
              id: mockData.data.playerId,
              name: 'Test Player',
              hand: mockData.data.handCards
            },
            'opponent-1': {
              id: 'opponent-1',
              name: 'Opponent',
              hand: []
            }
          }
        });
        
        console.log('Mock game state setup complete');
      }
    } catch (error) {
      console.error('Error loading mock hand data:', error);
    }
  }

  // Getters
  getPlayerHand() {
    return this.playerHand;
  }

  getLeaderCards() {
    return this.leaderCards;
  }

  getPlayerLeaderCards() {
    return this.playerLeaderCards;
  }

  getOpponentLeaderCards() {
    return this.opponentLeaderCards;
  }

  // Clean up
  destroy() {
    this.playerHand.forEach(card => card.destroy());
    this.playerHand = [];
    this.leaderCards = [];
    this.playerLeaderCards = [];
    this.opponentLeaderCards = [];
  }
}