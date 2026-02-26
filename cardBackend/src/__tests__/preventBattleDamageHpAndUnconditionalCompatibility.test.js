const { GameEnvironment } = require('../models/GameEnvironment');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { BattlePhaseManager } = require('../services/BattlePhaseManager');
const { GameNotificationManager } = require('../services/GameNotificationManager');
const { ContinuousBattleDamagePreventionManager } = require('../services/effects/continuous/ContinuousBattleDamagePreventionManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const gd03 = require('../data/gd03Card.json');

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

function setupBattle(attackerAp, attackerHp) {
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

    const attackerUnit = createUnit('ATK_uid_0001', 'ATK-001', attackerHp, attackerAp);
    const defenderUnit = createUnit('DEF_uid_0001', 'DEF-001', 6, 6);
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

    return { gameEnv, attackerPlayerId, defenderPlayerId, defenderUnit };
}

function targetRef(carduid, zone, playerId) {
    return { carduid, zone, playerId };
}

function resolveBattle(gameEnv, attackerPlayerId, defenderPlayerId) {
    expect(gameEnv.confirmBattleResolution(attackerPlayerId).success).toBe(true);
    expect(gameEnv.confirmBattleResolution(defenderPlayerId).success).toBe(true);
    const result = BattlePhaseManager.resolveBattle(gameEnv, attackerPlayerId);
    expect(result.success).toBe(true);
}

function latestEvent(gameEnv, type) {
    const list = (gameEnv.notificationQueue || []).filter((event) => event && event.type === type);
    return list[list.length - 1] || null;
}

describe('prevent_battle_damage compatibility for enemyHp and unconditional enemy_units', () => {
    test('enemyHp comparator prevents damage when attacker HP satisfies threshold (GD02-040 shape)', () => {
        const { gameEnv, attackerPlayerId, defenderPlayerId, defenderUnit } = setupBattle(4, 2);

        const preventionResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'gd02_040_deploy_prevent_hp',
                action: 'prevent_battle_damage',
                timing: { duration: 'UNTIL_END_OF_TURN' },
                parameters: { from: 'enemy_units', enemyHp: '<=2' }
            },
            [targetRef(defenderUnit.carduid, 'slot1', defenderPlayerId)],
            defenderPlayerId,
            'GD02-040_unit_0001'
        );
        expect(preventionResult.success).toBe(true);

        resolveBattle(gameEnv, attackerPlayerId, defenderPlayerId);
        const battleResolved = latestEvent(gameEnv, 'BATTLE_RESOLVED');
        expect(battleResolved).toBeTruthy();
        expect(battleResolved.payload.result.defenderDamagePrevented).toBe(true);
        expect(battleResolved.payload.result.defenderDamageTaken).toBe(0);
    });

    test('enemyHp comparator does not prevent damage when attacker HP is above threshold', () => {
        const { gameEnv, attackerPlayerId, defenderPlayerId, defenderUnit } = setupBattle(4, 3);

        const preventionResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'gd02_040_deploy_prevent_hp',
                action: 'prevent_battle_damage',
                timing: { duration: 'UNTIL_END_OF_TURN' },
                parameters: { from: 'enemy_units', enemyHp: '<=2' }
            },
            [targetRef(defenderUnit.carduid, 'slot1', defenderPlayerId)],
            defenderPlayerId,
            'GD02-040_unit_0001'
        );
        expect(preventionResult.success).toBe(true);

        resolveBattle(gameEnv, attackerPlayerId, defenderPlayerId);
        const battleResolved = latestEvent(gameEnv, 'BATTLE_RESOLVED');
        expect(battleResolved).toBeTruthy();
        expect(battleResolved.payload.result.defenderDamagePrevented).toBe(false);
        expect(battleResolved.payload.result.defenderDamageTaken).toBe(4);
    });

    test('unconditional from enemy_units prevention blocks damage (GD02-105/GD03-020 shape)', () => {
        const { gameEnv, attackerPlayerId, defenderPlayerId, defenderUnit } = setupBattle(5, 5);

        const preventionResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'unconditional_prevent_enemy_units',
                action: 'prevent_battle_damage',
                timing: { duration: 'UNTIL_END_OF_BATTLE' },
                parameters: { from: 'enemy_units' }
            },
            [targetRef(defenderUnit.carduid, 'slot1', defenderPlayerId)],
            defenderPlayerId,
            'GD02-105_command_0001'
        );
        expect(preventionResult.success).toBe(true);

        resolveBattle(gameEnv, attackerPlayerId, defenderPlayerId);
        const battleResolved = latestEvent(gameEnv, 'BATTLE_RESOLVED');
        expect(battleResolved).toBeTruthy();
        expect(battleResolved.payload.result.defenderDamagePrevented).toBe(true);
        expect(battleResolved.payload.result.defenderDamageTaken).toBe(0);
    });

    test('continuous manager applies unconditional enemy_units prevention to unit targets', () => {
        const { gameEnv, attackerPlayerId, defenderPlayerId, defenderUnit } = setupBattle(5, 5);

        const appliedCount = ContinuousBattleDamagePreventionManager.applyToTargets(
            gameEnv,
            {
                sourceCarduid: 'GD03-020_unit_0001',
                sourcePlayerId: defenderPlayerId,
                effectData: {
                    effectId: 'continuous_unconditional_enemy_units',
                    trigger: 'continuous',
                    action: 'prevent_battle_damage',
                    timing: { duration: 'CONTINUOUS' },
                    target: { type: 'unit', scope: 'self', count: 1 },
                    parameters: { from: 'enemy_units' }
                }
            },
            [defenderUnit]
        );

        expect(appliedCount).toBe(1);
        expect(Array.isArray(defenderUnit.temporaryEffects)).toBe(true);
        expect(defenderUnit.temporaryEffects.some((temp) => temp?.preventBattleDamage?.from === 'enemy_units')).toBe(true);

        resolveBattle(gameEnv, attackerPlayerId, defenderPlayerId);
        const battleResolved = latestEvent(gameEnv, 'BATTLE_RESOLVED');
        expect(battleResolved).toBeTruthy();
        expect(battleResolved.payload.result.defenderDamagePrevented).toBe(true);
        expect(battleResolved.payload.result.defenderDamageTaken).toBe(0);
    });

    test('GD03-020 continuous prevention works while Ad Balloon is in play', () => {
        const { gameEnv, attackerPlayerId, defenderPlayerId, defenderUnit } = setupBattle(5, 5);

        const gd03020 = gd03.cards['GD03-020'];
        const gd03020Rule = gd03020.effects.rules.find(
            (rule) => rule.effectId === 'prevent_enemy_unit_battle_damage_while_ad_balloon_in_play'
        );
        expect(gd03020Rule).toBeTruthy();

        defenderUnit.cardId = 'GD03-020';
        defenderUnit.cardData = JSON.parse(JSON.stringify(gd03020));
        defenderUnit.originalAP = gd03020.ap;
        defenderUnit.originalHP = gd03020.hp;
        defenderUnit.damageReceived = 0;
        defenderUnit.temporaryEffects = [];

        gameEnv.getPlayer(defenderPlayerId).zones.slot2.unit = {
            ...createUnit('T-014_token_0001', 'T-014', 1, 0),
            isRested: true,
            cardData: {
                id: 'T-014',
                name: 'Ad Balloon',
                cardType: 'unit',
                ap: 0,
                hp: 1,
                effects: { rules: [] }
            }
        };

        const registryResult = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(registryResult).toBeTruthy();
        expect(defenderUnit.temporaryEffects.some((temp) => temp?.preventBattleDamage?.from === 'enemy_units')).toBe(true);

        resolveBattle(gameEnv, attackerPlayerId, defenderPlayerId);
        const battleResolved = latestEvent(gameEnv, 'BATTLE_RESOLVED');
        expect(battleResolved).toBeTruthy();
        expect(battleResolved.payload.result.defenderDamagePrevented).toBe(true);
        expect(battleResolved.payload.result.defenderDamageTaken).toBe(0);

        expect(gd03020Rule.action).toBe('prevent_battle_damage');
    });
});
