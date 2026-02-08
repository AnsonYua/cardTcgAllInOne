require('ts-node/register/transpile-only');

const { GameEnvironment } = require('../../models/GameEnvironment');
const { CardDatabaseManager } = require('../../models/CardSystem');
const { PlayerActionExecutor } = require('../../services/PlayerActionExecutor');

function buildActivateEvent(playerId, carduid, effectId) {
  return {
    type: 'PLAYER_ACTION',
    playerId,
    data: {
      actionType: 'activateCardAbility',
      playerId,
      carduid,
      effectId
    }
  };
}

function buildAttackShieldEvent(playerId, attackerCarduid) {
  return {
    type: 'PLAYER_ACTION',
    playerId,
    data: {
      actionType: 'attackShieldArea',
      playerId,
      attackerCarduid
    }
  };
}

function validateGd02069RequiresLinkedToActivate() {
  const gameEnv = new GameEnvironment();
  const player = gameEnv.addPlayer('playerId_1', 'Player 1');
  gameEnv.addPlayer('playerId_2', 'Player 2');

  gameEnv.currentPlayer = player.id;
  gameEnv.phase = 'MAIN_PHASE';

  const unitData = CardDatabaseManager.getCardDetails('GD02-069');
  if (!unitData) {
    throw new Error('Expected card data for GD02-069 to exist');
  }

  const pilotData = CardDatabaseManager.getCardDetails('GD02-097'); // Kamille Bidan
  if (!pilotData) {
    throw new Error('Expected card data for GD02-097 to exist');
  }

  const baseData = CardDatabaseManager.getCardDetails('GD03-132');
  if (!baseData) {
    throw new Error('Expected card data for GD03-132 to exist');
  }

  player.zones.slot1.unit = {
    carduid: 'GD02-069_unit_0001',
    cardId: 'GD02-069',
    placedAt: 0,
    placedBy: player.id,
    isRested: false,
    cardData: unitData,
    effectUsage: {}
  };

  player.zones.base.push({
    carduid: 'GD03-132_base_0001',
    cardId: 'GD03-132',
    placedAt: 0,
    placedBy: player.id,
    isRested: false,
    cardData: baseData,
    effectUsage: {}
  });

  const unlinkedResult = PlayerActionExecutor.execute(
    buildActivateEvent(player.id, 'GD02-069_unit_0001', 'activate_effect'),
    gameEnv
  );
  if (unlinkedResult.success) {
    throw new Error('Expected GD02-069 activate_effect to fail when unit is not linked');
  }

  player.zones.slot1.pilot = {
    carduid: 'GD02-097_pilot_0001',
    cardId: 'GD02-097',
    placedAt: 0,
    placedBy: player.id,
    isRested: false,
    cardData: pilotData
  };

  const linkedResult = PlayerActionExecutor.execute(
    buildActivateEvent(player.id, 'GD02-069_unit_0001', 'activate_effect'),
    gameEnv
  );
  if (!linkedResult.success) {
    throw new Error(`Expected GD02-069 activate_effect to succeed when linked (error: ${linkedResult.error || 'unknown'})`);
  }

  const baseCard = player.zones.base.find((card) => card.carduid === 'GD03-132_base_0001');
  if (!baseCard || baseCard.isRested !== true) {
    throw new Error('Expected GD03-132 base to be rested after GD02-069 activate_effect resolves');
  }

  const attackerUnit = player.zones.slot1.unit;
  const restrictions = Array.isArray(attackerUnit.activeRestrictions) ? attackerUnit.activeRestrictions : [];
  const hasCannotAttackPlayer = restrictions.some((r) => (r && r.restriction) === 'cannot_attack_player');
  if (!hasCannotAttackPlayer) {
    throw new Error('Expected GD02-069 to gain cannot_attack_player restriction after activating');
  }

  const shieldAttackResult = PlayerActionExecutor.execute(
    buildAttackShieldEvent(player.id, 'GD02-069_unit_0001'),
    gameEnv
  );
  if (shieldAttackResult.success) {
    throw new Error('Expected GD02-069 to be unable to attack shield/player this turn after activating');
  }

  if (player.zones.slot1.unit.isRested) {
    throw new Error('Expected GD02-069 to remain active when shield attack is rejected');
  }
  if (gameEnv.currentBattle) {
    throw new Error('Expected no battle to open when shield attack is rejected');
  }
}

function validateGd02069DuringLinkActivatedAbility() {
  validateGd02069RequiresLinkedToActivate();
  console.log('OK: GD02-069 during-link activated ability validation');
}

module.exports = {
  validateGd02069DuringLinkActivatedAbility
};
