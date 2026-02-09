const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectNotifier } = require('../services/effects/EffectNotifier');

describe('CARD_DAMAGED notification uses slot HP', () => {
    test('resultingHP/displayValue/maxHP include pilot stats when unit is in a slot', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');

        p1.zones.slot1.unit = {
            carduid: 'GD02-054_unit_0001',
            cardId: 'GD02-054',
            cardData: {
                id: 'GD02-054',
                name: 'Gundam Barbatos 1st Form',
                cardType: 'unit',
                ap: 3,
                hp: 2,
            },
            originalAP: 3,
            originalHP: 2,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 2,
            isRested: false,
        };

        p1.zones.slot1.pilot = {
            carduid: 'ST05-010_pilot_0001',
            cardId: 'ST05-010',
            cardData: {
                id: 'ST05-010',
                name: 'Mikazuki Augus',
                cardType: 'pilot',
                ap: 2,
                hp: 1,
            },
            originalAP: 2,
            originalHP: 1,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            isRested: false,
        };

        EffectNotifier.notifyCardDamageApplied(
            gameEnv,
            p1.zones.slot1.unit,
            {
                playerId: 'playerId_1',
                zone: 'slot1',
                carduid: 'GD02-054_unit_0001',
                cardData: {
                    cardId: 'GD02-054',
                    name: 'Gundam Barbatos 1st Form',
                },
            },
            1,
            0,
            2
        );

        const notification = gameEnv.notificationQueue[gameEnv.notificationQueue.length - 1];
        expect(notification.type).toBe('CARD_DAMAGED');
        expect(notification.payload.resultingHP).toBe(1);
        expect(notification.payload.displayValue).toBe(1);
        expect(notification.payload.maxHP).toBe(3);
    });
});

