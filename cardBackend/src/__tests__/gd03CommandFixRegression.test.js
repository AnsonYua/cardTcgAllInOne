const gd03 = require('../data/gd03Card.json');

function getPlayRules(card) {
    const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
    return rules.filter(rule => rule?.type === 'play');
}

function findConditionalConditionByType(effectRule, conditionType) {
    const steps = Array.isArray(effectRule?.parameters?.steps) ? effectRule.parameters.steps : [];
    const conditionalStep = steps.find(step => step?.action === 'conditional');
    const ifConditions = Array.isArray(conditionalStep?.parameters?.if) ? conditionalStep.parameters.if : [];
    return ifConditions.find(condition => condition?.type === conditionType) || null;
}

describe('GD03 command duplicate-play fixes', () => {
    test('GD03-109 has a single play rule and excludes source card in name-in-trash checks', () => {
        const card = gd03.cards['GD03-109'];
        const playRules = getPlayRules(card);
        expect(playRules).toHaveLength(1);

        const burstRule = card.effects.rules.find(rule => rule?.effectId === 'burst_effect');
        const burstCondition = findConditionalConditionByType(burstRule, 'cardsInTrashWithNameIncludes');
        expect(burstCondition?.excludeSourceCard).toBe(true);

        const playCondition = findConditionalConditionByType(playRules[0], 'cardsInTrashWithNameIncludes');
        expect(playCondition?.excludeSourceCard).toBe(true);
    });

    test('GD03-114 has a single play rule and excludes source card in cardsInTrash checks', () => {
        const card = gd03.cards['GD03-114'];
        const playRules = getPlayRules(card);
        expect(playRules).toHaveLength(1);

        const burstRule = card.effects.rules.find(rule => rule?.effectId === 'burst_effect');
        const burstCondition = findConditionalConditionByType(burstRule, 'cardsInTrash');
        expect(burstCondition?.excludeSourceCard).toBe(true);

        const playCondition = findConditionalConditionByType(playRules[0], 'cardsInTrash');
        expect(playCondition?.excludeSourceCard).toBe(true);
    });
});
