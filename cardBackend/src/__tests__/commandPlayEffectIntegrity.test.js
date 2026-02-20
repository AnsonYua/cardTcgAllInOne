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

function getWindows(rule) {
    return Array.isArray(rule?.timing?.windows)
        ? rule.timing.windows.map(window => String(window).toUpperCase())
        : [];
}

function windowsOverlap(a, b) {
    if (a.length === 0 || b.length === 0) {
        return true;
    }
    const index = new Set(a);
    return b.some(window => index.has(window));
}

function sequenceShape(rule) {
    const action = typeof rule?.action === 'string' ? rule.action : '';
    const steps = Array.isArray(rule?.parameters?.steps) ? rule.parameters.steps : [];
    const stepActions = steps
        .filter((step) => step && typeof step === 'object')
        .map((step) => (typeof step.action === 'string' ? step.action : ''));
    return `${action}|${stepActions.join('>')}`;
}

describe('Command play effect integrity', () => {
    test('no command card has duplicate overlapping play rules with same execution shape', () => {
        const failures = [];

        for (const file of CARD_FILES) {
            const filePath = path.join(__dirname, '..', 'data', file);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const cards = data.cards || {};

            for (const [cardId, card] of Object.entries(cards)) {
                if (card?.cardType !== 'command') {
                    continue;
                }

                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
                const playRules = rules
                    .map((rule, ruleIndex) => ({ rule, ruleIndex }))
                    .filter(entry => entry.rule?.type === 'play');

                for (let i = 0; i < playRules.length; i += 1) {
                    for (let j = i + 1; j < playRules.length; j += 1) {
                        const left = playRules[i];
                        const right = playRules[j];
                        const leftWindows = getWindows(left.rule);
                        const rightWindows = getWindows(right.rule);
                        if (!windowsOverlap(leftWindows, rightWindows)) {
                            continue;
                        }
                        if (sequenceShape(left.rule) !== sequenceShape(right.rule)) {
                            continue;
                        }
                        failures.push(
                            `${file}:${cardId} overlapping play rules at indices ${left.ruleIndex} and ${right.ruleIndex}`
                        );
                    }
                }
            }
        }

        expect(failures).toEqual([]);
    });
});
