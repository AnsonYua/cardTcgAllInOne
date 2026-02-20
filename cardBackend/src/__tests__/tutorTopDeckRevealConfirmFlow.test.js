const { GameEnvironment } = require('../models/GameEnvironment');
const { TutorTopDeckManager } = require('../services/effects/TutorTopDeckManager');
const { PromptChoiceManager } = require('../services/effects/PromptChoiceManager');
const { OptionChoiceManager } = require('../services/effects/OptionChoiceManager');
const { EventType } = require('../models/GameEnums');

function buildTutorEffect() {
    return {
        effectId: 'destroyed_tutor_zeon_unit_from_top_3',
        type: 'triggered',
        trigger: 'DESTROYED',
        action: 'tutor_top_deck',
        parameters: {
            count: 3,
            select: {
                count: 1,
                optional: true,
                toZone: 'hand',
                reveal: true,
                filters: {
                    cardType: 'unit',
                    traitsAny: ['Zeon', 'Neo Zeon'],
                },
            },
            rest: {
                toZone: 'deck_bottom',
                order: 'random',
            },
        },
    };
}

describe('TutorTopDeck reveal confirm flow', () => {
    test('confirming reveal prompt enqueues OPTION_CHOICE with eligible + bottom options', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');

        player.deck.mainDeck = [
            'GD01-031_e802bddc-f0b8-41ff-adf6-ad6350f3b3a7',
            'GD03-109_01a0d739-d31e-4071-b7fa-878627ff72ad',
            'ST03-010_75206309-0b49-4d09-b49c-6760e16f781f',
        ];

        const staged = TutorTopDeckManager.processTutorTopDeckEffect(
            gameEnv,
            'playerId_1',
            'ST03-006_8c5de4d8-58b3-46c4-8507-9445e994d58d',
            buildTutorEffect(),
        );

        expect(staged.success).toBe(true);
        const promptChoiceEvent = gameEnv.processingQueue.find((e) => e.type === EventType.PROMPT_CHOICE);
        expect(promptChoiceEvent).toBeTruthy();

        promptChoiceEvent.status = 'RESOLVING';
        promptChoiceEvent.data.userDecisionMade = true;
        promptChoiceEvent.data.selectedOptionIndex = 0;

        const execResult = PromptChoiceManager.executePromptChoice(promptChoiceEvent, gameEnv);
        expect(execResult.success).toBe(true);

        const optionChoiceEvent = gameEnv.processingQueue.find((e) => e.type === EventType.OPTION_CHOICE);
        expect(optionChoiceEvent).toBeTruthy();
        expect(optionChoiceEvent.data.effect.action).toBe('tutor_top_deck');
        expect(optionChoiceEvent.data.availableOptions).toHaveLength(2);
        expect(optionChoiceEvent.data.availableOptions[0].payload.action).toBe('TAKE');
        expect(optionChoiceEvent.data.availableOptions[1].payload.action).toBe('BOTTOM');
        expect(optionChoiceEvent.data.defaultOptionIndex).toBe(1);
        expect(optionChoiceEvent.data.context.tutor.lookedCarduids).toHaveLength(3);
    });

    test('taking a tutor card emits revealed CARD_ADDED_TO_HAND payload', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');

        player.deck.mainDeck = [
            'GD01-031_e802bddc-f0b8-41ff-adf6-ad6350f3b3a7',
            'GD03-109_01a0d739-d31e-4071-b7fa-878627ff72ad',
            'ST03-010_75206309-0b49-4d09-b49c-6760e16f781f',
        ];

        const staged = TutorTopDeckManager.processTutorTopDeckEffect(
            gameEnv,
            'playerId_1',
            'ST03-006_8c5de4d8-58b3-46c4-8507-9445e994d58d',
            buildTutorEffect(),
        );
        expect(staged.success).toBe(true);

        const promptChoiceEvent = gameEnv.processingQueue.find((e) => e.type === EventType.PROMPT_CHOICE);
        promptChoiceEvent.status = 'RESOLVING';
        promptChoiceEvent.data.userDecisionMade = true;
        promptChoiceEvent.data.selectedOptionIndex = 0;
        const promptResult = PromptChoiceManager.executePromptChoice(promptChoiceEvent, gameEnv);
        expect(promptResult.success).toBe(true);

        const optionChoiceEvent = gameEnv.processingQueue.find((e) => e.type === EventType.OPTION_CHOICE);
        optionChoiceEvent.status = 'RESOLVING';
        optionChoiceEvent.data.userDecisionMade = true;
        optionChoiceEvent.data.selectedOptionIndex = 0;
        const optionResult = OptionChoiceManager.executeOptionChoice(optionChoiceEvent, gameEnv);
        expect(optionResult.success).toBe(true);

        const addToHandEvent = gameEnv.notificationQueue
            .slice()
            .reverse()
            .find((note) => note.type === 'CARD_ADDED_TO_HAND');
        expect(addToHandEvent).toBeTruthy();
        expect(addToHandEvent.payload.reason).toBe('tutor_top_deck');
        expect(addToHandEvent.payload.reveal).toBe(true);
        expect(addToHandEvent.payload.revealToOpponent).toBe(true);
    });
});
