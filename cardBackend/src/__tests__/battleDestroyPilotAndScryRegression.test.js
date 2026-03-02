const { GameEnvironment } = require('../models/GameEnvironment');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { TriggeredEffectProcessor } = require('../services/effects/TriggeredEffectProcessor');
const { EventConditionEvaluator } = require('../services/conditions/EventConditionEvaluator');
const { PromptChoiceManager } = require('../services/effects/PromptChoiceManager');
const { applyScryTopDeckEffect } = require('../services/effects/actions/EffectScryActions');
const gd03 = require('../data/gd03Card.json');
const gd02 = require('../data/gd02Card.json');

describe('battle destroy pilot self + scry regression', () => {
    test('EventConditionEvaluator resolves eventAttacker:self for pilot source to paired unit', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const unitUid = 'GD03-055_unit_paired_0001';
        const pilotUid = 'GD03-097_pilot_source_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: unitUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: pilotUid,
                playAs: 'pilot',
                targetUnit: unitUid
            }).success
        ).toBe(true);

        gameEnv.notificationQueue.push({
            id: 'battle_resolved_1',
            type: 'BATTLE_RESOLVED',
            payload: {
                attackerCarduid: unitUid,
                targetCarduid: 'GD03-083_enemy_0001'
            }
        });

        const pilotCard = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
            .map((slot) => gameEnv.players.playerId_1.zones[slot]?.pilot)
            .find((card) => card?.carduid === pilotUid);

        expect(EventConditionEvaluator.eventAttackerMatches(gameEnv, pilotCard, { type: 'eventAttacker', value: 'self' })).toBe(true);

        gameEnv.notificationQueue.push({
            id: 'battle_resolved_2',
            type: 'BATTLE_RESOLVED',
            payload: {
                attackerCarduid: 'GD03-083_other_attacker_0001',
                targetCarduid: 'GD03-083_enemy_0001'
            }
        });

        expect(EventConditionEvaluator.eventAttackerMatches(gameEnv, pilotCard, { type: 'eventAttacker', value: 'self' })).toBe(false);
    });

    test('GD03-097 during link battle destroy enqueues scry prompt and honors top_or_trash selection', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';

        const sourceUnitUid = 'GD03-055_unit_source_0001';
        const sourcePilotUid = 'GD03-097_pilot_source_0001';
        const enemyUnitUid = 'GD03-083_enemy_target_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: sourceUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: sourcePilotUid,
                playAs: 'pilot',
                targetUnit: sourceUnitUid
            }).success
        ).toBe(true);
        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: enemyUnitUid, playAs: 'unit' }).success).toBe(true);

        gameEnv.players.playerId_1.deck.mainDeck = [
            'GD01-001_scry_top_0001',
            'GD01-002_scry_top_0002',
            'GD01-003_scry_next_0003'
        ];

        gameEnv.notificationQueue.push({
            id: 'battle_resolved_3',
            type: 'BATTLE_RESOLVED',
            payload: {
                attackerCarduid: sourceUnitUid,
                targetCarduid: enemyUnitUid
            }
        });

        const pilotCard = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
            .map((slot) => gameEnv.players.playerId_1.zones[slot]?.pilot)
            .find((card) => card?.carduid === sourcePilotUid);

        const processResult = TriggeredEffectProcessor.processForSourceCard(gameEnv, 'playerId_1', pilotCard, {
            trigger: 'BATTLE_DESTROY',
            expectedTriggers: ['BATTLE_DESTROY'],
            fallbackEffectId: 'battle_destroy',
            defaultTargetScope: 'self'
        });
        expect(processResult.success).toBe(true);

        const promptEvent = gameEnv.processingQueue.find((event) => event.type === 'PROMPT_CHOICE' && event.data?.choiceId === 'scry_top_deck_choice');
        expect(promptEvent).toBeTruthy();

        promptEvent.status = EventStatus.RESOLVING;
        promptEvent.data.selectedOptionIndex = 1;

        const resolveResult = PromptChoiceManager.executePromptChoice(promptEvent, gameEnv);
        expect(resolveResult.success).toBe(true);

        const mainDeck = gameEnv.players.playerId_1.deck.mainDeck;
        expect(mainDeck[0]).toBe('GD01-002_scry_top_0002');
        expect(mainDeck).toEqual(expect.arrayContaining(['GD01-003_scry_next_0003']));

        const trashUids = (gameEnv.players.playerId_1.zones.trashArea || []).map((card) => card.carduid);
        expect(trashUids).toContain('GD01-001_scry_top_0001');
    });

    test('GD02-093 battle destroy draw resolves with pilot self attacker semantics', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';

        const sourceUnitUid = 'GD02-001_source_unit_0001';
        const sourcePilotUid = 'GD02-093_source_pilot_0001';
        const enemyUnitUid = 'GD03-083_enemy_unit_0001';
        const enemyPilotUid = 'GD02-094_enemy_newtype_pilot_0001';

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', { carduid: sourceUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_1', {
                carduid: sourcePilotUid,
                playAs: 'pilot',
                targetUnit: sourceUnitUid
            }).success
        ).toBe(true);

        expect(PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', { carduid: enemyUnitUid, playAs: 'unit' }).success).toBe(true);
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, 'playerId_2', {
                carduid: enemyPilotUid,
                playAs: 'pilot',
                targetUnit: enemyUnitUid
            }).success
        ).toBe(true);

        gameEnv.players.playerId_1.deck.mainDeck = ['GD01-001_draw_0001'];
        gameEnv.players.playerId_1.deck._handUids = [];

        gameEnv.notificationQueue.push({
            id: 'battle_resolved_4',
            type: 'BATTLE_RESOLVED',
            payload: {
                attackerCarduid: sourceUnitUid,
                targetCarduid: enemyUnitUid,
                result: {
                    targetType: 'unit',
                    attackerDestroyed: false,
                    defenderDestroyed: true
                }
            }
        });

        const pilotCard = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']
            .map((slot) => gameEnv.players.playerId_1.zones[slot]?.pilot)
            .find((card) => card?.carduid === sourcePilotUid);

        const processResult = TriggeredEffectProcessor.processForSourceCard(gameEnv, 'playerId_1', pilotCard, {
            trigger: 'BATTLE_DESTROY',
            expectedTriggers: ['BATTLE_DESTROY'],
            fallbackEffectId: 'battle_destroy',
            defaultTargetScope: 'self'
        });
        expect(processResult.success).toBe(true);

        expect(gameEnv.players.playerId_1.deck.handUids).toContain('GD01-001_draw_0001');
    });

    test('scry_top_deck top_or_bottom allows bottom placement for single-card look', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        gameEnv.players.playerId_1.deck.mainDeck = ['GD01-001_top_0001', 'GD01-002_next_0002'];

        const effect = {
            effectId: 'test_scry_top_bottom',
            action: 'scry_top_deck',
            parameters: {
                count: 1,
                keep: 1,
                choice: 'top_or_bottom'
            }
        };

        const applyResult = applyScryTopDeckEffect(gameEnv, 'playerId_1', effect, 'GD01-039_source_0001');
        expect(applyResult.success).toBe(true);

        const promptEvent = gameEnv.processingQueue.find((event) => event.type === 'PROMPT_CHOICE' && event.data?.choiceId === 'scry_top_deck_choice');
        expect(promptEvent).toBeTruthy();

        promptEvent.status = EventStatus.RESOLVING;
        promptEvent.data.selectedOptionIndex = 1;

        const resolveResult = PromptChoiceManager.executePromptChoice(promptEvent, gameEnv);
        expect(resolveResult.success).toBe(true);

        expect(gameEnv.players.playerId_1.deck.mainDeck).toEqual(['GD01-002_next_0002', 'GD01-001_top_0001']);
    });

    test('scry_top_deck legacy lookCount+choices shape still prompts top/bottom choice', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        gameEnv.players.playerId_1.deck.mainDeck = ['GD01-001_top_legacy_0001', 'GD01-002_next_legacy_0002'];

        const effect = {
            effectId: 'test_scry_legacy_shape',
            action: 'scry_top_deck',
            parameters: {
                lookCount: 1,
                choices: ['top', 'bottom'],
                count: 1
            }
        };

        const applyResult = applyScryTopDeckEffect(gameEnv, 'playerId_1', effect, 'GD01-039_source_legacy_0001');
        expect(applyResult.success).toBe(true);

        const promptEvent = gameEnv.processingQueue.find((event) => event.type === 'PROMPT_CHOICE' && event.data?.choiceId === 'scry_top_deck_choice');
        expect(promptEvent).toBeTruthy();

        promptEvent.status = EventStatus.RESOLVING;
        promptEvent.data.selectedOptionIndex = 1;

        const resolveResult = PromptChoiceManager.executePromptChoice(promptEvent, gameEnv);
        expect(resolveResult.success).toBe(true);

        expect(gameEnv.players.playerId_1.deck.mainDeck).toEqual(['GD01-002_next_legacy_0002', 'GD01-001_top_legacy_0001']);
    });

    test('card data sanity: GD03-097 and GD02-093 rules still present', () => {
        const gd03097 = gd03.cards['GD03-097'].effects.rules.find((rule) => rule.effectId === 'during_link_effect');
        const gd02093 = gd02.cards['GD02-093'].effects.rules.find((rule) => rule.effectId === 'draw_on_battle_destroy_newtype_paired_unit');
        const gd02038 = gd02.cards['GD02-038'].effects.rules.find((rule) => rule.effectId === 'deploy_scry');
        expect(gd03097).toBeTruthy();
        expect(gd02093).toBeTruthy();
        expect(gd02038?.action).toBe('deploy_from_top_deck');
    });
});
