function walkRuleSteps(steps, visitor) {
  if (!Array.isArray(steps)) {
    return;
  }
  for (const step of steps) {
    if (!step || typeof step !== 'object') {
      continue;
    }
    visitor(step);
    if (Array.isArray(step?.parameters?.steps)) {
      walkRuleSteps(step.parameters.steps, visitor);
    }
    if (Array.isArray(step?.parameters?.then)) {
      walkRuleSteps(step.parameters.then, visitor);
    }
    if (Array.isArray(step?.parameters?.else)) {
      walkRuleSteps(step.parameters.else, visitor);
    }
    if (Array.isArray(step?.parameters?.branches)) {
      for (const branch of step.parameters.branches) {
        if (Array.isArray(branch?.steps)) {
          walkRuleSteps(branch.steps, visitor);
        }
      }
    }
  }
}

function hasRuleCapability(rules, predicate) {
  for (const rule of rules) {
    if (predicate(rule)) {
      return true;
    }
    let foundInSteps = false;
    walkRuleSteps(rule?.parameters?.steps, (step) => {
      if (predicate(step)) {
        foundInSteps = true;
      }
    });
    if (foundInSteps) {
      return true;
    }
  }
  return false;
}

function normalizeKeywordValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAlwaysOnKeywordText(descriptions, keyword) {
  const normalizedKeyword = String(keyword || '').toLowerCase();
  const keywordPattern = normalizedKeyword === 'repair' || normalizedKeyword === 'breach'
    ? `<${normalizedKeyword}\\s*\\d+>`
    : `<${normalizedKeyword}>`;

  const startsWithKeywordRegex = new RegExp(`^\\s*${keywordPattern}`, 'i');
  const gainsKeywordRegex = new RegExp(
    `\\b(this Unit|all your .+ Units?|it)\\b.{0,100}\\b(gains?|gets?)\\s*${keywordPattern}`,
    'i'
  );

  return descriptions.some((line) =>
    typeof line === 'string' &&
    (startsWithKeywordRegex.test(line) || gainsKeywordRegex.test(line)) &&
    !/during this turn/i.test(line)
  );
}

function hasRepairRule(rules) {
  return hasRuleCapability(rules, (rule) => {
    const action = String(rule?.action || '').toLowerCase();
    const keyword = normalizeKeywordValue(rule?.parameters?.keyword);
    return action === 'heal' || (action === 'grant_keyword' && keyword.startsWith('repair'));
  });
}

function hasBlockerRule(rules) {
  return hasRuleCapability(rules, (rule) => {
    const action = String(rule?.action || '').toLowerCase();
    const keyword = normalizeKeywordValue(rule?.parameters?.keyword);
    const trigger = String(rule?.trigger || '').toUpperCase();
    return trigger === 'ATTACK_REDIRECT' || (action === 'grant_keyword' && keyword === 'blocker');
  });
}

function hasBreachRule(rules) {
  return hasRuleCapability(rules, (rule) => {
    const action = String(rule?.action || '').toLowerCase();
    const keyword = normalizeKeywordValue(rule?.parameters?.keyword);
    return (
      action === 'damageshield' ||
      action === 'grant_breach' ||
      (action === 'grant_keyword' && keyword.startsWith('breach'))
    );
  });
}

function hasLegacyEncoding(rules) {
  return rules.some((rule) => String(rule?.type || '').toLowerCase() === 'keyword');
}

module.exports = {
  hasAlwaysOnKeywordText,
  hasRepairRule,
  hasBlockerRule,
  hasBreachRule,
  hasRuleCapability,
  hasLegacyEncoding
};
