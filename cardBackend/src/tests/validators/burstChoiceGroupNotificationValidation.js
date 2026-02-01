function validateBurstChoiceGroupNotification() {
  require('ts-node/register/transpile-only');

  const { GameEnvironment } = require('../../models/GameEnvironment');
  const { EventFactory } = require('../../services/EventQueue/EventFactory');
  const { BurstEffectManager } = require('../../services/BurstEffectManager');

  const gameEnv = new GameEnvironment();
  gameEnv.addPlayer('playerId_1', 'Player 1');
  gameEnv.addPlayer('playerId_2', 'Player 2');
  gameEnv.currentPlayer = 'playerId_1';

  const burstCardData = {
    cardId: 'TEST-001',
    name: 'Burst Shield',
    cardType: 'shield',
    effects: {
      rules: [
        {
          effectId: 'burst_add_to_hand',
          type: 'triggered',
          trigger: 'BURST_CONDITION',
          action: 'addToHand',
          target: { type: 'card', scope: 'self' }
        }
      ]
    }
  };

  const multiShieldAttackEvent = EventFactory.createShieldCardAttackedEvent(
    'playerId_2',
    'playerId_1',
    'slot1',
    [
      { carduid: 'TEST-SHIELD-001', cardData: burstCardData },
      { carduid: 'TEST-SHIELD-002', cardData: burstCardData }
    ],
    3
  );

  const result = BurstEffectManager.processShieldCardAttack(multiShieldAttackEvent, gameEnv);
  if (!result.success) {
    throw new Error(`Expected shield attack processing to succeed, got error: ${result.error || 'unknown'}`);
  }

  const burstEvents = gameEnv.processingQueue.filter((evt) => evt.type === 'BURST_EFFECT_CHOICE');
  if (burstEvents.length !== 2) {
    throw new Error(`Expected 2 burst choice events in processingQueue, got ${burstEvents.length}`);
  }

  const groupNotifications = (gameEnv.notificationQueue || []).filter(
    (evt) => evt && evt.type === 'BURST_EFFECT_CHOICE_GROUP'
  );
  if (groupNotifications.length !== 1) {
    throw new Error(`Expected 1 BURST_EFFECT_CHOICE_GROUP notification, got ${groupNotifications.length}`);
  }

  if (groupNotifications[0]?.metadata?.requiresAcknowledgment !== true) {
    throw new Error('Expected BURST_EFFECT_CHOICE_GROUP metadata.requiresAcknowledgment to be true');
  }
  if (groupNotifications[0]?.metadata?.expiresAt !== Number.MAX_SAFE_INTEGER) {
    throw new Error('Expected BURST_EFFECT_CHOICE_GROUP metadata.expiresAt to be Number.MAX_SAFE_INTEGER');
  }

  const singleNotifications = (gameEnv.notificationQueue || []).filter(
    (evt) => evt && evt.type === 'BURST_EFFECT_CHOICE'
  );
  if (singleNotifications.length !== 0) {
    throw new Error(`Expected 0 BURST_EFFECT_CHOICE notifications for grouped flow, got ${singleNotifications.length}`);
  }

  const groupPayloadEvents = groupNotifications[0]?.payload?.events;
  if (!Array.isArray(groupPayloadEvents) || groupPayloadEvents.length !== 2) {
    throw new Error('Expected BURST_EFFECT_CHOICE_GROUP payload.events to be an array of length 2');
  }

  if (!Array.isArray(groupNotifications[0]?.payload?.resolvedEventIds)) {
    throw new Error('Expected BURST_EFFECT_CHOICE_GROUP payload.resolvedEventIds to be an array');
  }
  if (groupNotifications[0]?.payload?.isCompleted !== false) {
    throw new Error('Expected BURST_EFFECT_CHOICE_GROUP payload.isCompleted to be false initially');
  }

  const groupedIds = new Set(groupPayloadEvents.map((evt) => evt.id));
  for (const evt of burstEvents) {
    if (!groupedIds.has(evt.id)) {
      throw new Error(`Expected grouped payload to include burst event id ${evt.id}`);
    }
  }
}

module.exports = {
  validateBurstChoiceGroupNotification
};
