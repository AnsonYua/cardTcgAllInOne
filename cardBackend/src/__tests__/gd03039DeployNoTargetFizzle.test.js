const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager } = require('../models/CardSystem');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { DeployEffectManager } = require('../services/DeployEffectManager');
const { StaticEventProcessor } = require('../services/StaticEventProcessor');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { EventType } = require('../models/GameEnums');

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

function addEnergy(player, count = 4) {
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

function addUnit(player, slotName, cardId, opts = {}) {
  const cardData = CardDatabaseManager.getCardDetails(cardId);
  if (!cardData) throw new Error(`Missing card data for ${cardId}`);

  const uid = `${cardId}_${player.id}_${slotName}_${opts.tag || 'u'}`;
  player.zones[slotName].unit = {
    carduid: uid,
    cardId,
    cardData,
    placedAt: 0,
    placedBy: player.id,
    isRested: opts.isRested === true,
    playedThisTurn: false,
    canAttackOnPlayTurn: false,
    canAttackThisTurn: true,
    isFirstPlay: false,
    damageReceived: 0,
    modifyAP: 0,
    modifyHP: 0,
    continueModifyAP: 0,
    continueModifyHP: 0,
    originalAP: Number(cardData.ap || 0),
    originalHP: Number(cardData.hp || 0),
    effectUsage: {},
  };
  return uid;
}

function getGd03039DeployRule() {
  const card = CardDatabaseManager.getCardDetails('GD03-039');
  expect(card).toBeTruthy();
  const rule = (card.effects?.rules || []).find((r) => r && r.trigger === 'ENTERS_PLAY');
  expect(rule).toBeTruthy();
  return rule;
}

describe('GD03-039 deploy no-target fizzle semantics', () => {
  test('DeployTargetManager returns structured NO_TARGETS_REQUIRED failure for mandatory no-target step', () => {
    const { env, p1 } = createBaseEnv();
    const sourceUid = addUnit(p1, 'slot1', 'GD03-039', { tag: 'source' });
    addEnergy(p1, 4);

    const rule = getGd03039DeployRule();
    const result = DeployTargetManager.processEffectWithTargetChoice(
      env,
      'playerId_1',
      sourceUid,
      rule
    );

    expect(result.success).toBe(false);
    expect(result.failureKind).toBe('NO_TARGETS_REQUIRED');
    expect(result.error).toMatch(/No eligible targets found/);
  });

  test('DeployEffectManager treats GD03-039 mandatory no-target deploy as fizzle (success)', () => {
    const { env, p1 } = createBaseEnv();
    const sourceUid = addUnit(p1, 'slot1', 'GD03-039', { tag: 'source' });
    addEnergy(p1, 4);

    const deployEvent = {
      id: 'deploy_gd03_039_no_target',
      type: EventType.DEPLOY_EFFECT_TRIGGERED,
      status: 'RESOLVING',
      priority: 1,
      playerId: 'playerId_1',
      timestamp: Date.now(),
      data: {
        carduid: sourceUid,
        effects: [getGd03039DeployRule()],
      },
    };

    const result = DeployEffectManager.executeDeployEffect(deployEvent, env);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(env.processingQueue.find((e) => e.type === EventType.TARGET_CHOICE)).toBeFalsy();
  });

  test('PLAY_CARD processing succeeds when GD03-039 deploy has no legal Clan target', async () => {
    const { env, p1, p2 } = createBaseEnv();
    addEnergy(p1, 4);
    addUnit(p2, 'slot1', 'GD03-011', { tag: 'enemy' });

    const handUid = 'GD03-039_hand_test_0001';
    p1.deck._handUids = [handUid];

    const playEvent = EventFactory.createPlayCardEvent(
      'playerId_1',
      'test_game_gd03_039_no_target_fizzle',
      handUid,
      'unit'
    );

    const processingResult = await StaticEventProcessor.processEvent(env, playEvent);

    expect(processingResult.success).toBe(true);
    expect(processingResult.error).toBeUndefined();
    expect(processingResult.needsPlayerInput).toBe(false);

    const p1Units = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
      .map((slot) => env.players.playerId_1.zones[slot]?.unit)
      .filter(Boolean);

    expect(p1Units.some((unit) => unit.cardId === 'GD03-039')).toBe(true);
    expect(env.processingQueue.find((e) => e.type === EventType.TARGET_CHOICE)).toBeFalsy();
  });
});
