const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { BattlePhaseManager } = require('../services/BattlePhaseManager');
const { GameNotificationManager } = require('../services/GameNotificationManager');
const st02 = require('../data/st02Card.json');
const gd02 = require('../data/gd02Card.json');

function createUnit(carduid, cardId, { level = 1, ap = 3, hp = 4 } = {}) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            level,
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
        temporaryEffects: [],
        isRested: false,
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true
    };
}

function createBase(carduid, hp = 6) {
    return {
        carduid,
        cardId: 'TEST-BASE',
        cardData: {
            id: 'TEST-BASE',
            name: 'Test Base',
            cardType: 'base',
            hp,
            effects: { rules: [] }
        },
        originalHP: hp,
        damageReceived: 0,
        isRested: false,
        temporaryEffects: []
    };
}

function latestEvent(gameEnv, type) {
    const events = (gameEnv.notificationQueue || []).filter((e) => e?.type === type);
    return events[events.length - 1] || null;
}

function setupBaseAttackActionStep(attackerLevel, { includeShield = false } = {}) {
    const gameEnv = new GameEnvironment();
    const defenderPlayerId = 'playerId_1';
    const attackerPlayerId = 'playerId_2';
    const defender = gameEnv.addPlayer(defenderPlayerId, 'P1');
    const attacker = gameEnv.addPlayer(attackerPlayerId, 'P2');

    defender.isReady = true;
    attacker.isReady = true;
    gameEnv.gameStarted = true;
    gameEnv.currentTurn = 1;
    gameEnv.currentPlayer = attackerPlayerId;
    gameEnv.phase = 'ACTION_STEP';

    const attackingUnit = createUnit('attacker_unit_0001', 'ATK-UNIT', { level: attackerLevel, ap: 3, hp: 4 });
    attacker.zones.slot1.unit = attackingUnit;
    if (includeShield) {
        defender.zones.shieldArea.push({ carduid: 'defender_shield_0001', cardId: 'TEST-SHIELD' });
    }
    defender.zones.base.push(createBase('defender_base_0001', 6));

    const notificationManager = new GameNotificationManager(gameEnv);
    const attackNotificationId = notificationManager.addNotificationEvent('UNIT_ATTACK_DECLARED', {
        attackingPlayerId: attackerPlayerId,
        defendingPlayerId: defenderPlayerId,
        attackerCarduid: attackingUnit.carduid,
        attackerSlot: 'slot1',
        targetType: 'player',
        targetPlayerId: defenderPlayerId
    });

    gameEnv.setCurrentBattle({
        actionType: 'attackShieldArea',
        attackingPlayerId: attackerPlayerId,
        defendingPlayerId: defenderPlayerId,
        attackerCarduid: attackingUnit.carduid,
        targetPlayerId: defenderPlayerId,
        status: 'ACTION_STEP',
        openedAt: Date.now(),
        attackNotificationId
    });

    return { gameEnv, attackerPlayerId, defenderPlayerId, baseCard: defender.zones.base[0] };
}

function applyPlaySequence(gameEnv, playerId, effectRule, sourceUid) {
    const result = SequenceEffectManager.processSequenceEffect(gameEnv, playerId, sourceUid, effectRule);
    expect(result.success).toBe(true);
    if (result.requiresSelection) {
        throw new Error('Unexpected selection requirement for shield/base prevention command');
    }
}

function applyBasePreventionStep(gameEnv, playerId, sourceUid, effectStep) {
    const base = gameEnv.getPlayer(playerId).zones.base[0];
    const result = EffectExecutor.applyEffectToTargets(
        gameEnv,
        effectStep,
        [{ carduid: base.carduid, zone: 'base', playerId }],
        playerId,
        sourceUid
    );
    expect(result.success).toBe(true);
}

function resolveBattle(gameEnv, attackerPlayerId, defenderPlayerId) {
    expect(gameEnv.confirmBattleResolution(attackerPlayerId).success).toBe(true);
    expect(gameEnv.confirmBattleResolution(defenderPlayerId).success).toBe(true);
    const result = BattlePhaseManager.resolveBattle(gameEnv, attackerPlayerId);
    expect(result.success).toBe(true);
}

describe('shield-area prevention commands also protect base during battle', () => {
    test('ST02-013 prevents base battle damage from Lv.4 enemy unit', () => {
        const effect = st02.cards['ST02-013'].effects.rules.find((r) => r.effectId === 'action_prevent_shield_damage');
        expect(effect?.action).toBe('sequence');
        expect(effect?.parameters?.steps?.[1]?.target).toEqual({ type: 'base', scope: 'self' });
        const baseStep = effect.parameters.steps[1];
        const { gameEnv, attackerPlayerId, defenderPlayerId, baseCard } = setupBaseAttackActionStep(4);

        applyBasePreventionStep(gameEnv, defenderPlayerId, 'ST02-013_cmd_src_0001', baseStep);
        resolveBattle(gameEnv, attackerPlayerId, defenderPlayerId);

        expect(baseCard.damageReceived || 0).toBe(0);
        const prevented = latestEvent(gameEnv, 'BASE_DAMAGE_PREVENTED');
        expect(prevented).toBeTruthy();
        const resolved = latestEvent(gameEnv, 'BATTLE_RESOLVED');
        expect(resolved?.payload?.result?.damagePrevented).toBe(true);
    });

    test('ST02-013 does not prevent base battle damage from Lv.5 enemy unit', () => {
        const effect = st02.cards['ST02-013'].effects.rules.find((r) => r.effectId === 'action_prevent_shield_damage');
        const baseStep = effect.parameters.steps[1];
        const { gameEnv, attackerPlayerId, defenderPlayerId, baseCard } = setupBaseAttackActionStep(5);

        applyBasePreventionStep(gameEnv, defenderPlayerId, 'ST02-013_cmd_src_0002', baseStep);
        resolveBattle(gameEnv, attackerPlayerId, defenderPlayerId);

        expect(baseCard.damageReceived).toBe(3);
        expect(latestEvent(gameEnv, 'BASE_DAMAGE_PREVENTED')).toBeFalsy();
        const resolved = latestEvent(gameEnv, 'BATTLE_RESOLVED');
        expect(resolved?.payload?.result?.damagePrevented).toBe(false);
    });

    test('GD02-106 prevents base battle damage from Lv.3 enemy unit', () => {
        const effect = gd02.cards['GD02-106'].effects.rules.find((r) => r.effectId === 'play_effect');
        const { gameEnv, attackerPlayerId, defenderPlayerId, baseCard } = setupBaseAttackActionStep(3);

        applyPlaySequence(gameEnv, defenderPlayerId, effect, 'GD02-106_cmd_src_0001');
        resolveBattle(gameEnv, attackerPlayerId, defenderPlayerId);

        expect(baseCard.damageReceived || 0).toBe(0);
        const prevented = latestEvent(gameEnv, 'BASE_DAMAGE_PREVENTED');
        expect(prevented).toBeTruthy();
        const resolved = latestEvent(gameEnv, 'BATTLE_RESOLVED');
        expect(resolved?.payload?.result?.damagePrevented).toBe(true);
    });

    test('GD02-106 does not prevent base battle damage from Lv.4 enemy unit', () => {
        const effect = gd02.cards['GD02-106'].effects.rules.find((r) => r.effectId === 'play_effect');
        const { gameEnv, attackerPlayerId, defenderPlayerId, baseCard } = setupBaseAttackActionStep(4);

        applyPlaySequence(gameEnv, defenderPlayerId, effect, 'GD02-106_cmd_src_0002');
        resolveBattle(gameEnv, attackerPlayerId, defenderPlayerId);

        expect(baseCard.damageReceived).toBe(3);
        expect(latestEvent(gameEnv, 'BASE_DAMAGE_PREVENTED')).toBeFalsy();
        const resolved = latestEvent(gameEnv, 'BATTLE_RESOLVED');
        expect(resolved?.payload?.result?.damagePrevented).toBe(false);
    });
});
