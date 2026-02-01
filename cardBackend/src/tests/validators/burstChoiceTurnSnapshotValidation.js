function validateBurstChoiceDoesNotOverrideCurrentPlayer() {
  require('ts-node/register/transpile-only');

  const { GameEnvironment } = require('../../models/GameEnvironment');
  const { BurstChoiceService } = require('../../services/effects/BurstChoiceService');

  const gameEnv = new GameEnvironment();
  gameEnv.addPlayer('playerId_1', 'Player 1');
  gameEnv.addPlayer('playerId_2', 'Player 2');
  gameEnv.currentPlayer = 'playerId_1';

  const formattedTarget = { carduid: 'test_shield_0001', cardId: 'TEST-001', cardData: {} };
  BurstChoiceService.enqueueBurstChoice(gameEnv, 'playerId_2', formattedTarget);
  BurstChoiceService.enqueueBurstChoice(gameEnv, 'playerId_2', formattedTarget);

  if (gameEnv.currentPlayer !== 'playerId_1') {
    throw new Error(
      `BurstChoiceService must not overwrite gameEnv.currentPlayer (expected playerId_1, got ${gameEnv.currentPlayer})`
    );
  }

  const burstEvents = gameEnv.processingQueue.filter((evt) => evt.type === 'BURST_EFFECT_CHOICE');
  if (burstEvents.length !== 2) {
    throw new Error(`Expected 2 burst choice events, got ${burstEvents.length}`);
  }

  for (const evt of burstEvents) {
    if (evt.data.turnPlayerId !== 'playerId_1') {
      throw new Error(`Expected burst event turnPlayerId to be playerId_1, got ${evt.data.turnPlayerId}`);
    }
    if (evt.data.previousPlayerId !== 'playerId_1') {
      throw new Error(
        `Expected burst event previousPlayerId to be playerId_1, got ${evt.data.previousPlayerId}`
      );
    }
  }
}

module.exports = {
  validateBurstChoiceDoesNotOverrideCurrentPlayer
};

