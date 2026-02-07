require('ts-node/register/transpile-only');

const { GameEnvironment } = require('../../models/GameEnvironment');
const { EventFactory } = require('../../services/EventQueue/EventFactory');
const { ChoiceNotificationEmitter } = require('../../services/notifications/ChoiceNotificationEmitter');

function validateTargetChoiceResolvedUpdatesExistingNotification() {
  const gameEnv = new GameEnvironment();
  gameEnv.addPlayer('playerId_1', 'Player 1');
  gameEnv.currentPlayer = 'playerId_1';

  const effect = {
    effectId: 'test_merge_resolved',
    type: 'play',
    action: 'discardFromHand',
    target: {
      type: 'card',
      scope: 'self_hand',
      selection: { type: 'player_choice' },
      count: 1
    }
  };

  const choiceEvent = EventFactory.createTargetChoiceEvent({
    playerId: 'playerId_1',
    sourceCarduid: 'source_1',
    effect,
    availableTargets: [{ carduid: 'c1', zone: 'hand', playerId: 'playerId_1' }]
  });

  ChoiceNotificationEmitter.emitTargetChoiceCreated(gameEnv, choiceEvent);

  const notifBefore = (gameEnv.notificationQueue || []).find(
    (evt) => evt && evt.id === choiceEvent.id && evt.type === 'TARGET_CHOICE'
  );
  if (!notifBefore) {
    throw new Error('Expected TARGET_CHOICE notification to be created');
  }
  if (notifBefore.payload?.isCompleted !== false) {
    throw new Error('Expected TARGET_CHOICE payload.isCompleted to be false initially');
  }
  if (notifBefore.metadata?.requiresAcknowledgment !== true) {
    throw new Error('Expected TARGET_CHOICE metadata.requiresAcknowledgment to be true');
  }
  if (notifBefore.metadata?.expiresAt !== Number.MAX_SAFE_INTEGER) {
    throw new Error('Expected TARGET_CHOICE metadata.expiresAt to be Number.MAX_SAFE_INTEGER');
  }

  choiceEvent.data.selectedTargets = [{ carduid: 'c1', zone: 'hand', playerId: 'playerId_1' }];
  choiceEvent.data.userDecisionMade = true;
  ChoiceNotificationEmitter.emitTargetChoiceResolved(gameEnv, choiceEvent);

  const resolvedNotifications = (gameEnv.notificationQueue || []).filter(
    (evt) => evt && evt.type === 'TARGET_CHOICE_RESOLVED'
  );
  if (resolvedNotifications.length !== 0) {
    throw new Error(`Expected 0 TARGET_CHOICE_RESOLVED notifications, got ${resolvedNotifications.length}`);
  }

  const notifAfter = (gameEnv.notificationQueue || []).find(
    (evt) => evt && evt.id === choiceEvent.id && evt.type === 'TARGET_CHOICE'
  );
  if (!notifAfter) {
    throw new Error('Expected TARGET_CHOICE notification to remain after resolution');
  }
  if (notifAfter.payload?.isCompleted !== true) {
    throw new Error('Expected TARGET_CHOICE payload.isCompleted to be true after resolution');
  }
  if (notifAfter.payload?.event?.data?.userDecisionMade !== true) {
    throw new Error('Expected TARGET_CHOICE payload.event.data.userDecisionMade to be true after resolution');
  }

  console.log('OK: TARGET_CHOICE resolution updates existing notification');
}

module.exports = {
  validateTargetChoiceResolvedUpdatesExistingNotification
};

