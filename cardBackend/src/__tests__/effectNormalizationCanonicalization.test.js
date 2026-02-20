const { normalizeEffectRule, normalizeTargetConfig } = require('../utils/EffectNormalizationUtils');
const { TargetSelectionUtils } = require('../services/targets/TargetSelectionUtils');

describe('effect normalization canonicalization', () => {
    test('normalizes sourceAP/sourceHP aliases to sourceAp/sourceHp', () => {
        const normalized = normalizeEffectRule(
            {
                effectId: 'alias_condition_test',
                type: 'continuous',
                trigger: 'continuous',
                action: 'allow_attack_target',
                conditions: [
                    { type: 'sourceAP', scope: 'source', value: '>=5' },
                    { type: 'sourceHP', scope: 'source', value: '==1' }
                ]
            },
            {
                fallbackEffectId: 'alias_condition_test',
                expectedTriggers: ['continuous'],
                requireAction: true
            }
        );

        expect(normalized).toBeTruthy();
        expect(normalized.conditions).toEqual([
            expect.objectContaining({ type: 'sourceAp' }),
            expect.objectContaining({ type: 'sourceHp' })
        ]);
    });

    test('normalizes CONTROLLER_CHOICE selection type to player_choice with tieBreaker', () => {
        const target = normalizeTargetConfig({
            type: 'unit',
            scope: 'self_all_unit',
            count: 1,
            selection: {
                type: 'CONTROLLER_CHOICE'
            }
        });

        expect(target).toBeTruthy();
        expect(target.selection).toBeTruthy();
        expect(target.selection.type).toBe('player_choice');
        expect(target.selection.tieBreaker).toBe('CONTROLLER_CHOICE');
    });

    test('JUST_LINKED selection returns only the newly linked unit', () => {
        const targets = [
            { carduid: 'u1', zone: 'slot1', playerId: 'playerId_1' },
            { carduid: 'u2', zone: 'slot2', playerId: 'playerId_1' }
        ];

        const selected = TargetSelectionUtils.applySelection(
            {},
            targets,
            { type: 'JUST_LINKED' },
            { justLinkedUnitCarduid: 'u2' }
        );

        expect(selected).toEqual([
            expect.objectContaining({ carduid: 'u2' })
        ]);
    });
});
