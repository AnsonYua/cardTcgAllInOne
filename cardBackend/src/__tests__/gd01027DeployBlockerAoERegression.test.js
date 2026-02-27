const fs = require('fs');
const path = require('path');

const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');

function loadGd01Cards() {
    const filePath = path.join(__dirname, '..', 'data', 'gd01Card.json');
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return json.cards;
}

function seedZeonTrash(gameEnv, playerId, count) {
    const zeonUnitIds = [
        'GD01-023', 'GD01-026', 'GD01-030', 'GD01-031', 'GD01-032',
        'GD01-035', 'GD01-036', 'GD01-037', 'GD01-038', 'GD01-039'
    ];
    const player = gameEnv.getPlayer(playerId);
    expect(player).toBeTruthy();
    player.zones.trashArea = zeonUnitIds.slice(0, count).map((cardId, index) => ({
        carduid: `${cardId}_trash_seed_${index + 1}`,
        cardId
    }));
}

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

describe('GD01-027 deploy blocker AoE regression', () => {
    test('auto-applies to all active blockers with no TARGET_CHOICE', () => {
        const cards = loadGd01Cards();
        const deployEffect = cards['GD01-027']?.effects?.rules?.find((rule) => rule?.effectId === 'deploy_damage_all_4');
        expect(deployEffect).toBeTruthy();

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        seedZeonTrash(gameEnv, 'playerId_1', 10);

        const p1ConditionalBlocker = 'GD01-019_p1_conditional_blocker_0001';
        const p1Normal = 'ST01-007_p1_normal_0001';
        const p2PermanentBlocker = 'ST01-008_p2_permanent_blocker_0001';
        const p2Filler1 = 'GD01-001_p2_filler_0001';
        const p2Filler2 = 'GD01-002_p2_filler_0001';
        const p2Filler3 = 'GD01-003_p2_filler_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: p1ConditionalBlocker, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: p1Normal, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: p2PermanentBlocker, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: p2Filler1, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: p2Filler2, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: p2Filler3, playAs: 'unit' }).success).toBe(true);

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD01-027_source_test_0001',
            deployEffect
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(gameEnv.processingQueue.some((event) => event.type === EventType.TARGET_CHOICE)).toBe(false);

        // Both blockers should be hit for 4 and destroyed at their printed HP.
        expect(findUnit(gameEnv, 'playerId_1', p1ConditionalBlocker)).toBeNull();
        expect(findUnit(gameEnv, 'playerId_2', p2PermanentBlocker)).toBeNull();
        expect(findUnit(gameEnv, 'playerId_1', p1Normal)).toBeTruthy();
    });

    test('does not run blocker damage when trash condition is not met', () => {
        const cards = loadGd01Cards();
        const deployEffect = cards['GD01-027']?.effects?.rules?.find((rule) => rule?.effectId === 'deploy_damage_all_4');
        expect(deployEffect).toBeTruthy();

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        seedZeonTrash(gameEnv, 'playerId_1', 9);

        const p1ConditionalBlocker = 'GD01-019_p1_conditional_blocker_0002';
        const p2PermanentBlocker = 'ST01-008_p2_permanent_blocker_0002';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: p1ConditionalBlocker, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: p2PermanentBlocker, playAs: 'unit' }).success).toBe(true);

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD01-027_source_test_0002',
            deployEffect
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(gameEnv.processingQueue.some((event) => event.type === EventType.TARGET_CHOICE)).toBe(false);

        expect(findUnit(gameEnv, 'playerId_1', p1ConditionalBlocker)?.damageReceived || 0).toBe(0);
        expect(findUnit(gameEnv, 'playerId_2', p2PermanentBlocker)?.damageReceived || 0).toBe(0);
    });

    test('conditional Blocker is excluded when its condition is not currently active', () => {
        const cards = loadGd01Cards();
        const deployEffect = cards['GD01-027']?.effects?.rules?.find((rule) => rule?.effectId === 'deploy_damage_all_4');
        expect(deployEffect).toBeTruthy();

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        seedZeonTrash(gameEnv, 'playerId_1', 10);

        const p1ConditionalBlocker = 'GD01-019_p1_conditional_blocker_0003';
        const p2PermanentBlocker = 'ST01-008_p2_permanent_blocker_0003';
        const p2Filler1 = 'GD01-001_p2_filler_0002';
        const p2Filler2 = 'GD01-002_p2_filler_0002';

        // P2 has only 3 units total => GD01-019 blocker condition (opponent units >= 4) is false.
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: p1ConditionalBlocker, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: p2PermanentBlocker, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: p2Filler1, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: p2Filler2, playAs: 'unit' }).success).toBe(true);

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD01-027_source_test_0003',
            deployEffect
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(gameEnv.processingQueue.some((event) => event.type === EventType.TARGET_CHOICE)).toBe(false);

        expect(findUnit(gameEnv, 'playerId_1', p1ConditionalBlocker)?.damageReceived || 0).toBe(0);
        expect(findUnit(gameEnv, 'playerId_2', p2PermanentBlocker)).toBeNull();
    });
});
