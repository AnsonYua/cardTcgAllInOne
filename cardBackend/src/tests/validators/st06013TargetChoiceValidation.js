require('ts-node/register/transpile-only');

const { TargetChoicePolicy } = require('../../services/choices/TargetChoicePolicy');
const { TargetResolver } = require('../../services/targets/TargetResolver');

function validateSt06013AllowsOneToTwoTargets() {
  const st06Cards = require('../../data/st06Card.json');
  const fierceUnity = st06Cards && st06Cards.cards ? st06Cards.cards['ST06-013'] : undefined;
  if (!fierceUnity) {
    throw new Error('ST06-013 not found in st06Card.json');
  }

  const rules = fierceUnity.effects && Array.isArray(fierceUnity.effects.rules)
    ? fierceUnity.effects.rules
    : [];
  const preventRule = rules.find(r => r && r.effectId === 'action_prevent_battle_damage_from_enemy_units_le_2_for_clan');
  if (!preventRule) {
    throw new Error('ST06-013 prevent_battle_damage rule not found');
  }

  const selectionType = preventRule.target && preventRule.target.selection && preventRule.target.selection.type;
  if (selectionType !== 'player_choice') {
    throw new Error(`ST06-013 should use target.selection.type="player_choice" (got ${String(selectionType)})`);
  }

  const rawCount = preventRule.target && preventRule.target.count;
  if (!rawCount || typeof rawCount !== 'object') {
    throw new Error('ST06-013 target.count should be a {min,max} object');
  }
  if (rawCount.min !== 1 || rawCount.max !== 2) {
    throw new Error(`ST06-013 target.count should be {min:1,max:2} (got ${JSON.stringify(rawCount)})`);
  }

  const targetConfig = TargetResolver.resolveTargetConfig(preventRule);

  const availableTargets3 = [
    { carduid: 'unit_a', zone: 'slot1', playerId: 'playerId_1' },
    { carduid: 'unit_b', zone: 'slot2', playerId: 'playerId_1' },
    { carduid: 'unit_c', zone: 'slot3', playerId: 'playerId_1' }
  ];

  const requiresChoice = TargetChoicePolicy.requiresChoice(targetConfig, availableTargets3, preventRule);
  if (!requiresChoice) {
    throw new Error('Expected ST06-013 to require TARGET_CHOICE when 3 eligible targets exist');
  }

  console.log('OK: ST06-013 target choice validation');
}

module.exports = {
  validateSt06013AllowsOneToTwoTargets
};
