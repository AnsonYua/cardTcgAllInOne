const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { KeywordUtils } = require('../utils/KeywordUtils');
const { BlockerEffectManager } = require('../services/effects/BlockerEffectManager');

function findUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    expect(player).toBeTruthy();
    for (let i = 1; i <= 6; i++) {
        const slot = player.zones[`slot${i}`];
        if (slot && slot.unit && slot.unit.carduid === carduid) {
            return slot.unit;
        }
    }
    return null;
}

describe('GD01 pilot always-on keyword completion', () => {
    test('GD01-087 grants Repair 1 only when paired unit is Blue', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const blueUnitUid = 'GD03-004_blue_unit_0001';
        const whiteUnitUid = 'GD02-072_white_unit_0001';
        const pilotBlueUid = 'GD01-087_pilot_0001';
        const pilotWhiteUid = 'GD01-087_pilot_0002';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: blueUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: whiteUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: pilotBlueUid, playAs: 'pilot', targetUnit: blueUnitUid }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: pilotWhiteUid, playAs: 'pilot', targetUnit: whiteUnitUid }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const blueUnit = findUnit(gameEnv, 'playerId_1', blueUnitUid);
        const whiteUnit = findUnit(gameEnv, 'playerId_1', whiteUnitUid);
        expect(KeywordUtils.hasKeyword(blueUnit, 'Repair')).toBe(true);
        expect(KeywordUtils.getKeywordValue(blueUnit, 'Repair')).toBe(1);
        expect(KeywordUtils.hasKeyword(whiteUnit, 'Repair')).toBe(false);
    });

    test('GD01-092 grants Breach 1 only when paired unit has Zeon trait', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const zeonUnitUid = 'GD01-027_zeon_unit_0001';
        const nonZeonUnitUid = 'GD03-004_non_zeon_unit_0001';
        const pilotZeonUid = 'GD01-092_pilot_0001';
        const pilotNonZeonUid = 'GD01-092_pilot_0002';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: zeonUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: nonZeonUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: pilotZeonUid, playAs: 'pilot', targetUnit: zeonUnitUid }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: pilotNonZeonUid, playAs: 'pilot', targetUnit: nonZeonUnitUid }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const zeonUnit = findUnit(gameEnv, 'playerId_1', zeonUnitUid);
        const nonZeonUnit = findUnit(gameEnv, 'playerId_1', nonZeonUnitUid);
        const zeonHasBreach = Array.isArray(zeonUnit.temporaryEffects)
            && zeonUnit.temporaryEffects.some((effect) => effect?.breachValue === 1);
        const nonZeonHasBreach = Array.isArray(nonZeonUnit.temporaryEffects)
            && nonZeonUnit.temporaryEffects.some((effect) => effect?.breachValue === 1);
        expect(zeonHasBreach).toBe(true);
        expect(nonZeonHasBreach).toBe(false);
    });

    test('GD01-096 grants Blocker only when paired unit is White', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const whiteUnitUid = 'GD02-072_white_unit_0002';
        const blueUnitUid = 'GD03-004_blue_unit_0002';
        const pilotWhiteUid = 'GD01-096_pilot_0001';
        const pilotBlueUid = 'GD01-096_pilot_0002';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: whiteUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: blueUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: pilotWhiteUid, playAs: 'pilot', targetUnit: whiteUnitUid }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: pilotBlueUid, playAs: 'pilot', targetUnit: blueUnitUid }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const blockerTargets = BlockerEffectManager.getAvailableBlockerTargets(gameEnv, 'playerId_1');
        const blockerUids = blockerTargets.map((target) => target.carduid);
        expect(blockerUids).toContain(whiteUnitUid);
        expect(blockerUids).not.toContain(blueUnitUid);
    });
});
