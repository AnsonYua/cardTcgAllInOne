const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');
const { PromptChoiceManager } = require('../services/effects/PromptChoiceManager');
const { OptionChoiceManager } = require('../services/effects/OptionChoiceManager');
const { PlayerCardManager } = require('../services/PlayerCardManager');
const { TopDeckSelectionManager } = require('../services/effects/TopDeckSelectionManager');
const gd01 = require('../data/gd01Card.json');
const gd02 = require('../data/gd02Card.json');

function buildEnv() {
    const gameEnv = new GameEnvironment();
    gameEnv.addPlayer('playerId_1', 'P1');
    gameEnv.addPlayer('playerId_2', 'P2');
    return gameEnv;
}

function resolvePromptChoice(gameEnv, event) {
    event.status = EventStatus.RESOLVING;
    event.data.userDecisionMade = true;
    event.data.selectedOptionIndex = 0;
    return PromptChoiceManager.executePromptChoice(event, gameEnv);
}

function resolveOptionChoice(gameEnv, event, selectedOptionIndex) {
    event.status = EventStatus.RESOLVING;
    event.data.userDecisionMade = true;
    event.data.selectedOptionIndex = selectedOptionIndex;
    return OptionChoiceManager.executeOptionChoice(event, gameEnv);
}

function getLatestNotification(gameEnv, type) {
    return (gameEnv.notificationQueue || [])
        .slice()
        .reverse()
        .find((note) => note.type === type);
}

function fillBoard(gameEnv, playerId) {
    for (let i = 0; i < 6; i += 1) {
        const carduid = `GD02-040_full_board_${String(i + 1).padStart(4, '0')}`;
        expect(
            PlayerCardManager.placeCardWithEventData(gameEnv, playerId, {
                carduid,
                playAs: 'unit',
            }).success
        ).toBe(true);
    }
}

describe('select_from_top_deck play review flow', () => {
    test('GD02-038 emits TOP_DECK_VIEWED with eligibility and queues review prompt first', () => {
        const gameEnv = buildEnv();
        const player = gameEnv.players.playerId_1;
        const effect = gd02.cards['GD02-038'].effects.rules.find((rule) => rule.effectId === 'deploy_scry');

        player.deck.mainDeck = [
            'GD02-041_top_0001',
            'GD02-040_top_0002',
            'GD02-043_top_0003',
            'GD02-039_next_0004',
        ];

        const result = TopDeckSelectionManager.processEffect(
            gameEnv,
            'playerId_1',
            'GD02-038_src_0001',
            effect,
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const viewed = getLatestNotification(gameEnv, 'TOP_DECK_VIEWED');
        expect(viewed).toBeTruthy();
        expect(viewed.payload.cards).toHaveLength(3);
        expect(viewed.payload.cards.map((card) => card.cardId)).toEqual(['GD02-041', 'GD02-040', 'GD02-043']);
        expect(viewed.payload.cards.map((card) => card.matchesFilters)).toEqual([true, false, false]);

        const promptEvent = gameEnv.processingQueue.find((event) => event.type === EventType.PROMPT_CHOICE);
        expect(promptEvent).toBeTruthy();
        expect(promptEvent.data.choiceId).toBe('top_deck_selection_review_confirm');
        expect(promptEvent.data.context.kind).toBe('TOP_DECK_SELECTION_REVIEW_CONFIRM');
        expect(promptEvent.data.context.topDeckSelection.lookedCards).toHaveLength(3);

        const optionEvent = gameEnv.processingQueue.find((event) => event.type === EventType.OPTION_CHOICE);
        expect(optionEvent).toBeFalsy();
    });

    test('review confirm enqueues step 2 option choice with eligible card and bottom option', () => {
        const gameEnv = buildEnv();
        const player = gameEnv.players.playerId_1;
        const effect = gd02.cards['GD02-038'].effects.rules.find((rule) => rule.effectId === 'deploy_scry');

        player.deck.mainDeck = [
            'GD02-041_top_0001',
            'GD02-040_top_0002',
            'GD02-043_top_0003',
        ];

        const staged = TopDeckSelectionManager.processEffect(
            gameEnv,
            'playerId_1',
            'GD02-038_src_0001',
            effect,
        );
        expect(staged.success).toBe(true);

        const promptEvent = gameEnv.processingQueue.find((event) => event.type === EventType.PROMPT_CHOICE);
        const promptResult = resolvePromptChoice(gameEnv, promptEvent);
        expect(promptResult.success).toBe(true);

        const optionEvent = gameEnv.processingQueue.find((event) => event.type === EventType.OPTION_CHOICE);
        expect(optionEvent).toBeTruthy();
        expect(optionEvent.data.headerText).toBe('Deploy From Top Deck');
        expect(optionEvent.data.defaultOptionIndex).toBe(1);
        expect(optionEvent.data.availableOptions).toHaveLength(2);
        expect(optionEvent.data.availableOptions[0].payload.action).toBe('DEPLOY');
        expect(optionEvent.data.availableOptions[0].payload.cardId).toBe('GD02-041');
        expect(optionEvent.data.availableOptions[1].payload.action).toBe('BOTTOM');
        expect(optionEvent.data.context.topDeckSelection.lookedCarduids).toEqual([
            'GD02-041_top_0001',
            'GD02-040_top_0002',
            'GD02-043_top_0003',
        ]);
    });

    test('choosing bottom after review moves looked cards to deck bottom and resolves', () => {
        const gameEnv = buildEnv();
        const player = gameEnv.players.playerId_1;
        const effect = gd02.cards['GD02-038'].effects.rules.find((rule) => rule.effectId === 'deploy_scry');

        player.deck.mainDeck = [
            'GD02-041_top_0001',
            'GD02-040_top_0002',
            'GD02-043_top_0003',
            'GD02-039_next_0004',
        ];

        TopDeckSelectionManager.processEffect(gameEnv, 'playerId_1', 'GD02-038_src_0001', effect);
        const promptEvent = gameEnv.processingQueue.find((event) => event.type === EventType.PROMPT_CHOICE);
        expect(resolvePromptChoice(gameEnv, promptEvent).success).toBe(true);

        const optionEvent = gameEnv.processingQueue.find((event) => event.type === EventType.OPTION_CHOICE);
        expect(resolveOptionChoice(gameEnv, optionEvent, 1).success).toBe(true);

        expect(player.deck.mainDeck[0]).toBe('GD02-039_next_0004');
        expect(player.deck.mainDeck).toEqual(expect.arrayContaining([
            'GD02-041_top_0001',
            'GD02-040_top_0002',
            'GD02-043_top_0003',
        ]));

        const bottomNote = getLatestNotification(gameEnv, 'CARDS_MOVED_TO_DECK_BOTTOM');
        expect(bottomNote).toBeTruthy();
        expect(bottomNote.payload.reason).toBe('select_from_top_deck_choice_bottom');

        const resolved = getLatestNotification(gameEnv, 'DEPLOY_FROM_TOP_DECK_RESOLVED');
        expect(resolved).toBeTruthy();
        expect(resolved.payload.result).toBe('MOVED_TO_BOTTOM');
    });

    test('choosing deploy after review deploys the selected card and bottoms the rest', () => {
        const gameEnv = buildEnv();
        const player = gameEnv.players.playerId_1;
        const effect = gd02.cards['GD02-038'].effects.rules.find((rule) => rule.effectId === 'deploy_scry');

        player.deck.mainDeck = [
            'GD02-041_top_0001',
            'GD02-040_top_0002',
            'GD02-043_top_0003',
            'GD02-039_next_0004',
        ];

        TopDeckSelectionManager.processEffect(gameEnv, 'playerId_1', 'GD02-038_src_0001', effect);
        const promptEvent = gameEnv.processingQueue.find((event) => event.type === EventType.PROMPT_CHOICE);
        expect(resolvePromptChoice(gameEnv, promptEvent).success).toBe(true);

        const optionEvent = gameEnv.processingQueue.find((event) => event.type === EventType.OPTION_CHOICE);
        expect(resolveOptionChoice(gameEnv, optionEvent, 0).success).toBe(true);

        expect(player.zones.slot1.unit?.carduid).toBe('GD02-041_top_0001');
        expect(player.deck.mainDeck[0]).toBe('GD02-039_next_0004');
        expect(player.deck.mainDeck).toEqual(expect.arrayContaining([
            'GD02-040_top_0002',
            'GD02-043_top_0003',
        ]));

        const resolved = getLatestNotification(gameEnv, 'DEPLOY_FROM_TOP_DECK_RESOLVED');
        expect(resolved).toBeTruthy();
        expect(resolved.payload.result).toBe('DEPLOYED');
        expect(resolved.payload.deployedCarduid).toBe('GD02-041_top_0001');
    });

    test('no eligible looked cards still emits TOP_DECK_VIEWED and auto-bottoms', () => {
        const gameEnv = buildEnv();
        const player = gameEnv.players.playerId_1;
        const effect = gd02.cards['GD02-038'].effects.rules.find((rule) => rule.effectId === 'deploy_scry');

        player.deck.mainDeck = [
            'GD02-040_top_0001',
            'GD02-043_top_0002',
            'GD02-039_top_0003',
            'GD02-041_next_0004',
        ];

        const result = TopDeckSelectionManager.processEffect(
            gameEnv,
            'playerId_1',
            'GD02-038_src_0001',
            effect,
        );

        expect(result.success).toBe(true);
        expect(result.autoApplied).toBe(true);
        expect(getLatestNotification(gameEnv, 'TOP_DECK_VIEWED')).toBeTruthy();
        expect(gameEnv.processingQueue.find((event) => event.type === EventType.PROMPT_CHOICE)).toBeFalsy();

        const resolved = getLatestNotification(gameEnv, 'DEPLOY_FROM_TOP_DECK_RESOLVED');
        expect(resolved.payload.result).toBe('NO_MATCH_MOVED_TO_BOTTOM');
        expect(player.deck.mainDeck[0]).toBe('GD02-041_next_0004');
    });

    test('no empty slot still emits TOP_DECK_VIEWED and auto-bottoms', () => {
        const gameEnv = buildEnv();
        const player = gameEnv.players.playerId_1;
        const effect = gd02.cards['GD02-038'].effects.rules.find((rule) => rule.effectId === 'deploy_scry');

        fillBoard(gameEnv, 'playerId_1');
        player.deck.mainDeck = [
            'GD02-041_top_0001',
            'GD02-040_top_0002',
            'GD02-043_top_0003',
            'GD02-039_next_0004',
        ];

        const result = TopDeckSelectionManager.processEffect(
            gameEnv,
            'playerId_1',
            'GD02-038_src_0001',
            effect,
        );

        expect(result.success).toBe(true);
        expect(result.autoApplied).toBe(true);
        expect(getLatestNotification(gameEnv, 'TOP_DECK_VIEWED')).toBeTruthy();
        expect(gameEnv.processingQueue.find((event) => event.type === EventType.PROMPT_CHOICE)).toBeFalsy();

        const resolved = getLatestNotification(gameEnv, 'DEPLOY_FROM_TOP_DECK_RESOLVED');
        expect(resolved.payload.result).toBe('NO_EMPTY_SLOT_MOVED_TO_BOTTOM');
        expect(player.deck.mainDeck[0]).toBe('GD02-039_next_0004');
    });

    test('GD01 deploy-from-top-deck card also uses review prompt flow', () => {
        const gameEnv = buildEnv();
        const player = gameEnv.players.playerId_1;
        const effect = gd01.cards['GD01-045'].effects.rules.find((rule) => rule.action === 'select_from_top_deck');

        player.deck.mainDeck = [
            'GD01-046_top_0001',
            'GD01-049_top_0002',
            'GD02-040_top_0003',
        ];

        const result = TopDeckSelectionManager.processEffect(
            gameEnv,
            'playerId_1',
            'GD01-045_src_0001',
            effect,
        );

        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const promptEvent = gameEnv.processingQueue.find((event) => event.type === EventType.PROMPT_CHOICE);
        expect(promptEvent).toBeTruthy();
        expect(promptEvent.data.context.kind).toBe('TOP_DECK_SELECTION_REVIEW_CONFIRM');
        expect(getLatestNotification(gameEnv, 'TOP_DECK_VIEWED')).toBeTruthy();
    });
});
