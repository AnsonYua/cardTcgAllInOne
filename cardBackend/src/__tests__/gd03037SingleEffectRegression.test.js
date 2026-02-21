const gd03 = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');
const { KeywordUtils } = require('../utils/KeywordUtils');
const { createUnitZoneCard, findUnit } = require('./helpers/zoneCardFactory');

function setupBattle({ enemyRules }) {
    const gameEnv = new GameEnvironment();
    gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');
    gameEnv.currentTurn = 1;
    gameEnv.currentPlayer = 'playerId_1';
    gameEnv.phase = 'ACTION_STEP';

    const sourceCarduid = 'GD03-037_source_unit';
    const pilotCarduid = 'GD03-084_link_pilot';
    expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: sourceCarduid, playAs: 'unit' }).success).toBe(true);
    expect(
        PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotCarduid,
            playAs: 'pilot',
            targetUnit: sourceCarduid
        }).success
    ).toBe(true);

    gameEnv.players.playerId_2.zones.slot1.unit = createUnitZoneCard({
        carduid: 'enemy_battle_target',
        cardId: 'TEST-ENEMY',
        name: 'Enemy Unit',
        ap: 3,
        hp: 3,
        effectsRules: enemyRules
    });

    gameEnv.currentBattle = {
        attackerCarduid: sourceCarduid,
        targetCarduid: 'enemy_battle_target',
        actionType: 'attackUnit'
    };

    return gameEnv;
}

describe('GD03-037 single-effect regression', () => {
    test('card data keeps a single during-link rule and no destroyed trigger', () => {
        const card = gd03.cards['GD03-037'];
        expect(card).toBeTruthy();
        expect(Array.isArray(card.effects.description)).toBe(true);
        expect(card.effects.description).toHaveLength(1);
        expect(card.effects.description[0]).toContain('【Destroyed】 effect');

        const rules = Array.isArray(card.effects.rules) ? card.effects.rules : [];
        expect(rules).toHaveLength(1);
        expect(rules.some((rule) => rule.effectId === 'during_link_effect')).toBe(true);
        expect(rules.some((rule) => String(rule.trigger || '').toUpperCase() === 'DESTROYED')).toBe(false);
        expect(rules.some((rule) => rule.effectId === 'destroyed_effect')).toBe(false);
    });

    test('during your turn while linked and battling enemy with DESTROYED trigger, gains First Strike', () => {
        const gameEnv = setupBattle({
            enemyRules: [
                {
                    effectId: 'enemy_destroyed_effect',
                    type: 'triggered',
                    trigger: 'DESTROYED',
                    action: 'draw',
                    parameters: { value: 1 }
                }
            ]
        });

        const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(result.success).toBe(true);

        const sourceUnit = findUnit(gameEnv, 'playerId_1', 'GD03-037_source_unit');
        expect(sourceUnit).toBeTruthy();
        expect(KeywordUtils.hasKeyword(sourceUnit, 'First Strike')).toBe(true);
    });

    test('does not gain First Strike when battle target has no DESTROYED trigger', () => {
        const gameEnv = setupBattle({
            enemyRules: [
                {
                    effectId: 'enemy_attack_effect',
                    type: 'triggered',
                    trigger: 'ATTACK_PHASE',
                    action: 'draw',
                    parameters: { value: 1 }
                }
            ]
        });

        const result = ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        expect(result.success).toBe(true);

        const sourceUnit = findUnit(gameEnv, 'playerId_1', 'GD03-037_source_unit');
        expect(sourceUnit).toBeTruthy();
        expect(KeywordUtils.hasKeyword(sourceUnit, 'First Strike')).toBe(false);
    });
});
