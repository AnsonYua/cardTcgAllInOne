const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { AttackPhaseEffectManager } = require('../services/effects/AttackPhaseEffectManager');

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

function findSlotByUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    expect(player).toBeTruthy();
    for (let i = 1; i <= 6; i++) {
        const slotName = `slot${i}`;
        const slot = player.zones[slotName];
        if (slot && slot.unit && slot.unit.carduid === carduid) {
            return slot;
        }
    }
    return null;
}

function createPilot(carduid, ap, hp = 1) {
    return {
        carduid,
        cardId: carduid.split('_')[0],
        cardData: { id: carduid.split('_')[0], name: carduid, cardType: 'pilot', ap, hp },
        originalAP: ap,
        originalHP: hp,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        isRested: false
    };
}

function createEnemyUnit(carduid) {
    return {
        carduid,
        cardId: carduid.split('_')[0],
        cardData: { id: carduid.split('_')[0], name: 'Enemy', cardType: 'unit', ap: 3, hp: 20 },
        originalAP: 3,
        originalHP: 20,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        isRested: false
    };
}

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
        sourceSlot.pilot = createPilot('TEST-PILOT_0001', 4, 2); // 5 + 4 = 9

        p2.zones.slot1.unit = createEnemyUnit('GD01-001_enemy_0001');
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
        sourceSlot.pilot = createPilot('TEST-PILOT_0002', 7, 2); // 5 + 7 = 12

        p2.zones.slot1.unit = createEnemyUnit('GD01-001_enemy_0002');
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

        p2.zones.slot1.unit = createEnemyUnit('GD01-001_enemy_0003');
        const enemy = findUnit(gameEnv, 'playerId_2', 'GD01-001_enemy_0003');
        expect(enemy).toBeTruthy();

        const result = runAttack(gameEnv, attackerCarduid);
        expect(result.success).toBe(true);
        expect(enemy.damageReceived).toBe(0);
    });
});
