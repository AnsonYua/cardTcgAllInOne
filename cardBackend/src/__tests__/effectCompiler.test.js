const { EffectCompiler } = require('../services/effects/canonical/EffectCompiler');

describe('EffectCompiler', () => {
    test('compiles continuous modifyAP effect into canonical operation', () => {
        const effect = {
            effectId: 'test_continuous_ap',
            type: 'continuous',
            trigger: 'continuous',
            action: 'modifyAP',
            target: {
                type: 'unit',
                scope: 'self'
            },
            parameters: {
                value: 2
            }
        };

        const compiled = EffectCompiler.compile(effect);
        expect(compiled.effectId).toBe('test_continuous_ap');
        expect(compiled.kind).toBe('continuous');
        expect(Array.isArray(compiled.operations)).toBe(true);
        expect(compiled.operations).toHaveLength(1);
        expect(compiled.operations[0].action).toBe('modifyAP');
        expect(compiled.operations[0].baseValue).toBe(2);
    });

    test('retains scaling config in canonical operation', () => {
        const effect = {
            effectId: 'test_scaled_damage',
            type: 'triggered',
            trigger: 'ATTACK_PHASE',
            action: 'damage',
            parameters: {
                value: 1,
                scaling: {
                    type: 'COUNT_UNITS_IN_PLAY',
                    scope: 'self',
                    multiplier: 1
                }
            }
        };

        const compiled = EffectCompiler.compile(effect);
        expect(compiled.operations[0].scaling).toEqual({
            type: 'COUNT_UNITS_IN_PLAY',
            scope: 'self',
            multiplier: 1
        });
    });
});
