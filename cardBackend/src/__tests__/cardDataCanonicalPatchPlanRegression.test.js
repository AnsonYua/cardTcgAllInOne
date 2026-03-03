const gd01 = require('../data/gd01Card.json');
const gd02 = require('../data/gd02Card.json');
const gd03 = require('../data/gd03Card.json');
const st01 = require('../data/st01Card.json');
const st02 = require('../data/st02Card.json');
const st03 = require('../data/st03Card.json');
const st04 = require('../data/st04Card.json');
const st05 = require('../data/st05Card.json');
const st06 = require('../data/st06Card.json');
const st07 = require('../data/st07Card.json');
const st08 = require('../data/st08Card.json');
const { CardDatabaseManager } = require('../models/CardSystem');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { applyPreventEffectDamageEffect } = require('../services/effects/actions/EffectEffectDamagePreventionActions');
const { EffectExecutor } = require('../services/effects/EffectExecutor');

const CARD_FILES = [
  ['gd01Card.json', gd01],
  ['gd02Card.json', gd02],
  ['gd03Card.json', gd03],
  ['st01Card.json', st01],
  ['st02Card.json', st02],
  ['st03Card.json', st03],
  ['st04Card.json', st04],
  ['st05Card.json', st05],
  ['st06Card.json', st06],
  ['st07Card.json', st07],
  ['st08Card.json', st08]
];

function walk(node, onNode) {
  if (Array.isArray(node)) {
    node.forEach((entry) => walk(entry, onNode));
    return;
  }
  if (!node || typeof node !== 'object') {
    return;
  }
  onNode(node);
  Object.values(node).forEach((entry) => walk(entry, onNode));
}

describe('card data canonical patch plan regression', () => {
  test('GD02-098 includes explicit name alias rule for Char Aznable', () => {
    const card = gd02.cards['GD02-098'];
    const aliasRule = card.effects.rules.find((rule) => rule.effectId === 'name_alias_char_aznable');

    expect(aliasRule).toBeTruthy();
    expect(aliasRule.action).toBe('set_name_alias');
    expect(aliasRule.type).toBe('continuous');
    expect(aliasRule.trigger).toBe('continuous');
    expect(aliasRule.parameters.alsoTreatedAs).toContain('Char Aznable');
  });

  test('ST01-011 setActive effect explicitly targets a resource choice', () => {
    const card = st01.cards['ST01-011'];
    const activateRule = card.effects.rules.find((rule) => rule.effectId === 'attack_activate_resource');

    expect(activateRule).toBeTruthy();
    expect(activateRule.action).toBe('setActive');
    expect(activateRule.target).toBeTruthy();
    expect(activateRule.target.type).toBe('energy');
    expect(activateRule.target.scope).toBe('self_resource');
    expect(activateRule.target.count).toBe(1);
  });

  test('ST03-014 prevent_battle_damage explicitly specifies enemy_units source', () => {
    const card = st03.cards['ST03-014'];
    const rule = card.effects.rules.find((entry) => entry.action === 'prevent_battle_damage');

    expect(rule).toBeTruthy();
    expect(rule.parameters.from).toBe('enemy_units');
    expect(rule.parameters.maxEnemyAp).toBe(2);
  });

  test('known description/rules mapping cards now have equal counts', () => {
    const checks = [
      ['gd01Card.json', gd01.cards['GD01-025']],
      ['gd01Card.json', gd01.cards['GD01-076']],
      ['gd01Card.json', gd01.cards['GD01-081']],
      ['gd02Card.json', gd02.cards['GD02-006']],
      ['gd02Card.json', gd02.cards['GD02-098']],
      ['gd03Card.json', gd03.cards['GD03-013']],
      ['gd03Card.json', gd03.cards['GD03-020']],
      ['gd03Card.json', gd03.cards['GD03-049']],
      ['gd03Card.json', gd03.cards['T-014']]
    ];

    checks.forEach(([fileName, card]) => {
      expect(Array.isArray(card.effects.description)).toBe(true);
      expect(Array.isArray(card.effects.rules)).toBe(true);
      expect(card.effects.description.length).toBe(card.effects.rules.length);
      expect(card.effects.description.length).toBeGreaterThan(0);
      expect(fileName).toMatch(/Card\.json$/);
    });
  });

  test('restrict_attack uses canonical parameters.disallow across all card files', () => {
    const violations = [];

    for (const [fileName, json] of CARD_FILES) {
      const cards = json.cards || {};
      for (const [cardId, card] of Object.entries(cards)) {
        walk(card.effects?.rules || [], (node) => {
          if (node.action !== 'restrict_attack') {
            return;
          }
          const parameters = node.parameters && typeof node.parameters === 'object' ? node.parameters : {};
          if (Object.prototype.hasOwnProperty.call(parameters, 'restriction')) {
            violations.push(`${fileName}:${cardId}:${node.effectId || 'unknown'}`);
          }
        });
      }
    }

    expect(violations).toEqual([]);
  });

  test('GD02-098 set_name_alias rule is executable and idempotent at runtime', () => {
    const gameEnv = new GameEnvironment();
    gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');

    const unitUid = 'GD01-001_runtime_alias_unit_0001';
    const pilotUid = 'GD02-098_runtime_alias_pilot_0001';
    expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unitUid, playAs: 'unit' }).success).toBe(true);
    expect(
      PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
        carduid: pilotUid,
        playAs: 'pilot',
        targetUnit: unitUid
      }).success
    ).toBe(true);

    const aliasRule = gd02.cards['GD02-098'].effects.rules.find((rule) => rule.effectId === 'name_alias_char_aznable');
    expect(aliasRule).toBeTruthy();

    const first = EffectExecutor.applyEffectToTargets(gameEnv, aliasRule, [], 'playerId_1', pilotUid);
    expect(first.success).toBe(true);
    const second = EffectExecutor.applyEffectToTargets(gameEnv, aliasRule, [], 'playerId_1', pilotUid);
    expect(second.success).toBe(true);

    const player = gameEnv.getPlayer('playerId_1');
    const pilot = player.zones.slot1?.pilot;
    expect(pilot).toBeTruthy();
    expect(Array.isArray(pilot.nameAliases)).toBe(true);
    expect(pilot.nameAliases).toContain('Char Aznable');
    expect(pilot.nameAliases.filter((entry) => entry === 'Char Aznable')).toHaveLength(1);
  });

  test('GD02-098 set_name_alias is executable in continuous processing without duplicate aliases', () => {
    const gameEnv = new GameEnvironment();
    gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');

    const unitUid = 'GD01-001_alias_continuous_unit_0001';
    const pilotUid = 'GD02-098_alias_continuous_pilot_0001';
    expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unitUid, playAs: 'unit' }).success).toBe(true);
    expect(
      PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
        carduid: pilotUid,
        playAs: 'pilot',
        targetUnit: unitUid
      }).success
    ).toBe(true);

    const first = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
    expect(first.success).toBe(true);
    const second = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
    expect(second.success).toBe(true);

    const pilot = gameEnv.getPlayer('playerId_1').zones.slot1?.pilot;
    expect(Array.isArray(pilot?.nameAliases)).toBe(true);
    expect(pilot.nameAliases.filter((entry) => entry === 'Char Aznable')).toHaveLength(1);
  });

  test('set_name_alias does not mutate shared CardDatabase cardData', () => {
    CardDatabaseManager.reloadDatabase();
    const before = CardDatabaseManager.getCardDetails('GD02-098');
    expect(before?.nameAliases).toBeUndefined();

    const gameEnv = new GameEnvironment();
    gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');

    const unitUid = 'GD01-001_alias_db_unit_0001';
    const pilotUid = 'GD02-098_alias_db_pilot_0001';
    expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unitUid, playAs: 'unit' }).success).toBe(true);
    expect(
      PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
        carduid: pilotUid,
        playAs: 'pilot',
        targetUnit: unitUid
      }).success
    ).toBe(true);

    const aliasRule = gd02.cards['GD02-098'].effects.rules.find((rule) => rule.effectId === 'name_alias_char_aznable');
    expect(aliasRule).toBeTruthy();
    expect(EffectExecutor.applyEffectToTargets(gameEnv, aliasRule, [], 'playerId_1', pilotUid).success).toBe(true);

    const after = CardDatabaseManager.getCardDetails('GD02-098');
    expect(after?.nameAliases).toBeUndefined();
  });

  test('prevent_damage generic effect-damage handler rejects base-battle variant keys', () => {
    const gameEnv = new GameEnvironment();
    gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');

    const unitUid = 'GD01-001_prevent_damage_variant_unit_0001';
    expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unitUid, playAs: 'unit' }).success).toBe(true);

    const invalidBaseVariant = {
      effectId: 'prevent_damage_invalid_variant',
      type: 'triggered',
      trigger: 'PLAY_CARD',
      action: 'prevent_damage',
      parameters: {
        from: 'enemy_units',
        enemyLevel: '<=3'
      }
    };

    const result = applyPreventEffectDamageEffect(
      gameEnv,
      'playerId_1',
      unitUid,
      invalidBaseVariant,
      [{ carduid: unitUid, zone: 'slot1', playerId: 'playerId_1' }]
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/base-battle semantics/);
  });

  test('all blocker drift cards now use redirect_attack blocker schema', () => {
    const checks = [
      ['GD01-019', gd01.cards['GD01-019']],
      ['GD01-081', gd01.cards['GD01-081']],
      ['GD01-096', gd01.cards['GD01-096']],
      ['GD02-076', gd02.cards['GD02-076']],
      ['GD02-082', gd02.cards['GD02-082']]
    ];

    checks.forEach(([cardId, card]) => {
      const blockerRule = card.effects.rules.find((rule) => /blocker/i.test(rule.effectId));
      expect(blockerRule).toBeTruthy();
      expect(blockerRule.action).toBe('redirect_attack');
      expect(blockerRule.trigger).toBe('ATTACK_REDIRECT');
      expect(blockerRule.parameters?.cost).toBe('rest_self');
      expect(blockerRule.parameters?.keyword).toBeUndefined();
      expect(cardId).toMatch(/GD0[12]-/);
    });
  });

  test('GD02-021 deploy_effect keeps full if-you-do sequence semantics', () => {
    const card = gd02.cards['GD02-021'];
    const rule = card.effects.rules.find((entry) => entry.effectId === 'deploy_effect');
    expect(rule).toBeTruthy();
    expect(rule.action).toBe('sequence');

    const steps = rule.parameters?.steps;
    expect(Array.isArray(steps)).toBe(true);
    expect(steps[0]?.stepId).toBe('discard_ef_unit');
    expect(steps[0]?.action).toBe('discard');
    expect(steps[0]?.optional).toBe(true);
    expect(steps[0]?.target?.scope).toBe('self_hand');
    expect(steps[0]?.target?.filters?.cardType).toBe('unit');
    expect(steps[0]?.target?.filters?.color).toBe('Green');
    expect(steps[0]?.target?.filters?.traits).toEqual(expect.arrayContaining(['Earth Federation']));

    const ifYouDoConditional = steps[1];
    expect(ifYouDoConditional?.action).toBe('conditional');
    expect(ifYouDoConditional?.parameters?.if).toEqual(
      expect.arrayContaining([{ type: 'stepResolved', stepId: 'discard_ef_unit' }])
    );
    expect(ifYouDoConditional?.parameters?.then?.[0]?.action).toBe('addExtraEnergy');
    expect(ifYouDoConditional?.parameters?.then?.[0]?.parameters?.value).toBe(1);

    const levelConditional = ifYouDoConditional?.parameters?.then?.[1];
    expect(levelConditional?.action).toBe('conditional');
    expect(levelConditional?.parameters?.if).toEqual(
      expect.arrayContaining([{ type: 'playerLevel', scope: 'self', value: '>=7' }])
    );
    expect(levelConditional?.parameters?.then?.[0]?.action).toBe('draw');
    expect(levelConditional?.parameters?.then?.[0]?.parameters?.value).toBe(1);
  });

  test('GD01-103 main rest effect keeps friendly-then-enemy sequence semantics', () => {
    const card = gd01.cards['GD01-103'];
    const rule = card.effects.rules.find((entry) => entry.effectId === 'rest');
    expect(rule).toBeTruthy();
    expect(rule.type).toBe('play');
    expect(rule.action).toBe('sequence');

    const steps = rule.parameters?.steps;
    expect(Array.isArray(steps)).toBe(true);

    const restFriendly = steps[0];
    expect(restFriendly?.stepId).toBe('rest_friendly_ef_unit');
    expect(restFriendly?.action).toBe('rest');
    expect(restFriendly?.target?.type).toBe('unit');
    expect(restFriendly?.target?.scope).toBe('self');
    expect(restFriendly?.target?.count).toBe(1);
    expect(restFriendly?.target?.filters?.status).toBe('active');
    expect(restFriendly?.target?.filters?.traits).toEqual(expect.arrayContaining(['Earth Federation']));

    const restEnemy = steps[1];
    expect(restEnemy?.stepId).toBe('rest_enemy_unit');
    expect(restEnemy?.action).toBe('rest');
    expect(restEnemy?.target?.type).toBe('unit');
    expect(restEnemy?.target?.scope).toBe('opponent');
    expect(restEnemy?.target?.count).toBe(1);
    expect(restEnemy?.target?.filters?.status).toBe('active');
  });

  test('GD03-064 deploy_effect keeps add-from-trash gated discard semantics', () => {
    const card = gd03.cards['GD03-064'];
    const rule = card.effects.rules.find((entry) => entry.effectId === 'deploy_effect');
    expect(rule).toBeTruthy();
    expect(rule.action).toBe('sequence');

    const steps = rule.parameters?.steps;
    expect(Array.isArray(steps)).toBe(true);
    expect(steps[0]?.stepId).toBe('add_x_rounder_from_trash');
    expect(steps[0]?.action).toBe('addToHand');
    expect(steps[0]?.optional).toBe(true);
    expect(steps[0]?.target?.scope).toBe('self_trash');
    expect(steps[0]?.target?.filters?.traits).toEqual(expect.arrayContaining(['X-Rounder']));

    const ifYouDoConditional = steps[1];
    expect(ifYouDoConditional?.action).toBe('conditional');
    expect(ifYouDoConditional?.parameters?.if).toEqual(
      expect.arrayContaining([{ type: 'stepResolved', stepId: 'add_x_rounder_from_trash' }])
    );
    expect(ifYouDoConditional?.parameters?.then?.[0]?.action).toBe('discard');
    expect(ifYouDoConditional?.parameters?.then?.[0]?.target?.scope).toBe('self_hand');
    expect(ifYouDoConditional?.parameters?.then?.[0]?.parameters?.value).toBe(1);
  });
});
