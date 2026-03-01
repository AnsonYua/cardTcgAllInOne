const { GameEnvironment } = require('../models/GameEnvironment');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { DestroyedTriggeredEffectManager } = require('../services/effects/DestroyedTriggeredEffectManager');
const gd02 = require('../data/gd02Card.json');

function createUnit(carduid, cardId, cardData) {
    return {
        carduid,
        cardId,
        cardData,
        originalAP: cardData.ap || 0,
        originalHP: cardData.hp || 0,
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

function createPilot(carduid, cardId, cardData) {
    return {
        carduid,
        cardId,
        cardData,
        originalAP: cardData.ap || 0,
        originalHP: cardData.hp || 0,
        continueModifyAP: 0,
        continueModifyHP: 0,
        effectUsage: {},
        isRested: false
    };
}

describe('GD02-003 destroyed discard-return semantics', () => {
    test('declining optional discard cost does not return the paired pilot', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const owner = gameEnv.addPlayer('playerId_2', 'P2');

        const unitData = gd02.cards['GD02-003'];
        const pilotData = gd02.cards['GD02-086'];
        owner.zones.slot1.unit = createUnit('GD02-003_unit_0001', 'GD02-003', unitData);
        owner.zones.slot1.pilot = createPilot('GD02-086_pilot_0001', 'GD02-086', pilotData);
        owner.deck._handUids = ['GD02-007_discard_cost_0001'];
        owner.deck.handUids = ['GD02-007_discard_cost_0001'];

        const triggerResult = DestroyedTriggeredEffectManager.processDestroyedCard(
            gameEnv,
            'playerId_2',
            owner.zones.slot1.unit
        );
        expect(triggerResult.success).toBe(true);
        expect(triggerResult.requiresSelection).toBe(true);

        const costChoiceEvent = gameEnv.processingQueue.find((evt) => evt.type === 'TARGET_CHOICE');
        expect(costChoiceEvent).toBeTruthy();
        expect(costChoiceEvent.data.effect.action).toBe('discardFromHand');

        costChoiceEvent.status = EventStatus.RESOLVING;
        costChoiceEvent.data.selectedTargets = [];
        const executeResult = DeployTargetManager.executeTargetChoice(costChoiceEvent, gameEnv);
        expect(executeResult.success).toBe(true);

        expect(owner.zones.slot1.pilot?.carduid).toBe('GD02-086_pilot_0001');
        expect(owner.deck.handUids).toContain('GD02-007_discard_cost_0001');
        expect(owner.zones.trashArea).toHaveLength(0);
    });

    test('paying discard cost returns paired pilot to hand', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const owner = gameEnv.addPlayer('playerId_2', 'P2');

        const unitData = gd02.cards['GD02-003'];
        const pilotData = gd02.cards['GD02-086'];
        owner.zones.slot1.unit = createUnit('GD02-003_unit_0001', 'GD02-003', unitData);
        owner.zones.slot1.pilot = createPilot('GD02-086_pilot_0001', 'GD02-086', pilotData);
        owner.deck._handUids = ['GD02-007_discard_cost_0001'];
        owner.deck.handUids = ['GD02-007_discard_cost_0001'];

        const triggerResult = DestroyedTriggeredEffectManager.processDestroyedCard(
            gameEnv,
            'playerId_2',
            owner.zones.slot1.unit
        );
        expect(triggerResult.success).toBe(true);
        expect(triggerResult.requiresSelection).toBe(true);

        const costChoiceEvent = gameEnv.processingQueue.find((evt) => evt.type === 'TARGET_CHOICE');
        expect(costChoiceEvent).toBeTruthy();
        expect(costChoiceEvent.data.effect.action).toBe('discardFromHand');

        costChoiceEvent.status = EventStatus.RESOLVING;
        costChoiceEvent.data.selectedTargets = [costChoiceEvent.data.availableTargets[0]];
        const executeResult = DeployTargetManager.executeTargetChoice(costChoiceEvent, gameEnv);
        expect(executeResult.success).toBe(true);

        expect(owner.zones.slot1.pilot).toBeNull();
        expect(owner.deck.handUids).toContain('GD02-086_pilot_0001');
        expect(owner.deck.handUids).not.toContain('GD02-007_discard_cost_0001');
        expect(owner.zones.trashArea.some((card) => card.carduid === 'GD02-007_discard_cost_0001')).toBe(true);
    });
});
