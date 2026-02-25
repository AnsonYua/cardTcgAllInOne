const { parsePreventDamageVariant } = require('../services/effects/utils/PreventDamageVariantUtils');

describe('parsePreventDamageVariant', () => {
    test('parses effect-damage variant', () => {
        const result = parsePreventDamageVariant({
            action: 'prevent_damage',
            parameters: {
                sourceCardType: 'command',
                sourceController: 'opponent'
            }
        });

        expect(result.kind).toBe('effect_damage');
        expect(result.sourceCardType).toBe('command');
        expect(result.sourceController).toBe('opponent');
    });

    test('parses base-battle variant', () => {
        const result = parsePreventDamageVariant({
            action: 'prevent_damage',
            parameters: {
                from: 'enemy_units',
                enemyLevel: '<=3'
            }
        });

        expect(result.kind).toBe('base_battle');
        expect(result.from).toBe('enemy_units');
        expect(result.enemyLevel).toBe('<=3');
    });

    test('rejects mixed variant shape', () => {
        const result = parsePreventDamageVariant({
            action: 'prevent_damage',
            parameters: {
                sourceController: 'opponent',
                from: 'enemy_units'
            }
        });

        expect(result.kind).toBe('invalid');
        expect(result.error).toMatch(/cannot mix/);
    });
});
