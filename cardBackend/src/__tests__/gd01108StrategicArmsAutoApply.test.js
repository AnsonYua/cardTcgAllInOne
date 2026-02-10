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

function findUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    expect(player).toBeTruthy();
    const zones = player.zones || {};
    for (let i = 1; i <= 6; i++) {
        const slot = zones[`slot${i}`];
        if (slot && slot.unit && slot.unit.carduid === carduid) {
            return slot.unit;
        }
    }
    return null;
}

describe('GD01-108 Strategic Arms', () => {
    test('auto-applies damage to all Blocker units (no TARGET_CHOICE)', () => {
        const cards = loadGd01Cards();
        const effect = cards['GD01-108']?.effects?.rules?.find((r) => r.effectId === 'main_damage_all_blockers_2');
        expect(effect).toBeTruthy();
        expect(effect.target.scope).toBe('any_all_unit');
        expect(effect.target.filters.keywords).toEqual(['Blocker']);

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const p1Blocker = 'GD01-065_blocker_test_p1';
        const p1Normal = 'ST01-007_normal_test_p1';
        const p2Blocker = 'GD01-065_blocker_test_p2';
        const p2Normal = 'ST01-007_normal_test_p2';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: p1Blocker, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: p1Normal, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: p2Blocker, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: p2Normal, playAs: 'unit' }).success).toBe(true);

        const p1BlockerUnit = findUnit(gameEnv, 'playerId_1', p1Blocker);
        const p1NormalUnit = findUnit(gameEnv, 'playerId_1', p1Normal);
        const p2BlockerUnit = findUnit(gameEnv, 'playerId_2', p2Blocker);
        const p2NormalUnit = findUnit(gameEnv, 'playerId_2', p2Normal);

        expect(p1BlockerUnit).toBeTruthy();
        expect(p1NormalUnit).toBeTruthy();
        expect(p2BlockerUnit).toBeTruthy();
        expect(p2NormalUnit).toBeTruthy();

        expect(p1BlockerUnit.damageReceived || 0).toBe(0);
        expect(p1NormalUnit.damageReceived || 0).toBe(0);
        expect(p2BlockerUnit.damageReceived || 0).toBe(0);
        expect(p2NormalUnit.damageReceived || 0).toBe(0);

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD01-108_cmd_test_0001',
            effect
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeFalsy();

        expect(findUnit(gameEnv, 'playerId_1', p1Blocker).damageReceived).toBe(2);
        expect(findUnit(gameEnv, 'playerId_2', p2Blocker).damageReceived).toBe(2);
        expect(findUnit(gameEnv, 'playerId_1', p1Normal).damageReceived || 0).toBe(0);
        expect(findUnit(gameEnv, 'playerId_2', p2Normal).damageReceived || 0).toBe(0);
    });
});

