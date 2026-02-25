const { GameEnvironment } = require('../models/GameEnvironment');
const { AttackPreparationManager } = require('../services/AttackPreparationManager');

describe('GD03-081 deployed-this-turn attack requirement', () => {
    function makeUnit(carduid, traits, rules = []) {
        return {
            carduid,
            cardId: carduid.split('_')[0],
            cardData: {
                cardType: 'unit',
                name: carduid,
                level: 2,
                ap: 2,
                hp: 2,
                traits,
                effects: { rules }
            },
            isRested: false,
            playedThisTurn: false,
            continueModifyAP: 0,
            continueModifyHP: 0,
            temporaryEffects: []
        };
    }

    const restrictionRule = {
        effectId: 'restrict_attack_unless_friendly_sb_or_un_deployed_this_turn',
        type: 'continuous',
        trigger: 'continuous',
        action: 'restrict_attack',
        parameters: {
            requires: {
                type: 'friendly_unit_deployed_this_turn',
                traitsAny: ['Superpower Bloc', 'UN']
            }
        }
    };

    test('blocks attack when no matching unit was deployed this turn', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('player1', 'P1');
        gameEnv.addPlayer('player2', 'P2');

        const attacker = makeUnit('GD03-081_1', ['Superpower Bloc'], [restrictionRule]);
        const ally = makeUnit('ALLY_1', ['UN']);

        p1.zones.slot1.unit = attacker;
        p1.zones.slot2.unit = ally;

        const result = AttackPreparationManager.prepareBaseAttack(
            gameEnv,
            'player1',
            attacker.carduid
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/can only attack during a turn/i);
    });

    test('allows attack when a matching friendly unit was deployed this turn', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('player1', 'P1');
        gameEnv.addPlayer('player2', 'P2');

        const attacker = makeUnit('GD03-081_1', ['Superpower Bloc'], [restrictionRule]);
        const ally = makeUnit('ALLY_1', ['UN']);
        ally.playedThisTurn = true;

        p1.zones.slot1.unit = attacker;
        p1.zones.slot2.unit = ally;

        const result = AttackPreparationManager.prepareBaseAttack(
            gameEnv,
            'player1',
            attacker.carduid
        );

        expect(result.success).toBe(true);
    });

    test('allows attack when matching unit was deployed this turn and then destroyed', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('player1', 'P1');
        gameEnv.addPlayer('player2', 'P2');

        const attacker = makeUnit('GD03-081_1', ['Superpower Bloc'], [restrictionRule]);
        const deadAlly = makeUnit('ALLY_1', ['UN']);
        deadAlly.playedThisTurn = true;

        p1.zones.slot1.unit = attacker;
        p1.zones.trashArea.push(deadAlly);

        const result = AttackPreparationManager.prepareBaseAttack(
            gameEnv,
            'player1',
            attacker.carduid
        );

        expect(result.success).toBe(true);
    });
});
