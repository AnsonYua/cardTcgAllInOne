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

    test('GD01-025 pairing resource effect uses sequence addBasicEnergy + First Strike in data', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const unitUid = 'GD01-025_unit_test_0001';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unitUid, playAs: 'unit' }).success).toBe(true);

        const player = gameEnv.getPlayer('playerId_1');
        const slot1 = player.zones.slot1;
        expect(slot1.unit.carduid).toBe(unitUid);

        const rules = slot1.unit.cardData?.effects?.rules || [];
        const pairingEffect = rules.find((r) => r.effectId === 'pair_operation_meteor_place_resource_then_gain_first_strike');
        expect(pairingEffect).toBeTruthy();
        expect(pairingEffect.action).toBe('sequence');

        const steps = pairingEffect.parameters?.steps || [];
        expect(Array.isArray(steps)).toBe(true);
        expect(steps[0].action).toBe('addBasicEnergy');
        expect(steps[0].parameters?.rested).toBe(true);
        expect(steps[1].action).toBe('grant_keyword');
        expect(steps[1].parameters?.keyword).toBe('First Strike');
        expect(steps[1].timing?.duration).toBe('UNTIL_END_OF_TURN');
    });
});
