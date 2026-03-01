const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');

function createUnit(carduid, cardId) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            ap: 3,
            hp: 3,
            effects: { rules: [] }
        },
        originalAP: 3,
        originalHP: 3,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        effectUsage: {},
        isRested: false,
        playedThisTurn: false,
        canAttackOnPlayTurn: false,
        canAttackThisTurn: true
    };
}

describe('discardFromHand cost flow', () => {
    test('requires cost selection and resolves follow-up effect after paying cost', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        player.deck.mainDeck = ['GD01-001_draw_card_0001'];
        player.deck._handUids = ['GD01-002_cost_card_0001', 'GD01-003_cost_card_0001'];
        player.deck.handUids = ['GD01-002_cost_card_0001', 'GD01-003_cost_card_0001'];

        const effect = {
            effectId: 'discard_cost_then_draw',
            type: 'play',
            timing: { windows: ['MAIN_PHASE'] },
            action: 'draw',
            cost: {
                discardFromHand: 1
            },
            parameters: {
                value: 1
            }
        };

        const startHandSize = player.deck._handUids.length;
        const startTrashSize = player.zones.trashArea.length;

        const processResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'GD01-001_source_unit_0001',
            effect
        );

        expect(processResult.success).toBe(true);
        expect(processResult.requiresSelection).toBe(true);
        expect(processResult.choiceEventId).toBeTruthy();

        const choiceEvent = gameEnv.processingQueue.find((evt) => evt.id === processResult.choiceEventId);
        expect(choiceEvent).toBeTruthy();
        choiceEvent.status = EventStatus.RESOLVING;
        choiceEvent.data.selectedTargets = [choiceEvent.data.availableTargets[0]];

        const executeResult = DeployTargetManager.executeTargetChoice(choiceEvent, gameEnv);
        expect(executeResult.success).toBe(true);

        expect(player.zones.trashArea.length).toBe(startTrashSize + 1);
        expect(player.deck._handUids.length).toBe(startHandSize);
    });

    test('marks post-cost follow-up as non-optional once discard cost is paid', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        const opponent = gameEnv.addPlayer('playerId_2', 'P2');

        player.deck._handUids = ['GD01-002_cost_card_0001', 'GD01-003_cost_card_0001'];
        player.deck.handUids = ['GD01-002_cost_card_0001', 'GD01-003_cost_card_0001'];
        opponent.zones.slot1.unit = createUnit('OPP_UNIT_0001', 'GD01-001');
        opponent.zones.slot2.unit = createUnit('OPP_UNIT_0002', 'GD01-002');

        const effect = {
            effectId: 'discard_cost_then_destroy_target',
            type: 'triggered',
            trigger: 'DESTROYED',
            optional: true,
            action: 'destroy',
            cost: {
                discardFromHand: 1
            },
            target: {
                type: 'unit',
                scope: 'opponent',
                count: 1
            }
        };

        const processResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'playerId_1',
            'SRC_UNIT_0001',
            effect
        );

        expect(processResult.success).toBe(true);
        expect(processResult.requiresSelection).toBe(true);
        expect(processResult.choiceEventId).toBeTruthy();

        const costChoiceEvent = gameEnv.processingQueue.find((evt) => evt.id === processResult.choiceEventId);
        expect(costChoiceEvent).toBeTruthy();
        costChoiceEvent.status = EventStatus.RESOLVING;
        costChoiceEvent.data.selectedTargets = [costChoiceEvent.data.availableTargets[0]];

        const executeResult = DeployTargetManager.executeTargetChoice(costChoiceEvent, gameEnv);
        expect(executeResult.success).toBe(true);

        const followUpChoiceEvent = gameEnv.processingQueue.find(
            (evt) => evt.type === 'TARGET_CHOICE' && evt.id !== costChoiceEvent.id
        );
        expect(followUpChoiceEvent).toBeTruthy();
        expect(followUpChoiceEvent.data.effect.optional).toBe(false);
    });
});
