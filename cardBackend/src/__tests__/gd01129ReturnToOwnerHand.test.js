const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { SequenceTargetChoiceHandler } = require('../services/effects/SequenceTargetChoiceHandler');
const { SequenceContinuationManager } = require('../services/effects/SequenceContinuationManager');
const gd01 = require('../data/gd01Card.json');

function createUnit(carduid, cardId, traits = [], level = 4, ap = 3, hp = 4) {
    return {
        carduid,
        cardId,
        cardData: {
            id: cardId,
            name: cardId,
            cardType: 'unit',
            ap,
            hp,
            traits,
            level,
            effects: { rules: [] }
        },
        originalAP: ap,
        originalHP: hp,
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

function findTargetChoice(gameEnv) {
    return gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
}

function findContinueSequenceEvent(gameEnv) {
    return gameEnv.processingQueue.find(
        (event) => event.type === 'PLAYER_ACTION' && event.data && event.data.actionType === 'continueSequence'
    );
}

describe('GD01-129 returnToHand ownership', () => {
    test('returns selected enemy unit to enemy owner hand', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.currentPlayer = 'playerId_1';

        p1.zones.shieldArea = [
            {
                carduid: 'GD01-044_shield_p1_0001',
                cardId: 'GD01-044',
                cardData: {
                    id: 'GD01-044',
                    name: 'Test Shield',
                    cardType: 'unit',
                    ap: 1,
                    hp: 2,
                    traits: ['Academy'],
                    level: 2,
                    effects: { rules: [] }
                }
            }
        ];

        p2.zones.slot1.unit = createUnit('GD01-ENEMY-0001', 'GD01-001', ['Any'], 4, 3, 3);
        p2.zones.slot2.unit = createUnit('GD01-ENEMY-0002', 'GD01-002', ['Any'], 3, 2, 3);

        const deployEffect = gd01.cards['GD01-129'].effects.rules.find(
            (rule) => rule.effectId === 'deploy_shield_to_hand_then_bounce_enemy_hp_le_3'
        );
        expect(deployEffect).toBeTruthy();

        const firstResult = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            'playerId_1',
            'GD01-129_hand_0001',
            deployEffect
        );
        expect(firstResult.success).toBe(true);
        expect(firstResult.requiresSelection).toBe(true);

        const choice = findTargetChoice(gameEnv);
        expect(choice).toBeTruthy();
        expect(choice.data.availableTargets).toHaveLength(2);

        const selectedEnemy = choice.data.availableTargets.find((target) => target.carduid === 'GD01-ENEMY-0001');
        expect(selectedEnemy).toBeTruthy();
        expect(selectedEnemy.playerId).toBe('playerId_2');

        const choiceResult = SequenceTargetChoiceHandler.tryHandle(gameEnv, choice, [selectedEnemy]);
        expect(choiceResult.handled).toBe(true);
        expect(choiceResult.success).toBe(true);

        const continueEvent = findContinueSequenceEvent(gameEnv);
        expect(continueEvent).toBeTruthy();
        const continueResult = SequenceContinuationManager.continueSequence(gameEnv, continueEvent);
        expect(continueResult.success).toBe(true);

        expect(p2.zones.slot1.unit).toBeNull();
        expect(p2.deck.handUids).toContain('GD01-ENEMY-0001');
        expect(p1.deck.handUids || []).not.toContain('GD01-ENEMY-0001');
        expect(p1.deck.handUids).toContain('GD01-044_shield_p1_0001');
    });
});
