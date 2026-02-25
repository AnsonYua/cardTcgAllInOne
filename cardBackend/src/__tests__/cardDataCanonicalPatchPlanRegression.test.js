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
});
