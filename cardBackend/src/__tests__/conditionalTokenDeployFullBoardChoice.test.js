const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');

function createUnit(carduid, cardId = 'ST03-008') {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            color: 'Green',
            level: 2,
            ap: 1,
            hp: 2,
            effects: { rules: [] }
        },
        originalAP: 1,
        originalHP: 2,
        continueModifyAP: 0,
        continueModifyHP: 0,
        damageReceived: 0,
        effectUsage: {},
        isRested: false
    };
}

function createPilot(carduid, cardId = 'ST01-010') {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'pilot',
            color: 'Blue',
            level: 4,
            ap: 2,
            hp: 1,
            effects: { rules: [] }
        },
        originalAP: 2,
        originalHP: 1,
        continueModifyAP: 0,
        continueModifyHP: 0,
        effectUsage: {},
        isRested: false
    };
}

function fillBoard(player) {
    ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'].forEach((slotName, idx) => {
        player.zones[slotName].unit = createUnit(`FULL_UNIT_${idx + 1}`);
    });
}

describe('conditionalTokenDeploy full-board replacement flow', () => {
    test('creates target choice when board is full and deploys token after clearing selected slot', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('p1', 'P1');
        gameEnv.addPlayer('p2', 'P2');
        fillBoard(player);
        player.zones.slot1.pilot = createPilot('FULL_PILOT_1');

        const effect = {
            effectId: 'play_effect',
            type: 'internal',
            trigger: 'SEQUENCE_STEP',
            action: 'conditionalTokenDeploy',
            parameters: {
                condition1: {
                    token: { cardId: 'T-019' },
                    count: 1,
                    rested: true
                }
            }
        };

        const processResult = DeployTargetManager.processEffectWithTargetChoice(
            gameEnv,
            'p1',
            'GD03-106_test_source',
            effect
        );
        expect(processResult.success).toBe(true);
        expect(processResult.requiresSelection).toBe(true);
        expect(typeof processResult.choiceEventId).toBe('string');

        const choiceEvent = gameEnv.processingQueue.find((evt) => evt.id === processResult.choiceEventId);
        expect(choiceEvent).toBeTruthy();
        expect(choiceEvent.data.effect.action).toBe('conditionalTokenDeploy');
        expect(choiceEvent.data.effect.target.count).toBe(1);
        expect(choiceEvent.data.availableTargets.length).toBe(6);

        choiceEvent.status = EventStatus.RESOLVING;
        choiceEvent.data.selectedTargets = [
            {
                carduid: 'FULL_UNIT_1',
                zone: 'slot1',
                playerId: 'p1'
            }
        ];

        const resolveResult = DeployTargetManager.executeTargetChoice(choiceEvent, gameEnv);
        expect(resolveResult.success).toBe(true);

        expect(player.zones.slot1.unit.cardId).toBe('T-019');
        expect(player.zones.slot1.unit.isRested).toBe(true);
        expect(player.zones.slot1.pilot).toBeNull();
        expect(player.zones.trashArea.map((card) => card.carduid)).toEqual(
            expect.arrayContaining(['FULL_UNIT_1', 'FULL_PILOT_1'])
        );
    });
});
