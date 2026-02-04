require('ts-node/register/transpile-only');

const { GameEnvironment } = require('../../models/GameEnvironment');
const { EventFactory } = require('../../services/EventQueue/EventFactory');
const { ChoiceNotificationEmitter } = require('../../services/notifications/ChoiceNotificationEmitter');

function validateTargetChoiceNotificationIncludesTargetCount() {
  const gameEnv = new GameEnvironment();
  gameEnv.addPlayer('playerId_1', 'Player 1');
  gameEnv.currentPlayer = 'playerId_1';

  const effect = {
    effectId: 'test_count_range',
    type: 'play',
    action: 'prevent_battle_damage',
    target: {
      type: 'unit',
      scope: 'self_all_unit',
      selection: { type: 'player_choice' },
      count: { min: 1, max: 2 }
    }
  };

  const choiceEvent = EventFactory.createTargetChoiceEvent({
    playerId: 'playerId_1',
    sourceCarduid: 'source_1',
    effect,
    availableTargets: [
      { carduid: 'u1', zone: 'slot1', playerId: 'playerId_1' },
      { carduid: 'u2', zone: 'slot2', playerId: 'playerId_1' }
    ]
  });

  ChoiceNotificationEmitter.emitTargetChoiceCreated(gameEnv, choiceEvent);

  const notif = Array.isArray(gameEnv.notificationQueue)
    ? gameEnv.notificationQueue.find(e => e && e.id === choiceEvent.id && e.type === 'TARGET_CHOICE')
    : undefined;

  if (!notif) {
    throw new Error('Expected TARGET_CHOICE notification to be created');
  }

  const targetCount = notif.payload && notif.payload.targetCount;
  if (!targetCount || targetCount.min !== 1 || targetCount.max !== 2) {
    throw new Error(`Expected payload.targetCount to be {min:1,max:2} (got ${JSON.stringify(targetCount)})`);
  }

  console.log('OK: TARGET_CHOICE notification includes targetCount');
}

module.exports = {
  validateTargetChoiceNotificationIncludesTargetCount
};

