const gd01 = require('../data/gd01Card.json');
const gd02 = require('../data/gd02Card.json');
const gd03 = require('../data/gd03Card.json');
const st01 = require('../data/st01Card.json');
const st02 = require('../data/st02Card.json');
const st03 = require('../data/st03Card.json');
const st04 = require('../data/st04Card.json');
const st05 = require('../data/st05Card.json');
const st06 = require('../data/st06Card.json');
const st07 = require('../data/st07Card.json');
const st08 = require('../data/st08Card.json');

const CARD_FILES = [
    { file: 'gd01Card.json', data: gd01 },
    { file: 'gd02Card.json', data: gd02 },
    { file: 'gd03Card.json', data: gd03 },
    { file: 'st01Card.json', data: st01 },
    { file: 'st02Card.json', data: st02 },
    { file: 'st03Card.json', data: st03 },
    { file: 'st04Card.json', data: st04 },
    { file: 'st05Card.json', data: st05 },
    { file: 'st06Card.json', data: st06 },
    { file: 'st07Card.json', data: st07 },
    { file: 'st08Card.json', data: st08 }
];

function collectBattleDurationStatModifiers() {
    const rows = [];
    for (const { file, data } of CARD_FILES) {
        for (const [cardId, card] of Object.entries(data?.cards || {})) {
            const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
            for (const rule of rules) {
                if (!['modifyAP', 'modifyHP'].includes(rule?.action)) continue;
                if (rule?.timing?.duration !== 'UNTIL_END_OF_BATTLE') continue;
                rows.push({
                    file,
                    cardId,
                    cardName: card?.name || cardId,
                    effectId: rule?.effectId || 'unknown_effect',
                    action: rule.action,
                    type: rule?.type || null,
                    trigger: rule?.trigger || null,
                    scope: rule?.target?.scope || null
                });
            }
        }
    }
    return rows.sort((a, b) => a.cardId.localeCompare(b.cardId) || String(a.effectId).localeCompare(String(b.effectId)));
}

describe('battle-duration stat modifier audit across listed card data files', () => {
    test('detects known modifyAP/modifyHP rules with UNTIL_END_OF_BATTLE (code-level alignment audit)', () => {
        const rows = collectBattleDurationStatModifiers();
        const cardIds = [...new Set(rows.map((row) => row.cardId))].sort();

        expect(cardIds).toEqual([
            'GD01-058',
            'GD01-071',
            'GD01-082',
            'GD03-028',
            'ST04-010'
        ]);
    });
});
