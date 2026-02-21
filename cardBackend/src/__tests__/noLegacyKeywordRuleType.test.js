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
    const filePath = path.join(__dirname, '..', 'data', fileName);
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return json.cards || {};
}

describe('card data canonicalization', () => {
    test('no rule uses legacy keyword type', () => {
        const legacyEntries = [];

        for (const fileName of CARD_FILES) {
            const cards = loadCards(fileName);
            for (const [cardId, card] of Object.entries(cards)) {
                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
                for (const rule of rules) {
                    if (String(rule?.type || '').toLowerCase() === 'keyword') {
                        legacyEntries.push(`${fileName}:${cardId}:${rule.effectId || 'unknown'}`);
                    }
                }
            }
        }

        expect(legacyEntries).toEqual([]);
    });
});
