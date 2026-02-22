function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function createCardData(overrides) {
  return {
    id: overrides.id,
    name: overrides.name,
    cardType: overrides.cardType,
    color: 'Blue',
    level: 1,
    cost: 1,
    zone: ['Space'],
    traits: ['Test'],
    link: [],
    ap: overrides.ap,
    hp: overrides.hp,
    effects: overrides.effects || { rules: [] }
  };
}

function validateSlotTotalHpLethal() {
  require('ts-node/register/transpile-only');

  const { GameEnvironment } = require('../../models/GameEnvironment');
  const { createZoneCard } = require('../../models/CardSystem');
  const { SlotHealthService } = require('../../services/health/SlotHealthService');
  const { SlotHpDestructionChecker } = require('../../services/destruction/SlotHpDestructionChecker');

  const gameEnv = new GameEnvironment();
  gameEnv.phase = 'MAIN_PHASE';
  gameEnv.gameStarted = true;
  gameEnv.hasChosenFirstPlayer = true;
  gameEnv.currentPlayer = 'playerId_1';
  gameEnv.notificationQueue = [];

  const p1 = gameEnv.addPlayer('playerId_1', 'Player 1');
  gameEnv.addPlayer('playerId_2', 'Player 2');
  p1.isReady = true;

  const unit = createZoneCard(
    'TST-SLOT-UNIT_uid_0001',
    'TST-SLOT-UNIT',
    createCardData({ id: 'TST-SLOT-UNIT', name: 'Slot Unit', cardType: 'unit', ap: 1, hp: 1 }),
    'playerId_1'
  );
  const pilot = createZoneCard(
    'TST-SLOT-PILOT_uid_0001',
    'TST-SLOT-PILOT',
    createCardData({ id: 'TST-SLOT-PILOT', name: 'Slot Pilot', cardType: 'pilot', ap: 0, hp: 2 }),
    'playerId_1'
  );

  p1.zones.slot1.unit = unit;
  p1.zones.slot1.pilot = pilot;

  const damageTwo = SlotHealthService.applyDamageByCarduid(gameEnv, unit.carduid, 2);
  assert(damageTwo && damageTwo.remainingHp === 1, `Expected remaining HP to be 1 after 2 damage, got ${JSON.stringify(damageTwo)}`);

  const shouldNotDestroy = SlotHpDestructionChecker.destroyUnitIfSlotHpZero(gameEnv, unit.carduid, {
    timing: 'IMMEDIATE',
    cause: 'RULE_DESTROY'
  });
  assert(shouldNotDestroy === true, 'Expected destroy check to succeed');
  assert(p1.zones.slot1.unit && p1.zones.slot1.unit.carduid === unit.carduid, 'Unit should still be in slot at shared HP 1');

  const damageOne = SlotHealthService.applyDamageByCarduid(gameEnv, unit.carduid, 1);
  assert(damageOne && damageOne.remainingHp === 0, `Expected remaining HP to be 0 after lethal damage, got ${JSON.stringify(damageOne)}`);

  const destroyed = SlotHpDestructionChecker.destroyUnitIfSlotHpZero(gameEnv, unit.carduid, {
    timing: 'IMMEDIATE',
    cause: 'RULE_DESTROY'
  });
  assert(destroyed === true, 'Expected lethal shared slot HP check to destroy slot');
  assert(!p1.zones.slot1.unit, 'Unit should be removed from slot after lethal shared HP');
  assert(!p1.zones.slot1.pilot, 'Pilot should be removed from slot after lethal shared HP');
}

module.exports = {
  validateSlotTotalHpLethal
};
