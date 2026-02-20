const gd01 = require('../data/gd01Card.json');
const gd03 = require('../data/gd03Card.json');

function getPlayRules(card) {
  const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
  return rules.filter((rule) => rule?.type === 'play');
}

function findFirstStepByAction(rule, action) {
  const steps = Array.isArray(rule?.parameters?.steps) ? rule.parameters.steps : [];
  return steps.find((step) => step?.action === action) || null;
}

describe('Wave 1 schema remediation regression', () => {
  test('GD03-106 has one play rule that deploys both tokens in a single sequence', () => {
    const card = gd03.cards['GD03-106'];
    const playRules = getPlayRules(card);
    expect(playRules).toHaveLength(1);

    const steps = Array.isArray(playRules[0]?.parameters?.steps) ? playRules[0].parameters.steps : [];
    expect(steps).toHaveLength(2);
    expect(steps[0]?.action).toBe('conditionalTokenDeploy');
    expect(steps[0]?.parameters?.condition1?.token?.cardId).toBe('T-019');
    expect(steps[1]?.action).toBe('conditionalTokenDeploy');
    expect(steps[1]?.parameters?.condition1?.token?.cardId).toBe('T-018');
  });

  test('GD03-101 encodes the text-declared trash-name condition', () => {
    const card = gd03.cards['GD03-101'];
    const playRules = getPlayRules(card);
    expect(playRules).toHaveLength(1);

    const conditional = findFirstStepByAction(playRules[0], 'conditional');
    expect(conditional).not.toBeNull();
    const ifConditions = Array.isArray(conditional?.parameters?.if) ? conditional.parameters.if : [];
    const trashCondition = ifConditions.find((entry) => entry?.type === 'cardsInTrashWithNameIncludes');
    expect(trashCondition?.name).toBe('A Healthy Curiosity');
    expect(trashCondition?.excludeSourceCard).toBe(true);
  });

  test('GD03-118 encodes bounce first, then optional blocker branch with source exclusion', () => {
    const card = gd03.cards['GD03-118'];
    const playRules = getPlayRules(card);
    expect(playRules).toHaveLength(1);

    const returnToHand = findFirstStepByAction(playRules[0], 'returnToHand');
    expect(returnToHand).not.toBeNull();

    const conditional = findFirstStepByAction(playRules[0], 'conditional');
    expect(conditional).not.toBeNull();
    const ifConditions = Array.isArray(conditional?.parameters?.if) ? conditional.parameters.if : [];
    const trashCondition = ifConditions.find((entry) => entry?.type === 'cardsInTrashWithNameIncludes');
    expect(trashCondition?.name).toBe('Awakened Potential');
    expect(trashCondition?.excludeSourceCard).toBe(true);

    const thenSteps = Array.isArray(conditional?.parameters?.then) ? conditional.parameters.then : [];
    expect(thenSteps[0]?.action).toBe('grant_keyword');
    expect(thenSteps[0]?.optional).toBe(true);
  });

  test('GD01-027 deploy effect now gates blocker damage behind the trash-count condition', () => {
    const card = gd01.cards['GD01-027'];
    const deployRule = card.effects.rules.find((rule) => rule?.effectId === 'deploy_damage_all_4');
    expect(deployRule?.action).toBe('sequence');

    const conditional = findFirstStepByAction(deployRule, 'conditional');
    expect(conditional).not.toBeNull();
    const ifConditions = Array.isArray(conditional?.parameters?.if) ? conditional.parameters.if : [];
    const trashCondition = ifConditions.find((entry) => entry?.type === 'cardsInTrash');
    expect(trashCondition?.cardType).toBe('unit');
    expect(trashCondition?.value).toBe('>=10');
    expect(Array.isArray(trashCondition?.traitsAny)).toBe(true);
  });
});
