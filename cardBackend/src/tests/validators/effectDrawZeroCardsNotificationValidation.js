function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function validateEffectDrawZeroCardsNotification() {
  require('ts-node/register/transpile-only');

  const { GameEnvironment } = require('../../models/GameEnvironment');
  const { EffectExecutor } = require('../../services/effects/EffectExecutor');

  const gameEnv = new GameEnvironment();
  gameEnv.phase = 'MAIN_PHASE';
  gameEnv.gameStarted = true;
  gameEnv.hasChosenFirstPlayer = true;
  gameEnv.currentPlayer = 'playerId_1';
  gameEnv.notificationQueue = [];

  const p1 = gameEnv.addPlayer('playerId_1', 'Player 1');
  const p2 = gameEnv.addPlayer('playerId_2', 'Player 2');
  p1.isReady = true;
  p2.isReady = true;
  p1.deck.mainDeck = [];

  const drawEffect = {
    effectId: 'test_effect_draw_1',
    action: 'draw',
    target: { type: 'player', scope: 'self', count: 1 },
    parameters: { value: 1 }
  };

  const result = EffectExecutor.applyPlayerDrawEffect(gameEnv, 'playerId_1', drawEffect, 'TEST_SOURCE_UID');
  assert(result && result.success === true, `Expected applyPlayerDrawEffect success, got ${JSON.stringify(result)}`);

  const queue = Array.isArray(gameEnv.notificationQueue) ? gameEnv.notificationQueue : [];
  const cardDrawn = queue.some((event) => event && event.type === 'CARD_DRAWN' && event.payload?.playerId === 'playerId_1');
  assert(!cardDrawn, 'Did not expect CARD_DRAWN when effect draw resolves with empty deck');

  const zeroDrawNotification = queue.find(
    (event) => event &&
      event.type === 'EFFECT_DRAW_TRIGGERED' &&
      event.payload?.playerId === 'playerId_1' &&
      event.payload?.count === 0 &&
      event.payload?.drewAny === false &&
      event.payload?.reason === 'NO_CARDS_DRAWN' &&
      event.payload?.sourceCarduid === 'TEST_SOURCE_UID'
  );

  assert(Boolean(zeroDrawNotification), 'Expected EFFECT_DRAW_TRIGGERED notification for zero-card effect draw');
}

module.exports = {
  validateEffectDrawZeroCardsNotification
};
