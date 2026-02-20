const { GameEnvironment } = require('../models/GameEnvironment');
const { ConditionalTokenDeployManager } = require('../services/effects/ConditionalTokenDeployManager');

function createUnit(carduid, traits = []) {
    return {
        carduid,
        cardId: carduid.split('_')[0],
        cardData: {
            id: carduid.split('_')[0],
            name: carduid,
            cardType: 'unit',
            color: 'Blue',
            level: 3,
            ap: 2,
            hp: 2,
            traits,
            effects: { rules: [] }
        },
        originalAP: 2,
        originalHP: 2,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        effectUsage: {},
        isRested: false
    };
}

describe('conditional token deploy extended conditions', () => {
    test('supports hasAnotherUnitWithTrait and rested token placement', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        player.zones.slot1.unit = createUnit('SRC_0001');
        player.zones.slot2.unit = createUnit('ALLY_NEW_UNE_0001', ['New UNE']);

        const effect = {
            effectId: 'test_token_deploy',
            type: 'triggered',
            trigger: 'ENTERS_PLAY',
            action: 'conditionalTokenDeploy',
            parameters: {
                condition1: {
                    hasAnotherUnitWithTrait: 'New UNE',
                    token: { cardId: 'T-012' },
                    count: 1,
                    rested: true
                }
            }
        };

        const planResult = ConditionalTokenDeployManager.buildPlan(gameEnv, 'playerId_1', effect);
        expect(planResult.success).toBe(true);
        expect(planResult.plan.rested).toBe(true);
    });

    test('supports enemyUnitsInPlay range matching between conditions', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');

        player.zones.slot1.unit = createUnit('SRC_0002');
        opponent.zones.slot1.unit = createUnit('ENEMY_0001');
        opponent.zones.slot2.unit = createUnit('ENEMY_0002');

        const effect = {
            effectId: 'test_enemy_range',
            type: 'play',
            action: 'conditionalTokenDeploy',
            parameters: {
                condition1: {
                    enemyUnitsInPlay: '>=1',
                    enemyUnitsInPlayMax: 4,
                    token: { cardId: 'T-016' },
                    count: 1
                },
                condition2: {
                    enemyUnitsInPlay: '>=5',
                    token: { cardId: 'T-017' },
                    count: 1
                }
            }
        };

        const planResult = ConditionalTokenDeployManager.buildPlan(gameEnv, 'playerId_1', effect);
        expect(planResult.success).toBe(true);
        expect(planResult.plan.tokenData.id).toBe('T-016');
    });
});

