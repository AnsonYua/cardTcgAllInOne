const { GameEnvironment } = require('../models/GameEnvironment');
const { CardDatabaseManager } = require('../models/CardSystem');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { SequenceTargetChoiceHandler } = require('../services/effects/SequenceTargetChoiceHandler');
const { SequenceContinuationManager } = require('../services/effects/SequenceContinuationManager');
const gd02 = require('../data/gd02Card.json');

function getRedCardId() {
    const cards = Object.values(CardDatabaseManager.getAllCards());
    const match = cards.find((card) => card && card.color === 'Red' && card.cardType !== 'energy');
    if (!match) {
        throw new Error('No red card found for GD02-125 test');
    }
    return match.id;
}

function setupOwnerWithShield(gameEnv, ownerId) {
    const owner = gameEnv.getPlayer(ownerId);
    owner.zones.shieldArea = [
        {
            carduid: 'GD02-001_shield_0001',
            cardId: 'GD02-001',
            cardData: CardDatabaseManager.getCardDetails('GD02-001')
        }
    ];
    return owner;
}

describe('GD02-125 (Gwadan) deploy effect', () => {
    const deployEffect = gd02.cards['GD02-125'].effects.rules.find(
        (rule) => rule.effectId === 'deploy_effect' && rule.trigger === 'ENTERS_PLAY'
    );

    test('on opponent turn, only shield add resolves (no discard/draw)', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_1';
        const owner = setupOwnerWithShield(gameEnv, 'playerId_2');
        const redId = getRedCardId();
        owner.deck._handUids = [`${redId}_hand_0001`, `${redId}_hand_0002`];
        owner.deck.mainDeck = ['GD02-003_draw_0001'];

        const result = SequenceEffectManager.processSequenceEffect(gameEnv, owner.id, 'GD02-125_SRC', deployEffect);

        expect(result.success).toBe(true);
        expect(owner.zones.trashArea).toHaveLength(0);
        expect(owner.deck.mainDeck).toHaveLength(1);
        expect(owner.deck.handUids).toContain('GD02-001_shield_0001');
        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
        expect(choiceEvent).toBeUndefined();
    });

    test('on owner turn with single red card, discard then draw resolves after selection', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_2';
        const owner = setupOwnerWithShield(gameEnv, 'playerId_2');
        const redId = getRedCardId();
        owner.deck._handUids = [`${redId}_hand_0003`];
        owner.deck.mainDeck = ['GD02-004_draw_0001'];

        const result = SequenceEffectManager.processSequenceEffect(gameEnv, owner.id, 'GD02-125_SRC', deployEffect);

        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
        expect(choiceEvent).toBeTruthy();
        const selectedTarget = choiceEvent.data.availableTargets[0];

        const chooseResult = SequenceTargetChoiceHandler.tryHandle(gameEnv, choiceEvent, [selectedTarget]);
        expect(chooseResult.handled).toBe(true);
        expect(chooseResult.success).toBe(true);

        const continuation = gameEnv.processingQueue.find(
            (event) => event.type === 'PLAYER_ACTION' && event.data.actionType === 'continueSequence'
        );
        expect(continuation).toBeTruthy();

        const continueResult = SequenceContinuationManager.continueSequence(gameEnv, continuation);
        expect(continueResult.success).toBe(true);

        expect(owner.zones.trashArea).toHaveLength(1);
        expect(owner.zones.trashArea[0].cardId).toBe(redId);
        expect(owner.deck.mainDeck).toHaveLength(0);
        expect(owner.deck.handUids).toContain('GD02-001_shield_0001');
        expect(owner.deck.handUids).toContain('GD02-004_draw_0001');
    });

    test('on owner turn when optional discard is declined, draw does not resolve', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_2';
        const owner = setupOwnerWithShield(gameEnv, 'playerId_2');
        const redId = getRedCardId();
        owner.deck._handUids = [`${redId}_hand_0004`, `${redId}_hand_0005`];
        owner.deck.mainDeck = ['GD02-005_draw_0001'];

        const result = SequenceEffectManager.processSequenceEffect(gameEnv, owner.id, 'GD02-125_SRC', deployEffect);
        expect(result.success).toBe(true);
        expect(result.requiresSelection).toBe(true);

        const choiceEvent = gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
        expect(choiceEvent).toBeTruthy();

        const declineResult = SequenceTargetChoiceHandler.tryHandle(gameEnv, choiceEvent, []);
        expect(declineResult.handled).toBe(true);
        expect(declineResult.success).toBe(true);

        const continuation = gameEnv.processingQueue.find(
            (event) => event.type === 'PLAYER_ACTION' && event.data.actionType === 'continueSequence'
        );
        expect(continuation).toBeTruthy();

        const continueResult = SequenceContinuationManager.continueSequence(gameEnv, continuation);
        expect(continueResult.success).toBe(true);

        expect(owner.zones.trashArea).toHaveLength(0);
        expect(owner.deck.mainDeck).toHaveLength(1);
        expect(owner.deck.handUids).toContain('GD02-001_shield_0001');
        expect(owner.deck.handUids).toContain(`${redId}_hand_0004`);
        expect(owner.deck.handUids).toContain(`${redId}_hand_0005`);
    });
});
