const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');

const gd03Data = require('../data/gd03Card.json');

function createUnit(carduid, level, hp, color = 'Red') {
    return {
        carduid,
        cardId: carduid.split('_')[0],
        cardData: { id: carduid.split('_')[0], name: carduid, cardType: 'unit', level, ap: 3, hp, color, traits: [] },
        originalAP: 3,
        originalHP: hp,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        isRested: false
    };
}

function getGd03107PlayEffect() {
    const card = gd03Data.cards['GD03-107'];
    expect(card).toBeTruthy();
    const effect = (card.effects.rules || []).find(rule => rule.effectId === 'play_effect');
    expect(effect).toBeTruthy();
    return effect;
}

describe('GD03-107 damage scaling', () => {
    test('0 friendly token units in play deals 0 damage', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        p2.zones.slot1.unit = createUnit('enemy_unit_0001', 5, 10, 'Blue');

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD03-107_source_0001',
            getGd03107PlayEffect()
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit.damageReceived).toBe(0);
    });

    test('2 friendly token units in play deals 2 damage', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.slot1.unit = createUnit('token_unit_0001', 1, 1, 'Token');
        p1.zones.slot2.unit = createUnit('token_unit_0002', 1, 1, 'Token');
        p2.zones.slot1.unit = createUnit('enemy_unit_0002', 5, 10, 'Blue');

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD03-107_source_0002',
            getGd03107PlayEffect()
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit.damageReceived).toBe(2);
    });

    test('non-token friendly units are not counted', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.slot1.unit = createUnit('token_unit_0003', 1, 1, 'Token');
        p1.zones.slot2.unit = createUnit('normal_unit_0001', 4, 4, 'Red');
        p1.zones.slot3.unit = createUnit('normal_unit_0002', 4, 4, 'Blue');
        p2.zones.slot1.unit = createUnit('enemy_unit_0003', 5, 10, 'Blue');

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD03-107_source_0003',
            getGd03107PlayEffect()
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit.damageReceived).toBe(1);
    });
});
