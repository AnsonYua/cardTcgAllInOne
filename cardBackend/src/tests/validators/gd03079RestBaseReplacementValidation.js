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

function validateGd03079OffersRestReplacementWhenPayingRestBase() {
  const gameEnv = new GameEnvironment();
  const player = gameEnv.addPlayer('playerId_1', 'Player 1');
  gameEnv.addPlayer('playerId_2', 'Player 2');

  gameEnv.currentPlayer = player.id;
  gameEnv.currentTurn = 1;
  gameEnv.phase = 'MAIN_PHASE';

  const zetaData = CardDatabaseManager.getCardDetails('GD02-069');
  const kamilleData = CardDatabaseManager.getCardDetails('GD02-097');
  const gDefenserData = CardDatabaseManager.getCardDetails('GD03-079');
  const baseData = CardDatabaseManager.getCardDetails('GD03-132');

  if (!zetaData || !kamilleData || !gDefenserData || !baseData) {
    throw new Error('Expected card data for GD02-069/GD02-097/GD03-079/GD03-132 to exist');
  }

  player.zones.slot1.unit = {
    carduid: 'GD02-069_unit_0001',
    cardId: 'GD02-069',
    placedAt: 0,
    placedBy: player.id,
    isRested: false,
    cardData: zetaData,
    effectUsage: {}
  };
  player.zones.slot1.pilot = {
    carduid: 'GD02-097_pilot_0001',
    cardId: 'GD02-097',
    placedAt: 0,
    placedBy: player.id,
    isRested: false,
    playedAs: 'pilot',
    cardData: kamilleData
  };

  player.zones.slot2.unit = {
    carduid: 'GD03-079_unit_0001',
    cardId: 'GD03-079',
    placedAt: 0,
    placedBy: player.id,
    isRested: false,
    cardData: gDefenserData,
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

  const result = PlayerActionExecutor.execute(
    buildActivateEvent(player.id, 'GD02-069_unit_0001', 'activate_effect'),
    gameEnv
  );

  if (!result.success) {
    throw new Error(`Expected activation to succeed (error: ${result.error || 'unknown'})`);
  }

  if (!result.requiresSelection) {
    throw new Error('Expected activation to require selection due to GD03-079 rest-base replacement option');
  }
}

function validateGd03079RestBaseReplacement() {
  validateGd03079OffersRestReplacementWhenPayingRestBase();
  console.log('OK: GD03-079 rest-base replacement validation');
}

module.exports = {
  validateGd03079RestBaseReplacement
};

