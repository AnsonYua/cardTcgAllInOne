const {
    __testUtils: {
        validateScalingConfig,
        detectAlwaysOnTextRuleMismatches,
        validateReturnToHandSemantics,
        detectSupportActivatedSchemaMismatches
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

    test('warns when burst + play-from-hand pairing text has no pair_target_unit replace_cost rule', () => {
        const diagnostics = [];
        detectAlwaysOnTextRuleMismatches('mock.json', {
            'MOCK-004': {
                effects: {
                    description: [
                        '【Burst】Add this card to your hand.',
                        'When playing this card from your hand and pairing it with a Unit with "Gundam NT-1" in its card name, play this card as if it has 0 cost.'
                    ],
                    rules: [
                        {
                            effectId: 'burst_add_to_hand',
                            type: 'triggered',
                            trigger: 'BURST_CONDITION',
                            action: 'addToHand'
                        }
                    ]
                }
            }
        }, diagnostics);

        expect(diagnostics.some((d) => d.severity === 'warning' && /pair_target_unit replace_cost/.test(d.message))).toBe(true);
    });

    test('does not warn when burst + play-from-hand pairing text is backed by pair_target_unit replace_cost rule', () => {
        const diagnostics = [];
        detectAlwaysOnTextRuleMismatches('mock.json', {
            'MOCK-005': {
                effects: {
                    description: [
                        '【Burst】Add this card to your hand.',
                        'When playing this card from your hand and pairing it with a Unit with "Gundam NT-1" in its card name, play this card as if it has 0 cost.'
                    ],
                    rules: [
                        {
                            effectId: 'burst_add_to_hand',
                            type: 'triggered',
                            trigger: 'BURST_CONDITION',
                            action: 'addToHand'
                        },
                        {
                            effectId: 'play_pair_nt1_as_zero_cost',
                            type: 'play',
                            trigger: 'PLAY_CARD',
                            action: 'replace_cost',
                            parameters: {
                                replace: {
                                    from: { type: 'pair_target_unit', filters: { nameIncludes: 'Gundam NT-1' } },
                                    to: { cost: 0 }
                                }
                            }
                        }
                    ]
                }
            }
        }, diagnostics);

        expect(diagnostics.some((d) => /pair_target_unit replace_cost/.test(d.message))).toBe(false);
    });

    test('warns when returnToHand with non-opponent scope omits ownership policy', () => {
        const diagnostics = [];
        validateReturnToHandSemantics(
            {
                action: 'returnToHand',
                target: {
                    type: 'card',
                    scope: 'source_paired_pilot',
                    count: 1
                },
                parameters: {}
            },
            { cardId: 'MOCK-RET-001', effectId: 'ret_test', jsonPath: 'cards.MOCK-RET-001.effects.rules[0]' },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'warning' && /ownershipPolicy/.test(d.message))).toBe(true);
    });

    test('warns when returnToHand uses SOURCE_CONTROLLER policy without whitelist', () => {
        const diagnostics = [];
        validateReturnToHandSemantics(
            {
                action: 'returnToHand',
                target: {
                    type: 'unit',
                    scope: 'opponent',
                    count: 1
                },
                parameters: {
                    ownershipPolicy: 'SOURCE_CONTROLLER'
                }
            },
            { cardId: 'MOCK-RET-002', effectId: 'ret_test_2', jsonPath: 'cards.MOCK-RET-002.effects.rules[0]' },
            diagnostics
        );

        expect(
            diagnostics.some((d) => d.severity === 'warning' && /SOURCE_CONTROLLER/.test(d.message))
        ).toBe(true);
    });

    test('accepts canonical support activated schema', () => {
        const diagnostics = [];
        detectSupportActivatedSchemaMismatches('mock.json', {
            'MOCK-SUP-OK': {
                effects: {
                    description: ['[Activate/Main]<Support 2> (Rest this Unit. 1 other friendly Unit gets AP+2 during this turn.)'],
                    rules: [
                        {
                            effectId: 'activate_support_2',
                            type: 'activated',
                            timing: {
                                windows: ['MAIN_PHASE'],
                                duration: 'UNTIL_END_OF_TURN'
                            },
                            cost: { rest: 'self' },
                            action: 'modifyAP',
                            target: {
                                type: 'unit',
                                scope: 'self',
                                count: 1
                            },
                            parameters: {
                                value: 2,
                                excludeSource: true
                            }
                        }
                    ]
                }
            }
        }, diagnostics);

        expect(diagnostics).toHaveLength(0);
    });

    test('rejects sequence-wrapped support schema', () => {
        const diagnostics = [];
        detectSupportActivatedSchemaMismatches('mock.json', {
            'MOCK-SUP-BAD': {
                effects: {
                    description: ['[Activate/Main]<Support 1> (Rest this Unit. 1 other friendly Unit gets AP+1 during this turn.)'],
                    rules: [
                        {
                            effectId: 'activate_effect',
                            type: 'activated',
                            timing: { windows: ['MAIN_PHASE'] },
                            cost: { rest: 'self' },
                            action: 'sequence',
                            parameters: {
                                text: '<Support 1> ...',
                                steps: [
                                    {
                                        action: 'modifyAP',
                                        target: { type: 'unit', scope: 'self', count: 1 },
                                        parameters: { value: 1, excludeSource: true }
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        }, diagnostics);

        expect(diagnostics.some((d) => d.severity === 'error' && /top-level modifyAP/.test(d.message))).toBe(true);
    });
});
