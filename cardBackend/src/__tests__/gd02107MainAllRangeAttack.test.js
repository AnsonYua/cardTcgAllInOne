const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const gd02 = require('../data/gd02Card.json');

function createUnit(carduid, cardId, hp = 3, ap = 2) {
    return {
        carduid,
        cardId,
        placedAt: 0,
        placedBy: 'playerId_2',
        isRested: false,
        damageReceived: 0,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        originalAP: ap,
        originalHP: hp,
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true,
        isFirstPlay: false,
        temporaryEffects: [],
        effectUsage: {},
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            ap,
            hp,
            effects: { description: [], rules: [] }
        }
    };
}

describe('GD02-107 main effect', () => {
    test('deals 1 to all enemy non-link units without target choice', () => {
        const effect = gd02.cards['GD02-107'].effects.rules.find((r) => r.effectId === 'play_effect');
        expect(effect).toBeTruthy();

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        // Opponent slot1/slot2 are non-link units (no pilot paired)
        p2.zones.slot1.unit = createUnit('enemy_nonlink_1', 'ENEMY-1');
        p2.zones.slot2.unit = createUnit('enemy_nonlink_2', 'ENEMY-2');

        // Opponent slot3 is a link unit (has paired pilot) and should be excluded by filter.
        p2.zones.slot3.unit = createUnit('enemy_link_1', 'ENEMY-3');
        p2.zones.slot3.pilot = {
            carduid: 'enemy_pilot_1',
            cardId: 'PILOT-1',
            placedAt: 0,
            placedBy: 'playerId_2',
            isRested: false,
            isFirstPlay: false,
            originalAP: 1,
            originalHP: 1,
            temporaryEffects: [],
            effectUsage: {},
            cardData: { id: 'PILOT-1', name: 'Pilot', cardType: 'pilot' }
        };

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD02-107_cmd_test_0001',
            effect
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        expect(p2.zones.slot1.unit.damageReceived).toBe(1);
        expect(p2.zones.slot2.unit.damageReceived).toBe(1);
        expect(p2.zones.slot3.unit.damageReceived || 0).toBe(0);
    });
});
