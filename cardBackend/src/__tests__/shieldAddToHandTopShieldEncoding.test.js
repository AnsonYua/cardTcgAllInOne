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
].map((name) => path.join(__dirname, '..', 'data', name));

function collectInvalidSelfShieldChoices(node, cardId, effectId, pathLabel, out) {
    if (Array.isArray(node)) {
        node.forEach((entry, index) =>
            collectInvalidSelfShieldChoices(entry, cardId, effectId, `${pathLabel}[${index}]`, out)
        );
        return;
    }

    if (!node || typeof node !== 'object') {
        return;
    }

    if (
        node.action === 'addToHand' &&
        node.target &&
        node.target.scope === 'self_shield' &&
        node.target.selection &&
        node.target.selection.type === 'player_choice'
    ) {
        out.push(`${cardId}:${effectId}:${pathLabel}`);
    }

    for (const [key, value] of Object.entries(node)) {
        collectInvalidSelfShieldChoices(value, cardId, effectId, pathLabel ? `${pathLabel}.${key}` : key, out);
    }
}

describe('self_shield addToHand encoding', () => {
    test('does not encode player_choice for top-shield pickup effects', () => {
        const failures = [];

        for (const file of CARD_FILES) {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));

            for (const [cardId, card] of Object.entries(data.cards || {})) {
                for (const rule of card?.effects?.rules || []) {
                    collectInvalidSelfShieldChoices(
                        rule,
                        cardId,
                        rule.effectId || 'unknown_effect',
                        'rule',
                        failures
                    );
                }
            }
        }

        expect(failures).toEqual([]);
    });
});
