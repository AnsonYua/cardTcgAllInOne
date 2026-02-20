const fs = require('fs');
const path = require('path');

const TARGET_FILES = [
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

function findEffect(card, effectId) {
    const rules = card?.effects?.rules;
    if (!Array.isArray(rules)) {
        return null;
    }
    return rules.find((rule) => rule?.effectId === effectId) || null;
}

describe('GD03 alignment migration', () => {
    test('no CUSTOM triggers remain in the 11 target files', () => {
        const customEntries = [];

        for (const fileName of TARGET_FILES) {
            const cards = loadCards(fileName);
            for (const [cardId, card] of Object.entries(cards)) {
                const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
                for (const rule of rules) {
                    if (rule?.trigger === 'CUSTOM') {
                        customEntries.push(`${fileName}:${cardId}:${rule.effectId || 'unknown'}`);
                    }
                }
            }
        }

        expect(customEntries).toEqual([]);
    });

    test('migrated GD03 effects use explicit triggers and typed conditions', () => {
        const cards = loadCards('gd03Card.json');

        const gd03076 = findEffect(cards['GD03-076'], 'effect');
        expect(gd03076?.trigger).toBe('BATTLE_DAMAGE_TO_UNIT');
        expect(gd03076?.conditions).toEqual([
            expect.objectContaining({
                type: 'battleDamageToUnitEvent'
            })
        ]);

        const gd03095 = findEffect(cards['GD03-095'], 'effect');
        expect(gd03095?.trigger).toBe('EFFECT_DAMAGE_RECEIVED');

        const gd03124 = findEffect(cards['GD03-124'], 'effect');
        expect(gd03124?.trigger).toBe('PAIRING_COMPLETE_GLOBAL');
        expect(gd03124?.parameters?.pairedPilotLevel).toBe('<=3');

        const gd03125 = findEffect(cards['GD03-125'], 'effect');
        expect(gd03125?.trigger).toBe('BATTLE_DESTROY');
        expect(gd03125?.conditions).toEqual([
            expect.objectContaining({
                type: 'battleDestroyEvent',
                sourceLevel: '>=6'
            })
        ]);

        const gd03128 = findEffect(cards['GD03-128'], 'effect');
        expect(gd03128?.trigger).toBe('UNIT_RESTED_BY_EFFECT');
        expect(gd03128?.conditions).toEqual([
            expect.objectContaining({
                type: 'unitRestedByEffectEvent',
                sourceController: 'opponent',
                targetController: 'self'
            })
        ]);
    });

    test('GD03 link names do not contain stray brackets', () => {
        const cards = loadCards('gd03Card.json');
        for (const [cardId, card] of Object.entries(cards)) {
            const links = Array.isArray(card?.link) ? card.link : [];
            for (const entry of links) {
                expect(typeof entry).toBe('string');
                expect(entry.includes('[')).toBe(false);
                expect(entry.includes(']')).toBe(false);
            }
        }
    });
});
