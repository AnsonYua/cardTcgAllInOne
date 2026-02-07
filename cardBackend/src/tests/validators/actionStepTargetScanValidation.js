require('ts-node/register/transpile-only');

const { GameEnvironment } = require('../../models/GameEnvironment');
const { CardDatabaseManager } = require('../../models/CardSystem');
const { EffectScannerUtils } = require('../../utils/EffectScannerUtils');

function validateCommandPlayedAsPilotDoesNotAdvertisePlayActions() {
  const gameEnv = new GameEnvironment();
  const player = gameEnv.addPlayer('playerId_1', 'Player 1');

  const cardData = CardDatabaseManager.getCardDetails('ST04-014');
  if (!cardData) {
    throw new Error('Expected card data for ST04-014 to exist');
  }

  // Simulate a "command card used as pilot" (pilot slot holding a command card).
  player.zones.slot1.pilot = {
    carduid: 'ST04-014_pilot_0001',
    cardId: 'ST04-014',
    placedAt: 0,
    placedBy: player.id,
    isRested: false,
    cardData
  };

  const targets = EffectScannerUtils.collectActionStepTargets(gameEnv, player.id);
  const hasPilotTarget = targets.some((target) => target.carduid === 'ST04-014_pilot_0001');
  if (hasPilotTarget) {
    throw new Error('Expected ST04-014 used as pilot to NOT appear in action step targets');
  }
}

function validateCommandInHandStillAdvertisesActionStepPlay() {
  const gameEnv = new GameEnvironment();
  const player = gameEnv.addPlayer('playerId_1', 'Player 1');

  player.deck._handUids = ['ST04-014_cmd_0001'];

  const targets = EffectScannerUtils.collectActionStepTargets(gameEnv, player.id);
  const hasHandTarget = targets.some((target) => target.carduid === 'ST04-014_cmd_0001');
  if (!hasHandTarget) {
    throw new Error('Expected ST04-014 in hand to appear in action step targets');
  }
}

function validateActionStepTargetScan() {
  validateCommandPlayedAsPilotDoesNotAdvertisePlayActions();
  validateCommandInHandStillAdvertisesActionStepPlay();
  console.log('OK: action step target scan validation');
}

module.exports = {
  validateActionStepTargetScan
};

