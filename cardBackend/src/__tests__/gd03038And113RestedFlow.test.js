const { GameEnvironment } = require('../models/GameEnvironment');
const { BaseAbilityManager } = require('../services/effects/BaseAbilityManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { UnitRestedByEffectTriggeredEffectManager } = require('../services/effects/UnitRestedByEffectTriggeredEffectManager');
const gd03 = require('../data/gd03Card.json');

function createUnit(carduid, cardData, overrides = {}) {
    const ap = typeof cardData.ap === 'number' ? cardData.ap : 0;
    const hp = typeof cardData.hp === 'number' ? cardData.hp : 0;
    return {
        carduid,
        cardId: cardData.id,
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
        cardData,
        ...overrides
    };
}

function createSimpleUnitCardData(id, level, ap, hp, traits = []) {
    return {
        id,
        name: id,
        cardType: 'unit',
        level,
        color: 'Red',
        traits,
        ap,
        hp,
        effects: { description: [], rules: [] }
    };
}

function setupTurn(gameEnv) {
    gameEnv.phase = 'MAIN_PHASE';
    gameEnv.currentTurn = 1;
    gameEnv.currentPlayer = 'playerId_1';
}

describe('GD03-038 / GD03-113 rest + dynamic level regression', () => {
    test('GD03-038 support activated effect uses canonical modifyAP schema', () => {
        const guaiz = gd03.cards['GD03-038'];
        const support = guaiz.effects.rules.find(rule => rule.effectId === 'activate_effect');
        expect(support).toBeTruthy();
        expect(support.type).toBe('activated');
        expect(support.action).toBe('modifyAP');
        expect(support.cost?.rest).toBe('self');
        expect(support.parameters?.excludeSource).toBe(true);
        expect(support.parameters?.value).toBe(1);
    });

    test('GD03-113 rests GD03-038, triggers UNIT_RESTED_BY_EFFECT AP+2, and damages valid lower-level enemy', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        setupTurn(gameEnv);

        const guaiz = gd03.cards['GD03-038'];
        const humanKarmaEffect = gd03.cards['GD03-113'].effects.rules.find(rule => rule.effectId === 'play_effect');
        expect(humanKarmaEffect).toBeTruthy();

        p1.zones.slot1.unit = createUnit('GD03-038_unit_0001', guaiz);
        p2.zones.slot1.unit = createUnit(
            'enemy_low_level_0001',
            createSimpleUnitCardData('ENEMY-LOW', 2, 3, 4)
        );

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD03-113_cmd_0001',
            humanKarmaEffect
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).not.toBe(true);
        expect(p1.zones.slot1.unit.isRested).toBe(true);
        expect(p1.zones.slot1.unit.modifyAP || 0).toBe(2);
        expect(p2.zones.slot1.unit.damageReceived || 0).toBe(3);
    });

    test('GD03-113 does not damage enemy above rested unit level', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        setupTurn(gameEnv);

        const humanKarmaEffect = gd03.cards['GD03-113'].effects.rules.find(rule => rule.effectId === 'play_effect');
        expect(humanKarmaEffect).toBeTruthy();

        p1.zones.slot1.unit = createUnit('friendly_level_4_0001', createSimpleUnitCardData('ALLY-L4', 4, 3, 3));
        p2.zones.slot1.unit = createUnit(
            'enemy_level_6_0001',
            createSimpleUnitCardData('ENEMY-L6', 6, 5, 6)
        );

        const result = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD03-113_cmd_0002',
            humanKarmaEffect
        );

        expect(result.success).toBe(true);
        expect(p1.zones.slot1.unit.isRested).toBe(true);
        expect(p2.zones.slot1.unit.damageReceived || 0).toBe(0);
    });

    test('unitRestedByEffectEvent targetCarduid \"self\" alias matches source carduid', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        setupTurn(gameEnv);

        const guaiz = gd03.cards['GD03-038'];
        p1.zones.slot1.unit = createUnit('GD03-038_alias_0001', guaiz);

        const result = UnitRestedByEffectTriggeredEffectManager.process(gameEnv, {
            sourcePlayerId: 'playerId_1',
            targetPlayerId: 'playerId_1',
            targetCarduid: 'GD03-038_alias_0001'
        });

        expect(result.success).toBe(true);
        expect(p1.zones.slot1.unit.modifyAP || 0).toBe(2);
    });

    test('rest cost on activated unit ability dispatches UNIT_RESTED_BY_EFFECT trigger', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        setupTurn(gameEnv);

        const guaiz = gd03.cards['GD03-038'];
        const nonZaftAlly = createSimpleUnitCardData('ALLY-NON-ZAFT', 3, 2, 3, ['Earth Federation']);

        p1.zones.slot1.unit = createUnit('GD03-038_cost_0001', guaiz);
        p1.zones.slot2.unit = createUnit('ALLY_NON_ZAFT_0001', nonZaftAlly);

        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'player_action_gd03_038_activate',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD03-038_cost_0001',
                effectId: 'activate_effect'
            }
        });

        expect(result.success).toBe(true);
        expect(p1.zones.slot1.unit.isRested).toBe(true);
        expect(p1.zones.slot1.unit.modifyAP || 0).toBe(2);
        expect(p1.zones.slot2.unit.modifyAP || 0).toBe(1);
    });
});
