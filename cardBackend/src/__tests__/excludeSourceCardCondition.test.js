const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectConditionEvaluator } = require('../services/conditions/EffectConditionEvaluator');

function buildEffect(conditions) {
    return {
        effectId: 'test_effect',
        type: 'internal',
        trigger: 'SEQUENCE_STEP',
        action: 'noop',
        conditions
    };
}

function addTrashCard(player, carduid, name) {
    player.zones.trashArea.push({
        carduid,
        cardId: carduid.split('_')[0] || 'TEST',
        cardData: {
            id: carduid.split('_')[0] || 'TEST',
            name,
            cardType: 'command',
            traits: []
        }
    });
}

describe('excludeSourceCard condition option', () => {
    test('cardsInTrashWithNameIncludes excludes source card when requested', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('p1', 'P1');
        gameEnv.addPlayer('p2', 'P2');

        addTrashCard(player, 'GD03-109_prev', 'Improved Technique');
        addTrashCard(player, 'GD03-109_source', 'Improved Technique');

        const sourceCard = { carduid: 'GD03-109_source' };

        const withExclude = EffectConditionEvaluator.validateEffectConditions(
            buildEffect([
                {
                    type: 'cardsInTrashWithNameIncludes',
                    scope: 'self',
                    name: 'Improved Technique',
                    value: '>=2',
                    excludeSourceCard: true
                }
            ]),
            gameEnv,
            'p1',
            sourceCard
        );

        const withoutExclude = EffectConditionEvaluator.validateEffectConditions(
            buildEffect([
                {
                    type: 'cardsInTrashWithNameIncludes',
                    scope: 'self',
                    name: 'Improved Technique',
                    value: '>=2'
                }
            ]),
            gameEnv,
            'p1',
            sourceCard
        );

        expect(withExclude).toBe(false);
        expect(withoutExclude).toBe(true);
    });

    test('cardsInTrash excludes source card when requested', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('p1', 'P1');
        gameEnv.addPlayer('p2', 'P2');

        addTrashCard(player, 'GD03-114_prev', 'Other Card');
        addTrashCard(player, 'GD03-114_source', 'Look of Determination');

        const sourceCard = { carduid: 'GD03-114_source' };

        const withExclude = EffectConditionEvaluator.validateEffectConditions(
            buildEffect([
                {
                    type: 'cardsInTrash',
                    scope: 'self',
                    value: '>=2',
                    excludeSourceCard: true
                }
            ]),
            gameEnv,
            'p1',
            sourceCard
        );

        const withoutExclude = EffectConditionEvaluator.validateEffectConditions(
            buildEffect([
                {
                    type: 'cardsInTrash',
                    scope: 'self',
                    value: '>=2'
                }
            ]),
            gameEnv,
            'p1',
            sourceCard
        );

        expect(withExclude).toBe(false);
        expect(withoutExclude).toBe(true);
    });
});
