const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { BlockerChoiceManager } = require('../services/BlockerChoiceManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const gd01 = require('../data/gd01Card.json');
const st01 = require('../data/st01Card.json');

function buildUnitCard(cardId, ownerId, cardData, overrides = {}) {
    return {
        carduid: overrides.carduid || `${cardId}_${ownerId}_${Math.random().toString(36).slice(2, 8)}`,
        cardId,
        placedAt: 0,
        placedBy: ownerId,
        isRested: false,
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true,
        isFirstPlay: false,
        damageReceived: 0,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        originalAP: typeof cardData.ap === 'number' ? cardData.ap : 0,
        originalHP: typeof cardData.hp === 'number' ? cardData.hp : 0,
        temporaryEffects: [],
        effectUsage: {},
        cardData,
        ...overrides
    };
}

function getDeployDamageAll3() {
    return gd01.cards['GD01-024'].effects.rules.find((rule) => rule.effectId === 'deploy_damage_all_3');
}

describe('GD01-024 hardening regression', () => {
    test('High-Maneuver attacker skips blocker choice', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        const attacker = buildUnitCard('GD01-024', 'playerId_1', gd01.cards['GD01-024'], {
            carduid: 'GD01-024_attacker_0001'
        });
        const blocker = buildUnitCard('ST01-008', 'playerId_2', st01.cards['ST01-008'], {
            carduid: 'ST01-008_blocker_0001'
        });

        p1.zones.slot1.unit = attacker;
        p2.zones.slot1.unit = blocker;

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const attackEvent = {
            id: 'player_action_attack_gd01024',
            type: 'PLAYER_ACTION',
            playerId: 'playerId_1',
            data: {
                actionType: 'attackShieldArea',
                attackerCarduid: attacker.carduid
            }
        };

        const result = BlockerChoiceManager.processAttackWithBlockerChoice(gameEnv, attackEvent, 'playerId_2');

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(result.normalAttack).toBe(true);
        expect(gameEnv.processingQueue.some((evt) => evt.type === 'BLOCKER_CHOICE')).toBe(false);
    });

    test('deploy_damage_all_3 damages only units with level <= 5 across both players', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        const source = buildUnitCard('GD01-024', 'playerId_1', gd01.cards['GD01-024'], {
            carduid: 'GD01-024_source_0001'
        });
        const allyLv5 = buildUnitCard('ALLY-LV5', 'playerId_1', {
            id: 'ALLY-LV5', name: 'Ally Lv5', cardType: 'unit', ap: 2, hp: 4, level: 5, effects: { description: [], rules: [] }
        }, { carduid: 'ally_lv5_0001' });
        const allyLv6 = buildUnitCard('ALLY-LV6', 'playerId_1', {
            id: 'ALLY-LV6', name: 'Ally Lv6', cardType: 'unit', ap: 2, hp: 4, level: 6, effects: { description: [], rules: [] }
        }, { carduid: 'ally_lv6_0001' });

        const enemyLv3 = buildUnitCard('ENEMY-LV3', 'playerId_2', {
            id: 'ENEMY-LV3', name: 'Enemy Lv3', cardType: 'unit', ap: 2, hp: 4, level: 3, effects: { description: [], rules: [] }
        }, { carduid: 'enemy_lv3_0001' });
        const enemyLv5 = buildUnitCard('ENEMY-LV5', 'playerId_2', {
            id: 'ENEMY-LV5', name: 'Enemy Lv5', cardType: 'unit', ap: 2, hp: 4, level: 5, effects: { description: [], rules: [] }
        }, { carduid: 'enemy_lv5_0001' });
        const enemyLv8 = buildUnitCard('ENEMY-LV8', 'playerId_2', {
            id: 'ENEMY-LV8', name: 'Enemy Lv8', cardType: 'unit', ap: 2, hp: 4, level: 8, effects: { description: [], rules: [] }
        }, { carduid: 'enemy_lv8_0001' });

        p1.zones.slot1.unit = source;
        p1.zones.slot2.unit = allyLv5;
        p1.zones.slot3.unit = allyLv6;
        p2.zones.slot1.unit = enemyLv3;
        p2.zones.slot2.unit = enemyLv5;
        p2.zones.slot3.unit = enemyLv8;

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            source.carduid,
            getDeployDamageAll3()
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(gameEnv.processingQueue.some((evt) => evt.type === 'TARGET_CHOICE')).toBe(false);

        expect(source.damageReceived).toBe(0);
        expect(allyLv5.damageReceived).toBe(3);
        expect(allyLv6.damageReceived).toBe(0);
        expect(enemyLv3.damageReceived).toBe(3);
        expect(enemyLv5.damageReceived).toBe(3);
        expect(enemyLv8.damageReceived).toBe(0);
    });

    test('deploy_damage_all_3 applies to every eligible unit on a full 12-slot board', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        const slots = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];

        const source = buildUnitCard('GD01-024', 'playerId_1', gd01.cards['GD01-024'], {
            carduid: 'GD01-024_source_full_0001'
        });
        p1.zones.slot1.unit = source;

        slots.slice(1).forEach((slotName, idx) => {
            p1.zones[slotName].unit = buildUnitCard(`P1-LV5-${idx}`, 'playerId_1', {
                id: `P1-LV5-${idx}`, name: `P1 Lv5 ${idx}`, cardType: 'unit', ap: 1, hp: 3, level: 5, effects: { description: [], rules: [] }
            }, { carduid: `p1_eligible_${slotName}` });
        });

        slots.forEach((slotName, idx) => {
            p2.zones[slotName].unit = buildUnitCard(`P2-LV5-${idx}`, 'playerId_2', {
                id: `P2-LV5-${idx}`, name: `P2 Lv5 ${idx}`, cardType: 'unit', ap: 1, hp: 3, level: 5, effects: { description: [], rules: [] }
            }, { carduid: `p2_eligible_${slotName}` });
        });

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            source.carduid,
            getDeployDamageAll3()
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(gameEnv.processingQueue.some((evt) => evt.type === 'TARGET_CHOICE')).toBe(false);

        expect(source.damageReceived).toBe(0);
        expect(Array.isArray(result.affectedTargets)).toBe(true);
        expect(result.affectedTargets).toHaveLength(11);
        expect(slots.slice(1).every((slotName) => !p1.zones[slotName].unit)).toBe(true);
        expect(slots.every((slotName) => !p2.zones[slotName].unit)).toBe(true);
        expect(Array.isArray(p1.zones.trashArea)).toBe(true);
        expect(Array.isArray(p2.zones.trashArea)).toBe(true);
        expect(p1.zones.trashArea.length).toBe(5);
        expect(p2.zones.trashArea.length).toBe(6);
    });
});
