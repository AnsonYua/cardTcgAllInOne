// Test suite for Card Effect Execution System
const request = require('supertest');
const { app, server } = require('../../server');

const API_BASE = 'http://localhost:8080';

describe('Card Effect Execution System', () => {
  let gameId;
  let playerId1 = 'test-player-1';
  let playerId2 = 'test-player-2';

  beforeAll(() => {
    // Server is already started by setup.js
  });

  afterAll(() => {
    // Server cleanup handled by teardown.js
  });

  beforeEach(() => {
    gameId = 'test-effects-' + Date.now();
  });

  describe('Play Sequence Recording', () => {
    test('should record leader plays during game setup', async () => {
      // Create game
      const createResponse = await request(app)
        .post('/game/create')
        .send({ playerId: playerId1 });
      
      expect(createResponse.status).toBe(200);
      gameId = createResponse.body.gameEnv.gameId || createResponse.body.gameId;

      // Player 2 joins
      await request(app)
        .post('/game/join')
        .send({ playerId: playerId2, gameId });

      // Both players ready
      await request(app)
        .post('/game/ready')
        .send({ playerId: playerId1, gameId, isRedraw: false });

      const readyResponse = await request(app)
        .post('/game/ready')
        .send({ playerId: playerId2, gameId, isRedraw: false });

      expect(readyResponse.status).toBe(200);
      
      // Check that play sequence contains leader plays
      const gameEnv = readyResponse.body.gameEnv;
      expect(gameEnv.playSequence).toBeDefined();
      expect(gameEnv.playSequence.plays).toBeDefined();
      
      const leaderPlays = gameEnv.playSequence.plays.filter(p => p.action === 'PLAY_LEADER');
      expect(leaderPlays.length).toBe(2); // One for each player
      
      // Check leader play structure
      const leaderPlay = leaderPlays[0];
      expect(leaderPlay.sequenceId).toBeDefined();
      expect(leaderPlay.playerId).toBeDefined();
      expect(leaderPlay.cardId).toBeDefined();
      expect(leaderPlay.action).toBe('PLAY_LEADER');
      expect(leaderPlay.zone).toBe('leader');
      expect(leaderPlay.data.isInitialPlacement).toBe(true);
    });

    test('should record card plays during game', async () => {
      // Set up a game state with both players ready
      const gameLogic = require('../../src/services/GameLogic');
      
      // Create test game state with leaders already placed
      const testGameEnv = {
        phase: 'MAIN_PHASE',
        currentPlayer: playerId1,
        currentTurn: 1,
        playerId_1: playerId1,
        playerId_2: playerId2,
        [playerId1]: {
          deck: {
            hand: ['c-7'], // Trump card
            mainDeck: ['c-1', 'c-2'],
            leader: ['S002'],
            currentLeaderIdx: 0
          },
          Field: {
            leader: { id: 'S002', name: '拜登' },
            top: [],
            left: [],
            right: [],
            help: [],
            sp: []
          },
          turnAction: []
        },
        [playerId2]: {
          deck: {
            hand: ['h-nullify'], // Power nullification card
            mainDeck: ['c-3', 'c-4'],
            leader: ['S001'],
            currentLeaderIdx: 0
          },
          Field: {
            leader: { id: 'S001', name: '特朗普' },
            top: [],
            left: [],
            right: [],
            help: [],
            sp: []
          },
          turnAction: []
        },
        playSequence: {
          globalSequence: 2,
          plays: [
            {
              sequenceId: 1,
              playerId: playerId1,
              cardId: 'S002',
              action: 'PLAY_LEADER',
              zone: 'leader',
              data: { isInitialPlacement: true }
            },
            {
              sequenceId: 2,
              playerId: playerId2,
              cardId: 'S001',
              action: 'PLAY_LEADER',
              zone: 'leader',
              data: { isInitialPlacement: true }
            }
          ]
        },
        computedState: {
          playerPowers: {},
          activeRestrictions: {},
          disabledCards: [],
          victoryPointModifiers: {}
        }
      };

      // Inject test state
      await gameLogic.injectGameState(gameId, testGameEnv);

      // Player 1 plays Trump card
      const playResponse = await request(app)
        .post('/game/playerAction')
        .send({
          playerId: playerId1,
          gameId,
          action: {
            actionType: 'PlayCard',
            cardId: 'c-7',
            zone: 'top'
          }
        });

      expect(playResponse.status).toBe(200);
      
      // Check play sequence updated
      const gameEnv = playResponse.body.gameEnv;
      expect(gameEnv.playSequence.plays.length).toBe(3); // 2 leaders + 1 card
      
      const cardPlay = gameEnv.playSequence.plays.find(p => p.cardId === 'c-7');
      expect(cardPlay).toBeDefined();
      expect(cardPlay.action).toBe('PLAY_CARD');
      expect(cardPlay.zone).toBe('top');
      expect(cardPlay.playerId).toBe(playerId1);
    });
  });

  describe('Trump Disable Effect', () => {
    test('should disable opponent SP and HELP cards when Trump is on field', async () => {
      const gameLogic = require('../../src/services/GameLogic');
      
      // Create test game state with Trump card on field
      const testGameEnv = {
        phase: 'MAIN_PHASE',
        currentPlayer: playerId2,
        currentTurn: 2,
        playerId_1: playerId1,
        playerId_2: playerId2,
        [playerId1]: {
          deck: { hand: [], mainDeck: [], leader: ['S002'], currentLeaderIdx: 0 },
          Field: {
            leader: { id: 'S002', name: '拜登' },
            top: [{ id: 'c-7', name: '特朗普(天選之人)', power: 100, gameType: '愛國者' }],
            left: [],
            right: [],
            help: [],
            sp: []
          },
          turnAction: []
        },
        [playerId2]: {
          deck: { hand: ['h-1'], mainDeck: [], leader: ['S001'], currentLeaderIdx: 0 },
          Field: {
            leader: { id: 'S001', name: '特朗普' },
            top: [],
            left: [],
            right: [],
            help: [{ id: 'h-1', name: 'Test Help Card', cardType: 'help' }],
            sp: [{ id: 'sp-1', name: 'Test SP Card', cardType: 'sp' }]
          },
          turnAction: []
        },
        playSequence: {
          globalSequence: 4,
          plays: [
            { sequenceId: 1, playerId: playerId1, cardId: 'S002', action: 'PLAY_LEADER', zone: 'leader' },
            { sequenceId: 2, playerId: playerId2, cardId: 'S001', action: 'PLAY_LEADER', zone: 'leader' },
            { sequenceId: 3, playerId: playerId1, cardId: 'c-7', action: 'PLAY_CARD', zone: 'top' },
            { sequenceId: 4, playerId: playerId2, cardId: 'h-1', action: 'PLAY_CARD', zone: 'help' }
          ]
        }
      };

      // Inject and get computed state
      const result = await gameLogic.injectGameState(gameId, testGameEnv);
      
      // Check computed state for disabled cards
      const computedState = result.gameEnv.computedState;
      expect(computedState).toBeDefined();
      expect(computedState.disabledCards).toBeDefined();
      
      // Should have disabled cards for player 2
      const disabledCards = computedState.disabledCards.filter(d => d.playerId === playerId2);
      expect(disabledCards.length).toBeGreaterThan(0);
      
      // Check that help and SP cards are disabled
      const disabledCardIds = disabledCards.map(d => d.cardId);
      expect(disabledCardIds).toContain('h-1');
      expect(disabledCardIds).toContain('sp-1');
    });
  });

  describe('Power Nullification Effect', () => {
    test('should nullify opponent character card power', async () => {
      const gameLogic = require('../../src/services/GameLogic');
      
      // Create test game state with power nullification card
      const testGameEnv = {
        phase: 'MAIN_PHASE',
        currentPlayer: playerId2,
        currentTurn: 2,
        playerId_1: playerId1,
        playerId_2: playerId2,
        [playerId1]: {
          deck: { hand: [], mainDeck: [], leader: ['S002'], currentLeaderIdx: 0 },
          Field: {
            leader: { id: 'S002', name: '拜登' },
            top: [],
            left: [],
            right: [],
            help: [{ id: 'h-nullify', name: '能力封印', cardType: 'help' }],
            sp: []
          },
          turnAction: []
        },
        [playerId2]: {
          deck: { hand: [], mainDeck: [], leader: ['S001'], currentLeaderIdx: 0 },
          Field: {
            leader: { id: 'S001', name: '特朗普' },
            top: [{ id: 'c-1', name: '總統特朗普', power: 100, gameType: '愛國者' }],
            left: [],
            right: [],
            help: [],
            sp: []
          },
          turnAction: []
        },
        playSequence: {
          globalSequence: 4,
          plays: [
            { sequenceId: 1, playerId: playerId1, cardId: 'S002', action: 'PLAY_LEADER', zone: 'leader' },
            { sequenceId: 2, playerId: playerId2, cardId: 'S001', action: 'PLAY_LEADER', zone: 'leader' },
            { sequenceId: 3, playerId: playerId2, cardId: 'c-1', action: 'PLAY_CARD', zone: 'top' },
            { sequenceId: 4, playerId: playerId1, cardId: 'h-nullify', action: 'PLAY_CARD', zone: 'help' }
          ]
        }
      };

      // Inject and get computed state
      const result = await gameLogic.injectGameState(gameId, testGameEnv);
      
      // Check computed state for power modifications
      const computedState = result.gameEnv.computedState;
      expect(computedState).toBeDefined();
      expect(computedState.playerPowers).toBeDefined();
      
      // Check that opponent's card power is nullified
      const player2Powers = computedState.playerPowers[playerId2];
      expect(player2Powers).toBeDefined();
      
      const trumpCardPower = player2Powers['c-1'];
      expect(trumpCardPower).toBeDefined();
      expect(trumpCardPower.originalPower).toBe(100);
      expect(trumpCardPower.finalPower).toBe(0); // Should be nullified
    });
  });

  describe('Effect Replay Consistency', () => {
    test('should produce consistent results when replaying same sequence', async () => {
      const gameLogic = require('../../src/services/GameLogic');
      const effectSimulator = require('../../src/services/EffectSimulator');
      
      // Create test game state
      const testGameEnv = {
        phase: 'MAIN_PHASE',
        playerId_1: playerId1,
        playerId_2: playerId2,
        [playerId1]: {
          Field: {
            leader: { id: 'S002', name: '拜登' },
            top: [{ id: 'c-7', name: '特朗普(天選之人)', power: 100 }],
            left: [], right: [], help: [], sp: []
          }
        },
        [playerId2]: {
          Field: {
            leader: { id: 'S001', name: '特朗普' },
            top: [], left: [], right: [],
            help: [{ id: 'h-1', name: 'Test Help Card', cardType: 'help' }],
            sp: []
          }
        },
        playSequence: {
          globalSequence: 3,
          plays: [
            { sequenceId: 1, playerId: playerId1, cardId: 'S002', action: 'PLAY_LEADER', zone: 'leader' },
            { sequenceId: 2, playerId: playerId2, cardId: 'S001', action: 'PLAY_LEADER', zone: 'leader' },
            { sequenceId: 3, playerId: playerId1, cardId: 'c-7', action: 'PLAY_CARD', zone: 'top' }
          ]
        }
      };

      // Set up effect simulator
      effectSimulator.setCardInfoUtils(require('../../src/mozGame/mozGamePlay').cardInfoUtils);
      
      // Run simulation multiple times
      const result1 = effectSimulator.simulateCardPlaySequence(testGameEnv);
      const result2 = effectSimulator.simulateCardPlaySequence(testGameEnv);
      const result3 = effectSimulator.simulateCardPlaySequence(testGameEnv);
      
      // Results should be identical
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
      
      // Should have disabled cards for player 2
      expect(result1.disabledCards.length).toBeGreaterThan(0);
      expect(result1.disabledCards[0].playerId).toBe(playerId2);
    });
  });
});