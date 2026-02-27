const { GameEnvironment } = require('../models/GameEnvironment');
const { GameLogic } = require('../services/GameLogic');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { EnergyManager } = require('../services/EnergyManager');

describe('GD01-002 playCardWithAction cost replacement forwarding', () => {
    test('forwards useCostReplacement/costReplacementTargetCarduid so explicit replacement is applied with sufficient energy', async () => {
        const logic = new GameLogic();
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const unicornModeKeepUid = 'GD01-005_unit_gl_keep_0001';
        const banagherKeepUid = 'GD01-088_pilot_gl_keep_0001';
        const unicornModeDestroyUid = 'GD01-005_unit_gl_destroy_0001';
        const banagherDestroyUid = 'GD01-088_pilot_gl_destroy_0001';
        const destroyModeUid = 'GD01-002_unit_gl_0001';
        p1.deck._handUids = [destroyModeUid];
        p1.deck.handUids = [destroyModeUid];

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unicornModeKeepUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: banagherKeepUid,
                playAs: 'pilot',
                targetUnit: unicornModeKeepUid
            }).success
        ).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unicornModeDestroyUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: banagherDestroyUid,
                playAs: 'pilot',
                targetUnit: unicornModeDestroyUid
            }).success
        ).toBe(true);

        for (let i = 0; i < 7; i += 1) {
            expect(EnergyManager.addBasicEnergy(gameEnv, 'playerId_1')).toBe(true);
        }

        jest.spyOn(logic, 'loadGameFromFile').mockResolvedValue(gameEnv);
        jest.spyOn(logic, 'saveGameToFile').mockResolvedValue();

        const result = await logic.playCardWithAction('game_1', 'playerId_1', {
            type: 'PlayCard',
            carduid: destroyModeUid,
            playAs: 'unit',
            useCostReplacement: true,
            costReplacementTargetCarduid: unicornModeDestroyUid
        });

        expect(result.success).toBe(true);
        expect(p1.deck.handUids).not.toContain(destroyModeUid);

        const trashedUids = p1.zones.trashArea.map((card) => card.carduid);
        expect(trashedUids).toContain(unicornModeDestroyUid);
        expect(trashedUids).toContain(banagherDestroyUid);
        expect(trashedUids).not.toContain(unicornModeKeepUid);
        expect(trashedUids).not.toContain(banagherKeepUid);

        const restedEnergyCount = (p1.zones.energyArea || []).filter((card) => card.isRested).length;
        expect(restedEnergyCount).toBe(0);
    });
});
