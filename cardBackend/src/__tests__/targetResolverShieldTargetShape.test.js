const { GameEnvironment } = require('../models/GameEnvironment');
const { TargetResolver } = require('../services/targets/TargetResolver');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

describe('TargetResolver shield target shape', () => {
    test('self_shield targets expose flattened cardData contract', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.shieldArea.push(
            createUnitZoneCard({
                carduid: 'GD03-044_shield_p1_0001',
                cardId: 'GD03-044',
                name: 'Daughtress Flyer',
                ap: 2,
                hp: 3,
                traits: ['New UNE']
            })
        );

        const targets = TargetResolver.generateAvailableTargets(gameEnv, 'playerId_1', {
            type: 'card',
            scope: 'self_shield',
            count: 1,
            filters: {}
        });

        expect(targets).toHaveLength(1);
        expect(targets[0].carduid).toBe('GD03-044_shield_p1_0001');
        expect(targets[0].zone).toBe('shield');
        expect(targets[0].playerId).toBe('playerId_1');
        expect(targets[0].cardData).toBeTruthy();
        expect(targets[0].cardData.id).toBe('GD03-044');
        expect(targets[0].cardData.cardType).toBe('unit');
        expect(targets[0].cardData.cardData).toBeUndefined();
    });

    test('non-shield unit target flow remains unchanged', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.unit = createUnitZoneCard({
            carduid: 'GD03-047_enemy_valid_0001',
            cardId: 'GD03-047',
            name: 'DINN (Commander Type)',
            ap: 3,
            hp: 4,
            traits: ['ZAFT'],
            cardDataExtras: { level: 4 }
        });

        const targets = TargetResolver.generateAvailableTargets(gameEnv, 'playerId_1', {
            type: 'unit',
            scope: 'opponent',
            count: 1,
            filters: {}
        });

        const target = targets.find((entry) => entry.carduid === 'GD03-047_enemy_valid_0001');
        expect(target).toBeTruthy();
        expect(target.zone).toBe('slot1');
        expect(target.playerId).toBe('playerId_2');
        expect(target.cardData.id).toBe('GD03-047');
    });
});
