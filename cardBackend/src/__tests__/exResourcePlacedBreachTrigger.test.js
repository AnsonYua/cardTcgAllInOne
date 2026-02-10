const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { applyAddExtraEnergyEffect } = require('../services/effects/actions/EffectEnergyActions');

describe('EX_RESOURCE_PLACED triggered effects', () => {
    test('GD02-022 schedules a TARGET_CHOICE when an EX resource is placed and multiple AGE System units exist', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        // Put GD02-022 in play (the trigger source).
        const placedGExes = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: 'GD02-022_unit_test_0001',
            playAs: 'unit'
        });
        expect(placedGExes.success).toBe(true);

        // Put 2 AGE System units in play to force player choice.
        const placedAge1 = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: 'GD02-023_age_unit_test_0001',
            playAs: 'unit'
        });
        expect(placedAge1.success).toBe(true);

        const placedAge2 = PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: 'GD02-023_age_unit_test_0002',
            playAs: 'unit'
        });
        expect(placedAge2.success).toBe(true);

        // Simulate an EX resource being placed (e.g. ST02-002 deploy effect).
        const addExtraEnergyResult = applyAddExtraEnergyEffect(
            gameEnv,
            'playerId_1',
            'ST02-002_test_source_0001',
            {
                effectId: 'deploy_place_ex_resource',
                type: 'triggered',
                trigger: 'ENTERS_PLAY',
                action: 'addExtraEnergy',
                parameters: { value: 1 }
            }
        );
        expect(addExtraEnergyResult.success).toBe(true);

        const processingResult = gameEnv.processEvents();
        expect(processingResult.success).toBe(true);
        expect(processingResult.needsPlayerInput).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeTruthy();
        expect(choiceEvent.data.effect.action).toBe('grant_breach');

        // Should offer the two AGE System units as eligible targets.
        const available = choiceEvent.data.availableTargets || [];
        const offeredUids = available.map((t) => t.carduid);
        expect(offeredUids).toEqual(
            expect.arrayContaining([
                'GD02-023_age_unit_test_0001',
                'GD02-023_age_unit_test_0002'
            ])
        );
    });
});

