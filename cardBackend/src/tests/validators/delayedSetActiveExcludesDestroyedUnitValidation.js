function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function validateDelayedSetActiveExcludesDestroyedUnit() {
  require('ts-node/register/transpile-only');

  const { GameEnvironment } = require('../../models/GameEnvironment');
  const { createZoneCard } = require('../../models/CardSystem');
  const { BattlePhaseManager } = require('../../services/BattlePhaseManager');

  const gameEnv = new GameEnvironment();
  gameEnv.version = 4;
  gameEnv.phase = 'MAIN_PHASE';
  gameEnv.gameStarted = true;
  gameEnv.hasChosenFirstPlayer = true;
  gameEnv.currentTurn = 1;
  gameEnv.currentPlayer = 'playerId_1';
  gameEnv.notificationQueue = [];
  gameEnv.processingQueue = [];

  const p1 = gameEnv.addPlayer('playerId_1', 'Player 1');
  const p2 = gameEnv.addPlayer('playerId_2', 'Player 2');
  p1.isReady = true;
  p2.isReady = true;

  // Delayed trigger like GD03-120: after a friendly (SB)/(UN) unit destroys an enemy unit with battle damage,
  // set 1 rested friendly (SB)/(UN) unit as active and prevent it from attacking this turn.
  p1.delayedTriggers = [
    {
      id: 'delayed_trigger_test_0001',
      ownerPlayerId: 'playerId_1',
      sourceCarduid: 'GD03-120_action_0001',
      createdTurn: 1,
      expiresTurn: 1,
      trigger: {
        type: 'BATTLE_DESTROY',
        attackerController: 'self',
        attackerTraitsAny: ['Superpower Bloc', 'UN']
      },
      then: [
        {
          action: 'setActive',
          target: {
            type: 'unit',
            scope: 'self_all_unit',
            count: 1,
            selection: { type: 'player_choice' },
            filters: {
              traitsAny: ['Superpower Bloc', 'UN'],
              status: 'rested'
            }
          }
        },
        {
          action: 'applyStatusEffect',
          timing: { duration: 'UNTIL_END_OF_TURN' },
          target: { type: 'unit', scope: 'self', count: 1 },
          parameters: { restriction: 'cannot_attack' }
        }
      ]
    }
  ];

  const attackerCardData = {
    id: 'TST-ATTACKER',
    name: 'Test Attacker (SB)',
    cardType: 'unit',
    color: 'White',
    level: 3,
    cost: 0,
    zone: ['Space'],
    traits: ['Superpower Bloc'],
    link: [],
    ap: 4,
    hp: 1,
    effects: { rules: [] }
  };

  const otherFriendlyCardData = {
    id: 'TST-FRIEND',
    name: 'Test Friendly (SB)',
    cardType: 'unit',
    color: 'White',
    level: 1,
    cost: 0,
    zone: ['Space'],
    traits: ['Superpower Bloc'],
    link: [],
    ap: 1,
    hp: 3,
    effects: { rules: [] }
  };

  const defenderCardData = {
    id: 'TST-DEFENDER',
    name: 'Test Defender',
    cardType: 'unit',
    color: 'Green',
    level: 1,
    cost: 0,
    zone: ['Space'],
    traits: ['Zeon'],
    link: [],
    ap: 1,
    hp: 2,
    effects: { rules: [] }
  };

  const attacker = createZoneCard(
    'TST-ATTACKER_uid_0001',
    attackerCardData.id,
    attackerCardData,
    'playerId_1'
  );
  const otherFriendly = createZoneCard(
    'TST-FRIEND_uid_0001',
    otherFriendlyCardData.id,
    otherFriendlyCardData,
    'playerId_1'
  );
  const defender = createZoneCard(
    'TST-DEFENDER_uid_0001',
    defenderCardData.id,
    defenderCardData,
    'playerId_2'
  );

  // Ensure the "other friendly" is rested and survives; it should be the only valid target after the attacker is destroyed.
  otherFriendly.isRested = true;

  // Defender must be rested for attacks unless a permission says otherwise.
  defender.isRested = true;

  p1.zones.slot1.unit = attacker;
  p1.zones.slot2.unit = otherFriendly;
  p2.zones.slot1.unit = defender;

  const context = {
    actionType: 'attackUnit',
    attackingPlayerId: 'playerId_1',
    defendingPlayerId: 'playerId_2',
    attackerCarduid: attacker.carduid,
    targetPlayerId: 'playerId_2',
    targetCarduid: defender.carduid,
    status: 'ACTION_STEP',
    openedAt: Date.now()
  };

  const result = BattlePhaseManager['resolveUnitBattle'](gameEnv, context);
  assert(result && result.success === true, 'Expected resolveUnitBattle to succeed');

  const processingTypes = (gameEnv.processingQueue || []).map((e) => e && e.type);
  assert(
    !processingTypes.includes('TARGET_CHOICE'),
    `Expected no TARGET_CHOICE when only one valid rested unit remains; got: ${processingTypes.join(', ')}`
  );

  const remainingFriendly = p1.zones.slot2.unit;
  assert(remainingFriendly && remainingFriendly.carduid === otherFriendly.carduid, 'Expected friendly unit to remain in slot2');
  assert(
    remainingFriendly.isRested === false,
    `Expected surviving rested unit to be set active (isRested=false), got isRested=${String(remainingFriendly.isRested)}`
  );

  const notifTypes = (gameEnv.notificationQueue || []).map((e) => e && e.type);
  assert(!notifTypes.includes('TARGET_CHOICE'), `Expected no TARGET_CHOICE notification, got: ${notifTypes.join(', ')}`);
}

module.exports = {
  validateDelayedSetActiveExcludesDestroyedUnit
};

