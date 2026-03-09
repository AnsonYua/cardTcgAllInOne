const { compileEffectActionNodeFromRule } = require('../services/effects/EffectActionCompiler');
const { applyCompiledTimingBridgeToCardData } = require('../services/effects/timing/EffectTimingBridge');
const gd01Cards = require('../data/gd01Card.json');

describe('EffectActionCompiler', () => {
    test('classifies primitive, structural, play-mode, and meta effects', () => {
        expect(
            compileEffectActionNodeFromRule({
                action: 'damage'
            })
        ).toMatchObject({
            structure: 'primitive',
            operation: 'damage'
        });

        expect(
            compileEffectActionNodeFromRule({
                action: 'sequence'
            })
        ).toMatchObject({
            structure: 'sequence'
        });

        expect(
            compileEffectActionNodeFromRule({
                action: 'conditional'
            })
        ).toMatchObject({
            structure: 'conditional'
        });

        expect(
            compileEffectActionNodeFromRule({
                type: 'special',
                action: 'designate_pilot',
                parameters: {
                    pilotName: 'Test Pilot',
                    AP: 2,
                    HP: 1
                }
            })
        ).toMatchObject({
            structure: 'primitive',
            playMode: 'designate_pilot'
        });

        expect(
            compileEffectActionNodeFromRule(
                {
                    action: 'activate_ability',
                    parameters: {
                        abilityType: 'main'
                    }
                },
                {
                    eventTrigger: 'BURST_CONDITION',
                    timingClass: 'event_triggered'
                }
            )
        ).toMatchObject({
            structure: 'primitive',
            metaRef: {
                type: 'activate_ability',
                abilityType: 'main'
            },
            aiTags: {
                mechanical: expect.arrayContaining(['triggered', 'burst_triggered']),
                strategic: expect.arrayContaining(['tempo'])
            }
        });
    });

    test('derives AI tags for common strategic categories', () => {
        const damage = compileEffectActionNodeFromRule({ action: 'damage' });
        expect(damage.aiTags.strategic).toContain('removal');

        const heal = compileEffectActionNodeFromRule({ action: 'heal' });
        expect(heal.aiTags.strategic).toEqual(expect.arrayContaining(['recovery', 'resilience']));

        const breach = compileEffectActionNodeFromRule({ action: 'grant_breach' });
        expect(breach.aiTags.strategic).toContain('shield_pressure');

        const pair = compileEffectActionNodeFromRule({ action: 'designate_pilot' });
        expect(pair.aiTags.strategic).toContain('pair_payoff');
    });

    test('bridged card data exposes compiled effect nodes for runtime consumers', () => {
        const card = gd01Cards.cards['GD01-101'];
        const bridged = applyCompiledTimingBridgeToCardData(card);
        const designationRule = bridged.effects.rules.find((rule) => rule.effectId === 'pilot_designation');

        expect(designationRule).toBeTruthy();
        expect(designationRule.compiledEffectNode).toMatchObject({
            structure: 'primitive',
            playMode: 'designate_pilot'
        });
        expect(designationRule.playMode).toBe('designate_pilot');
    });
});
