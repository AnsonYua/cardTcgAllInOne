const fs = require('fs');
const path = require('path');

describe('source scope pairing normalization', () => {
    test('card data does not use ambiguous scope=source for pilot->unit or unit->pilot targets', () => {
        const dataDir = path.join(__dirname, '..', 'data');
        const files = fs.readdirSync(dataDir).filter((file) => /Card\.json$/.test(file));
        const violations = [];

        for (const file of files) {
            const filePath = path.join(dataDir, file);
            const cardDb = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            for (const [cardId, card] of Object.entries(cardDb.cards || {})) {
                const cardType = String(card?.cardType || '').toLowerCase();
                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];

                for (let i = 0; i < rules.length; i += 1) {
                    const rule = rules[i] || {};

                    const target = rule.target;
                    const targetScope = String(target?.scope || '').toLowerCase();
                    const targetType = String(target?.type || '').toLowerCase();

                    if (targetScope === 'source' && (
                        (cardType === 'pilot' && targetType === 'unit') ||
                        (cardType === 'unit' && targetType === 'pilot')
                    )) {
                        violations.push(`${file}:${cardId}:rules[${i}].target scope=source (cardType=${cardType}, target.type=${targetType})`);
                    }

                    const steps = Array.isArray(rule?.parameters?.steps) ? rule.parameters.steps : [];
                    for (let j = 0; j < steps.length; j += 1) {
                        const stepTarget = steps[j]?.target;
                        const stepScope = String(stepTarget?.scope || '').toLowerCase();
                        const stepType = String(stepTarget?.type || '').toLowerCase();

                        if (stepScope === 'source' && (
                            (cardType === 'pilot' && stepType === 'unit') ||
                            (cardType === 'unit' && stepType === 'pilot')
                        )) {
                            violations.push(`${file}:${cardId}:rules[${i}].steps[${j}].target scope=source (cardType=${cardType}, target.type=${stepType})`);
                        }
                    }
                }
            }
        }

        expect(violations).toEqual([]);
    });
});
