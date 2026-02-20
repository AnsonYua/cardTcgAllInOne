const { GameEnvironment } = require('../models/GameEnvironment');
const { TutorTopDeckManager } = require('../services/effects/TutorTopDeckManager');
const { EventType } = require('../models/GameEnums');

describe('TutorTopDeck option choice metadata', () => {
    test('stages reveal-confirm PROMPT_CHOICE first with looked cards and staged options', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');

        player.deck.mainDeck = [
            'GD01-031_e802bddc-f0b8-41ff-adf6-ad6350f3b3a7',
            'GD03-109_01a0d739-d31e-4071-b7fa-878627ff72ad',
            'ST03-010_75206309-0b49-4d09-b49c-6760e16f781f',
        ];

        const effect = {
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

        const result = TutorTopDeckManager.processTutorTopDeckEffect(
            gameEnv,
            'playerId_1',
            'ST03-006_8c5de4d8-58b3-46c4-8507-9445e994d58d',
            effect,
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const promptChoiceEvent = gameEnv.processingQueue.find((e) => e.type === EventType.PROMPT_CHOICE);
        expect(promptChoiceEvent).toBeTruthy();
        expect(promptChoiceEvent.data.choiceId).toBe('tutor_top_deck_reveal_confirm');
        expect(promptChoiceEvent.data.headerText).toBe('Top of Deck');
        expect(promptChoiceEvent.data.context.kind).toBe('TUTOR_TOP_DECK_REVEAL_CONFIRM');
        expect(Array.isArray(promptChoiceEvent.data.context.tutor.lookedCards)).toBe(true);
        expect(promptChoiceEvent.data.context.tutor.lookedCards).toHaveLength(3);
        expect(promptChoiceEvent.data.context.tutor.availableOptions[0].label).toBe('Reveal and add Gelgoog to hand');
        expect(promptChoiceEvent.data.context.tutor.availableOptions[1].display.mode).toBe('text');

        const optionChoiceEvent = gameEnv.processingQueue.find((e) => e.type === EventType.OPTION_CHOICE);
        expect(optionChoiceEvent).toBeFalsy();
    });
});
