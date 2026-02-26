const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager } = require('../models/CardSystem');
const { StaticEventProcessor } = require('../services/StaticEventProcessor');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { validatePlayerSlotFixtures } = require('./helpers/slotFixtureValidator');

function createBaseEnv() {
  const env = new GameEnvironment();
  const p1 = env.addPlayer('playerId_1', 'P1');
  const p2 = env.addPlayer('playerId_2', 'P2');
  env.gameStarted = true;
  env.phase = 'MAIN_PHASE';
  env.currentPlayer = 'playerId_1';
  env.currentTurn = 1;
  env.firstPlayer = 0;
  env.hasChosenFirstPlayer = true;
  env.playersReady = { playerId_1: true, playerId_2: true };
  return { env, p1, p2 };
}

function addEnergy(player, count = 8) {
  for (let i = 1; i <= count; i += 1) {
    player.zones.energyArea.push({
      carduid: `energy_basic_${player.id}_${i}`,
      cardId: 'energy_basic',
      placedAt: 0,
      placedBy: player.id,
      isRested: false,
      isExtraEnergy: false,
    });
  }
}

function addCanonicalUnit(player, slotName, cardId, opts = {}) {
  const cardData = CardDatabaseManager.getCardDetails(cardId);
  if (!cardData) throw new Error(`Missing card data for ${cardId}`);

  const uid = `${cardId}_${player.id}_${slotName}_${opts.tag || 'u'}`;
  player.zones[slotName].unit = {
    carduid: uid,
    cardId,
    cardData,
    placedAt: 0,
    placedBy: player.id,
    isRested: !!opts.isRested,
    playedThisTurn: false,
    canAttackOnPlayTurn: false,
    canAttackThisTurn: true,
    isFirstPlay: false,
    damageReceived: 0,
    modifyAP: 0,
    modifyHP: 0,
    continueModifyAP: 0,
    continueModifyHP: 0,
    temporaryEffects: [],
    effectUsage: {},
    originalAP: Number(cardData.ap || 0),
    originalHP: Number(cardData.hp || 0),
  };
  return uid;
}

function addMalformedPlaceholderUnit(player, slotName) {
  player.zones[slotName].unit = {
    carduid: `enemy_unit_placeholder_${player.id}_${slotName}`,
    cardId: 'enemy_unit_basic',
    placedAt: 0,
    placedBy: player.id,
    isRested: false,
    playedThisTurn: false,
    canAttackOnPlayTurn: false,
    canAttackThisTurn: true,
    isFirstPlay: false,
    damageReceived: 0,
    continueModifyAP: 0,
    continueModifyHP: 0,
    ap: 3,
    hp: 4,
  };
}

function seedHandForPlay(player, cardId, tag = 'test') {
  const handUid = `${cardId}_hand_${tag}_0001`;
  player.deck._handUids = [handUid];
  return handUid;
}

function deployDiagnostics(env) {
  return (env.notificationQueue || []).filter((n) => n?.type === 'DEPLOY_EFFECT_DIAGNOSTIC');
}

describe('GD03-034 deploy diagnostics + strict fixture validation', () => {
  test('fixture validator passes for canonical slot unit fixtures', () => {
    const { env, p2 } = createBaseEnv();
    addCanonicalUnit(p2, 'slot1', 'ST03-008', { tag: 'enemy' });
    expect(() => validatePlayerSlotFixtures(env, 'playerId_2')).not.toThrow();
  });

  test('fixture validator fails fast for malformed placeholder slot unit', () => {
    const { env, p2 } = createBaseEnv();
    addMalformedPlaceholderUnit(p2, 'slot1');
    expect(() => validatePlayerSlotFixtures(env, 'playerId_2')).toThrow(/Missing fields: .*cardData.*originalAP.*originalHP/);
  });

  test('GD03-034 deploy effect resolves and deals 3 damage to canonical enemy unit', async () => {
    const { env, p1, p2 } = createBaseEnv();
    addEnergy(p1, 8);
    const enemyUid = addCanonicalUnit(p2, 'slot1', 'ST03-008', { tag: 'enemy' });
    validatePlayerSlotFixtures(env, 'playerId_2');

    const handUid = seedHandForPlay(p1, 'GD03-034', 'canonical');
    const playEvent = EventFactory.createPlayCardEvent('playerId_1', 'test_gd03_034_canonical', handUid, 'unit');
    const result = await StaticEventProcessor.processEvent(env, playEvent);

    expect(result.success).toBe(true);
    expect(env.players.playerId_2.zones.slot1.unit).toBeNull();
    const trashedEnemy = (env.players.playerId_2.zones.trashArea || []).find((card) => card?.carduid === enemyUid);
    expect(trashedEnemy).toBeTruthy();
    const damageNotification = (env.notificationQueue || []).find(
      (n) => n?.type === 'CARD_DAMAGED' && n?.payload?.carduid === enemyUid
    );
    expect(damageNotification).toBeTruthy();

    const outcomes = deployDiagnostics(env).map((n) => n.payload?.outcome);
    expect(outcomes).toContain('triggered');
    expect(outcomes).toContain('resolved');
  });

  test('GD03-034 deploy effect with no enemy units resolves as a legal no-op and emits diagnostics', async () => {
    const { env, p1 } = createBaseEnv();
    addEnergy(p1, 8);

    const handUid = seedHandForPlay(p1, 'GD03-034', 'notarget');
    const playEvent = EventFactory.createPlayCardEvent('playerId_1', 'test_gd03_034_no_targets', handUid, 'unit');
    const result = await StaticEventProcessor.processEvent(env, playEvent);

    expect(result.success).toBe(true);
    const outcomes = deployDiagnostics(env).map((n) => n.payload?.outcome);
    expect(outcomes).toContain('triggered');
    expect(outcomes).toContain('resolved');
    const damageNotifications = (env.notificationQueue || []).filter((n) => n?.type === 'CARD_DAMAGED');
    expect(damageNotifications).toHaveLength(0);
  });

  test('GD03-034 deploy effect on malformed target fixture emits invalid_target_state diagnostic', async () => {
    const { env, p1, p2 } = createBaseEnv();
    addEnergy(p1, 8);
    addMalformedPlaceholderUnit(p2, 'slot1');

    const handUid = seedHandForPlay(p1, 'GD03-034', 'malformed');
    const playEvent = EventFactory.createPlayCardEvent('playerId_1', 'test_gd03_034_malformed', handUid, 'unit');
    const result = await StaticEventProcessor.processEvent(env, playEvent);

    expect(result.success).toBe(false);
    expect(result.error || '').toMatch(/Invalid slot health state/);

    const invalidDiagnostic = deployDiagnostics(env).find((n) => n.payload?.outcome === 'invalid_target_state');
    expect(invalidDiagnostic).toBeTruthy();
    expect(String(invalidDiagnostic.payload?.error || '')).toMatch(/Invalid slot health state/);
  });
});
