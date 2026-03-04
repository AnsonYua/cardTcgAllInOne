const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { AttackPhaseEffectManager } = require('../services/effects/AttackPhaseEffectManager');

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

function seedCbTrash(gameEnv, playerId, count) {
    const player = gameEnv.getPlayer(playerId);
    expect(player).toBeTruthy();
    player.zones.trashArea = [];
    for (let i = 0; i < count; i++) {
        player.zones.trashArea.push({
            carduid: `ST07-008_trash_seed_${i + 1}`,
            cardId: 'ST07-008',
            cardData: {
                id: 'ST07-008',
                name: 'Gundam Kyrios (Flight Mode)',
                cardType: 'unit',
                traits: ['CB']
            }
        });
    }
}

describe('ST07-009 attack conditional all-CB buff', () => {
    test('with 7+ CB in trash, buff applies to all friendly CB units without TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUid = 'ST07-008_unit_test_0001';
        const pilotUid = 'ST07-009_pilot_test_0001';
        const allyCbUnitUid = 'ST07-001_cb_unit_test_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerUid,
            playAs: 'unit'
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: attackerUid
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: allyCbUnitUid,
            playAs: 'unit'
        }).success).toBe(true);

        seedCbTrash(gameEnv, 'playerId_1', 7);

        const attackEvent = {
            playerId: 'playerId_1',
            data: {
                playerId: 'playerId_1',
                actionType: 'attackShieldArea',
                attackerCarduid: attackerUid,
                fromBurst: false
            }
        };

        const result = AttackPhaseEffectManager.processAttackPhaseEffects(gameEnv, attackEvent);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeFalsy();

        const attacker = findUnit(gameEnv, 'playerId_1', attackerUid);
        const ally = findUnit(gameEnv, 'playerId_1', allyCbUnitUid);
        expect(attacker).toBeTruthy();
        expect(ally).toBeTruthy();

        expect(attacker.modifyAP || 0).toBe(1);
        expect(ally.modifyAP || 0).toBe(1);
    });
});
