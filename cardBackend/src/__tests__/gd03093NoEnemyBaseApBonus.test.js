const gd03 = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { ContinuousEffectManager } = require('../services/ContinuousEffectManager');

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

describe('GD03-093 no-enemy-base continuous AP bonus', () => {
    test('card data includes burst and continuous no-enemy-base AP rule', () => {
        const card = gd03.cards['GD03-093'];
        expect(card.effects.description).toHaveLength(2);
        expect(card.effects.rules).toHaveLength(2);

        const rule = card.effects.rules.find((entry) => entry.effectId === 'ap_plus_1_if_no_enemy_base');
        expect(rule).toBeTruthy();
        expect(rule.type).toBe('continuous');
        expect(rule.timing?.duration).toBe('continuous');
        expect(rule.action).toBe('modifyAP');
        expect(rule.target).toEqual({
            type: 'unit',
            scope: 'self',
            count: 1
        });
        expect(rule.conditions).toEqual([
            {
                type: 'cardsInPlayWithFilter',
                scope: 'opponent',
                filters: { cardType: 'base' },
                value: 0
            }
        ]);
        expect(rule.parameters).toEqual({ value: 1 });
    });

    test('applies AP+1 when no enemy base is in play', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const unitUid = 'GD03-032_unit_093_0001';
        const pilotUid = 'GD03-093_pilot_093_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: unitUid,
            playAs: 'unit'
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: unitUid
        }).success).toBe(true);

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const unit = findUnit(gameEnv, 'playerId_1', unitUid);
        expect(unit).toBeTruthy();
        expect(unit.continueModifyAP).toBe(1);
    });

    test('does not apply AP bonus while enemy base is in play', () => {
        const gameEnv = new GameEnvironment();
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.addPlayer('playerId_1', 'P1');

        const unitUid = 'GD03-032_unit_093_0002';
        const pilotUid = 'GD03-093_pilot_093_0002';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: unitUid,
            playAs: 'unit'
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: unitUid
        }).success).toBe(true);

        p2.zones.base.push({
            carduid: 'enemy_base_093_0001',
            cardId: 'TEST-ENEMY-BASE',
            cardData: {
                cardType: 'base',
                color: 'Blue',
                name: 'Enemy Base'
            },
            isRested: false
        });

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);

        const unit = findUnit(gameEnv, 'playerId_1', unitUid);
        expect(unit).toBeTruthy();
        expect(unit.continueModifyAP || 0).toBe(0);
    });

    test('toggle behavior: bonus appears after enemy base is removed', () => {
        const gameEnv = new GameEnvironment();
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.addPlayer('playerId_1', 'P1');

        const unitUid = 'GD03-032_unit_093_0003';
        const pilotUid = 'GD03-093_pilot_093_0003';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: unitUid,
            playAs: 'unit'
        }).success).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
            carduid: pilotUid,
            playAs: 'pilot',
            targetUnit: unitUid
        }).success).toBe(true);

        p2.zones.base.push({
            carduid: 'enemy_base_093_0002',
            cardId: 'TEST-ENEMY-BASE-2',
            cardData: {
                cardType: 'base',
                color: 'White',
                name: 'Enemy Base 2'
            },
            isRested: false
        });

        ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        let unit = findUnit(gameEnv, 'playerId_1', unitUid);
        expect(unit.continueModifyAP || 0).toBe(0);

        p2.zones.base = [];
        ContinuousEffectManager.processAllContinuousEffects(gameEnv);
        unit = findUnit(gameEnv, 'playerId_1', unitUid);
        expect(unit.continueModifyAP).toBe(1);
    });
});
