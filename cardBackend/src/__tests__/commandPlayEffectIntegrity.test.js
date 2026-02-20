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

describe('Command play effect integrity', () => {
    test('no command card has duplicate overlapping play rules with the same effectId', () => {
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

                const byEffectId = new Map();
                for (const entry of playRules) {
                    const effectId = typeof entry.rule?.effectId === 'string' ? entry.rule.effectId : '';
                    if (!effectId) {
                        continue;
                    }
                    if (!byEffectId.has(effectId)) {
                        byEffectId.set(effectId, []);
                    }
                    byEffectId.get(effectId).push(entry);
                }

                for (const [effectId, entries] of byEffectId.entries()) {
                    if (entries.length < 2) {
                        continue;
                    }

                    for (let i = 0; i < entries.length; i += 1) {
                        for (let j = i + 1; j < entries.length; j += 1) {
                            const left = entries[i];
                            const right = entries[j];
                            const leftWindows = getWindows(left.rule);
                            const rightWindows = getWindows(right.rule);
                            if (windowsOverlap(leftWindows, rightWindows)) {
                                failures.push(
                                    `${file}:${cardId}:${effectId} overlaps at rule indices ${left.ruleIndex} and ${right.ruleIndex}`
                                );
                            }
                        }
                    }
                }
            }
        }

        expect(failures).toEqual([]);
    });
});
