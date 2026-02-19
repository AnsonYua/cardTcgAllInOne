const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { BattlePhaseManager } = require('../services/BattlePhaseManager');
const { GameNotificationManager } = require('../services/GameNotificationManager');

function createUnit(carduid, cardId, hp = 1, ap = 1) {
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

function setupBattle() {
    const gameEnv = new GameEnvironment();
    const attackerPlayerId = 'playerId_1';
    const defenderPlayerId = 'playerId_2';
    const attacker = gameEnv.addPlayer(attackerPlayerId, 'P1');
    const defender = gameEnv.addPlayer(defenderPlayerId, 'P2');
    attacker.isReady = true;
    defender.isReady = true;
    gameEnv.gameStarted = true;
    gameEnv.currentPlayer = attackerPlayerId;
    gameEnv.currentTurn = 1;

    const attackerUnit = createUnit('ATK_uid_0001', 'ATK-001', 2, 2);
    const defenderUnit = createUnit('DEF_uid_0001', 'DEF-001', 1, 1);
    attacker.zones.slot1.unit = attackerUnit;
    defender.zones.slot1.unit = defenderUnit;
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

function latestBattleResolved(gameEnv) {
    const list = (gameEnv.notificationQueue || []).filter((event) => event && event.type === 'BATTLE_RESOLVED');
    return list[list.length - 1] || null;
}

describe('ACTION_STEP battle consistency hardening', () => {
    test('target dies from damage effect during ACTION_STEP and battle auto-aborts', () => {
        const { gameEnv, attackerPlayerId, defenderPlayerId, defenderUnit } = setupBattle();

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_damage_target', action: 'damage', parameters: { value: 1 } },
            [targetRef(defenderUnit.carduid, 'slot1', defenderPlayerId)],
            attackerPlayerId,
            undefined
        );
        expect(result.success).toBe(true);
        expect(gameEnv.currentBattle).toBeUndefined();

        const resolution = latestBattleResolved(gameEnv);
        expect(resolution).toBeTruthy();
        expect(resolution.payload.result.aborted).toBe(true);
        expect(resolution.payload.result.battleEndedEarly).toBe(true);
        expect(resolution.payload.result.abortReason).toBe('TARGET_NOT_ON_BOARD');
        expect(resolution.payload.result.targetMissing).toBe(true);
        expect(resolution.payload.battleType).toBe('attackUnit');
        expect(resolution.payload.target?.zoneType).toBe('slot');
        expect(resolution.payload.target?.slot).toBe('slot1');

        const resolveAfterEnd = BattlePhaseManager.resolveBattle(gameEnv, attackerPlayerId);
        expect(resolveAfterEnd.success).toBe(true);
    });

    test('attacker dies from damage effect during ACTION_STEP and battle auto-aborts', () => {
        const { gameEnv, attackerPlayerId, attackerUnit } = setupBattle();

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_damage_attacker', action: 'damage', parameters: { value: 2 } },
            [targetRef(attackerUnit.carduid, 'slot1', attackerPlayerId)],
            'playerId_2',
            undefined
        );
        expect(result.success).toBe(true);
        expect(gameEnv.currentBattle).toBeUndefined();

        const resolution = latestBattleResolved(gameEnv);
        expect(resolution).toBeTruthy();
        expect(resolution.payload.result.aborted).toBe(true);
        expect(resolution.payload.result.abortReason).toBe('ATTACKER_NOT_ON_BOARD');
        expect(resolution.payload.result.attackerMissing).toBe(true);
    });

    test('target removed by destroy effect during ACTION_STEP auto-aborts battle', () => {
        const { gameEnv, attackerPlayerId, defenderPlayerId, defenderUnit } = setupBattle();

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_destroy_target', action: 'destroy', parameters: {} },
            [targetRef(defenderUnit.carduid, 'slot1', defenderPlayerId)],
            attackerPlayerId,
            undefined
        );
        expect(result.success).toBe(true);
        expect(gameEnv.currentBattle).toBeUndefined();

        const resolution = latestBattleResolved(gameEnv);
        expect(resolution).toBeTruthy();
        expect(resolution.payload.result.aborted).toBe(true);
        expect(resolution.payload.result.abortReason).toBe('TARGET_NOT_ON_BOARD');
    });

    test('attacker removed by destroy effect during ACTION_STEP auto-aborts battle', () => {
        const { gameEnv, attackerPlayerId, attackerUnit } = setupBattle();

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_destroy_attacker', action: 'destroy', parameters: {} },
            [targetRef(attackerUnit.carduid, 'slot1', attackerPlayerId)],
            'playerId_2',
            undefined
        );
        expect(result.success).toBe(true);
        expect(gameEnv.currentBattle).toBeUndefined();

        const resolution = latestBattleResolved(gameEnv);
        expect(resolution).toBeTruthy();
        expect(resolution.payload.result.aborted).toBe(true);
        expect(resolution.payload.result.abortReason).toBe('ATTACKER_NOT_ON_BOARD');
    });

    test('target removed by returnToHand effect during ACTION_STEP auto-aborts battle', () => {
        const { gameEnv, attackerPlayerId, defenderPlayerId, defenderUnit } = setupBattle();

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_return_target', action: 'returnToHand', parameters: {} },
            [targetRef(defenderUnit.carduid, 'slot1', defenderPlayerId)],
            attackerPlayerId,
            undefined
        );
        expect(result.success).toBe(true);
        expect(gameEnv.currentBattle).toBeUndefined();

        const resolution = latestBattleResolved(gameEnv);
        expect(resolution).toBeTruthy();
        expect(resolution.payload.result.aborted).toBe(true);
        expect(resolution.payload.result.abortReason).toBe('TARGET_NOT_ON_BOARD');
    });

    test('attacker removed by returnToHand effect during ACTION_STEP auto-aborts battle', () => {
        const { gameEnv, attackerPlayerId, attackerUnit } = setupBattle();

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_return_attacker', action: 'returnToHand', parameters: {} },
            [targetRef(attackerUnit.carduid, 'slot1', attackerPlayerId)],
            'playerId_2',
            undefined
        );
        expect(result.success).toBe(true);
        expect(gameEnv.currentBattle).toBeUndefined();

        const resolution = latestBattleResolved(gameEnv);
        expect(resolution).toBeTruthy();
        expect(resolution.payload.result.aborted).toBe(true);
        expect(resolution.payload.result.abortReason).toBe('ATTACKER_NOT_ON_BOARD');
    });

    test('multi-target damage still processes remaining targets after battle auto-aborts', () => {
        const { gameEnv, attackerPlayerId, defenderPlayerId, defenderUnit } = setupBattle();
        const extraTarget = createUnit('DEF_uid_0002', 'DEF-002', 2, 1);
        const defender = gameEnv.getPlayer(defenderPlayerId);
        defender.zones.slot2.unit = extraTarget;

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_damage_multi', action: 'damage', parameters: { value: 1 } },
            [
                targetRef(defenderUnit.carduid, 'slot1', defenderPlayerId),
                targetRef(extraTarget.carduid, 'slot2', defenderPlayerId)
            ],
            attackerPlayerId,
            undefined
        );
        expect(result.success).toBe(true);
        expect(gameEnv.currentBattle).toBeUndefined();

        expect(defender.zones.slot2.unit).toBeTruthy();
        expect(defender.zones.slot2.unit.damageReceived).toBe(1);
    });
});
