const { GameEnvironment } = require('../models/GameEnvironment');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { KeywordUtils } = require('../utils/KeywordUtils');
const gd02 = require('../data/gd02Card.json');
const gd03 = require('../data/gd03Card.json');

function makeUnit(carduid, effectsRules) {
    return {
        carduid,
        cardId: carduid.split('_')[0],
        cardData: {
            cardType: 'unit',
            name: carduid,
            traits: ['Test'],
            effects: { rules: effectsRules },
            ap: 3,
            hp: 3
        },
        isRested: false,
        continueModifyAP: 0,
        continueModifyHP: 0,
        temporaryEffects: []
    };
}

function findRule(card, effectId) {
    const rules = Array.isArray(card?.effects?.rules) ? card.effects.rules : [];
    return rules.find((rule) => rule?.effectId === effectId) || null;
}

describe('GD02/GD03 keyword coverage fixes', () => {
    test('GD02-053 includes suppression_2 rule and grants Suppression continuously to self', () => {
        const card = gd02.cards['GD02-053'];
        expect(card.effects.description).toHaveLength(2);
        expect(card.effects.rules).toHaveLength(2);
        const suppressionRule = findRule(card, 'suppression_2');
        expect(suppressionRule).toBeTruthy();
        expect(suppressionRule.action).toBe('grant_keyword');
        expect(suppressionRule.parameters?.keyword).toBe('Suppression');

        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('player1', 'P1');
        gameEnv.addPlayer('player2', 'P2');
        gameEnv.currentPlayer = 'player1';

        const source = makeUnit('GD02-053_source_0001', [suppressionRule]);
        p1.zones.slot1.unit = source;

        const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(result.success).toBe(true);
        expect(KeywordUtils.hasKeyword(source, 'Suppression')).toBe(true);
    });

    test('GD03-034 includes suppression_2 rule and grants Suppression continuously to self', () => {
        const card = gd03.cards['GD03-034'];
        expect(card.effects.description).toHaveLength(2);
        expect(card.effects.rules).toHaveLength(2);
        const suppressionRule = findRule(card, 'suppression_2');
        expect(suppressionRule).toBeTruthy();
        expect(suppressionRule.action).toBe('grant_keyword');
        expect(suppressionRule.parameters?.keyword).toBe('Suppression');

        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('player1', 'P1');
        gameEnv.addPlayer('player2', 'P2');
        gameEnv.currentPlayer = 'player1';

        const source = makeUnit('GD03-034_source_0001', [suppressionRule]);
        p1.zones.slot1.unit = source;

        const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(result.success).toBe(true);
        expect(KeywordUtils.hasKeyword(source, 'Suppression')).toBe(true);
    });

    test('GD03-069 includes high_maneuver rule and grants High-Maneuver continuously to self', () => {
        const card = gd03.cards['GD03-069'];
        expect(card.effects.description).toHaveLength(2);
        expect(card.effects.rules).toHaveLength(2);
        const highManeuverRule = findRule(card, 'high_maneuver');
        expect(highManeuverRule).toBeTruthy();
        expect(highManeuverRule.action).toBe('grant_keyword');
        expect(highManeuverRule.parameters?.keyword).toBe('High-Maneuver');

        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('player1', 'P1');
        gameEnv.addPlayer('player2', 'P2');
        gameEnv.currentPlayer = 'player1';

        const source = makeUnit('GD03-069_source_0001', [highManeuverRule]);
        p1.zones.slot1.unit = source;

        const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(result.success).toBe(true);
        expect(KeywordUtils.hasKeyword(source, 'High-Maneuver')).toBe(true);
    });
});
