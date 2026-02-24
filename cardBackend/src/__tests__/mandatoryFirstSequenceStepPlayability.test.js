const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager } = require('../models/CardSystem');
const { PlayCardPreparationManager } = require('../services/PlayCardPreparationManager');

const allCards = CardDatabaseManager.getAllCards ? CardDatabaseManager.getAllCards() : {};

function findCardId(label, predicate) {
  const entries = Object.entries(allCards);
  for (const [cardId, card] of entries) {
    if (predicate(card || {})) return cardId;
  }
  throw new Error(`Missing fixture card for ${label}`);
}

const FIXTURE_IDS = {
  anyUnit: findCardId('anyUnit', (c) => c.cardType === 'unit'),
  blockerUnit: 'GD03-003',
  vaganUnit: findCardId('vaganUnit', (c) => c.cardType === 'unit' && Array.isArray(c.traits) && c.traits.includes('Vagan')),
  titansUnit: findCardId('titansUnit', (c) => c.cardType === 'unit' && Array.isArray(c.traits) && c.traits.includes('Titans')),
  unitLe2: findCardId('unitLe2', (c) => c.cardType === 'unit' && Number(c.level) <= 2),
  unitLe3: findCardId('unitLe3', (c) => c.cardType === 'unit' && Number(c.level) <= 3),
  unitLe4: findCardId('unitLe4', (c) => c.cardType === 'unit' && Number(c.level) <= 4),
  unitLe5: findCardId('unitLe5', (c) => c.cardType === 'unit' && Number(c.level) <= 5),
  pilot: findCardId('pilot', (c) => c.cardType === 'pilot'),
  base: findCardId('base', (c) => c.cardType === 'base'),
};

function createBaseEnv({ phase = 'MAIN_PHASE', actionStep = false }) {
  const env = new GameEnvironment();
  const p1 = env.addPlayer('playerId_1', 'P1');
  const p2 = env.addPlayer('playerId_2', 'P2');
  env.gameStarted = true;
  env.currentPlayer = 'playerId_1';
  env.currentTurn = 1;
  env.phase = phase;

  if (actionStep) {
    env.phase = 'ACTION_STEP_PHASE';
  }

  for (let i = 0; i < 10; i += 1) {
    p1.zones.energyArea.push({
      carduid: `energy_basic_p1_${i}`,
      cardId: 'energy_basic',
      placedAt: 0,
      placedBy: p1.id,
      isRested: false,
      isExtraEnergy: false,
    });
  }

  return { env, p1, p2 };
}

function addHandCommand(player, cardId) {
  const uid = `${cardId}_hand_test_0001`;
  player.deck._handUids = [uid];
  return uid;
}

function addUnit(player, slotName, cardId, opts = {}) {
  const cardData = CardDatabaseManager.getCardDetails(cardId);
  if (!cardData) throw new Error(`Missing unit card data: ${cardId}`);
  const uid = `${cardId}_${player.id}_${slotName}_${opts.tag || 'u'}`;
  player.zones[slotName].unit = {
    carduid: uid,
    cardId,
    cardData,
    placedAt: 0,
    placedBy: player.id,
    isRested: opts.isRested === true,
    damageReceived: Number(opts.damageReceived || 0),
    modifyAP: 0,
    modifyHP: 0,
    continueModifyAP: 0,
    continueModifyHP: 0,
    originalAP: Number(cardData.ap || 0),
    originalHP: Number(cardData.hp || 0),
    playedThisTurn: false,
    canAttackOnPlayTurn: false,
    canAttackThisTurn: true,
    isFirstPlay: false,
    effectUsage: {},
  };
  return uid;
}

function addPilot(player, slotName, cardId, opts = {}) {
  const cardData = CardDatabaseManager.getCardDetails(cardId);
  if (!cardData) throw new Error(`Missing pilot card data: ${cardId}`);
  const uid = `${cardId}_${player.id}_${slotName}_${opts.tag || 'p'}`;
  player.zones[slotName].pilot = {
    carduid: uid,
    cardId,
    cardData,
    placedAt: 0,
    placedBy: player.id,
    isRested: opts.isRested === true,
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

function addBase(player, cardId, opts = {}) {
  const cardData = CardDatabaseManager.getCardDetails(cardId);
  if (!cardData) throw new Error(`Missing base card data: ${cardId}`);
  const uid = `${cardId}_${player.id}_base_${opts.tag || 'b'}`;
  player.zones.base.push({
    carduid: uid,
    cardId,
    cardData,
    placedAt: 0,
    placedBy: player.id,
    isRested: opts.isRested === true,
    effectUsage: {},
    originalHP: Number(cardData.hp || 0),
    damageReceived: 0,
  });
  return uid;
}

function setActionStepBattle(env, attackerUid, targetUid) {
  env.phase = 'ACTION_STEP_PHASE';
  env.currentBattle = {
    actionType: 'attackUnit',
    attackingPlayerId: 'playerId_1',
    defendingPlayerId: 'playerId_2',
    attackerCarduid: attackerUid,
    targetCarduid: targetUid,
    targetPlayerId: 'playerId_2',
    status: 'ACTION_STEP',
    confirmations: {
      playerId_1: false,
      playerId_2: false,
    },
    fromBurst: false,
    openedAt: Date.now(),
  };
}

function prepareCommand(env, carduid) {
  return PlayCardPreparationManager.prepare(
    env,
    'playerId_1',
    {
      carduid,
      playAs: 'command',
      gameId: 'test_game',
    },
    false
  );
}

const CASES = [
  {
    cardId: 'GD01-121',
    actionStep: false,
    setupPositive: ({ p1 }) => {
      addUnit(p1, 'slot1', FIXTURE_IDS.blockerUnit, { isRested: true, tag: 'pos' });
    },
    setupNegative: ({ p1 }) => {
      addUnit(p1, 'slot1', FIXTURE_IDS.blockerUnit, { isRested: false, tag: 'neg' });
    },
  },
  {
    cardId: 'GD02-100',
    actionStep: false,
    setupPositive: ({ p1 }) => {
      addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { damageReceived: 1, tag: 'pos' });
    },
    setupNegative: ({ p1 }) => {
      addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { damageReceived: 0, tag: 'neg' });
    },
  },
  {
    cardId: 'GD02-101',
    actionStep: false,
    setupPositive: ({ p2 }) => {
      addUnit(p2, 'slot1', FIXTURE_IDS.unitLe2, { tag: 'pos' });
    },
    setupNegative: ({ p2 }) => {
      addUnit(p2, 'slot1', FIXTURE_IDS.unitLe5, { tag: 'neg' });
    },
  },
  {
    cardId: 'GD02-107',
    actionStep: false,
    setupPositive: ({ p2 }) => {
      addUnit(p2, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'pos' });
    },
    setupNegative: () => {},
  },
  {
    cardId: 'GD03-102',
    actionStep: true,
    setupPositive: ({ env, p1, p2 }) => {
      const attacker = addUnit(p1, 'slot1', FIXTURE_IDS.titansUnit, { isRested: true, tag: 'att' });
      addPilot(p1, 'slot1', FIXTURE_IDS.pilot, { tag: 'pair' });
      const target = addUnit(p2, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'tgt' });
      setActionStepBattle(env, attacker, target);
    },
    setupNegative: ({ env, p1, p2 }) => {
      const attacker = addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { isRested: true, tag: 'att' });
      const target = addUnit(p2, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'tgt' });
      setActionStepBattle(env, attacker, target);
    },
  },
  {
    cardId: 'GD03-110',
    actionStep: false,
    setupPositive: ({ p2 }) => {
      addUnit(p2, 'slot1', FIXTURE_IDS.unitLe5, { tag: 'u' });
      addPilot(p2, 'slot1', FIXTURE_IDS.pilot, { tag: 'p' });
    },
    setupNegative: ({ p2 }) => {
      addUnit(p2, 'slot1', FIXTURE_IDS.unitLe5, { tag: 'u' });
    },
  },
  {
    cardId: 'GD03-113',
    actionStep: false,
    setupPositive: ({ p1 }) => {
      addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { isRested: false, tag: 'pos' });
    },
    setupNegative: ({ p1 }) => {
      addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { isRested: true, tag: 'neg' });
    },
  },
  {
    cardId: 'GD03-116',
    actionStep: false,
    setupPositive: ({ p1 }) => {
      addUnit(p1, 'slot1', FIXTURE_IDS.vaganUnit, { tag: 'pos' });
    },
    setupNegative: ({ p1 }) => {
      addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'neg' });
    },
  },
  {
    cardId: 'GD03-118',
    actionStep: true,
    setupPositive: ({ env, p1, p2 }) => {
      const attacker = addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'att' });
      const target = addUnit(p2, 'slot1', FIXTURE_IDS.unitLe4, { isRested: true, tag: 'tgt' });
      setActionStepBattle(env, attacker, target);
    },
    setupNegative: ({ env, p1, p2 }) => {
      const attacker = addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'att' });
      const target = addUnit(p2, 'slot1', FIXTURE_IDS.unitLe4, { isRested: false, tag: 'tgt' });
      setActionStepBattle(env, attacker, target);
    },
  },
  {
    cardId: 'GD03-119',
    actionStep: false,
    setupPositive: ({ p1 }) => {
      addBase(p1, FIXTURE_IDS.base, { isRested: true, tag: 'pos' });
    },
    setupNegative: ({ p1 }) => {
      addBase(p1, FIXTURE_IDS.base, { isRested: false, tag: 'neg' });
    },
  },
  {
    cardId: 'GD03-121',
    actionStep: true,
    setupPositive: ({ env, p1, p2 }) => {
      const attacker = addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'att' });
      const target = addUnit(p2, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'tgt' });
      setActionStepBattle(env, attacker, target);
      addBase(p1, FIXTURE_IDS.base, { isRested: false, tag: 'pos' });
    },
    setupNegative: ({ env, p1, p2 }) => {
      const attacker = addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'att' });
      const target = addUnit(p2, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'tgt' });
      setActionStepBattle(env, attacker, target);
      addBase(p1, FIXTURE_IDS.base, { isRested: true, tag: 'neg' });
    },
  },
  {
    cardId: 'GD03-122',
    actionStep: true,
    setupPositive: ({ env, p1, p2 }) => {
      const attacker = addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'att' });
      const target = addUnit(p2, 'slot1', FIXTURE_IDS.unitLe3, { tag: 'tgt' });
      setActionStepBattle(env, attacker, target);
    },
    setupNegative: ({ env, p1, p2 }) => {
      const attacker = addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'att' });
      const target = addUnit(p2, 'slot1', FIXTURE_IDS.unitLe5, { tag: 'tgt' });
      setActionStepBattle(env, attacker, target);
    },
  },
  {
    cardId: 'ST05-013',
    actionStep: false,
    setupPositive: ({ p1 }) => {
      addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'pos' });
    },
    setupNegative: () => {},
  },
];

describe('mandatory first sequence step playability regression (13 command cards)', () => {
  test.each(CASES)('$cardId is playable only when mandatory step-1 has at least one target', ({ cardId, actionStep, setupPositive, setupNegative }) => {
    const pos = createBaseEnv({ phase: actionStep ? 'ACTION_STEP_PHASE' : 'MAIN_PHASE', actionStep });
    const posUid = addHandCommand(pos.p1, cardId);
    setupPositive(pos);
    const positiveResult = prepareCommand(pos.env, posUid);
    expect(positiveResult.success).toBe(true);

    const neg = createBaseEnv({ phase: actionStep ? 'ACTION_STEP_PHASE' : 'MAIN_PHASE', actionStep });
    const negUid = addHandCommand(neg.p1, cardId);
    setupNegative(neg);
    const negativeResult = prepareCommand(neg.env, negUid);
    expect(negativeResult.success).toBe(false);
    expect(String(negativeResult.error || '')).toContain('No eligible targets for mandatory effect step');
  });

  test('optional later steps do not block playability when step-1 is valid (GD03-118)', () => {
    const { env, p1, p2 } = createBaseEnv({ phase: 'ACTION_STEP_PHASE', actionStep: true });
    const cmdUid = addHandCommand(p1, 'GD03-118');
    const attacker = addUnit(p1, 'slot1', FIXTURE_IDS.anyUnit, { tag: 'att' });
    const target = addUnit(p2, 'slot1', FIXTURE_IDS.unitLe4, { isRested: true, tag: 'tgt' });
    setActionStepBattle(env, attacker, target);

    const result = prepareCommand(env, cmdUid);
    expect(result.success).toBe(true);
  });
});
