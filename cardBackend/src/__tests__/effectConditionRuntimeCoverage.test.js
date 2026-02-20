const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectConditionEvaluator } = require('../services/conditions/EffectConditionEvaluator');

function buildEffect(conditions) {
  return {
    effectId: 'runtime_condition_test',
    type: 'internal',
    trigger: 'SEQUENCE_STEP',
    action: 'noop',
    conditions
  };
}

function attachUnit(player, slot, carduid, cardData, isRested = false) {
  player.zones[slot].unit = {
    carduid,
    cardId: cardData.id,
    cardData,
    isRested,
    currentAP: cardData.ap,
    currentHP: cardData.hp
  };
  return player.zones[slot].unit;
}

function attachPilot(player, slot, carduid, cardData) {
  player.zones[slot].pilot = {
    carduid,
    cardId: cardData.id,
    cardData,
    isRested: false,
    currentAP: cardData.ap,
    currentHP: cardData.hp
  };
  return player.zones[slot].pilot;
}

describe('EffectConditionEvaluator runtime coverage additions', () => {
  test('pairedPilotTraitAny resolves from source pairing context', () => {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('p1', 'P1');
    gameEnv.addPlayer('p2', 'P2');

    const unit = attachUnit(p1, 'slot1', 'UNIT_001', {
      id: 'UNIT',
      name: 'Unit',
      cardType: 'unit',
      traits: ['Titans'],
      color: 'Blue',
      ap: 3,
      hp: 3
    });
    attachPilot(p1, 'slot1', 'PILOT_001', {
      id: 'PILOT',
      name: 'Pilot',
      cardType: 'pilot',
      traits: ['Cyber-Newtype'],
      color: 'Blue',
      ap: 1,
      hp: 1
    });

    const ok = EffectConditionEvaluator.validateEffectConditions(
      buildEffect([
        {
          type: 'pairedPilotTraitAny',
          scope: 'source',
          value: ['Cyber-Newtype', 'Newtype']
        }
      ]),
      gameEnv,
      'p1',
      unit
    );

    expect(ok).toBe(true);
  });

  test('unitsInPlayWithStatus respects scope and source exclusion', () => {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('p1', 'P1');
    gameEnv.addPlayer('p2', 'P2');

    const source = attachUnit(p1, 'slot1', 'SRC_001', {
      id: 'SRC',
      name: 'Source Unit',
      cardType: 'unit',
      traits: ['CB'],
      color: 'Purple',
      ap: 2,
      hp: 2
    }, true);

    attachUnit(p1, 'slot2', 'ALLY_001', {
      id: 'ALLY',
      name: 'Ally Unit',
      cardType: 'unit',
      traits: ['CB'],
      color: 'Purple',
      ap: 2,
      hp: 2
    }, true);

    const ok = EffectConditionEvaluator.validateEffectConditions(
      buildEffect([
        {
          type: 'unitsInPlayWithStatus',
          scope: 'self',
          status: 'rested',
          value: '>=1'
        }
      ]),
      gameEnv,
      'p1',
      source
    );

    expect(ok).toBe(true);
  });

  test('attackTargetCardType evaluates current battle target type', () => {
    const gameEnv = new GameEnvironment();
    const p1 = gameEnv.addPlayer('p1', 'P1');
    const p2 = gameEnv.addPlayer('p2', 'P2');

    const source = attachUnit(p1, 'slot1', 'ATK_001', {
      id: 'ATK',
      name: 'Attacker',
      cardType: 'unit',
      traits: [],
      color: 'Red',
      ap: 3,
      hp: 3
    });

    const defender = attachUnit(p2, 'slot1', 'DEF_001', {
      id: 'DEF',
      name: 'Defender',
      cardType: 'unit',
      traits: [],
      color: 'Blue',
      ap: 2,
      hp: 4
    });

    gameEnv.currentBattle = {
      attackerCarduid: source.carduid,
      targetCarduid: defender.carduid,
      attackingPlayerId: 'p1',
      defendingPlayerId: 'p2',
      actionType: 'attackUnit',
      status: 'ACTION_STEP',
      confirmations: { p1: false, p2: false }
    };

    const ok = EffectConditionEvaluator.validateEffectConditions(
      buildEffect([
        {
          type: 'attackTargetCardType',
          scope: 'battle',
          value: 'unit'
        }
      ]),
      gameEnv,
      'p1',
      source
    );

    expect(ok).toBe(true);
  });
});
