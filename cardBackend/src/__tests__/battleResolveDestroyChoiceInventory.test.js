const gd01 = require('../data/gd01Card.json');
const gd02 = require('../data/gd02Card.json');
const gd03 = require('../data/gd03Card.json');
const st05 = require('../data/st05Card.json');

function getCard(db, cardId) {
    return (db.cards || {})[cardId];
}

function collectDestroyedOrBattleDestroyRules(card) {
    const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
    return rules.filter((rule) => {
        const trigger = String(rule?.timing?.eventTrigger || '').toUpperCase();
        return trigger === 'DESTROYED' || trigger === 'BATTLE_DESTROY';
    });
}

describe('Battle-resolve destroy choice inventory coverage', () => {
    const expected = [
        { db: gd01, cardId: 'GD01-005' },
        { db: gd01, cardId: 'GD01-056' },
        { db: gd01, cardId: 'GD01-080' },
        { db: gd02, cardId: 'GD02-003' },
        { db: gd02, cardId: 'GD02-056' },
        { db: gd02, cardId: 'GD02-126' },
        { db: gd03, cardId: 'GD03-007' },
        { db: gd03, cardId: 'GD03-078' },
        { db: gd03, cardId: 'GD03-100' },
        { db: st05, cardId: 'ST05-005' },
        { db: st05, cardId: 'ST05-011' }
    ];

    test.each(expected)('%s has DESTROYED/BATTLE_DESTROY effect rules', ({ db, cardId }) => {
        const card = getCard(db, cardId);
        expect(card).toBeTruthy();
        const rules = collectDestroyedOrBattleDestroyRules(card);
        expect(rules.length).toBeGreaterThan(0);
    });
});
