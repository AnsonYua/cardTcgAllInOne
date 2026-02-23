const gd03 = require('../data/gd03Card.json');
const { GameEnvironment } = require('../models/GameEnvironment');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const { EventType } = require('../models/GameEnums');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');

describe('GD03-129 (Hotarubi) split deploy + effect-damage trigger', () => {
    test('card data encodes 3 separate effects with 3 rules', () => {
        const card = gd03.cards['GD03-129'];
        expect(card.effects.description).toHaveLength(3);
        expect(card.effects.rules).toHaveLength(3);

        const burstRule = card.effects.rules.find((rule) => rule.effectId === 'burst_effect');
        const deployRule = card.effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        const triggerRule = card.effects.rules.find((rule) => rule.effectId === 'during_your_turn_when_friendly_tte_effect_damaged_optional_rest_self_then_mill_1');

        expect(burstRule?.trigger).toBe('BURST_CONDITION');
        expect(deployRule?.trigger).toBe('ENTERS_PLAY');
        expect(triggerRule?.trigger).toBe('EFFECT_DAMAGE_RECEIVED');
        expect(triggerRule?.timing?.actionTurn).toBe('YOUR_TURN');
        expect(triggerRule?.action).toBe('sequence');
    });

    test('during your turn: damaged friendly Tekkadan/Teiwaz unit can rest this base and mill 1', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = owner.id;

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
            carduid: 'GD03-129_base_0001',
            playAs: 'base'
        }).success).toBe(true);

        owner.deck.mainDeck = ['GD03-001_deck_0001', 'GD03-002_deck_0002'];
        owner.zones.trashArea = [];

        owner.zones.slot1.unit = createUnitZoneCard({
            carduid: 'friendly_tekkadan_unit_0001',
            cardId: 'ALLY-TEKKADAN-0001',
            ap: 2,
            hp: 2,
            cardDataExtras: { traits: ['Tekkadan'], color: 'Purple', level: 2 }
        });

        const damageResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'test_damage_1',
                action: 'damage',
                parameters: { value: 1 }
            },
            [{ carduid: 'friendly_tekkadan_unit_0001', zone: 'slot1', playerId: owner.id }],
            opponent.id,
            'enemy_effect_source_0001'
        );

        expect(damageResult.success).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeTruthy();
        expect(choiceEvent.data.effect?.effectId).toBe('rest_base');

        choiceEvent.data.selectedTargets = [choiceEvent.data.availableTargets[0]];
        choiceEvent.data.userDecisionMade = true;

        const processResult = gameEnv.processEvents();
        expect(processResult.success).toBe(true);

        expect(owner.zones.base[0].isRested).toBe(true);
        expect(owner.zones.trashArea.length).toBe(1);
        expect(owner.deck.mainDeck.length).toBe(1);
    });

    test('declining optional rest does not mill', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = owner.id;

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
            carduid: 'GD03-129_base_0002',
            playAs: 'base'
        }).success).toBe(true);

        owner.deck.mainDeck = ['GD03-001_deck_0003'];
        owner.zones.trashArea = [];

        owner.zones.slot1.unit = createUnitZoneCard({
            carduid: 'friendly_teiwaz_unit_0001',
            cardId: 'ALLY-TEIWAZ-0001',
            ap: 2,
            hp: 2,
            cardDataExtras: { traits: ['Teiwaz'], color: 'Purple', level: 4 }
        });

        const damageResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'test_damage_2',
                action: 'damage',
                parameters: { value: 1 }
            },
            [{ carduid: 'friendly_teiwaz_unit_0001', zone: 'slot1', playerId: owner.id }],
            opponent.id,
            'enemy_effect_source_0002'
        );

        expect(damageResult.success).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeTruthy();

        choiceEvent.data.selectedTargets = [];
        choiceEvent.data.userDecisionMade = true;

        const processResult = gameEnv.processEvents();
        expect(processResult.success).toBe(true);

        expect(owner.zones.base[0].isRested).toBe(false);
        expect(owner.zones.trashArea.length).toBe(0);
        expect(owner.deck.mainDeck.length).toBe(1);
    });

    test('already rested base does not prompt target choice and does not mill', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = owner.id;

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
            carduid: 'GD03-129_base_0004',
            playAs: 'base'
        }).success).toBe(true);

        owner.zones.base[0].isRested = true;
        owner.deck.mainDeck = ['GD03-001_deck_0005'];
        owner.zones.trashArea = [];

        owner.zones.slot1.unit = createUnitZoneCard({
            carduid: 'friendly_tekkadan_unit_0003',
            cardId: 'ALLY-TEKKADAN-0003',
            ap: 2,
            hp: 2,
            cardDataExtras: { traits: ['Tekkadan'], color: 'Purple', level: 2 }
        });

        const damageResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'test_damage_4',
                action: 'damage',
                parameters: { value: 1 }
            },
            [{ carduid: 'friendly_tekkadan_unit_0003', zone: 'slot1', playerId: owner.id }],
            opponent.id,
            'enemy_effect_source_0004'
        );

        expect(damageResult.success).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeFalsy();

        const processResult = gameEnv.processEvents();
        expect(processResult.success).toBe(true);

        expect(owner.zones.base[0].isRested).toBe(true);
        expect(owner.zones.trashArea.length).toBe(0);
        expect(owner.deck.mainDeck.length).toBe(1);
    });

    test('does not trigger on opponent turn', () => {
        const gameEnv = new GameEnvironment();
        const owner = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = opponent.id;

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, owner.id, {
            carduid: 'GD03-129_base_0003',
            playAs: 'base'
        }).success).toBe(true);

        owner.deck.mainDeck = ['GD03-001_deck_0004'];
        owner.zones.trashArea = [];

        owner.zones.slot1.unit = createUnitZoneCard({
            carduid: 'friendly_tekkadan_unit_0002',
            cardId: 'ALLY-TEKKADAN-0002',
            ap: 2,
            hp: 2,
            cardDataExtras: { traits: ['Tekkadan'], color: 'Purple', level: 2 }
        });

        const damageResult = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'test_damage_3',
                action: 'damage',
                parameters: { value: 1 }
            },
            [{ carduid: 'friendly_tekkadan_unit_0002', zone: 'slot1', playerId: owner.id }],
            opponent.id,
            'enemy_effect_source_0003'
        );

        expect(damageResult.success).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.TARGET_CHOICE);
        expect(choiceEvent).toBeFalsy();
        expect(owner.zones.base[0].isRested).toBe(false);
        expect(owner.zones.trashArea.length).toBe(0);
        expect(owner.deck.mainDeck.length).toBe(1);
    });
});
