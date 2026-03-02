require('ts-node/register/transpile-only');

const { GameEnvironment } = require('../../models/GameEnvironment');
const { CardDatabaseManager, createZoneCard } = require('../../models/CardSystem');
const { EventFactory } = require('../../services/EventQueue/EventFactory');
const { GameNotificationManager } = require('../../services/GameNotificationManager');
const { ShieldAreaCardDamagedTriggeredEffectManager } = require('../../services/effects/ShieldAreaCardDamagedTriggeredEffectManager');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function validateGd02001HealsOnTitansShieldAreaBattleDamage() {
  const gameEnv = new GameEnvironment();
  gameEnv.phase = 'MAIN_PHASE';
  gameEnv.gameStarted = true;
  gameEnv.hasChosenFirstPlayer = true;
  gameEnv.currentPlayer = 'playerId_1';
  gameEnv.currentTurn = 1;
  gameEnv.notificationQueue = [];
  gameEnv.processingQueue = [];

  const p1 = gameEnv.addPlayer('playerId_1', 'Player 1');
  const p2 = gameEnv.addPlayer('playerId_2', 'Player 2');
  p1.isReady = true;
  p2.isReady = true;

  const psychoData = CardDatabaseManager.getCardDetails('GD02-001');
  const fourData = CardDatabaseManager.getCardDetails('GD02-085');
  assert(psychoData, 'Expected card data for GD02-001');
  assert(fourData, 'Expected card data for GD02-085');

  const psycho = createZoneCard('GD02-001_unit_0001', 'GD02-001', psychoData, p1.id);
  psycho.damageReceived = 2;
  const four = createZoneCard('GD02-085_pilot_0001', 'GD02-085', fourData, p1.id, 'pilot');

  p1.zones.slot1.unit = psycho;
  p1.zones.slot1.pilot = four;

  const triggerEvent = EventFactory.createShieldAreaCardDamagedTriggeredEvent({
    playerId: p1.id,
    attackingPlayerId: p1.id,
    attackerSlot: 'slot1',
    defendingPlayerId: p2.id,
    defenseArea: 'base',
    damagedCarduid: 'base_default',
    damageSource: 'battle',
    sourceCarduid: psycho.carduid
  });

  const notificationManager = new GameNotificationManager(gameEnv);
  notificationManager.addNotificationEventWithId(triggerEvent.id, 'SHIELD_AREA_CARD_DAMAGED', {
    playerId: p1.id,
    attackingPlayerId: p1.id,
    attackerSlot: 'slot1',
    defendingPlayerId: p2.id,
    defenseArea: 'base',
    damagedCarduid: 'base_default',
    damageSource: 'battle',
    sourceCarduid: psycho.carduid,
    timestamp: Date.now()
  });

  const result = ShieldAreaCardDamagedTriggeredEffectManager.executeShieldAreaCardDamagedTriggeredEvent(
    triggerEvent,
    gameEnv
  );
  assert(result && result.success === true, `Expected GD02-001 shield-area trigger processing to succeed (error: ${result?.error || 'unknown'})`);
  assert(psycho.damageReceived === 0, `Expected GD02-001 to heal 2 after Titans shield-area battle damage, got damageReceived=${String(psycho.damageReceived)}`);

  const healedNotification = gameEnv.notificationQueue.find(
    (entry) => entry && entry.type === 'CARD_HEALED' && entry.payload?.carduid === psycho.carduid && entry.payload?.healAmount === 2
  );
  assert(Boolean(healedNotification), 'Expected CARD_HEALED notification for GD02-001 after shield-area battle damage');
}

function validateGd02001PairedTitansShieldDamageHeal() {
  validateGd02001HealsOnTitansShieldAreaBattleDamage();
  console.log('OK: GD02-001 paired titans shield-area battle damage heal validation');
}

module.exports = {
  validateGd02001PairedTitansShieldDamageHeal
};
