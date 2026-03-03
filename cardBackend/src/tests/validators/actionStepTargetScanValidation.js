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

function validateCommandInHandRequiresEnergyToAdvertiseActionStepPlay() {
  const gameEnv = new GameEnvironment();
  const player = gameEnv.addPlayer('playerId_1', 'Player 1');

  player.deck._handUids = ['ST04-014_cmd_0001'];

  const noEnergyTargets = EffectScannerUtils.collectActionStepTargets(gameEnv, player.id);
  const hasHandTargetWithoutEnergy = noEnergyTargets.some((target) => target.carduid === 'ST04-014_cmd_0001');
  if (hasHandTargetWithoutEnergy) {
    throw new Error('Expected ST04-014 in hand to NOT appear in action step targets when energy is insufficient');
  }

  player.zones.energyArea.push({
    cardId: 'energy_basic',
    carduid: 'energy_basic_test_0001',
    isExtraEnergy: false,
    isRested: false,
    placedAt: 0,
    placedBy: player.id
  });

  const targets = EffectScannerUtils.collectActionStepTargets(gameEnv, player.id);
  const hasHandTarget = targets.some((target) => target.carduid === 'ST04-014_cmd_0001');
  if (!hasHandTarget) {
    throw new Error('Expected ST04-014 in hand to appear in action step targets when energy is sufficient');
  }
}

function validatePilotActivatedAbilityAppears() {
  const gameEnv = new GameEnvironment();
  const player = gameEnv.addPlayer('playerId_1', 'Player 1');

  const pilotData = CardDatabaseManager.getCardDetails('GD01-098');
  if (!pilotData) {
    throw new Error('Expected card data for GD01-098 to exist');
  }

  player.zones.slot1.pilot = {
    carduid: 'GD01-098_pilot_0001',
    cardId: 'GD01-098',
    placedAt: 0,
    placedBy: player.id,
    isRested: false,
    cardData: pilotData
  };

  const targets = EffectScannerUtils.collectActionStepTargets(gameEnv, player.id);
  const hasPilotTarget = targets.some((target) => target.carduid === 'GD01-098_pilot_0001');
  if (!hasPilotTarget) {
    throw new Error('Expected pilot-slot activated abilities to appear in action step targets');
  }
}

function validateRestedBaseActivatedAbilityDoesNotAppear() {
  const gameEnv = new GameEnvironment();
  const player = gameEnv.addPlayer('playerId_1', 'Player 1');

  const baseData = CardDatabaseManager.getCardDetails('GD01-127');
  if (!baseData) {
    throw new Error('Expected card data for GD01-127 to exist');
  }

  player.zones.base.push({
    carduid: 'GD01-127_base_0001',
    cardId: 'GD01-127',
    placedAt: 0,
    placedBy: player.id,
    isRested: true,
    cardData: baseData,
    effectUsage: {}
  });

  const targets = EffectScannerUtils.collectActionStepTargets(gameEnv, player.id);
  const hasBaseTarget = targets.some((target) => target.carduid === 'GD01-127_base_0001');
  if (hasBaseTarget) {
    throw new Error('Expected rested base activated abilities to not appear in action step targets');
  }
}

function validateActivatedUnitRequiresEnergyToAppear() {
  const gameEnv = new GameEnvironment();
  const player = gameEnv.addPlayer('playerId_1', 'Player 1');

  const unitData = CardDatabaseManager.getCardDetails('GD01-058');
  if (!unitData) {
    throw new Error('Expected card data for GD01-058 to exist');
  }

  player.zones.slot1.unit = {
    carduid: 'GD01-058_unit_0001',
    cardId: 'GD01-058',
    placedAt: 0,
    placedBy: player.id,
    isRested: false,
    cardData: unitData,
    effectUsage: {}
  };

  const noEnergyTargets = EffectScannerUtils.collectActionStepTargets(gameEnv, player.id);
  const hasUnitTargetWithoutEnergy = noEnergyTargets.some((target) => target.carduid === 'GD01-058_unit_0001');
  if (hasUnitTargetWithoutEnergy) {
    throw new Error('Expected activated unit ability to not appear when energy is insufficient');
  }

  player.zones.energyArea.push({
    cardId: 'energy_basic',
    carduid: 'energy_basic_test_0002',
    isExtraEnergy: false,
    isRested: false,
    placedAt: 0,
    placedBy: player.id
  });

  const targets = EffectScannerUtils.collectActionStepTargets(gameEnv, player.id);
  const hasUnitTarget = targets.some((target) => target.carduid === 'GD01-058_unit_0001');
  if (!hasUnitTarget) {
    throw new Error('Expected activated unit ability to appear when energy is sufficient');
  }
}

function validateActionStepTargetScan() {
  validateCommandPlayedAsPilotDoesNotAdvertisePlayActions();
  validateCommandInHandRequiresEnergyToAdvertiseActionStepPlay();
  validatePilotActivatedAbilityAppears();
  validateRestedBaseActivatedAbilityDoesNotAppear();
  validateActivatedUnitRequiresEnergyToAppear();
  console.log('OK: action step target scan validation');
}

module.exports = {
  validateActionStepTargetScan
};
