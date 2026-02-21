const { CardDatabaseManager } = require('../models/CardSystem');

describe('GD02-087 linked blocker rest completion', () => {
    test('has linked rest rule with blocker target filter and blue-unit condition', () => {
        const card = CardDatabaseManager.getCardDetails('GD02-087');
        expect(card).toBeTruthy();

        const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
        const linkedRule = rules.find((rule) => rule.effectId === 'linked_rest_enemy_blocker_if_blue_unit');
        expect(linkedRule).toBeTruthy();
        expect(linkedRule.trigger).toBe('PAIRING_COMPLETE');
        expect(linkedRule.action).toBe('rest');
        expect(linkedRule.sourceConditions?.some((condition) => condition.type === 'linked')).toBe(true);
        expect(linkedRule.conditions?.some((condition) => condition.type === 'pairedUnitColor' && condition.value === 'Blue')).toBe(true);
        expect(linkedRule.target?.scope).toBe('opponent');
        expect(linkedRule.target?.filters?.keywords).toEqual(['Blocker']);
    });
});
