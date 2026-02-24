const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { BattlePhaseManager } = require('../services/BattlePhaseManager');
const { GameNotificationManager } = require('../services/GameNotificationManager');

function createUnit(carduid, cardId, hp = 6, ap = 1) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            ap,
            hp,
            effects: { rules: [] }
        },
        originalAP: ap,
        originalHP: hp,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        effectUsage: {},
        isRested: false,
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true
    };
}

function setupBattle(attackerAp) {
    const gameEnv = new GameEnvironment();
    const attackerPlayerId = 'playerId_2';
    const defenderPlayerId = 'playerId_1';

    const defender = gameEnv.addPlayer(defenderPlayerId, 'P1');
    const attacker = gameEnv.addPlayer(attackerPlayerId, 'P2');
    defender.isReady = true;
    attacker.isReady = true;
    gameEnv.gameStarted = true;
    gameEnv.currentPlayer = attackerPlayerId;
    gameEnv.currentTurn = 4;

    const attackerUnit = createUnit('GD03-071_defender_0001', 'GD03-071', 5, attackerAp);
    const defenderUnit = createUnit('GD03-010_attacker_0001', 'GD03-010', 6, 6);
    defenderUnit.isRested = true;
    defender.zones.slot1.unit = defenderUnit;
    attacker.zones.slot1.unit = attackerUnit;

    const notificationManager = new GameNotificationManager(gameEnv);
    const attackNotificationId = notificationManager.addNotificationEvent('UNIT_ATTACK_DECLARED', {
        attackingPlayerId: attackerPlayerId,
        defendingPlayerId: defenderPlayerId,
        attackerCarduid: attackerUnit.carduid,
        attackerSlot: 'slot1',
        targetCarduid: defenderUnit.carduid,
        targetSlotName: 'slot1'
    });

    gameEnv.setCurrentBattle({
        actionType: 'attackUnit',
        attackingPlayerId: attackerPlayerId,
        defendingPlayerId: defenderPlayerId,
        attackerCarduid: attackerUnit.carduid,
        targetCarduid: defenderUnit.carduid,
        targetPlayerId: defenderPlayerId,
        status: 'ACTION_STEP',
        openedAt: Date.now(),
        attackNotificationId
    });

    return { gameEnv, attackerPlayerId, defenderPlayerId, attackerUnit, defenderUnit };
}

function targetRef(carduid, zone, playerId) {
    return { carduid, zone, playerId };
}

function latestEvent(gameEnv, type) {
    const list = (gameEnv.notificationQueue || []).filter((event) => event && event.type === type);
    return list[list.length - 1] || null;
}

describe('GD03-115 battle-damage prevention enemyAp compatibility', () => {
    test('enemyAp comparator prevents battle damage when attacker AP matches threshold', () => {
        const { gameEnv, attackerPlayerId, defenderPlayerId, defenderUnit } = setupBattle(5);

        const preventionResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'gd03_115_prevent',
                action: 'prevent_battle_damage',
                timing: { duration: 'UNTIL_END_OF_BATTLE' },
                parameters: { from: 'enemy_units', enemyAp: '<=5' }
            },
            [targetRef(defenderUnit.carduid, 'slot1', defenderPlayerId)],
            defenderPlayerId,
            'GD03-115_hand_0001'
        );
        expect(preventionResult.success).toBe(true);

        const preventionGranted = latestEvent(gameEnv, 'BATTLE_DAMAGE_PREVENTION_GRANTED');
        expect(preventionGranted).toBeTruthy();
        expect(preventionGranted.payload.enemyAp).toBe('<=5');

        expect(gameEnv.confirmBattleResolution(attackerPlayerId).success).toBe(true);
        expect(gameEnv.confirmBattleResolution(defenderPlayerId).success).toBe(true);
        const resolveResult = BattlePhaseManager.resolveBattle(gameEnv, attackerPlayerId);
        expect(resolveResult.success).toBe(true);

        const battleResolved = latestEvent(gameEnv, 'BATTLE_RESOLVED');
        expect(battleResolved).toBeTruthy();
        expect(battleResolved.payload.result.defenderDamagePrevented).toBe(true);
        expect(battleResolved.payload.result.defenderDamageTaken).toBe(0);
        expect(gameEnv.players[defenderPlayerId].zones.slot1.unit.damageReceived).toBe(0);
    });

    test('maxEnemyAp compatibility keeps <= threshold prevention and > threshold damage', () => {
        const prevented = setupBattle(2);
        const preventResult = EffectExecutor.applyEffectToTargets(
            prevented.gameEnv,
            {
                effectId: 'legacy_max_enemy_ap',
                action: 'prevent_battle_damage',
                timing: { duration: 'UNTIL_END_OF_BATTLE' },
                parameters: { from: 'enemy_units', maxEnemyAp: 2 }
            },
            [targetRef(prevented.defenderUnit.carduid, 'slot1', prevented.defenderPlayerId)],
            prevented.defenderPlayerId,
            'ST03-014_hand_0001'
        );
        expect(preventResult.success).toBe(true);
        expect(prevented.gameEnv.confirmBattleResolution(prevented.attackerPlayerId).success).toBe(true);
        expect(prevented.gameEnv.confirmBattleResolution(prevented.defenderPlayerId).success).toBe(true);
        const preventedResolve = BattlePhaseManager.resolveBattle(prevented.gameEnv, prevented.attackerPlayerId);
        expect(preventedResolve.success).toBe(true);
        const preventedBattle = latestEvent(prevented.gameEnv, 'BATTLE_RESOLVED');
        expect(preventedBattle).toBeTruthy();
        expect(preventedBattle.payload.result.defenderDamagePrevented).toBe(true);
        expect(preventedBattle.payload.result.defenderDamageTaken).toBe(0);

        const notPrevented = setupBattle(3);
        const noPreventResult = EffectExecutor.applyEffectToTargets(
            notPrevented.gameEnv,
            {
                effectId: 'legacy_max_enemy_ap',
                action: 'prevent_battle_damage',
                timing: { duration: 'UNTIL_END_OF_BATTLE' },
                parameters: { from: 'enemy_units', maxEnemyAp: 2 }
            },
            [targetRef(notPrevented.defenderUnit.carduid, 'slot1', notPrevented.defenderPlayerId)],
            notPrevented.defenderPlayerId,
            'ST03-014_hand_0001'
        );
        expect(noPreventResult.success).toBe(true);
        expect(notPrevented.gameEnv.confirmBattleResolution(notPrevented.attackerPlayerId).success).toBe(true);
        expect(notPrevented.gameEnv.confirmBattleResolution(notPrevented.defenderPlayerId).success).toBe(true);
        const notPreventedResolve = BattlePhaseManager.resolveBattle(notPrevented.gameEnv, notPrevented.attackerPlayerId);
        expect(notPreventedResolve.success).toBe(true);
        const nonPreventedBattle = latestEvent(notPrevented.gameEnv, 'BATTLE_RESOLVED');
        expect(nonPreventedBattle).toBeTruthy();
        expect(nonPreventedBattle.payload.result.defenderDamagePrevented).toBe(false);
        expect(nonPreventedBattle.payload.result.defenderDamageTaken).toBe(3);
    });

    test('notification payload keeps compatibility fields for maxEnemyAp input', () => {
        const { gameEnv, defenderPlayerId, defenderUnit } = setupBattle(2);

        const preventionResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'legacy_max_enemy_ap_notify',
                action: 'prevent_battle_damage',
                timing: { duration: 'UNTIL_END_OF_BATTLE' },
                parameters: { from: 'enemy_units', maxEnemyAp: 2 }
            },
            [targetRef(defenderUnit.carduid, 'slot1', defenderPlayerId)],
            defenderPlayerId,
            'ST03-014_hand_0001'
        );
        expect(preventionResult.success).toBe(true);

        const preventionGranted = latestEvent(gameEnv, 'BATTLE_DAMAGE_PREVENTION_GRANTED');
        expect(preventionGranted).toBeTruthy();
        expect(preventionGranted.payload.maxEnemyAp).toBe(2);
        expect(preventionGranted.payload.enemyAp).toBe('<=2');
    });
});
