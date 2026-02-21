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

    test('damage effect uses AP-based scaling from source slot', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.slot1.unit = {
            carduid: 'GD03-033_source_1',
            cardId: 'GD03-033',
            cardData: { id: 'GD03-033', name: 'Providence Gundam', cardType: 'unit', ap: 5, hp: 5 },
            originalAP: 5,
            originalHP: 5,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            damageReceived: 0,
            isRested: false,
        };
        p1.zones.slot1.pilot = {
            carduid: 'TEST-PILOT_source_1',
            cardId: 'TEST-PILOT',
            cardData: { id: 'TEST-PILOT', name: 'Test Pilot', cardType: 'pilot', ap: 4, hp: 2 },
            originalAP: 4,
            originalHP: 2,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            isRested: false,
        };

        p2.zones.slot1.unit = {
            carduid: 'enemy_unit_scale_1',
            cardId: 'GD02-054',
            cardData: { id: 'GD02-054', name: 'Enemy Unit', cardType: 'unit', ap: 3, hp: 10 },
            originalAP: 3,
            originalHP: 10,
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
            'GD03-033_source_1',
            {
                effectId: 'test_scaled_damage',
                type: 'internal',
                trigger: 'TEST',
                action: 'damage',
                parameters: {
                    value: 1,
                    scaling: {
                        stat: 'ap',
                        scope: 'source',
                        per: 4,
                        rounding: 'floor'
                    }
                }
            },
            [{ carduid: 'enemy_unit_scale_1', zone: 'slot1', playerId: p2.id, cardData: p2.zones.slot1.unit.cardData }]
        );

        // source slot AP = 5 + 4 = 9 -> floor(9/4)=2
        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit.damageReceived).toBe(2);
    });
});
