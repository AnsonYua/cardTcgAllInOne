const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectScalingResolver } = require('../services/effects/scaling/EffectScalingResolver');

function createUnit(carduid, ap, hp, color = 'Red') {
    return {
        carduid,
        cardId: carduid.split('_')[0],
        cardData: { id: carduid.split('_')[0], name: carduid, cardType: 'unit', ap, hp, color, traits: [] },
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

function createPilot(carduid, ap, hp) {
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

describe('EffectScalingResolver', () => {
    test('source AP scaling with floor handles 9/12/3 AP cases', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        p1.zones.slot1.unit = createUnit('GD03-033_unit', 5, 5);
        p1.zones.slot1.pilot = createPilot('GD03-089_pilot', 4, 1);

        const scaling = { stat: 'ap', scope: 'source', per: 4, rounding: 'floor' };
        expect(EffectScalingResolver.resolveScaledValue(1, scaling, {
            gameEnv,
            sourcePlayerId: 'playerId_1',
            sourceCarduid: 'GD03-033_unit'
        })).toBe(2);

        p1.zones.slot1.pilot.originalAP = 7;
        expect(EffectScalingResolver.resolveScaledValue(1, scaling, {
            gameEnv,
            sourcePlayerId: 'playerId_1',
            sourceCarduid: 'GD03-033_unit'
        })).toBe(3);

        p1.zones.slot1.pilot = undefined;
        p1.zones.slot1.unit.continueModifyAP = -2;
        expect(EffectScalingResolver.resolveScaledValue(1, scaling, {
            gameEnv,
            sourcePlayerId: 'playerId_1',
            sourceCarduid: 'GD03-033_unit'
        })).toBe(0);
    });

    test('COUNT_UNITS_IN_PLAY supports filter and multiplier', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.slot1.unit = createUnit('token_1', 2, 1, 'Token');
        p1.zones.slot2.unit = createUnit('token_2', 2, 1, 'Token');
        p1.zones.slot3.unit = createUnit('normal_1', 4, 4, 'Red');

        const scaling = {
            type: 'COUNT_UNITS_IN_PLAY',
            scope: 'self',
            filters: { color: 'Token' },
            multiplier: 2
        };

        expect(EffectScalingResolver.resolveScaledValue(1, scaling, {
            gameEnv,
            sourcePlayerId: 'playerId_1'
        })).toBe(4);
    });

    test('unsupported scaling falls back to base value', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        expect(EffectScalingResolver.resolveScaledValue(3, { type: 'UNKNOWN_SCALING' }, {
            gameEnv,
            sourcePlayerId: 'playerId_1',
            effectId: 'test_effect'
        })).toBe(3);
    });

    test('COUNT_UNIQUE_CARDS_IN_TRASH counts unique names only for filtered card types/traits', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.trashArea = [
            { carduid: 't1', cardData: { name: 'Bernard Wiseman', cardType: 'pilot', traits: ['Cyclops Team'] } },
            { carduid: 't2', cardData: { name: 'Bernard Wiseman', cardType: 'pilot', traits: ['Cyclops Team'] } }, // duplicate name
            { carduid: 't3', cardData: { name: 'Mikhail Kaminsky', cardType: 'command', traits: ['Cyclops Team'] } },
            { carduid: 't4', cardData: { name: 'Off Trait Pilot', cardType: 'pilot', traits: ['Zeon'] } },
            { carduid: 't5', cardData: { name: 'Cyclops Unit', cardType: 'unit', traits: ['Cyclops Team'] } }
        ];

        const scaling = {
            type: 'COUNT_UNIQUE_CARDS_IN_TRASH',
            scope: 'self',
            filters: {
                traitsAny: ['Cyclops Team'],
                cardTypes: ['pilot', 'command']
            },
            multiplier: 1
        };

        expect(EffectScalingResolver.resolveScaledValue(1, scaling, {
            gameEnv,
            sourcePlayerId: 'playerId_1'
        })).toBe(2);
    });
});
