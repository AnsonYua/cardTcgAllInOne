const { GameEnvironment } = require('../models/GameEnvironment');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { KeywordUtils } = require('../utils/KeywordUtils');
const gd02 = require('../data/gd02Card.json');

function makeEnergy(playerId, index) {
    return {
        cardId: 'energy_basic',
        carduid: `gd02023_energy_${playerId}_${index}`,
        isExtraEnergy: false,
        isRested: false,
        placedAt: 0,
        placedBy: playerId
    };
}

function makeLinkedSlot(carduid, cardData) {
    return {
        unit: {
            carduid,
            cardId: cardData.id,
            cardData,
            isRested: false,
            continueModifyAP: 0,
            continueModifyHP: 0,
            temporaryEffects: []
        },
        pilot: {
            carduid: `${carduid}_pilot`,
            cardId: 'GD02-088',
            cardData: {
                id: 'GD02-088',
                name: 'Flit Asuno',
                cardType: 'pilot',
                traits: [],
                effects: { description: [], rules: [] }
            },
            isRested: false,
            continueModifyAP: 0,
            continueModifyHP: 0,
            temporaryEffects: []
        }
    };
}

describe('GD02-023 linked First Strike player level condition', () => {
    test('does not grant First Strike when linked but level is below 7', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const cardData = gd02.cards['GD02-023'];
        p1.zones.slot1 = makeLinkedSlot('GD02-023_unit_test_low_level', cardData);
        p1.zones.energyArea = Array.from({ length: 6 }, (_, index) => makeEnergy(p1.id, index));

        const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(result.success).toBe(true);
        expect(KeywordUtils.hasKeyword(p1.zones.slot1.unit, 'First Strike')).toBe(false);
    });

    test('grants First Strike when linked and level is 7 or higher', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const cardData = gd02.cards['GD02-023'];
        p1.zones.slot1 = makeLinkedSlot('GD02-023_unit_test_high_level', cardData);
        p1.zones.energyArea = Array.from({ length: 7 }, (_, index) => makeEnergy(p1.id, index));

        const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(result.success).toBe(true);
        expect(KeywordUtils.hasKeyword(p1.zones.slot1.unit, 'First Strike')).toBe(true);
    });
});
