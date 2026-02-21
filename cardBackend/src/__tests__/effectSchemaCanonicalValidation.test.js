const {
    __testUtils: {
        validateScalingConfig,
        detectAlwaysOnTextRuleMismatches
    }
} = require('../tests/validators/effectSchemaCanonicalValidation');

describe('effectSchemaCanonicalValidation utilities', () => {
    test('accepts known scaling config shape', () => {
        const diagnostics = [];
        validateScalingConfig(
            {
                type: 'COUNT_UNITS_IN_PLAY',
                scope: 'self',
                multiplier: 1
            },
            'cards.X.effects.rules[0].parameters.scaling',
            { cardId: 'X', effectId: 'test_effect' },
            diagnostics
        );

        expect(diagnostics).toHaveLength(0);
    });

    test('reports error for unknown scaling type', () => {
        const diagnostics = [];
        validateScalingConfig(
            {
                type: 'UNKNOWN_SCALING'
            },
            'cards.X.effects.rules[0].parameters.scaling',
            { cardId: 'X', effectId: 'test_effect' },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'error')).toBe(true);
    });

    test('reports warning when always-on repair text has no backing rule', () => {
        const diagnostics = [];
        detectAlwaysOnTextRuleMismatches('mock.json', {
            'MOCK-001': {
                effects: {
                    description: ['<Repair 1> (At the end of your turn, this Unit recovers the specified number of HP.)'],
                    rules: [
                        {
                            effectId: 'blocker',
                            type: 'triggered',
                            trigger: 'ATTACK_REDIRECT',
                            action: 'redirect_attack'
                        }
                    ]
                }
            }
        }, diagnostics);

        expect(diagnostics.some((d) => d.severity === 'warning')).toBe(true);
    });

    test('does not warn when breach keyword text is backed by keyword-style damageShield rule', () => {
        const diagnostics = [];
        detectAlwaysOnTextRuleMismatches('mock.json', {
            'MOCK-002': {
                effects: {
                    description: ['<Breach 4> (When this Unit destroys an enemy Unit by attack, deal 4 damage to shield.)'],
                    rules: [
                        {
                            effectId: 'breach_4',
                            type: 'keyword',
                            trigger: 'BATTLE_DESTROY',
                            action: 'damageShield',
                            parameters: { value: 4 }
                        }
                    ]
                }
            }
        }, diagnostics);

        expect(diagnostics.some((d) => d.severity === 'warning')).toBe(false);
    });

    test('does not treat targeting text with <Blocker> as always-on blocker grant text', () => {
        const diagnostics = [];
        detectAlwaysOnTextRuleMismatches('mock.json', {
            'MOCK-003': {
                effects: {
                    description: ['[Attack]Choose 1 enemy Unit with <Blocker> that is Lv.3 or lower. Destroy it.'],
                    rules: [
                        {
                            effectId: 'attack_effect',
                            type: 'triggered',
                            trigger: 'ATTACK_DECLARED',
                            action: 'destroy',
                            target: { type: 'unit', scope: 'opponent', filters: { keywords: ['Blocker'] } }
                        }
                    ]
                }
            }
        }, diagnostics);

        expect(diagnostics.some((d) => d.severity === 'warning')).toBe(false);
    });
});
