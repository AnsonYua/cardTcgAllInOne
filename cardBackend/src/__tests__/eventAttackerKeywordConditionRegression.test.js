const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { EventConditionEvaluator } = require('../services/conditions/EventConditionEvaluator');

describe('EventConditionEvaluator eventAttackerHasKeyword regression', () => {
    test('detects Repair granted by temporary effects on attacker', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUid = 'GD01-001_event_attacker_0001';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: attackerUid, playAs: 'unit' }).success).toBe(true);

        const slot = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
            .map((name) => gameEnv.players.playerId_1.zones[name])
            .find((candidate) => candidate?.unit?.carduid === attackerUid);
        expect(slot?.unit).toBeTruthy();

        slot.unit.temporaryEffects = [
            {
                sourceCarduid: 'temp_source_0001',
                grantedKeywords: ['Repair'],
                keywordValues: { Repair: 1 }
            }
        ];

        gameEnv.notificationQueue.push({
            id: 'unit_attack_declared_event_keyword_1',
            type: 'UNIT_ATTACK_DECLARED',
            payload: {
                attackerCarduid: attackerUid
            }
        });

        expect(EventConditionEvaluator.eventAttackerHasKeyword(gameEnv, { value: 'Repair' })).toBe(true);
        expect(EventConditionEvaluator.eventAttackerHasKeyword(gameEnv, { value: 'repair' })).toBe(true);
        expect(EventConditionEvaluator.eventAttackerHasKeyword(gameEnv, { value: 'Blocker' })).toBe(false);
    });

    test('still detects native Repair rule on attacker', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUid = 'GD03-002_event_attacker_0001'; // native Repair 3
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: attackerUid, playAs: 'unit' }).success).toBe(true);

        gameEnv.notificationQueue.push({
            id: 'unit_attack_declared_event_keyword_2',
            type: 'UNIT_ATTACK_DECLARED',
            payload: {
                attackerCarduid: attackerUid
            }
        });

        expect(EventConditionEvaluator.eventAttackerHasKeyword(gameEnv, { value: 'Repair' })).toBe(true);
    });
});
