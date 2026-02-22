const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const gd03 = require('../data/gd03Card.json');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

describe('GD03-128 UNIT_RESTED_BY_EFFECT trigger', () => {
    test('triggers during opponent turn when your unit is rested by opponent effect and deals 1 damage to enemy unit', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = opponent.id;

        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
                carduid: 'GD03-128_base_0001',
                playAs: 'base'
            }).success
        ).toBe(true);

        owner.zones.slot1.unit = createUnitZoneCard({
            carduid: 'owner_unit_0001',
            cardId: 'GD03-001',
            ap: 3,
            hp: 4,
            cardDataExtras: { level: 3, color: 'Red', traits: ['New UNE'] }
        });

        opponent.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_target_0001',
            cardId: 'GD03-002',
            ap: 3,
            hp: 4,
            cardDataExtras: { level: 3, color: 'Blue', traits: ['Earth Federation'] }
        });

        const restEffect = {
            effectId: 'test_rest_opponent_effect',
            action: 'rest',
            parameters: {}
        };

        const restResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            restEffect,
            [{ carduid: 'owner_unit_0001', zone: 'slot1', playerId: owner.id }],
            opponent.id,
            'opponent_effect_source_0001'
        );

        expect(restResult.success).toBe(true);
        expect(owner.zones.slot1.unit.isRested).toBe(true);
        expect(opponent.zones.slot1.unit.damageReceived || 0).toBe(1);
    });

    test('does not trigger on your own turn', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = owner.id;

        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
                carduid: 'GD03-128_base_0002',
                playAs: 'base'
            }).success
        ).toBe(true);

        owner.zones.slot1.unit = createUnitZoneCard({
            carduid: 'owner_unit_0002',
            cardId: 'GD03-001',
            ap: 3,
            hp: 4,
            cardDataExtras: { level: 3, color: 'Red', traits: ['New UNE'] }
        });

        opponent.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_target_0002',
            cardId: 'GD03-002',
            ap: 3,
            hp: 4,
            cardDataExtras: { level: 3, color: 'Blue', traits: ['Earth Federation'] }
        });

        const restResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            { effectId: 'test_rest_owner_turn', action: 'rest', parameters: {} },
            [{ carduid: 'owner_unit_0002', zone: 'slot1', playerId: owner.id }],
            opponent.id,
            'opponent_effect_source_0002'
        );

        expect(restResult.success).toBe(true);
        expect(owner.zones.slot1.unit.isRested).toBe(true);
        expect(opponent.zones.slot1.unit.damageReceived || 0).toBe(0);
    });

    test('once_per_turn restriction applies (second rest in same turn does not re-trigger)', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = opponent.id;

        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
                carduid: 'GD03-128_base_0003',
                playAs: 'base'
            }).success
        ).toBe(true);

        owner.zones.slot1.unit = createUnitZoneCard({
            carduid: 'owner_unit_0003a',
            cardId: 'GD03-001',
            ap: 3,
            hp: 4,
            cardDataExtras: { level: 3, color: 'Red', traits: ['New UNE'] }
        });
        owner.zones.slot2.unit = createUnitZoneCard({
            carduid: 'owner_unit_0003b',
            cardId: 'GD03-003',
            ap: 3,
            hp: 4,
            cardDataExtras: { level: 3, color: 'Red', traits: ['New UNE'] }
        });

        opponent.zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_target_0003',
            cardId: 'GD03-002',
            ap: 3,
            hp: 4,
            cardDataExtras: { level: 3, color: 'Blue', traits: ['Earth Federation'] }
        });

        const restEffect = { effectId: 'test_rest_once_per_turn', action: 'rest', parameters: {} };

        const first = EffectExecutor.applyEffectToTargets(
            gameEnv,
            restEffect,
            [{ carduid: 'owner_unit_0003a', zone: 'slot1', playerId: owner.id }],
            opponent.id,
            'opponent_effect_source_0003a'
        );
        expect(first.success).toBe(true);

        const second = EffectExecutor.applyEffectToTargets(
            gameEnv,
            restEffect,
            [{ carduid: 'owner_unit_0003b', zone: 'slot2', playerId: owner.id }],
            opponent.id,
            'opponent_effect_source_0003b'
        );
        expect(second.success).toBe(true);

        expect(opponent.zones.slot1.unit.damageReceived || 0).toBe(1);
    });

    test('card data encoding matches intended trigger/condition', () => {
        const card = gd03.cards['GD03-128'];
        const rule = card.effects.rules.find((r) => r.effectId === 'effect');

        expect(rule).toBeTruthy();
        expect(rule.trigger).toBe('UNIT_RESTED_BY_EFFECT');
        expect(rule.restrictions).toContain('once_per_turn');
        expect(rule.timing?.actionTurn).toBe('OPPONENT_TURN');
        expect(rule.action).toBe('damage');
        expect(rule.parameters?.value).toBe(1);
        expect(rule.conditions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'unitRestedByEffectEvent',
                    targetController: 'self',
                    sourceController: 'opponent'
                })
            ])
        );
    });
});
