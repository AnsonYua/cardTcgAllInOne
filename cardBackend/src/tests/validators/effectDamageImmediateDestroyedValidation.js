function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function createDestroyedDrawUnitCardData() {
  return {
    id: 'TST-DAMAGE-TARGET',
    name: 'Damage Target',
    cardType: 'unit',
    color: 'Red',
    level: 1,
    cost: 1,
    zone: ['Space'],
    traits: ['Test'],
    link: [],
    ap: 1,
    hp: 1,
    effects: {
      rules: [
        {
          effectId: 'destroyed_draw_1',
          type: 'triggered',
          trigger: 'DESTROYED',
          action: 'draw',
          parameters: { value: 1 },
          target: { type: 'player', scope: 'self', count: 1 }
        }
      ]
    }
  };
}

function validateEffectDamageImmediateDestroyed() {
  require('ts-node/register/transpile-only');

  const { GameEnvironment } = require('../../models/GameEnvironment');
  const { createZoneCard } = require('../../models/CardSystem');
  const { applyDamageEffect } = require('../../services/effects/actions/EffectDamageActions');

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
  p2.deck.mainDeck = ['P2_DRAW_CARD_0001'];

  const target = createZoneCard(
    'TST-DAMAGE-TARGET_uid_0001',
    'TST-DAMAGE-TARGET',
    createDestroyedDrawUnitCardData(),
    'playerId_2'
  );
  p2.zones.slot1.unit = target;

  const effect = {
    effectId: 'test_damage_1',
    action: 'damage',
    parameters: { value: 1 }
  };

  const result = applyDamageEffect(gameEnv, 'playerId_1', undefined, effect, [
    { playerId: 'playerId_2', zone: 'slot1', carduid: target.carduid }
  ]);
  assert(result && result.success === true, `Expected applyDamageEffect success, got ${JSON.stringify(result)}`);

  const queue = Array.isArray(gameEnv.notificationQueue) ? gameEnv.notificationQueue : [];
  const hasDraw = queue.some((event) => event && event.type === 'CARD_DRAWN' && event.payload?.playerId === 'playerId_2');
  const hasEffectDraw = queue.some((event) => event && event.type === 'EFFECT_DRAW_TRIGGERED' && event.payload?.playerId === 'playerId_2');
  const hasBattleResolved = queue.some((event) => event && event.type === 'BATTLE_RESOLVED');
  assert(hasDraw, 'Expected immediate CARD_DRAWN from DESTROYED effect');
  assert(hasEffectDraw, 'Expected immediate EFFECT_DRAW_TRIGGERED from DESTROYED effect');
  assert(!hasBattleResolved, 'Did not expect BATTLE_RESOLVED for effect damage scenario');
}

module.exports = {
  validateEffectDamageImmediateDestroyed
};
