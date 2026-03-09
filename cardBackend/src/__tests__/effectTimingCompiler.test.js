const { compileEffectTimingFromRule } = require('../services/effects/timing/EffectTimingCompiler');
const { bridgeCardData } = require('./helpers/effectTimingRuntimeTestUtils');

const gd01Cards = require('../data/gd01Card.json');
const gd02Cards = require('../data/gd02Card.json');
const gd03Cards = require('../data/gd03Card.json');
const st01Cards = require('../data/st01Card.json');
const st02Cards = require('../data/st02Card.json');
const st03Cards = require('../data/st03Card.json');
const st04Cards = require('../data/st04Card.json');
const st05Cards = require('../data/st05Card.json');
const st06Cards = require('../data/st06Card.json');
const st07Cards = require('../data/st07Card.json');
const st08Cards = require('../data/st08Card.json');

const CARD_SETS = [
    gd01Cards,
    gd02Cards,
    gd03Cards,
    st01Cards,
    st02Cards,
    st03Cards,
    st04Cards,
    st05Cards,
    st06Cards,
    st07Cards,
    st08Cards
];

function getAllRules() {
    return CARD_SETS.flatMap((set) =>
        Object.values(set?.cards || {}).flatMap((card) =>
            Array.isArray(card?.effects?.rules)
                ? card.effects.rules.map((rule) => ({ cardId: card.id, rule }))
                : []
        )
    );
}

describe('EffectTimingCompiler', () => {
    test('classifies triggered, activated, continuous, and special timing correctly', () => {
        expect(
            compileEffectTimingFromRule({
                type: 'triggered',
                timing: { eventTrigger: 'ENTERS_PLAY' },
                action: 'damage'
            })
        ).toMatchObject({
            eventTrigger: 'ENTERS_PLAY',
            timingClass: 'event_triggered'
        });

        expect(
            compileEffectTimingFromRule({
                type: 'activated',
                timing: { activationWindows: ['ACTION_STEP'] },
                action: 'damage'
            })
        ).toMatchObject({
            activationWindows: ['ACTION_STEP'],
            timingClass: 'player_activated'
        });

        expect(
            compileEffectTimingFromRule({
                type: 'continuous',
                timing: { duration: 'continuous' },
                action: 'modifyAP'
            })
        ).toMatchObject({
            duration: 'continuous',
            timingClass: 'continuous_passive'
        });

        expect(
            compileEffectTimingFromRule({
                type: 'special',
                action: 'designate_pilot',
                timing: { activationWindows: ['MAIN_PHASE'] }
            })
        ).toMatchObject({
            activationWindows: ['MAIN_PHASE'],
            timingClass: 'player_activated'
        });
    });

    test('migrated card data no longer uses top-level rule trigger or timing.windows', () => {
        const rules = getAllRules();
        expect(rules.length).toBeGreaterThan(0);

        for (const { cardId, rule } of rules) {
            expect(rule.trigger).toBeUndefined();
            expect(rule?.timing?.windows).toBeUndefined();
            expect(rule?.timing?.internalHook).toBeUndefined();
            expect(typeof rule.type).toBe('string');
            expect(rule.timing).toBeDefined();

            if (rule.type === 'triggered') {
                expect(typeof rule.timing.eventTrigger).toBe('string');
            }

            if (rule.type === 'activated' || rule.type === 'play') {
                const hasEventTrigger = typeof rule?.timing?.eventTrigger === 'string';
                const hasActivationWindows = Array.isArray(rule?.timing?.activationWindows);
                expect(hasEventTrigger || hasActivationWindows).toBe(true);
            }

            if (rule.type === 'continuous') {
                expect(rule?.timing?.duration).toBe('continuous');
            }

            if (rule.type === 'special' && rule.action === 'designate_pilot') {
                expect(rule?.timing?.activationWindows).toEqual(['MAIN_PHASE']);
            }

            const bridgedCard = bridgeCardData({
                id: cardId,
                effects: { rules: [rule] }
            });
            const bridgedRule = bridgedCard.effects.rules[0];
            expect(bridgedRule.compiledTiming).toBeDefined();
            expect(typeof bridgedRule.compiledTiming.timingClass).toBe('string');
            expect(bridgedRule.compiledTiming.windows).toBeUndefined();
            expect(bridgedRule.compiledTiming.legacyTrigger).toBeUndefined();
            expect(bridgedRule.timing).toBeDefined();
        }
    });
});
