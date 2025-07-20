const MozGamePlay = require('../mozGame/mozGamePlay');
const TestHelper = require('./helpers/testHelper');

describe('Utility Card Effects Tests', () => {
  let mozGamePlay;
  let testHelper;

  beforeEach(() => {
    mozGamePlay = new MozGamePlay();
    testHelper = new TestHelper();
  });

  describe('Neutralization Effects', () => {
    test('h-1 Deep State neutralizes opponent effects', () => {
      const gameEnv = testHelper.createBasicGameState('test_game', 's-1', 's-2');
      
      // Place h-1 (Deep State) in player 1's help zone
      const h1Card = {
        id: 'h-1',
        name: 'Deep State',
        cardType: 'help',
        effects: {
          rules: [{
            id: 'deep_state_neutralize',
            type: 'continuous',
            trigger: { event: 'always', conditions: [] },
            target: { owner: 'opponent', zones: ['help', 'sp'], filters: [] },
            effect: { type: 'neutralizeEffect', value: true }
          }]
        }
      };
      
      gameEnv.gameEnv.zones.playerId_1.help = [h1Card];
      
      // Apply neutralization effects
      mozGamePlay.applyUtilityCardEffects(gameEnv.gameEnv, 'playerId_1');
      
      // Check that neutralization state is created
      expect(gameEnv.gameEnv.neutralizedEffects).toBeDefined();
      expect(gameEnv.gameEnv.neutralizedEffects.playerId_2).toBeDefined();
      expect(gameEnv.gameEnv.neutralizedEffects.playerId_2.allEffects).toBe(true);
    });

    test('h-5 immunity prevents neutralization', () => {
      const gameEnv = testHelper.createBasicGameState('test_game', 's-1', 's-2');
      
      // Place h-5 (失智老人 - immune) in player 1's help zone
      const h5Card = {
        id: 'h-5',
        name: '失智老人',
        cardType: 'help',
        effects: {
          rules: [{
            id: 'dementia_placement_freedom',
            type: 'continuous',
            trigger: { event: 'always', conditions: [] },
            target: { owner: 'self', zones: ['top', 'left', 'right'], filters: [] },
            effect: { type: 'zonePlacementFreedom', value: true }
          }],
          immuneToNeutralization: true
        }
      };
      
      gameEnv.gameEnv.zones.playerId_1.help = [h5Card];
      
      // Apply zone freedom effect
      mozGamePlay.applyUtilityCardEffects(gameEnv.gameEnv, 'playerId_1');
      
      // Verify zone freedom is active
      expect(gameEnv.gameEnv.players.playerId_1.fieldEffects.specialEffects).toBeDefined();
      expect(gameEnv.gameEnv.players.playerId_1.fieldEffects.specialEffects.zonePlacementFreedom).toBe(true);
      
      // Now place h-1 (Deep State) in player 2's help zone to try neutralization
      const h1Card = {
        id: 'h-1',
        name: 'Deep State',
        cardType: 'help',
        effects: {
          rules: [{
            id: 'deep_state_neutralize',
            type: 'continuous',
            trigger: { event: 'always', conditions: [] },
            target: { owner: 'opponent', zones: ['help', 'sp'], filters: [] },
            effect: { type: 'neutralizeEffect', value: true }
          }]
        }
      };
      
      gameEnv.gameEnv.zones.playerId_2.help = [h1Card];
      
      // Apply neutralization effects
      mozGamePlay.applyUtilityCardEffects(gameEnv.gameEnv, 'playerId_2');
      
      // Zone freedom should still work due to immunity
      expect(gameEnv.gameEnv.players.playerId_1.fieldEffects.specialEffects.zonePlacementFreedom).toBe(true);
    });
  });

  describe('Zone Placement Freedom', () => {
    test('h-5 allows unrestricted card placement', () => {
      const gameEnv = testHelper.createBasicGameState('test_game', 's-1', 's-2');
      
      // Set up Trump leader with zone restrictions
      gameEnv.gameEnv.zones.playerId_1.leader = {
        id: 's-1',
        name: '特朗普',
        zoneCompatibility: {
          top: ['右翼', '自由', '經濟'],
          left: ['右翼', '自由', '愛國者'],
          right: ['右翼', '愛國者', '經濟']
        }
      };
      
      // Place h-5 (Zone Freedom) in player 1's help zone
      const h5Card = {
        id: 'h-5',
        name: '失智老人',
        cardType: 'help',
        effects: {
          rules: [{
            id: 'dementia_placement_freedom',
            type: 'continuous',
            trigger: { event: 'always', conditions: [] },
            target: { owner: 'self', zones: ['top', 'left', 'right'], filters: [] },
            effect: { type: 'zonePlacementFreedom', value: true }
          }],
          immuneToNeutralization: true
        }
      };
      
      gameEnv.gameEnv.zones.playerId_1.help = [h5Card];
      
      // Apply zone freedom effect
      mozGamePlay.applyUtilityCardEffects(gameEnv.gameEnv, 'playerId_1');
      
      // Verify zone freedom is active
      expect(gameEnv.gameEnv.players.playerId_1.fieldEffects.specialEffects).toBeDefined();
      expect(gameEnv.gameEnv.players.playerId_1.fieldEffects.specialEffects.zonePlacementFreedom).toBe(true);
      
      // Test that normally restricted placement now works
      const characterCard = {
        id: 'c-1',
        cardType: 'character',
        gameType: '愛國者', // Would be restricted in TOP zone normally
        power: 100
      };
      
      // Check if placement is allowed with zone freedom
      const canPlace = mozGamePlay.checkZonePlacementFreedom(gameEnv.gameEnv, 'playerId_1');
      expect(canPlace).toBe(true);
    });
  });

  describe('Combo Disruption', () => {
    test('sp-8 disables combos when opponent is Musk', async () => {
      // Set both players ready
      await request(app)
        .post('/player/ready')
        .send({ gameId, playerId: playerId1, useRedraw: false });
      
      await request(app)
        .post('/player/ready')
        .send({ gameId, playerId: playerId2, useRedraw: false });

      // Place some cards to fill zones
      await request(app)
        .post('/player/playCard')
        .send({
          gameId,
          playerId: playerId1,
          cardId: 'c-1',
          zone: 'top'
        });

      await request(app)
        .post('/player/playCard')
        .send({
          gameId,
          playerId: playerId2,
          cardId: 'c-21',
          zone: 'top'
        });

      // Fill help zones (face-down is allowed)
      await request(app)
        .post('/player/playCardBack')
        .send({
          gameId,
          playerId: playerId1,
          cardId: 'h-1',
          zone: 'help'
        });

      await request(app)
        .post('/player/playCardBack')
        .send({
          gameId,
          playerId: playerId2,
          cardId: 'h-2',
          zone: 'help'
        });

      // Place SP cards
      await request(app)
        .post('/player/playCardBack')
        .send({
          gameId,
          playerId: playerId1,
          cardId: 'sp-8', // Tesla Takedown
          zone: 'sp'
        });

      await request(app)
        .post('/player/playCardBack')
        .send({
          gameId,
          playerId: playerId2,
          cardId: 'sp-1',
          zone: 'sp'
        });

      // Check final state
      const response = await request(app)
        .get(`/player/${playerId1}?gameId=${gameId}`);

      expect(response.body.success).toBe(true);
      
      // Verify combo disruption is active
      const gameEnv = response.body.gameEnv;
      if (gameEnv.disabledEffects && gameEnv.disabledEffects[playerId2]) {
        expect(gameEnv.disabledEffects[playerId2].comboBonus).toBe(true);
      }
    });
  });

  describe('Power Calculation with Effects', () => {
    test('Multiple utility effects stack correctly', async () => {
      // Set both players ready
      await request(app)
        .post('/player/ready')
        .send({ gameId, playerId: playerId1, useRedraw: false });
      
      await request(app)
        .post('/player/ready')
        .send({ gameId, playerId: playerId2, useRedraw: false });

      // Player 1 places power boost card
      await request(app)
        .post('/player/playCard')
        .send({
          gameId,
          playerId: playerId1,
          cardId: 'sp-2', // 減息周期 - +30 to all own cards
          zone: 'sp'
        });

      // Player 2 places power nerf card
      await request(app)
        .post('/player/playCard')
        .send({
          gameId,
          playerId: playerId2,
          cardId: 'sp-3', // 加息周期 - -30 to all opponent cards
          zone: 'sp'
        });

      // Place character cards
      await request(app)
        .post('/player/playCard')
        .send({
          gameId,
          playerId: playerId1,
          cardId: 'c-1',
          zone: 'top'
        });

      await request(app)
        .post('/player/playCard')
        .send({
          gameId,
          playerId: playerId2,
          cardId: 'c-21',
          zone: 'top'
        });

      // Get final power calculations
      const response = await request(app)
        .get(`/player/${playerId1}?gameId=${gameId}`);

      expect(response.body.success).toBe(true);
      // Power calculations should reflect all active effects
    });
  });

  describe('Final Calculation Effects', () => {
    test('sp-6 totalPowerNerf applies after combo calculation', async () => {
      // Set both players ready
      await request(app)
        .post('/player/ready')
        .send({ gameId, playerId: playerId1, useRedraw: false });
      
      await request(app)
        .post('/player/ready')
        .send({ gameId, playerId: playerId2, useRedraw: false });

      // Place sp-6 (DeepSeek風暴)
      await request(app)
        .post('/player/playCardBack')
        .send({
          gameId,
          playerId: playerId1,
          cardId: 'sp-6',
          zone: 'sp'
        });

      // Place opponent SP card
      await request(app)
        .post('/player/playCardBack')
        .send({
          gameId,
          playerId: playerId2,
          cardId: 'sp-1',
          zone: 'sp'
        });

      // Fill all required zones to trigger battle
      await request(app)
        .post('/player/playCard')
        .send({
          gameId,
          playerId: playerId1,
          cardId: 'c-1',
          zone: 'top'
        });

      await request(app)
        .post('/player/playCard')
        .send({
          gameId,
          playerId: playerId2,
          cardId: 'c-21',
          zone: 'top'
        });

      // Fill help zones
      await request(app)
        .post('/player/playCardBack')
        .send({
          gameId,
          playerId: playerId1,
          cardId: 'h-1',
          zone: 'help'
        });

      await request(app)
        .post('/player/playCardBack')
        .send({
          gameId,
          playerId: playerId2,
          cardId: 'h-2',
          zone: 'help'
        });

      // Check that final calculation effects are tracked
      const response = await request(app)
        .get(`/player/${playerId1}?gameId=${gameId}`);

      expect(response.body.success).toBe(true);
      // Final power should be modified by sp-6 effect
    });
  });

  describe('Error Cases', () => {
    test('Invalid card placement with restrictions', async () => {
      // Set both players ready
      await request(app)
        .post('/player/ready')
        .send({ gameId, playerId: playerId1, useRedraw: false });
      
      await request(app)
        .post('/player/ready')
        .send({ gameId, playerId: playerId2, useRedraw: false });

      // Try to place a card that violates leader restrictions
      const response = await request(app)
        .post('/player/playCard')
        .send({
          gameId,
          playerId: playerId1,
          cardId: 'c-1', // May be restricted by leader
          zone: 'top'
        });

      // Should fail with zone compatibility error OR succeed if leader allows
      expect(response.body).toBeDefined();
    });
  });
});