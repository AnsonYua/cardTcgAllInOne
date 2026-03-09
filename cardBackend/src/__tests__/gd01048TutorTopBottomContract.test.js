const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { TopDeckSelectionManager } = require('../services/effects/TopDeckSelectionManager');
const { OptionChoiceManager } = require('../services/effects/OptionChoiceManager');

function buildGd01048TutorEffect() {
    return {
        effectId: 'deploy_effect',
        type: 'play',
        trigger: 'ENTERS_PLAY',
        action: 'select_from_top_deck',
        parameters: {
            lookCount: 1,
            select: {
                count: 1,
                optional: true,
                toZone: 'hand',
                reveal: true,
            },
            rest: {
                toZone: 'deck_bottom',
                order: 'preserve',
            },
        },
    };
}

describe('GD01-048 top deck selection take/bottom contract', () => {
    test('emits direct OPTION_CHOICE contract with TAKE/BOTTOM actions', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        player.deck.mainDeck = ['GD01-023_top_0001', 'GD01-022_next_0002'];

        const result = TopDeckSelectionManager.processEffect(
            gameEnv,
            'playerId_1',
            'GD01-048_source_0001',
            buildGd01048TutorEffect(),
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const optionChoiceEvent = gameEnv.processingQueue.find((e) => e.type === EventType.OPTION_CHOICE);
        expect(optionChoiceEvent).toBeTruthy();
        expect(optionChoiceEvent.data.headerText).toBe('Top of Deck');
        expect(optionChoiceEvent.data.defaultOptionIndex).toBe(1);
        expect(optionChoiceEvent.data.availableOptions[0].payload.action).toBe('TAKE');
        expect(optionChoiceEvent.data.availableOptions[1].payload.action).toBe('BOTTOM');
        expect(optionChoiceEvent.data.availableOptions[0].label).toBe('Add to hand');
        expect(optionChoiceEvent.data.availableOptions[1].label).toBe('Bottom');
        expect(optionChoiceEvent.data.availableOptions[0].display.mode).toBe('card');
        expect(optionChoiceEvent.data.availableOptions[0].display.cardId).toBe('GD01-023');
        expect(optionChoiceEvent.data.availableOptions[0].display.label).toBe('Add to hand');
        expect(optionChoiceEvent.data.availableOptions[1].display.mode).toBe('text');
        expect(optionChoiceEvent.data.context.topDeckSelection.lookedCarduids).toEqual(['GD01-023_top_0001']);
    });

    test('resolves TAKE and BOTTOM explicitly for GD01-048 option choice', () => {
        const gameEnvTake = new GameEnvironment();
        const takePlayer = gameEnvTake.addPlayer('playerId_1', 'P1');
        takePlayer.deck.mainDeck = ['GD01-023_top_0001', 'GD01-022_next_0002'];

        TopDeckSelectionManager.processEffect(
            gameEnvTake,
            'playerId_1',
            'GD01-048_source_take_0001',
            buildGd01048TutorEffect(),
        );
        const takeEvent = gameEnvTake.processingQueue.find((e) => e.type === EventType.OPTION_CHOICE);
        takeEvent.status = 'RESOLVING';
        takeEvent.data.userDecisionMade = true;
        takeEvent.data.selectedOptionIndex = 0;

        const takeResult = OptionChoiceManager.executeOptionChoice(takeEvent, gameEnvTake);
        expect(takeResult.success).toBe(true);
        expect(takePlayer.deck.mainDeck).toEqual(['GD01-022_next_0002']);
        const takenCard = takePlayer.deck.hand.find((card) => card.carduid === 'GD01-023_top_0001');
        expect(takenCard).toBeTruthy();

        const gameEnvBottom = new GameEnvironment();
        const bottomPlayer = gameEnvBottom.addPlayer('playerId_1', 'P1');
        bottomPlayer.deck.mainDeck = ['GD01-023_top_0001', 'GD01-022_next_0002'];

        TopDeckSelectionManager.processEffect(
            gameEnvBottom,
            'playerId_1',
            'GD01-048_source_bottom_0001',
            buildGd01048TutorEffect(),
        );
        const bottomEvent = gameEnvBottom.processingQueue.find((e) => e.type === EventType.OPTION_CHOICE);
        bottomEvent.status = 'RESOLVING';
        bottomEvent.data.userDecisionMade = true;
        bottomEvent.data.selectedOptionIndex = 1;

        const bottomResult = OptionChoiceManager.executeOptionChoice(bottomEvent, gameEnvBottom);
        expect(bottomResult.success).toBe(true);
        expect(bottomPlayer.deck.mainDeck).toEqual(['GD01-022_next_0002', 'GD01-023_top_0001']);
    });
});
