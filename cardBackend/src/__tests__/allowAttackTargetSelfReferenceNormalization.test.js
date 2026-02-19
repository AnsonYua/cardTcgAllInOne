const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { PairingEffectManager } = require('../services/PairingEffectManager');
const { AllowAttackTargetPermissionResolver } = require('../services/attack/AllowAttackTargetPermissionResolver');

function findUnit(gameEnv, playerId, carduid) {
    const player = gameEnv.getPlayer(playerId);
    expect(player).toBeTruthy();
    for (let i = 1; i <= 6; i++) {
        const slot = player.zones?.[`slot${i}`];
        if (slot?.unit?.carduid === carduid) {
            return slot.unit;
        }
    }
    return null;
}

function pairingEventForPilot(gameEnv, playerId, pilotUid, targetUnitUid) {
    return PairingEffectManager.checkForPairingEffectsEvent(
        {
            playerId,
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: targetUnitUid
        },
        gameEnv,
        playerId
    );
}

describe('allow_attack_target self-referential normalization', () => {
    test('ST04-011 pairing auto-applies to paired unit without TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const linkedUnitUid = 'GD01-066_unit_test_0001';
        const otherUnitUid = 'ST01-009_unit_test_0001';
        const pilotUid = 'ST04-011_pilot_test_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: linkedUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: otherUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: linkedUnitUid
        }).success).toBe(true);

        const pairingEvent = pairingEventForPilot(gameEnv, 'playerId_1', pilotUid, linkedUnitUid);
        expect(pairingEvent).toBeTruthy();
        const pilotEffect = pairingEvent.data.effects.find((effect) => effect.effectId === 'attack_active_low_level_5');
        expect(pilotEffect).toBeTruthy();
        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            effects: [pilotEffect]
        });
        expect(result.success).toBe(true);

        const queueChoice = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        const notifChoice = (gameEnv.notificationQueue || []).find((event) => event.type === 'TARGET_CHOICE');
        expect(queueChoice).toBeFalsy();
        expect(notifChoice).toBeFalsy();

        const linkedUnit = findUnit(gameEnv, 'playerId_1', linkedUnitUid);
        const otherUnit = findUnit(gameEnv, 'playerId_1', otherUnitUid);
        expect(Array.isArray(linkedUnit.temporaryEffects)).toBe(true);
        expect(linkedUnit.temporaryEffects.some((effect) => effect?.allowAttackTarget?.level === '<=5')).toBe(true);
        expect(Array.isArray(otherUnit.temporaryEffects)).toBe(false);
    });

    test('ST07-011 optional pairing effect auto-applies to paired unit without TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const linkedUnitUid = 'ST07-001_unit_test_0001';
        const otherUnitUid = 'ST07-002_unit_test_0001';
        const pilotUid = 'ST07-011_pilot_test_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: linkedUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: otherUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: linkedUnitUid
        }).success).toBe(true);

        const pairingEvent = pairingEventForPilot(gameEnv, 'playerId_1', pilotUid, linkedUnitUid);
        expect(pairingEvent).toBeTruthy();
        const pilotEffect = pairingEvent.data.effects.find((effect) => effect.effectId === 'pair_allow_attack_target_active_enemy_le_source');
        expect(pilotEffect).toBeTruthy();
        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            effects: [pilotEffect]
        });
        expect(result.success).toBe(true);

        const queueChoice = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        const notifChoice = (gameEnv.notificationQueue || []).find((event) => event.type === 'TARGET_CHOICE');
        expect(queueChoice).toBeFalsy();
        expect(notifChoice).toBeFalsy();

        const linkedUnit = findUnit(gameEnv, 'playerId_1', linkedUnitUid);
        const otherUnit = findUnit(gameEnv, 'playerId_1', otherUnitUid);
        expect(Array.isArray(linkedUnit.temporaryEffects)).toBe(true);
        expect(linkedUnit.temporaryEffects.some((effect) => effect?.allowAttackTarget?.level === '<=SOURCE_LEVEL')).toBe(true);
        expect(Array.isArray(otherUnit.temporaryEffects)).toBe(false);
    });

    test('ST08-010 explicit player_choice still creates TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const linkedUnitUid = 'ST08-001_unit_test_0001';
        const secondMaftyUnitUid = 'ST08-002_unit_test_0001';
        const pilotUid = 'ST08-010_pilot_test_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: linkedUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: secondMaftyUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: linkedUnitUid
        }).success).toBe(true);

        const pairingEvent = pairingEventForPilot(gameEnv, 'playerId_1', pilotUid, linkedUnitUid);
        expect(pairingEvent).toBeTruthy();

        const pilotEffect = pairingEvent.data.effects.find((effect) => effect.effectId === 'pair_allow_attack_target_damaged_active_enemy_if_mafty_unit');
        expect(pilotEffect).toBeTruthy();
        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            effects: [pilotEffect]
        });
        expect(result.success).toBe(true);

        const queueChoice = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(queueChoice).toBeTruthy();
        expect(queueChoice.data.effect?.action).toBe('allow_attack_target');
    });

    test('GD03-035 linked sequence applies allow_attack_target to source unit without chooser', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const linkedUnitUid = 'GD03-035_unit_test_0001';
        const otherUnitUid = 'GD03-036_unit_test_0001';
        const pilotUid = 'GD03-092_pilot_test_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: linkedUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: otherUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: linkedUnitUid
        }).success).toBe(true);

        const pairingEvent = pairingEventForPilot(gameEnv, 'playerId_1', pilotUid, linkedUnitUid);
        expect(pairingEvent).toBeTruthy();
        const unitEffect = pairingEvent.data.effects.find((effect) => effect.sourceCarduid === linkedUnitUid);
        expect(unitEffect).toBeTruthy();
        expect(PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', {
            carduid: linkedUnitUid,
            effects: [unitEffect]
        }).success).toBe(true);

        const queueChoice = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        const notifChoice = (gameEnv.notificationQueue || []).find((event) => event.type === 'TARGET_CHOICE');
        expect(queueChoice).toBeFalsy();
        expect(notifChoice).toBeFalsy();

        const linkedUnit = findUnit(gameEnv, 'playerId_1', linkedUnitUid);
        const otherUnit = findUnit(gameEnv, 'playerId_1', otherUnitUid);
        expect(Array.isArray(linkedUnit.temporaryEffects)).toBe(true);
        expect(linkedUnit.temporaryEffects.some((effect) => effect?.allowAttackTarget?.ap === '<=SOURCE_AP')).toBe(true);
        expect(Array.isArray(otherUnit.temporaryEffects)).toBe(false);
    });

    test('ST04-011 permission allows <=5 active target and rejects >5', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const attackerUid = 'ST04-006_unit_test_0001';
        const pilotUid = 'ST04-011_pilot_test_0002';
        const validTargetUid = 'GD01-020_unit_test_0001'; // Lv.4
        const invalidTargetUid = 'ST03-001_unit_test_0001'; // Lv.6

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: attackerUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: attackerUid
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: validTargetUid, playAs: 'unit' }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: invalidTargetUid, playAs: 'unit' }).success).toBe(true);

        const pairingEvent = pairingEventForPilot(gameEnv, 'playerId_1', pilotUid, attackerUid);
        expect(pairingEvent).toBeTruthy();
        expect(PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', pairingEvent.data).success).toBe(true);

        const attacker = findUnit(gameEnv, 'playerId_1', attackerUid);
        const validTarget = findUnit(gameEnv, 'playerId_2', validTargetUid);
        const invalidTarget = findUnit(gameEnv, 'playerId_2', invalidTargetUid);

        expect(AllowAttackTargetPermissionResolver.canTargetActiveUnit(gameEnv, attacker, validTarget)).toBe(true);
        expect(AllowAttackTargetPermissionResolver.canTargetActiveUnit(gameEnv, attacker, invalidTarget)).toBe(false);
    });
});
