const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { PlayerCardManager } = require('../services/PlayerCardManager');

describe('addBasicEnergy effect', () => {
    test('adds rested basic energy (not EX resource)', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');

        const before = Array.isArray(player.zones.energyArea) ? player.zones.energyArea.length : 0;

        const effect = {
            effectId: 'test_add_basic_energy_rested',
            type: 'internal',
            trigger: 'CUSTOM',
            action: 'addBasicEnergy',
            parameters: {
                value: 1,
                rested: true
            }
        };

        const result = EffectExecutor.applyEffectToTargets(gameEnv, effect, [], 'playerId_1', 'source_carduid_1');
        expect(result.success).toBe(true);

        const after = Array.isArray(player.zones.energyArea) ? player.zones.energyArea.length : 0;
        expect(after).toBe(before + 1);

        const addedCard = player.zones.energyArea[player.zones.energyArea.length - 1];
        expect(addedCard.cardId).toBe('energy_basic');
        expect(addedCard.isExtraEnergy).toBe(false);
        expect(addedCard.isRested).toBe(true);
    });

    test('GD01-025 pairing resource effect uses addBasicEnergy in data', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const unitUid = 'GD01-025_unit_test_0001';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unitUid, playAs: 'unit' }).success).toBe(true);

        const player = gameEnv.getPlayer('playerId_1');
        const slot1 = player.zones.slot1;
        expect(slot1.unit.carduid).toBe(unitUid);

        const rules = slot1.unit.cardData?.effects?.rules || [];
        const resourceEffect = rules.find((r) => r.effectId === 'pair_place_rested_resource');
        expect(resourceEffect).toBeTruthy();
        expect(resourceEffect.action).toBe('addBasicEnergy');
        expect(resourceEffect.parameters.rested).toBe(true);
    });
});

