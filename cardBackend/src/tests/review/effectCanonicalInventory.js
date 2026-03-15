const fs = require('fs');
const path = require('path');
const {
  hasAlwaysOnKeywordText,
  hasRepairRule,
  hasBlockerRule,
  hasBreachRule,
  hasLegacyEncoding
} = require('../validators/alwaysOnEffectUtils');

const CARD_FILES = [
  'gd01Card.json',
  'gd02Card.json',
  'gd03Card.json',
  'st01Card.json',
  'st02Card.json',
  'st03Card.json',
  'st04Card.json',
  'st05Card.json',
  'st06Card.json',
  'st07Card.json',
  'st08Card.json',
  'st09Card.json'
];

function loadCardFile(baseDir, fileName) {
  const filePath = path.join(baseDir, 'src', 'data', fileName);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function classifyAlwaysOnCompleteness(card) {
  const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
  const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
  const text = descriptions
    .filter((line) => typeof line === 'string')
    .join(' ');

  const hasRepairText = hasAlwaysOnKeywordText(descriptions, 'repair');
  const hasBlockerText = hasAlwaysOnKeywordText(descriptions, 'blocker');
  const hasBreachText = hasAlwaysOnKeywordText(descriptions, 'breach');
  const hasPassiveText = hasRepairText || hasBlockerText || hasBreachText || /\bWhile\b/i.test(text);

  const hasRepairRuleCapability = hasRepairRule(rules);
  const hasBlockerRuleCapability = hasBlockerRule(rules);
  const hasBreachRuleCapability = hasBreachRule(rules);
  const usesLegacyEncoding = hasLegacyEncoding(rules);

  if (
    (hasRepairText && !hasRepairRuleCapability) ||
    (hasBlockerText && !hasBlockerRuleCapability) ||
    (hasBreachText && !hasBreachRuleCapability)
  ) {
    return 'likely-missing-rule';
  }

  if (!hasPassiveText) {
    return 'no-passive-text';
  }

  if (hasRepairRuleCapability || hasBlockerRuleCapability || hasBreachRuleCapability) {
    return usesLegacyEncoding ? 'legacy-encoding-but-behaviorally-complete' : 'complete';
  }

  return 'complete';
}

function generateEffectInventoryReport(baseDir) {
  const cards = [];
  const ruleTypeSummary = {};

  for (const fileName of CARD_FILES) {
    const fileJson = loadCardFile(baseDir, fileName);
    const fileCards = fileJson.cards || {};

    for (const [cardId, card] of Object.entries(fileCards)) {
      const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
      const descriptions = Array.isArray(card?.effects?.description) ? card.effects.description : [];
      for (const rule of rules) {
        const type = typeof rule?.type === 'string' ? rule.type : 'unknown';
        ruleTypeSummary[type] = (ruleTypeSummary[type] || 0) + 1;
      }

      cards.push({
        file: fileName,
        cardId,
        name: card?.name || '',
        cardType: card?.cardType || '',
        descriptionCount: descriptions.length,
        ruleCount: rules.length,
        effectIds: rules.map((rule) => rule.effectId || 'unknown'),
        alwaysOnStatus: classifyAlwaysOnCompleteness(card)
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    fileCount: CARD_FILES.length,
    cardCount: cards.length,
    ruleTypeSummary,
    cards
  };
}

function generateAlwaysOnCompletenessReport(baseDir) {
  const entries = [];

  for (const fileName of CARD_FILES) {
    const fileJson = loadCardFile(baseDir, fileName);
    const fileCards = fileJson.cards || {};

    for (const [cardId, card] of Object.entries(fileCards)) {
      const status = classifyAlwaysOnCompleteness(card);
      if (status === 'no-passive-text') {
        continue;
      }
      entries.push({
        file: fileName,
        cardId,
        name: card?.name || '',
        status
      });
    }
  }

  const summary = entries.reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] || 0) + 1;
    return acc;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    entryCount: entries.length,
    summary,
    entries
  };
}

module.exports = {
  CARD_FILES,
  generateEffectInventoryReport,
  generateAlwaysOnCompletenessReport,
  __testUtils: {
    classifyAlwaysOnCompleteness
  }
};
