function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function validateDestroyedDrawNotificationsComeAfterBattleResolved() {
  // Use TS sources directly (the validators run in node, not through tsc output).
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

  // One card to draw when the attacker is destroyed.
  p2.deck.mainDeck = ['TST-001_draw_0001'];

  const attackerCardData = {
    id: 'TST-UNIT-A',
    name: 'Test Attacker',
    cardType: 'unit',
    color: 'Red',
    level: 1,
    cost: 0,
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

  const defenderCardData = {
    id: 'TST-UNIT-D',
    name: 'Test Defender',
    cardType: 'unit',
    color: 'Blue',
    level: 1,
    cost: 0,
    zone: ['Space'],
    traits: ['Test'],
    link: [],
    ap: 2,
    hp: 1,
    effects: { rules: [] }
  };

  const attacker = createZoneCard(
    'TST-UNIT-A_uid_0001',
    'TST-UNIT-A',
    attackerCardData,
    'playerId_2'
  );
  const defender = createZoneCard(
    'TST-UNIT-D_uid_0001',
    'TST-UNIT-D',
    defenderCardData,
    'playerId_1'
  );

  // Target must be rested for attacks unless a permission says otherwise.
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

  const types = (gameEnv.notificationQueue || []).map((e) => e && e.type);
  const battleIdx = types.indexOf('BATTLE_RESOLVED');
  const drawnIdx = types.indexOf('CARD_DRAWN');
  const effectDrawIdx = types.indexOf('EFFECT_DRAW_TRIGGERED');

  assert(battleIdx >= 0, `Expected BATTLE_RESOLVED notification, got: ${types.join(', ')}`);
  assert(drawnIdx >= 0, `Expected CARD_DRAWN notification, got: ${types.join(', ')}`);
  assert(effectDrawIdx >= 0, `Expected EFFECT_DRAW_TRIGGERED notification, got: ${types.join(', ')}`);

  assert(
    battleIdx < drawnIdx,
    `Expected BATTLE_RESOLVED before CARD_DRAWN (battle=${battleIdx}, drawn=${drawnIdx}): ${types.join(', ')}`
  );
  assert(
    battleIdx < effectDrawIdx,
    `Expected BATTLE_RESOLVED before EFFECT_DRAW_TRIGGERED (battle=${battleIdx}, effect=${effectDrawIdx}): ${types.join(', ')}`
  );
  assert(
    drawnIdx < effectDrawIdx,
    `Expected CARD_DRAWN before EFFECT_DRAW_TRIGGERED (drawn=${drawnIdx}, effect=${effectDrawIdx}): ${types.join(', ')}`
  );
}

module.exports = {
  validateDestroyedDrawNotificationsComeAfterBattleResolved
};

