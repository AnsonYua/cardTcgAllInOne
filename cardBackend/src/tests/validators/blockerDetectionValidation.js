require('ts-node/register/transpile-only');

const { isBlockerRedirectRule } = require('../../utils/BlockerRuleUtils');
const { CardDatabaseManager } = require('../../models/CardSystem');

function loadAllCardRules() {
  const rules = [];
  const cards = CardDatabaseManager.getAllCards();

  for (const [cardId, card] of Object.entries(cards)) {
    const cardRules = (card && card.effects && Array.isArray(card.effects.rules)) ? card.effects.rules : [];
    for (const rule of cardRules) {
      rules.push({ cardId, rule });
    }
  }

  return rules;
}

function validateBlockerRedirectRulesAreRecognized() {
  const rules = loadAllCardRules();
  const blockerRedirects = rules.filter(
    ({ rule }) => rule && rule.trigger === 'ATTACK_REDIRECT' && rule.action === 'redirect_attack'
  );

  if (blockerRedirects.length === 0) {
    throw new Error('Expected at least one ATTACK_REDIRECT redirect_attack rule in card data');
  }

  for (const entry of blockerRedirects) {
    if (!isBlockerRedirectRule(entry.rule)) {
      throw new Error(
        `Expected isBlockerRedirectRule=true for ${entry.cardId} effectId=${String(entry.rule.effectId)}`
      );
    }
  }
}

function validateNonBlockerRulesDoNotMatch() {
  const rules = loadAllCardRules();
  const samples = rules
    .filter(({ rule }) => rule && typeof rule === 'object')
    .filter(({ rule }) => !(rule.trigger === 'ATTACK_REDIRECT' && rule.action === 'redirect_attack'))
    .slice(0, 100);

  for (const entry of samples) {
    if (isBlockerRedirectRule(entry.rule)) {
      throw new Error(
        `Expected isBlockerRedirectRule=false for ${entry.cardId} effectId=${String(entry.rule.effectId)} trigger=${String(entry.rule.trigger)} action=${String(entry.rule.action)}`
      );
    }
  }
}

function validateBlockerDetection() {
  validateBlockerRedirectRulesAreRecognized();
  validateNonBlockerRulesDoNotMatch();
  console.log('OK: blocker detection validation');
}

module.exports = {
  validateBlockerDetection
};
