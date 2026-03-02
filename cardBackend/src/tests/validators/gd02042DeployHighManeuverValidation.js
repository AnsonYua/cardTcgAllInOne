require('ts-node/register/transpile-only');

const { GameEnvironment } = require('../../models/GameEnvironment');
const { CardDatabaseManager, createZoneCard } = require('../../models/CardSystem');
const { EventFactory } = require('../../services/EventQueue/EventFactory');
const { KeywordUtils } = require('../../utils/KeywordUtils');
const { SlotZoneUtils } = require('../../utils/SlotZoneUtils');
const { TurnLifecycleManager } = require('../../services/TurnLifecycleManager');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function buildEnergy(carduid, playerId) {
  return {
    carduid,
    cardId: 'energy_basic',
    placedAt: 0,
    placedBy: playerId,
    isRested: false,
    isExtraEnergy: false
  };
}

function buildAttackUnitEvent(playerId, attackerCarduid, targetPlayerId, targetCarduid) {
  return EventFactory.createPlayerActionEvent(playerId, 'attackUnit', {
    actionType: 'attackUnit',
    playerId,
    attackerCarduid,
    targetPlayerId,
    targetCarduid,
    targetUnitUid: targetCarduid
  });
}

function processChoice(gameEnv, choiceEvent, selectedTargets) {
  choiceEvent.data.selectedTargets = selectedTargets;
  choiceEvent.data.userDecisionMade = true;
  return gameEnv.processEvents();
}

function createBaseGameEnv() {
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

  return { gameEnv, p1, p2 };
}

function validateGd02042TargetChoiceAndBlockerSkip() {
  const { gameEnv, p1, p2 } = createBaseGameEnv();

  const ashtaronData = CardDatabaseManager.getCardDetails('GD02-042');
  const newUneData = CardDatabaseManager.getCardDetails('GD02-043');
  const blockerData = CardDatabaseManager.getCardDetails('ST01-008');
  const weakDefenderData = {
    id: 'TST-GD02042-DEFENDER',
    name: 'Test Defender',
    cardType: 'unit',
    color: 'Green',
    level: 1,
    cost: 0,
    zone: ['Space'],
    traits: ['Test'],
    link: [],
    ap: 0,
    hp: 1,
    effects: { rules: [] }
  };

  assert(ashtaronData, 'Expected card data for GD02-042');
  assert(newUneData, 'Expected card data for GD02-043');
  assert(blockerData, 'Expected card data for ST01-008');

  const existingNewUne = createZoneCard('GD02-043_p1_target_0001', 'GD02-043', newUneData, p1.id);
  const defendingUnit = createZoneCard('GD02-043_p2_defender_0001', weakDefenderData.id, weakDefenderData, p2.id);
  const blocker = createZoneCard('ST01-008_p2_blocker_0001', 'ST01-008', blockerData, p2.id);

  defendingUnit.isRested = true;

  p1.zones.slot1.unit = existingNewUne;
  p2.zones.slot1.unit = defendingUnit;
  p2.zones.slot2.unit = blocker;

  p1.zones.energyArea.push(buildEnergy('energy_basic_gd02042_p1_0001', p1.id));
  p1.zones.energyArea.push(buildEnergy('energy_basic_gd02042_p1_0002', p1.id));
  p1.zones.energyArea.push(buildEnergy('energy_basic_gd02042_p1_0003', p1.id));

  p1.deck._handUids = ['GD02-042_hand_0001'];

  const playEvent = EventFactory.createPlayCardEvent(
    p1.id,
    undefined,
    'GD02-042_hand_0001',
    'unit',
    undefined,
    { slotName: 'slot3' }
  );

  gameEnv.enqueueForProcessing(playEvent);
  const afterPlay = gameEnv.processEvents();
  assert(afterPlay.success, `Expected GD02-042 play to succeed (error: ${afterPlay.error || 'unknown'})`);

  const choiceEvent = gameEnv.processingQueue.find((evt) => evt && evt.type === 'TARGET_CHOICE');
  assert(choiceEvent, 'Expected GD02-042 deploy to create TARGET_CHOICE');

  const availableTargets = choiceEvent.data.availableTargets || [];
  const availableTargetUids = availableTargets.map((target) => target.carduid).sort();
  const expectedUids = ['GD02-042_hand_0001', 'GD02-043_p1_target_0001'].sort();
  assert(
    JSON.stringify(availableTargetUids) === JSON.stringify(expectedUids),
    `Expected TARGET_CHOICE targets ${JSON.stringify(expectedUids)}, got ${JSON.stringify(availableTargetUids)}`
  );

  const choiceResult = processChoice(gameEnv, choiceEvent, [
    { carduid: 'GD02-043_p1_target_0001', zone: 'slot1', playerId: p1.id }
  ]);
  assert(choiceResult.success, `Expected TARGET_CHOICE resolution to succeed (error: ${choiceResult.error || 'unknown'})`);

  const chosenUnit = SlotZoneUtils.getCardByUid(gameEnv, 'GD02-043_p1_target_0001');
  const sourceUnit = SlotZoneUtils.getCardByUid(gameEnv, 'GD02-042_hand_0001');
  assert(chosenUnit && KeywordUtils.isUnblockable(chosenUnit), 'Expected chosen New UNE unit to gain High-Maneuver');
  assert(sourceUnit && !KeywordUtils.isUnblockable(sourceUnit), 'Expected GD02-042 to not gain High-Maneuver when another unit is chosen');

  gameEnv.enqueueForProcessing(
    buildAttackUnitEvent(p1.id, 'GD02-043_p1_target_0001', p2.id, 'GD02-043_p2_defender_0001')
  );
  const afterAttack = gameEnv.processEvents();
  assert(afterAttack.success, `Expected attack with granted High-Maneuver to succeed (error: ${afterAttack.error || 'unknown'})`);

  const blockerChoiceQueued = gameEnv.processingQueue.some((evt) => evt && evt.type === 'BLOCKER_CHOICE');
  const blockerChoiceNotified = gameEnv.notificationQueue.some((evt) => evt && evt.type === 'BLOCKER_CHOICE');
  assert(!blockerChoiceQueued, 'Expected no BLOCKER_CHOICE event when attacker has High-Maneuver');
  assert(!blockerChoiceNotified, 'Expected no BLOCKER_CHOICE notification when attacker has High-Maneuver');

  TurnLifecycleManager.cleanupEndTurn(gameEnv, p1.id);
  assert(!KeywordUtils.isUnblockable(chosenUnit), 'Expected granted High-Maneuver to expire at end of turn');
}

function validateGd02042DeployHighManeuver() {
  validateGd02042TargetChoiceAndBlockerSkip();
  console.log('OK: GD02-042 deploy high-maneuver validation');
}

module.exports = {
  validateGd02042DeployHighManeuver
};
