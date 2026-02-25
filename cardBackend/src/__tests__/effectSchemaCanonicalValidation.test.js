const {
    __testUtils: {
        validateScalingConfig,
        walkEffects,
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

    test('accepts prevent_battle_damage enemyHp comparator parameter', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'deploy_effect',
                type: 'triggered',
                trigger: 'ENTERS_PLAY',
                action: 'prevent_battle_damage',
                target: {
                    type: 'unit',
                    scope: 'self',
                    count: 1
                },
                parameters: {
                    from: 'enemy_units',
                    enemyHp: '<=2'
                }
            },
            { cardId: 'MOCK-HP-OK', effectId: 'deploy_effect', jsonPath: 'cards.MOCK-HP-OK.effects.rules[0]' },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'error')).toBe(false);
    });

    test('rejects unsupported prevent_battle_damage parameter key', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'play_effect',
                type: 'play',
                action: 'prevent_battle_damage',
                target: {
                    type: 'unit',
                    scope: 'self',
                    count: 1
                },
                parameters: {
                    from: 'enemy_units',
                    enemyAttack: '<=2'
                }
            },
            { cardId: 'MOCK-HP-BAD', effectId: 'play_effect', jsonPath: 'cards.MOCK-HP-BAD.effects.rules[0]' },
            diagnostics
        );

        expect(
            diagnostics.some(
                (d) => d.severity === 'error' && /unsupported parameter key enemyAttack/.test(d.message)
            )
        ).toBe(true);
    });

    test('accepts canonical scry_top_deck parameters', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'scry_ok',
                type: 'triggered',
                trigger: 'ENTERS_PLAY',
                action: 'scry_top_deck',
                parameters: {
                    count: 2,
                    keep: 1,
                    choice: 'top_or_trash',
                    rest: 'trash'
                }
            },
            { cardId: 'MOCK-SCRY-OK', effectId: 'scry_ok', jsonPath: 'cards.MOCK-SCRY-OK.effects.rules[0]' },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'error')).toBe(false);
    });

    test('rejects conflicting scry choice and rest schema', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'scry_bad',
                type: 'triggered',
                trigger: 'ENTERS_PLAY',
                action: 'scry_top_deck',
                parameters: {
                    count: 2,
                    keep: 1,
                    choice: 'top_or_trash',
                    rest: 'bottom'
                }
            },
            { cardId: 'MOCK-SCRY-BAD', effectId: 'scry_bad', jsonPath: 'cards.MOCK-SCRY-BAD.effects.rules[0]' },
            diagnostics
        );

        expect(
            diagnostics.some((d) => d.severity === 'error' && /requires rest=trash/.test(d.message))
        ).toBe(true);
    });

    test('warns for legacy scry parameter aliases', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'scry_legacy',
                type: 'triggered',
                trigger: 'ENTERS_PLAY',
                action: 'scry_top_deck',
                parameters: {
                    lookCount: 1,
                    choices: ['top', 'bottom']
                }
            },
            { cardId: 'MOCK-SCRY-LEGACY', effectId: 'scry_legacy', jsonPath: 'cards.MOCK-SCRY-LEGACY.effects.rules[0]' },
            diagnostics
        );

        expect(
            diagnostics.some((d) => d.severity === 'warning' && /legacy/.test(d.message))
        ).toBe(true);
        expect(diagnostics.some((d) => d.severity === 'error')).toBe(false);
    });

    test('accepts restrict_attack canonical requires variant', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'restrict_requires_ok',
                type: 'continuous',
                trigger: 'continuous',
                action: 'restrict_attack',
                parameters: {
                    requires: {
                        type: 'friendly_unit_deployed_this_turn',
                        traitsAny: ['UN']
                    }
                }
            },
            { cardId: 'MOCK-RESTRICT-REQ-OK', effectId: 'restrict_requires_ok', jsonPath: 'cards.MOCK-RESTRICT-REQ-OK.effects.rules[0]' },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'error')).toBe(false);
    });

    test('accepts restrict_attack canonical disallow variant', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'restrict_disallow_ok',
                type: 'continuous',
                trigger: 'continuous',
                action: 'restrict_attack',
                parameters: {
                    disallow: 'player'
                }
            },
            { cardId: 'MOCK-RESTRICT-DISALLOW-OK', effectId: 'restrict_disallow_ok', jsonPath: 'cards.MOCK-RESTRICT-DISALLOW-OK.effects.rules[0]' },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'error')).toBe(false);
    });

    test('rejects restrict_attack deprecated restriction variant', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'restrict_deprecated_bad',
                type: 'continuous',
                trigger: 'continuous',
                action: 'restrict_attack',
                parameters: {
                    restriction: 'cannot_attack_player'
                }
            },
            { cardId: 'MOCK-RESTRICT-DEPRECATED-BAD', effectId: 'restrict_deprecated_bad', jsonPath: 'cards.MOCK-RESTRICT-DEPRECATED-BAD.effects.rules[0]' },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'error' && /deprecated/.test(d.message))).toBe(true);
    });

    test('accepts prevent_damage effect-damage variant', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'prevent_damage_effect_variant_ok',
                type: 'continuous',
                trigger: 'continuous',
                action: 'prevent_damage',
                parameters: {
                    sourceCardType: 'command',
                    sourceController: 'opponent'
                }
            },
            {
                cardId: 'MOCK-PREVENT-DAMAGE-EFFECT-OK',
                cardType: 'unit',
                effectId: 'prevent_damage_effect_variant_ok',
                jsonPath: 'cards.MOCK-PREVENT-DAMAGE-EFFECT-OK.effects.rules[0]'
            },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'error')).toBe(false);
    });

    test('accepts prevent_damage base-battle variant on base card', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'prevent_damage_base_variant_ok',
                type: 'continuous',
                trigger: 'continuous',
                action: 'prevent_damage',
                parameters: {
                    from: 'enemy_units',
                    enemyLevel: '<=3'
                }
            },
            {
                cardId: 'MOCK-PREVENT-DAMAGE-BASE-OK',
                cardType: 'base',
                effectId: 'prevent_damage_base_variant_ok',
                jsonPath: 'cards.MOCK-PREVENT-DAMAGE-BASE-OK.effects.rules[0]'
            },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'error')).toBe(false);
    });

    test('rejects prevent_damage mixed variant parameters', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'prevent_damage_mixed_bad',
                type: 'continuous',
                trigger: 'continuous',
                action: 'prevent_damage',
                parameters: {
                    sourceController: 'opponent',
                    from: 'enemy_units'
                }
            },
            {
                cardId: 'MOCK-PREVENT-DAMAGE-MIXED-BAD',
                cardType: 'base',
                effectId: 'prevent_damage_mixed_bad',
                jsonPath: 'cards.MOCK-PREVENT-DAMAGE-MIXED-BAD.effects.rules[0]'
            },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'error' && /cannot mix/.test(d.message))).toBe(true);
    });

    test('rejects prevent_damage base-battle variant on non-base cards', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'prevent_damage_base_non_base_bad',
                type: 'continuous',
                trigger: 'continuous',
                action: 'prevent_damage',
                parameters: {
                    from: 'enemy_units',
                    enemyLevel: '<=3'
                }
            },
            {
                cardId: 'MOCK-PREVENT-DAMAGE-NONBASE-BAD',
                cardType: 'unit',
                effectId: 'prevent_damage_base_non_base_bad',
                jsonPath: 'cards.MOCK-PREVENT-DAMAGE-NONBASE-BAD.effects.rules[0]'
            },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'error' && /only allowed on base cards/.test(d.message))).toBe(true);
    });

    test('rejects unsupported sequence step action', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'sequence_bad_step',
                type: 'play',
                trigger: 'COST',
                action: 'sequence',
                parameters: {
                    steps: [
                        {
                            action: 'drawx',
                            parameters: {
                                value: 1
                            }
                        }
                    ]
                }
            },
            {
                cardId: 'MOCK-SEQ-BAD-STEP',
                effectId: 'sequence_bad_step',
                jsonPath: 'cards.MOCK-SEQ-BAD-STEP.effects.rules[0]'
            },
            diagnostics
        );

        expect(
            diagnostics.some((d) => d.severity === 'error' && /unsupported sequence step action/i.test(d.message))
        ).toBe(true);
    });

    test('accepts valid sourceLevelScope values', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'scope_ok',
                type: 'triggered',
                trigger: 'ATTACK_PHASE',
                action: 'modifyAP',
                sourceLevelScope: 'source_card'
            },
            {
                cardId: 'MOCK-SOURCE-SCOPE-OK',
                effectId: 'scope_ok',
                jsonPath: 'cards.MOCK-SOURCE-SCOPE-OK.effects.rules[0]'
            },
            diagnostics
        );

        expect(diagnostics.some((d) => d.severity === 'error')).toBe(false);
    });

    test('rejects invalid sourceLevelScope values', () => {
        const diagnostics = [];
        walkEffects(
            {
                effectId: 'scope_bad',
                type: 'triggered',
                trigger: 'ATTACK_PHASE',
                action: 'modifyAP',
                sourceLevelScope: 'pilot_level'
            },
            {
                cardId: 'MOCK-SOURCE-SCOPE-BAD',
                effectId: 'scope_bad',
                jsonPath: 'cards.MOCK-SOURCE-SCOPE-BAD.effects.rules[0]'
            },
            diagnostics
        );

        expect(
            diagnostics.some((d) => d.severity === 'error' && /sourceLevelScope must be one of/.test(d.message))
        ).toBe(true);
    });
});
