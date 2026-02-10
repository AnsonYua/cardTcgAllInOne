const { GameEnvironment } = require('../models/GameEnvironment');

describe('Damage persistence across turns', () => {
    test('resetTurnStatus does not clear unit damageReceived', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');

        p1.zones.slot1.unit = {
            carduid: 'GD02-006_unit_0001',
            cardId: 'GD02-006',
            cardData: { id: 'GD02-006', name: 'Forbidden Gundam', cardType: 'unit', ap: 4, hp: 4 },
            originalAP: 4,
            originalHP: 4,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 1,
            isRested: false,
        };

        p1.resetTurnStatus();
        expect(p1.zones.slot1.unit.damageReceived).toBe(1);
    });
});

