require('ts-node/register/transpile-only');

const { normalizeEffectRule } = require('../../utils/EffectNormalizationUtils');

function validateNormalizeEffectRulePreservesCountRange() {
  const rawRule = {
    effectId: 'test_count_range_rule',
    type: 'play',
    trigger: 'ACTION_STEP',
    action: 'modifyAP',
    target: {
      type: 'unit',
      scope: 'self_all_unit',
      selection: { type: 'player_choice' },
      count: { min: 1, max: 2 }
    },
    parameters: { value: 2 }
  };

  const normalized = normalizeEffectRule(rawRule, {
    fallbackEffectId: 'fallback',
    defaultTargetScope: 'opponent',
    defaultTargetType: 'unit',
    defaultTargetCount: 1,
    requireAction: true
  });

  if (!normalized || !normalized.target || !normalized.target.count) {
    throw new Error('Expected normalized rule to include target.count');
  }

  const count = normalized.target.count;
  if (!count || typeof count !== 'object' || count.min !== 1 || count.max !== 2) {
    throw new Error(`Expected normalized target.count to be {min:1,max:2} (got ${JSON.stringify(count)})`);
  }

  console.log('OK: normalizeEffectRule preserves count range');
}

module.exports = {
  validateNormalizeEffectRulePreservesCountRange
};

