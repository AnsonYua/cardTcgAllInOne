const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');

const gd03Data = require('../data/gd03Card.json');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

function getGd03107PlayEffect() {
    const card = gd03Data.cards['GD03-107'];
    expect(card).toBeTruthy();
    const effect = (card.effects.rules || []).find(rule => rule.effectId === 'play_effect');
    expect(effect).toBeTruthy();
    return effect;
}

describe('GD03-107 damage scaling', () => {
    test('0 friendly token units in play deals 0 damage', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_unit_0001',
            cardId: 'enemy_unit',
            ap: 3,
            hp: 10,
            cardDataExtras: { level: 5, color: 'Blue', traits: [] }
        });

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD03-107_source_0001',
            getGd03107PlayEffect()
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit.damageReceived).toBe(0);
    });

    test('2 friendly token units in play deals 2 damage', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'token_unit_0001',
            cardId: 'token_unit',
            ap: 3,
            hp: 1,
            cardDataExtras: { level: 1, color: 'Token', traits: [] }
        });
        p1.zones.slot2.unit = createUnitZoneCard({
            carduid: 'token_unit_0002',
            cardId: 'token_unit',
            ap: 3,
            hp: 1,
            cardDataExtras: { level: 1, color: 'Token', traits: [] }
        });
        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_unit_0002',
            cardId: 'enemy_unit',
            ap: 3,
            hp: 10,
            cardDataExtras: { level: 5, color: 'Blue', traits: [] }
        });

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD03-107_source_0002',
            getGd03107PlayEffect()
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit.damageReceived).toBe(2);
    });

    test('non-token friendly units are not counted', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.slot1.unit = createUnitZoneCard({
            carduid: 'token_unit_0003',
            cardId: 'token_unit',
            ap: 3,
            hp: 1,
            cardDataExtras: { level: 1, color: 'Token', traits: [] }
        });
        p1.zones.slot2.unit = createUnitZoneCard({
            carduid: 'normal_unit_0001',
            cardId: 'normal_unit',
            ap: 3,
            hp: 4,
            cardDataExtras: { level: 4, color: 'Red', traits: [] }
        });
        p1.zones.slot3.unit = createUnitZoneCard({
            carduid: 'normal_unit_0002',
            cardId: 'normal_unit',
            ap: 3,
            hp: 4,
            cardDataExtras: { level: 4, color: 'Blue', traits: [] }
        });
        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_unit_0003',
            cardId: 'enemy_unit',
            ap: 3,
            hp: 10,
            cardDataExtras: { level: 5, color: 'Blue', traits: [] }
        });

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD03-107_source_0003',
            getGd03107PlayEffect()
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit.damageReceived).toBe(1);
    });
});
