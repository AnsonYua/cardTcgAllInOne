const { GameEnvironment } = require('../models/GameEnvironment');
const { applyDamageEffect } = require('../services/effects/actions/EffectDamageActions');

describe('Effect damage destruction', () => {
    test('unit is destroyed and moved to trash when slot HP reaches 0', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.unit = {
            carduid: 'enemy_unit_1',
            cardId: 'GD02-054',
            cardData: { id: 'GD02-054', name: 'Unit', cardType: 'unit', ap: 3, hp: 2 },
            originalAP: 3,
            originalHP: 2,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            isRested: false,
        };

        const result = applyDamageEffect(
            gameEnv,
            p1.id,
            undefined,
            { effectId: 'test_damage', type: 'internal', trigger: 'TEST', action: 'damage', parameters: { value: 2 } },
            [{ carduid: 'enemy_unit_1', zone: 'slot1', playerId: p2.id, cardData: p2.zones.slot1.unit.cardData }]
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit).toBeFalsy();
        expect(Array.isArray(p2.zones.trashArea)).toBe(true);
        expect(p2.zones.trashArea.some(c => c.carduid === 'enemy_unit_1')).toBe(true);
    });

    test('unit is destroyed when shared unit+pilot slot HP reaches 0', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.unit = {
            carduid: 'enemy_unit_2',
            cardId: 'GD02-054',
            cardData: { id: 'GD02-054', name: 'Unit', cardType: 'unit', ap: 3, hp: 2 },
            originalAP: 3,
            originalHP: 2,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            isRested: false,
        };
        p2.zones.slot1.pilot = {
            carduid: 'enemy_pilot_2',
            cardId: 'ST05-010',
            cardData: { id: 'ST05-010', name: 'Pilot', cardType: 'pilot', ap: 2, hp: 1 },
            originalAP: 2,
            originalHP: 1,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            isRested: false,
        };

        const result = applyDamageEffect(
            gameEnv,
            p1.id,
            undefined,
            { effectId: 'test_damage', type: 'internal', trigger: 'TEST', action: 'damage', parameters: { value: 3 } },
            [{ carduid: 'enemy_unit_2', zone: 'slot1', playerId: p2.id, cardData: p2.zones.slot1.unit.cardData }]
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit).toBeFalsy();
        expect(p2.zones.slot1.pilot).toBeFalsy();
        expect(Array.isArray(p2.zones.trashArea)).toBe(true);
        expect(p2.zones.trashArea.some(c => c.carduid === 'enemy_unit_2')).toBe(true);
        expect(p2.zones.trashArea.some(c => c.carduid === 'enemy_pilot_2')).toBe(true);
    });
});
