const { GameEnvironment } = require('../models/GameEnvironment');
const { resolveEffectDamageValue } = require('../services/effects/actions/EffectDamageValueResolver');

function createUnitCard(carduid, ap = 0, hp = 1) {
    return {
        carduid,
        cardId: carduid.split('_')[0],
        cardData: { id: carduid.split('_')[0], name: carduid, cardType: 'unit', ap, hp },
        originalAP: ap,
        originalHP: hp,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        isRested: false
    };
}

function createPilotCard(carduid, ap = 0, hp = 1) {
    return {
        carduid,
        cardId: carduid.split('_')[0],
        cardData: { id: carduid.split('_')[0], name: carduid, cardType: 'pilot', ap, hp },
        originalAP: ap,
        originalHP: hp,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        isRested: false
    };
}

describe('resolveEffectDamageValue', () => {
    test('returns base value when scaling is absent', () => {
        const gameEnv = new GameEnvironment();
        const effect = { effectId: 'test', action: 'damage', parameters: { value: 3 } };

        expect(resolveEffectDamageValue(gameEnv, effect, 'missing_source')).toBe(3);
    });

    test('ap=9 with per=4 and floor resolves to 2', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.slot1.unit = createUnitCard('GD03-033_attacker', 5, 5);
        p1.zones.slot1.pilot = createPilotCard('TEST-PILOT_floor', 4, 2);

        const effect = {
            effectId: 'test',
            action: 'damage',
            parameters: {
                value: 1,
                scaling: { stat: 'ap', scope: 'source', per: 4, rounding: 'floor' }
            }
        };

        expect(resolveEffectDamageValue(gameEnv, effect, 'GD03-033_attacker')).toBe(2);
    });

    test('ap=12 with per=4 and floor resolves to 3', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.slot1.unit = createUnitCard('GD03-033_attacker', 5, 5);
        p1.zones.slot1.pilot = createPilotCard('TEST-PILOT_floor', 7, 2);

        const effect = {
            effectId: 'test',
            action: 'damage',
            parameters: {
                value: 1,
                scaling: { stat: 'ap', scope: 'source', per: 4, rounding: 'floor' }
            }
        };

        expect(resolveEffectDamageValue(gameEnv, effect, 'GD03-033_attacker')).toBe(3);
    });

    test('ap=3 with per=4 and floor resolves to 0', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.slot1.unit = createUnitCard('GD03-033_attacker', 3, 5);

        const effect = {
            effectId: 'test',
            action: 'damage',
            parameters: {
                value: 1,
                scaling: { stat: 'ap', scope: 'source', per: 4, rounding: 'floor' }
            }
        };

        expect(resolveEffectDamageValue(gameEnv, effect, 'GD03-033_attacker')).toBe(0);
    });

    test('invalid per and missing source fallback to base value', () => {
        const gameEnv = new GameEnvironment();
        const effectInvalidPer = {
            effectId: 'test_invalid_per',
            action: 'damage',
            parameters: {
                value: 2,
                scaling: { stat: 'ap', scope: 'source', per: 0, rounding: 'floor' }
            }
        };
        const effectMissingSource = {
            effectId: 'test_missing_source',
            action: 'damage',
            parameters: {
                value: 2,
                scaling: { stat: 'ap', scope: 'source', per: 4, rounding: 'floor' }
            }
        };

        expect(resolveEffectDamageValue(gameEnv, effectInvalidPer, 'no_source')).toBe(2);
        expect(resolveEffectDamageValue(gameEnv, effectMissingSource, undefined)).toBe(2);
    });

    test('slot AP includes unit+pilot and AP modifiers', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.slot1.unit = createUnitCard('GD03-033_attacker', 5, 5);
        p1.zones.slot1.unit.continueModifyAP = 2;
        p1.zones.slot1.unit.modifyAP = 1;

        p1.zones.slot1.pilot = createPilotCard('TEST-PILOT_mod', 2, 2);
        p1.zones.slot1.pilot.continueModifyAP = 1;
        p1.zones.slot1.pilot.modifyAP = 1;

        // total AP = (5+2+1) + (2+1+1) = 12 -> floor(12/4)=3; base=2 => 6
        const effect = {
            effectId: 'test',
            action: 'damage',
            parameters: {
                value: 2,
                scaling: { stat: 'ap', scope: 'source', per: 4, rounding: 'floor' }
            }
        };

        expect(resolveEffectDamageValue(gameEnv, effect, 'GD03-033_attacker')).toBe(6);
    });
});
