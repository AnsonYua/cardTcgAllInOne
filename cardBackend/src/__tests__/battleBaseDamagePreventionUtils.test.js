const { GameEnvironment } = require('../models/GameEnvironment');
const { BattleBaseDamagePreventionUtils } = require('../services/battle/BattleBaseDamagePreventionUtils');

describe('BattleBaseDamagePreventionUtils', () => {
    test('honors temporary preventBattleDamage effects on base cards', () => {
        const gameEnv = new GameEnvironment();
        const defender = gameEnv.addPlayer('playerId_1', 'P1');

        const baseCard = {
            carduid: 'base_0001',
            cardId: 'GD01-125',
            cardData: { id: 'GD01-125', name: 'Base', cardType: 'base', hp: 5, effects: { description: [], rules: [] } },
            originalHP: 5,
            damageReceived: 0,
            temporaryEffects: [
                {
                    sourceCarduid: 'cmd_0001',
                    duration: 'UNTIL_END_OF_BATTLE',
                    appliedTurn: 1,
                    appliedBy: 'playerId_1',
                    preventBattleDamage: {
                        from: 'enemy_units',
                        enemyLevel: '<=4'
                    }
                }
            ]
        };
        defender.zones.base.push(baseCard);

        const attackingUnit = {
            carduid: 'attacker_0001',
            cardId: 'ST03-001',
            cardData: { id: 'ST03-001', name: 'Attacker', cardType: 'unit', level: 4, ap: 3, hp: 4 },
            damageReceived: 0
        };

        const prevented = BattleBaseDamagePreventionUtils.isBaseDamagePreventedFromEnemyUnit(
            gameEnv,
            defender.id,
            baseCard,
            attackingUnit
        );

        expect(prevented).toBe(true);
    });

    test('temporary base preventBattleDamage respects enemyLevel filter', () => {
        const gameEnv = new GameEnvironment();
        const defender = gameEnv.addPlayer('playerId_1', 'P1');

        const baseCard = {
            carduid: 'base_0001',
            cardId: 'GD01-125',
            cardData: { id: 'GD01-125', name: 'Base', cardType: 'base', hp: 5, effects: { description: [], rules: [] } },
            originalHP: 5,
            damageReceived: 0,
            temporaryEffects: [
                {
                    sourceCarduid: 'cmd_0001',
                    duration: 'UNTIL_END_OF_BATTLE',
                    appliedTurn: 1,
                    appliedBy: 'playerId_1',
                    preventBattleDamage: {
                        from: 'enemy_units',
                        enemyLevel: '<=3'
                    }
                }
            ]
        };
        defender.zones.base.push(baseCard);

        const attackingUnit = {
            carduid: 'attacker_0001',
            cardId: 'ST03-001',
            cardData: { id: 'ST03-001', name: 'Attacker', cardType: 'unit', level: 4, ap: 3, hp: 4 },
            damageReceived: 0
        };

        const prevented = BattleBaseDamagePreventionUtils.isBaseDamagePreventedFromEnemyUnit(
            gameEnv,
            defender.id,
            baseCard,
            attackingUnit
        );

        expect(prevented).toBe(false);
    });
});
