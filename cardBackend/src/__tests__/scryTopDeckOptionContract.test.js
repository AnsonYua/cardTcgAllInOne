const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');
const { OptionChoiceManager } = require('../services/effects/OptionChoiceManager');
const { PromptChoiceManager } = require('../services/effects/PromptChoiceManager');
const { applyScryTopDeckEffect } = require('../services/effects/actions/EffectScryActions');

describe('scry_top_deck option-choice contract', () => {
    test('interactive top_or_bottom emits OPTION_CHOICE with TOP/BOTTOM actions', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        player.deck.mainDeck = ['GD01-001_top_0001', 'GD01-002_next_0002'];

        const effect = {
            effectId: 'test_scry_top_bottom',
            action: 'scry_top_deck',
            parameters: {
                count: 1,
                keep: 1,
                choice: 'top_or_bottom',
                rest: 'bottom'
            }
        };

        const result = applyScryTopDeckEffect(gameEnv, 'playerId_1', effect, 'GD01-039_source_0001');
        expect(result.success).toBe(true);

        const optionChoiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.OPTION_CHOICE);
        expect(optionChoiceEvent).toBeTruthy();
        expect(optionChoiceEvent.data.effect.action).toBe('scry_top_deck');
        expect(optionChoiceEvent.data.availableOptions[0].payload.action).toBe('TOP');
        expect(optionChoiceEvent.data.availableOptions[1].payload.action).toBe('BOTTOM');
        expect(optionChoiceEvent.data.context.kind).toBe('SCRY_TOP_DECK');
    });

    test('interactive scry resolves through OptionChoiceManager', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        player.deck.mainDeck = ['GD01-001_top_0001', 'GD01-002_next_0002'];

        const effect = {
            effectId: 'test_scry_top_bottom_resolve',
            action: 'scry_top_deck',
            parameters: {
                count: 1,
                keep: 1,
                choice: 'top_or_bottom',
                rest: 'bottom'
            }
        };

        const applyResult = applyScryTopDeckEffect(gameEnv, 'playerId_1', effect, 'GD01-039_source_0001');
        expect(applyResult.success).toBe(true);

        const optionChoiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.OPTION_CHOICE);
        optionChoiceEvent.status = EventStatus.RESOLVING;
        optionChoiceEvent.data.userDecisionMade = true;
        optionChoiceEvent.data.selectedOptionIndex = 1;

        const resolveResult = OptionChoiceManager.executeOptionChoice(optionChoiceEvent, gameEnv);
        expect(resolveResult.success).toBe(true);
        expect(player.deck.mainDeck).toEqual(['GD01-002_next_0002', 'GD01-001_top_0001']);
    });

    test('PromptChoiceManager still resolves legacy scry prompt payloads', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        player.deck.mainDeck = ['GD01-002_next_compat_0002'];

        const legacyPromptEvent = {
            status: EventStatus.RESOLVING,
            playerId: 'playerId_1',
            data: {
                choiceId: 'scry_top_deck_choice',
                selectedOptionIndex: 1,
                context: {
                    kind: 'SCRY_TOP_DECK',
                    sourcePlayerId: 'playerId_1',
                    lookedCarduids: ['GD01-001_top_compat_0001'],
                    choice: 'top_or_bottom',
                    keep: 1,
                    restDestination: 'bottom'
                }
            }
        };

        const result = PromptChoiceManager.executePromptChoice(legacyPromptEvent, gameEnv);
        expect(result.success).toBe(true);
        expect(player.deck.mainDeck).toEqual(['GD01-002_next_compat_0002', 'GD01-001_top_compat_0001']);
    });
});
