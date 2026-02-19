const fs = require('fs');
const path = require('path');

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
  'st08Card.json'
];

function loadCards(fileName) {
  const filePath = path.join(__dirname, '..', '..', 'data', fileName);
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return json.cards || {};
}

function walkRules(node, context, out, inheritedTrigger) {
  if (Array.isArray(node)) {
    node.forEach((entry, index) => walkRules(entry, `${context}[${index}]`, out, inheritedTrigger));
    return;
  }

  if (!node || typeof node !== 'object') {
    return;
  }

  const trigger = typeof node.trigger === 'string' ? node.trigger : inheritedTrigger;
  const action = typeof node.action === 'string' ? node.action : '';

  if (action === 'allow_attack_target') {
    out.push({
      trigger,
      target: node.target,
      context
    });
  }

  for (const [key, value] of Object.entries(node)) {
    walkRules(value, context ? `${context}.${key}` : key, out, trigger);
  }
}

function validateAllowAttackTargetSchema() {
  const errors = [];

  for (const fileName of CARD_FILES) {
    const cards = loadCards(fileName);
    for (const [cardId, card] of Object.entries(cards)) {
      const rules = card && card.effects && Array.isArray(card.effects.rules) ? card.effects.rules : [];
      const collected = [];
      walkRules(rules, 'rules', collected, null);

      for (const entry of collected) {
        const trigger = typeof entry.trigger === 'string' ? entry.trigger.toUpperCase() : '';
        const target = entry.target && typeof entry.target === 'object' ? entry.target : null;

        if (!target && trigger !== 'CONTINUOUS') {
          errors.push(
            `${fileName}:${cardId}:${entry.context} non-continuous allow_attack_target must define explicit target`
          );
          continue;
        }

        if (!target) {
          continue;
        }

        const scope = typeof target.scope === 'string' ? target.scope.toLowerCase() : '';
        const selectionType =
          target.selection && typeof target.selection.type === 'string'
            ? target.selection.type.toLowerCase()
            : '';

        if (scope === 'self' && selectionType !== 'player_choice') {
          errors.push(
            `${fileName}:${cardId}:${entry.context} allow_attack_target scope=self without player_choice is ambiguous; use source/source_paired_unit`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  console.log('OK: allow_attack_target schema validation');
}

module.exports = {
  validateAllowAttackTargetSchema
};
