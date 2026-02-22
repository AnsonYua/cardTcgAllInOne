function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function createDestroyedDrawRule(effectId) {
  return {
    effectId,
    type: 'triggered',
    trigger: 'DESTROYED',
    action: 'draw',
    parameters: { value: 1 },
    target: { type: 'player', scope: 'self', count: 1 }
  };
}

function createUnitCardData({ id, name, ap, hp, effectId }) {
  return {
    id,
    name,
    cardType: 'unit',
    color: 'Blue',
    level: 1,
    cost: 1,
    zone: ['Space'],
    traits: ['Test'],
    link: [],
    ap,
    hp,
    effects: {
      rules: [createDestroyedDrawRule(effectId)]
    }
  };
}

function validateBattleSimultaneousDestroyOrder() {
  require('ts-node/register/transpile-only');

  const { GameEnvironment } = require('../../models/GameEnvironment');
  const { createZoneCard } = require('../../models/CardSystem');
  const { BattlePhaseManager } = require('../../services/BattlePhaseManager');

  const gameEnv = new GameEnvironment();
  gameEnv.version = 3;
  gameEnv.phase = 'MAIN_PHASE';
  gameEnv.gameStarted = true;
  gameEnv.hasChosenFirstPlayer = true;
  gameEnv.currentTurn = 1;
  gameEnv.currentPlayer = 'playerId_2';
  gameEnv.notificationQueue = [];

  const p1 = gameEnv.addPlayer('playerId_1', 'Player 1');
  const p2 = gameEnv.addPlayer('playerId_2', 'Player 2');
  p1.isReady = true;
  p2.isReady = true;

  p1.deck.mainDeck = ['P1_DRAW_CARD_0001'];
  p2.deck.mainDeck = ['P2_DRAW_CARD_0001'];

  const attackerCardData = createUnitCardData({
    id: 'TST-ATTACKER',
    name: 'Attacker',
    ap: 1,
    hp: 1,
    effectId: 'destroyed_draw_attacker'
  });
  const defenderCardData = createUnitCardData({
    id: 'TST-DEFENDER',
    name: 'Defender',
    ap: 1,
    hp: 1,
    effectId: 'destroyed_draw_defender'
  });

  const attacker = createZoneCard('TST-ATTACKER_uid_0001', 'TST-ATTACKER', attackerCardData, 'playerId_2');
  const defender = createZoneCard('TST-DEFENDER_uid_0001', 'TST-DEFENDER', defenderCardData, 'playerId_1');
  defender.isRested = true;

  p2.zones.slot1.unit = attacker;
  p1.zones.slot1.unit = defender;

  const context = {
    actionType: 'attackUnit',
    attackingPlayerId: 'playerId_2',
    defendingPlayerId: 'playerId_1',
    attackerCarduid: attacker.carduid,
    targetPlayerId: 'playerId_1',
    targetCarduid: defender.carduid,
    status: 'ACTION_STEP',
    openedAt: Date.now()
  };

  const result = BattlePhaseManager['resolveUnitBattle'](gameEnv, context);
  assert(result && result.success === true, 'Expected resolveUnitBattle to succeed');

  const queue = Array.isArray(gameEnv.notificationQueue) ? gameEnv.notificationQueue : [];
  const battleResolvedIdx = queue.findIndex((event) => event && event.type === 'BATTLE_RESOLVED');
  assert(battleResolvedIdx >= 0, 'Expected BATTLE_RESOLVED notification');

  const drawTriggers = queue.filter((event) => event && event.type === 'EFFECT_DRAW_TRIGGERED');
  assert(drawTriggers.length === 2, `Expected 2 EFFECT_DRAW_TRIGGERED notifications, got ${drawTriggers.length}`);
  assert(
    drawTriggers[0].payload && drawTriggers[0].payload.playerId === 'playerId_1',
    `Expected defender destroy trigger first, got ${JSON.stringify(drawTriggers[0] && drawTriggers[0].payload)}`
  );
  assert(
    drawTriggers[1].payload && drawTriggers[1].payload.playerId === 'playerId_2',
    `Expected attacker destroy trigger second, got ${JSON.stringify(drawTriggers[1] && drawTriggers[1].payload)}`
  );

  const firstDrawTriggerIdx = queue.findIndex((event) => event && event.type === 'EFFECT_DRAW_TRIGGERED');
  assert(
    battleResolvedIdx < firstDrawTriggerIdx,
    `Expected BATTLE_RESOLVED before DESTROYED effects (battle=${battleResolvedIdx}, draw=${firstDrawTriggerIdx})`
  );
}

module.exports = {
  validateBattleSimultaneousDestroyOrder
};
