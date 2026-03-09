const gd03 = require('../data/gd03Card.json');

describe('GD03-078 destroyed paired pilot return schema', () => {
    test('uses DESTROYED triggered timing for paired-pilot return', () => {
        const card = gd03.cards['GD03-078'];
        expect(card).toBeTruthy();

        const rule = (card.effects?.rules || []).find((entry) => entry.effectId === 'during_link_effect');
        expect(rule).toBeTruthy();

        expect(rule.type).toBe('triggered');
        expect(rule.timing?.eventTrigger).toBe('DESTROYED');
        expect(rule.action).toBe('sequence');

        const step = rule.parameters?.steps?.[0];
        expect(step).toBeTruthy();
        expect(step.action).toBe('returnToHand');
        expect(step.target).toMatchObject({
            type: 'card',
            scope: 'source_paired_pilot',
            count: 1
        });
    });
});
