const gd02 = require('../data/gd02Card.json');
const gd03 = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

function findDeclaredTargetChoicesBySource(gameEnv, sourceCarduid) {
    const queue = Array.isArray(gameEnv.processingQueue) ? gameEnv.processingQueue : [];
    return queue.filter((event) =>
        event?.type === 'TARGET_CHOICE' &&
        event?.status === 'DECLARED' &&
        event?.data?.sourceCarduid === sourceCarduid
    );
}

function findTokenDeployedNotifications(gameEnv, sourceCarduid) {
    const notifications = Array.isArray(gameEnv.notificationQueue) ? gameEnv.notificationQueue : [];
    return notifications.filter((event) =>
        event?.type === 'TOKEN_DEPLOYED' &&
        event?.payload?.sourceCarduid === sourceCarduid
    );
}

function hasTokenInSlots(player) {
    for (let i = 1; i <= 6; i++) {
        const unit = player?.zones?.[`slot${i}`]?.unit;
        if (unit?.cardId === 'T-015') {
            return true;
        }
    }
    return false;
}

describe('EFFECT_DAMAGE_RECEIVED self-target regression coverage', () => {
    test('GD03-060 only deploys T-015 when GD03-060 itself receives effect damage', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = owner.id;

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
            carduid: 'GD03-060_friendly_0001',
            playAs: 'unit'
        }).success).toBe(true);

        owner.zones.slot2.unit = createUnitZoneCard({
            carduid: 'ALLY_NON_TRIGGER_0001',
            cardId: 'ALLY-NON-TRIGGER-0001',
            ap: 2,
            hp: 3,
            traits: ['Tekkadan']
        });

        const wrongTargetDamage = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'test_enemy_damage_other_friendly',
                action: 'damage',
                parameters: { value: 1 }
            },
            [{ carduid: 'ALLY_NON_TRIGGER_0001', zone: 'slot2', playerId: owner.id }],
            owner.id,
            'friendly_effect_source_0001'
        );
        expect(wrongTargetDamage.success).toBe(true);
        expect(findTokenDeployedNotifications(gameEnv, 'GD03-060_friendly_0001')).toHaveLength(0);
        expect(hasTokenInSlots(owner)).toBe(false);

        const selfDamage = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'test_enemy_damage_gd03060',
                action: 'damage',
                parameters: { value: 1 }
            },
            [{ carduid: 'GD03-060_friendly_0001', zone: 'slot1', playerId: owner.id }],
            owner.id,
            'friendly_effect_source_0002'
        );
        expect(selfDamage.success).toBe(true);
        const tokenNotifications = findTokenDeployedNotifications(gameEnv, 'GD03-060_friendly_0001');
        const tokenChoiceEvents = findDeclaredTargetChoicesBySource(gameEnv, 'GD03-060_friendly_0001');
        expect(tokenNotifications.length > 0 || tokenChoiceEvents.length > 0 || hasTokenInSlots(owner)).toBe(true);
    });

    test('GD02-010 draws only when GD02-010 itself receives enemy effect damage', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = owner.id;
        owner.deck.mainDeck = ['GD02-001_draw_0001'];

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
            carduid: 'GD02-010_friendly_0001',
            playAs: 'unit'
        }).success).toBe(true);

        owner.zones.slot2.unit = createUnitZoneCard({
            carduid: 'ALLY_DRAW_BAIT_0001',
            cardId: 'ALLY-DRAW-BAIT-0001',
            ap: 2,
            hp: 3
        });

        const otherUnitDamage = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'test_enemy_damage_other_unit',
                action: 'damage',
                parameters: { value: 1 }
            },
            [{ carduid: 'ALLY_DRAW_BAIT_0001', zone: 'slot2', playerId: owner.id }],
            opponent.id,
            'enemy_effect_source_0003'
        );
        expect(otherUnitDamage.success).toBe(true);
        expect(owner.deck.handUids).toHaveLength(0);

        const selfUnitDamage = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'test_enemy_damage_gd02010',
                action: 'damage',
                parameters: { value: 1 }
            },
            [{ carduid: 'GD02-010_friendly_0001', zone: 'slot1', playerId: owner.id }],
            opponent.id,
            'enemy_effect_source_0004'
        );
        expect(selfUnitDamage.success).toBe(true);
        expect(owner.deck.handUids).toHaveLength(1);
        expect(owner.deck.handUids).toContain('GD02-001_draw_0001');
    });

    test('GD03-095 pilot trigger uses effective self target (paired unit) only', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = owner.id;
        gameEnv.gameStarted = true;
        gameEnv.phase = 'MAIN_PHASE';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
            carduid: 'GD03-050_unit_0001',
            playAs: 'unit'
        }).success).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
            carduid: 'GD03-095_pilot_0001',
            playAs: 'pilot',
            targetUnit: 'GD03-050_unit_0001'
        }).success).toBe(true);
        owner.zones.slot2.unit = createUnitZoneCard({
            carduid: 'ALLY_OTHER_UNIT_0001',
            cardId: 'ALLY-OTHER-UNIT-0001',
            ap: 2,
            hp: 3
        });
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, opponent.id, {
            carduid: 'GD03-068_enemy_0001',
            playAs: 'unit'
        }).success).toBe(true);

        const damageOtherFriendly = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'test_damage_other_friendly',
                action: 'damage',
                parameters: { value: 1 }
            },
            [{ carduid: 'ALLY_OTHER_UNIT_0001', zone: 'slot2', playerId: owner.id }],
            opponent.id,
            'enemy_effect_source_0005'
        );
        expect(damageOtherFriendly.success).toBe(true);
        const statModifiedAfterOther = (gameEnv.notificationQueue || []).filter((e) => e?.type === 'CARD_STAT_MODIFIED').length;
        expect(statModifiedAfterOther).toBe(0);

        const damagePairedUnit = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'test_damage_paired_unit',
                action: 'damage',
                parameters: { value: 1 }
            },
            [{ carduid: 'GD03-050_unit_0001', zone: 'slot1', playerId: owner.id }],
            opponent.id,
            'enemy_effect_source_0006'
        );
        expect(damagePairedUnit.success).toBe(true);
        const statModifiedAfterPaired = (gameEnv.notificationQueue || []).filter((e) => e?.type === 'CARD_STAT_MODIFIED').length;
        expect(statModifiedAfterPaired).toBeGreaterThan(statModifiedAfterOther);
    });

    test('card data audit: self-worded EFFECT_DAMAGE_RECEIVED rules encode eventTarget=self', () => {
        const gd02010 = gd02.cards['GD02-010'].effects.rules.find((rule) => rule.effectId === 'draw_when_effect_damage_received');
        const gd03060 = gd03.cards['GD03-060'].effects.rules.find((rule) => rule.effectId === 'effect');
        const gd03095 = gd03.cards['GD03-095'].effects.rules.find((rule) => rule.effectId === 'effect');
        const gd03129 = gd03.cards['GD03-129'].effects.rules.find((rule) => rule.effectId === 'during_your_turn_when_friendly_tte_effect_damaged_optional_rest_self_then_mill_1');

        expect(gd02010.conditions).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'eventTarget', value: 'self' })]));
        expect(gd03060.conditions).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'eventTarget', value: 'self' })]));
        expect(gd03095.conditions).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'eventTarget', value: 'self' })]));

        const gd03129ConditionTypes = (gd03129.conditions || []).map((cond) => cond.type);
        expect(gd03129ConditionTypes).toEqual(expect.arrayContaining(['eventTargetController', 'eventTargetTraitsAny']));
        expect(gd03129ConditionTypes).not.toContain('eventTarget');
    });
});
