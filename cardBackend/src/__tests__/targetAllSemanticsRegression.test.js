const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { BattleDestroyEffectManager } = require('../services/effects/BattleDestroyEffectManager');
const gd01 = require('../data/gd01Card.json');
const gd03 = require('../data/gd03Card.json');
const st02 = require('../data/st02Card.json');

function makeUnit(carduid, options = {}) {
    const {
        cardId = 'U',
        ap = 3,
        hp = 3,
        level = 3,
        color = 'Red',
        traits = ['Test'],
        effectsDescription = []
    } = options;

    return {
        carduid,
        cardId,
        placedAt: 0,
        placedBy: 'playerId_1',
        isRested: false,
        damageReceived: 0,
        modifyAP: 0,
        modifyHP: 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        originalAP: ap,
        originalHP: hp,
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true,
        isFirstPlay: false,
        temporaryEffects: [],
        effectUsage: {},
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            ap,
            hp,
            level,
            color,
            traits,
            effects: {
                description: effectsDescription,
                rules: []
            }
        }
    };
}

function makePilot(carduid) {
    return {
        carduid,
        cardId: 'PILOT',
        placedAt: 0,
        placedBy: 'playerId_1',
        isRested: false,
        isFirstPlay: false,
        originalAP: 1,
        originalHP: 1,
        temporaryEffects: [],
        effectUsage: {},
        cardData: {
            id: 'PILOT',
            name: 'Pilot',
            cardType: 'pilot'
        }
    };
}

describe('target-all semantics regression', () => {
    test('GD01-102 and GD01-105 resolve to all friendly units without TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.slot1.unit = makeUnit('ally_1', { level: 3, hp: 4 });
        p1.zones.slot2.unit = makeUnit('ally_2', { level: 4, hp: 5 });

        const healEffect = gd01.cards['GD01-102'].effects.rules.find((r) => r.effectId === 'heal_friendly_units_le_4');
        const apEffect = gd01.cards['GD01-105'].effects.rules.find((r) => r.effectId === 'main_all_friendly_units_ap_plus_2');

        const healResult = DeployTargetManager.processEffectWithTargetChoice(gameEnv, 'playerId_1', 'GD01-102_src', healEffect);
        expect(healResult.success).toBe(true);
        expect(healResult.requiresSelection).not.toBe(true);

        const apResult = DeployTargetManager.processEffectWithTargetChoice(gameEnv, 'playerId_1', 'GD01-105_src', apEffect);
        expect(apResult.success).toBe(true);
        expect(apResult.requiresSelection).not.toBe(true);

        expect(p1.zones.slot1.unit.modifyAP).toBe(2);
        expect(p1.zones.slot2.unit.modifyAP).toBe(2);
    });

    test('GD03-036 linked damage step resolves all enemy units without TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.unit = makeUnit('enemy_1');
        p2.zones.slot2.unit = makeUnit('enemy_2');

        const damageStep = gd03.cards['GD03-036'].effects.rules[0].parameters.steps[0];
        const result = DeployTargetManager.processEffectWithTargetChoice(gameEnv, 'playerId_1', 'GD03-036_src', damageStep);

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(p2.zones.slot1.unit.damageReceived).toBe(1);
        expect(p2.zones.slot2.unit.damageReceived).toBe(1);
    });

    test('GD03-041 deploy damage step resolves all bases without TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p1.zones.base = [{ carduid: 'base_1', cardId: 'BASE_1', hp: 5, damageReceived: 0, cardData: { id: 'BASE_1', cardType: 'base' } }];
        p2.zones.base = [{ carduid: 'base_2', cardId: 'BASE_2', hp: 5, damageReceived: 0, cardData: { id: 'BASE_2', cardType: 'base' } }];

        const damageStep = gd03.cards['GD03-041'].effects.rules[0].parameters.steps[0];
        const result = DeployTargetManager.processEffectWithTargetChoice(gameEnv, 'playerId_1', 'GD03-041_src', damageStep);

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(Array.isArray(p1.zones.base)).toBe(true);
        expect(Array.isArray(p2.zones.base)).toBe(true);
        expect(p1.zones.base).toHaveLength(0);
        expect(p2.zones.base).toHaveLength(0);
    });

    test('GD03-119 conditional debuff step resolves all enemy units without TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.unit = makeUnit('enemy_1', { ap: 4 });
        p2.zones.slot2.unit = makeUnit('enemy_2', { ap: 5 });

        const debuffStep = gd03.cards['GD03-119'].effects.rules[0].parameters.steps[1].parameters.then[0];
        const result = DeployTargetManager.processEffectWithTargetChoice(gameEnv, 'playerId_1', 'GD03-119_src', debuffStep);

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(p2.zones.slot1.unit.modifyAP).toBe(-1);
        expect(p2.zones.slot2.unit.modifyAP).toBe(-1);
    });

    test('ST02-003 battle-destroy splash resolves all eligible enemies without TARGET_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 3;
        gameEnv.currentPlayer = 'playerId_1';

        const sourceUnit = makeUnit('st02_003_source', {
            cardId: 'ST02-003',
            effectsDescription: st02.cards['ST02-003'].effects.description
        });
        sourceUnit.cardData.effects.rules = [st02.cards['ST02-003'].effects.rules[0]];
        p1.zones.slot1.unit = sourceUnit;
        p1.zones.slot1.pilot = makePilot('st02_003_pilot');

        p2.zones.slot1.unit = makeUnit('enemy_lv2', { level: 2, hp: 3 });
        p2.zones.slot2.unit = makeUnit('enemy_lv3', { level: 3, hp: 3 });
        p2.zones.slot3.unit = makeUnit('enemy_lv4', { level: 4, hp: 3 });

        const result = BattleDestroyEffectManager.processBattleDestroy(gameEnv, {
            sourcePlayerId: 'playerId_1',
            sourceUnit,
            sourceSlot: 'slot1',
            destroyedPlayerId: 'playerId_2',
            destroyedUnit: makeUnit('destroyed_unit', { level: 2 })
        });

        expect(result.success).toBe(true);

        const queuedChoice = gameEnv.processingQueue.find((evt) => evt.type === 'TARGET_CHOICE');
        expect(queuedChoice).toBeFalsy();

        expect(p2.zones.slot1.unit.damageReceived).toBe(1);
        expect(p2.zones.slot2.unit.damageReceived).toBe(1);
        expect(p2.zones.slot3.unit.damageReceived || 0).toBe(0);
    });
});
