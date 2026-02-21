const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { AttackPhaseEffectManager } = require('../services/effects/AttackPhaseEffectManager');
const { createPilotZoneCard, createUnitZoneCard, findUnit, findSlotByUnit } = require('./helpers/zoneCardFactory');

function runAttack(gameEnv, attackerCarduid) {
    return AttackPhaseEffectManager.processAttackPhaseEffects(gameEnv, {
        playerId: 'playerId_1',
        data: {
            playerId: 'playerId_1',
            actionType: 'attackUnit',
            attackerCarduid,
            fromBurst: false
        }
    });
}

describe('GD03-033 attack scaling', () => {
    test('total AP 9 deals 2 damage', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        const attackerCarduid = 'GD03-033_attacker_0001';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerCarduid,
            playAs: 'unit'
        }).success).toBe(true);

        const sourceSlot = findSlotByUnit(gameEnv, 'playerId_1', attackerCarduid);
        expect(sourceSlot).toBeTruthy();
        sourceSlot.pilot = createPilotZoneCard({ carduid: 'TEST-PILOT_0001', cardId: 'TEST-PILOT', ap: 4, hp: 2 }); // 5 + 4 = 9

        p2.zones.slot1.unit = createUnitZoneCard({ carduid: 'GD01-001_enemy_0001', cardId: 'GD01-001', name: 'Enemy', ap: 3, hp: 20 });
        const enemy = findUnit(gameEnv, 'playerId_2', 'GD01-001_enemy_0001');
        expect(enemy).toBeTruthy();

        const result = runAttack(gameEnv, attackerCarduid);
        expect(result.success).toBe(true);
        expect(enemy.damageReceived).toBe(2);
    });

    test('total AP 12 deals 3 damage', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        const attackerCarduid = 'GD03-033_attacker_0002';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerCarduid,
            playAs: 'unit'
        }).success).toBe(true);

        const sourceSlot = findSlotByUnit(gameEnv, 'playerId_1', attackerCarduid);
        expect(sourceSlot).toBeTruthy();
        sourceSlot.pilot = createPilotZoneCard({ carduid: 'TEST-PILOT_0002', cardId: 'TEST-PILOT', ap: 7, hp: 2 }); // 5 + 7 = 12

        p2.zones.slot1.unit = createUnitZoneCard({ carduid: 'GD01-001_enemy_0002', cardId: 'GD01-001', name: 'Enemy', ap: 3, hp: 20 });
        const enemy = findUnit(gameEnv, 'playerId_2', 'GD01-001_enemy_0002');
        expect(enemy).toBeTruthy();

        const result = runAttack(gameEnv, attackerCarduid);
        expect(result.success).toBe(true);
        expect(enemy.damageReceived).toBe(3);
    });

    test('total AP 3 deals 0 damage', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        const attackerCarduid = 'GD03-033_attacker_0003';
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: attackerCarduid,
            playAs: 'unit'
        }).success).toBe(true);

        const attacker = findUnit(gameEnv, 'playerId_1', attackerCarduid);
        expect(attacker).toBeTruthy();
        attacker.continueModifyAP = -2; // 5 + (-2) = 3

        p2.zones.slot1.unit = createUnitZoneCard({ carduid: 'GD01-001_enemy_0003', cardId: 'GD01-001', name: 'Enemy', ap: 3, hp: 20 });
        const enemy = findUnit(gameEnv, 'playerId_2', 'GD01-001_enemy_0003');
        expect(enemy).toBeTruthy();

        const result = runAttack(gameEnv, attackerCarduid);
        expect(result.success).toBe(true);
        expect(enemy.damageReceived).toBe(0);
    });
});
