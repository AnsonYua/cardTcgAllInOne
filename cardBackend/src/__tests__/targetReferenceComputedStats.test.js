const { GameEnvironment } = require('../models/GameEnvironment');
const { TargetResolver } = require('../services/targets/TargetResolver');

describe('TargetReference computed stats', () => {
    test('unit targets include computed totalAP/totalHP', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        // Put an opponent unit in slot2 with AP reduced.
        p2.zones.slot2.unit = {
            carduid: 'ST03-007_enemy_le4_0002',
            cardData: {
                id: 'ST03-007',
                name: 'Zaku I',
                cardType: 'unit',
                ap: 1,
                hp: 2,
                traits: ['Zeon'],
                level: 1
            },
            originalAP: 1,
            originalHP: 2,
            modifyAP: -2,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            isRested: false
        };

        const targets = TargetResolver.generateAvailableTargets(gameEnv, 'playerId_1', {
            type: 'unit',
            scope: 'opponent',
            count: 1,
            filters: {}
        });

        const zaku = targets.find(t => t.carduid === 'ST03-007_enemy_le4_0002');
        expect(zaku).toBeTruthy();
        expect(zaku.computed).toBeTruthy();
        expect(typeof zaku.computed.totalAP).toBe('number');
        expect(typeof zaku.computed.totalHP).toBe('number');
    });
});

