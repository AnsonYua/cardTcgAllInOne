const { GameEnvironment } = require('../models/GameEnvironment');
const { SequenceEffectManager } = require('../services/effects/SequenceEffectManager');
const { SequenceTargetChoiceHandler } = require('../services/effects/SequenceTargetChoiceHandler');
const { SequenceContinuationManager } = require('../services/effects/SequenceContinuationManager');
const { EffectExecutor } = require('../services/effects/EffectExecutor');
const gd03 = require('../data/gd03Card.json');

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

describe('GD03-131 returnToHand ownership', () => {
    test('returns selected enemy unit to enemy owner hand (not source player hand)', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentPlayer = 'playerId_1';

        p1.zones.shieldArea = [
            {
                carduid: 'GD03-044_shield_p1_0001',
                cardId: 'GD03-044',
                cardData: {
                    id: 'GD03-044',
                    name: 'Daughtress Flyer',
                    cardType: 'unit',
                    ap: 2,
                    hp: 3,
                    traits: ['New UNE'],
                    level: 3,
                    effects: { rules: [] }
                }
            }
        ];

        // Satisfy the condition: 2+ Triple Ship Alliance units.
        p1.zones.slot1.unit = createUnit('GD03-072_friendly_tsa_0001', 'GD03-072', ['Triple Ship Alliance'], 4);
        p1.zones.slot2.unit = createUnit('GD03-070_friendly_tsa_0002', 'GD03-070', ['Triple Ship Alliance'], 6);

        // Opponent has two valid level<=4 targets so the second sequence step requires player choice.
        p2.zones.slot1.unit = createUnit('GD03-047_enemy_valid_0001', 'GD03-047', ['ZAFT'], 4);
        p2.zones.slot2.unit = createUnit('GD03-048_enemy_valid_0002', 'GD03-048', ['ZAFT'], 3);

        const deployEffect = gd03.cards['GD03-131'].effects.rules.find((rule) => rule.effectId === 'deploy_effect');
        expect(deployEffect).toBeTruthy();

        const firstResult = SequenceEffectManager.processSequenceEffect(
            gameEnv,
            'playerId_1',
            'GD03-131_hand_0001',
            deployEffect
        );
        expect(firstResult.success).toBe(true);
        expect(firstResult.requiresSelection).toBe(true);

        // Choice: pick opponent unit to return.
        const choice = findTargetChoice(gameEnv);
        expect(choice).toBeTruthy();
        expect(choice.data.availableTargets).toHaveLength(2);
        const selectedEnemy = choice.data.availableTargets.find((target) => target.carduid === 'GD03-047_enemy_valid_0001');
        expect(selectedEnemy).toBeTruthy();
        expect(selectedEnemy.playerId).toBe('playerId_2');

        const choiceResult = SequenceTargetChoiceHandler.tryHandle(
            gameEnv,
            choice,
            [selectedEnemy]
        );
        expect(choiceResult.handled).toBe(true);
        expect(choiceResult.success).toBe(true);

        const continueEvent = findContinueSequenceEvent(gameEnv);
        expect(continueEvent).toBeTruthy();
        const continueResult = SequenceContinuationManager.continueSequence(gameEnv, continueEvent);
        expect(continueResult.success).toBe(true);

        // Returned unit should be removed from opponent slot.
        expect(p2.zones.slot1.unit).toBeNull();
        expect(p2.zones.slot2.unit).toBeTruthy();

        // Ownership assertion: enemy card goes to enemy hand.
        expect(p2.deck.handUids).toContain('GD03-047_enemy_valid_0001');
        expect(p1.deck.handUids).not.toContain('GD03-047_enemy_valid_0001');

        // Source player should only get their shield from step 1.
        expect(p1.deck.handUids).toContain('GD03-044_shield_p1_0001');
    });

    test('opponent-scoped returnToHand falls back to actual owner when selected target playerId drifts', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        const p2 = gameEnv.addPlayer('playerId_2', 'P2');

        p2.zones.slot1.unit = createUnit('GD03-047_enemy_valid_0001', 'GD03-047', ['ZAFT'], 4);

        const result = EffectExecutor.applyEffectToTargets(
            gameEnv,
            {
                effectId: 'gd03131_return_guard',
                action: 'returnToHand',
                target: { type: 'unit', scope: 'opponent', count: 1 }
            },
            [
                // Intentionally incorrect playerId; card actually belongs to playerId_2.
                { carduid: 'GD03-047_enemy_valid_0001', zone: 'slot1', playerId: 'playerId_1' }
            ],
            'playerId_1',
            'GD03-131_hand_0001'
        );

        expect(result.success).toBe(true);
        expect(p2.zones.slot1.unit).toBeNull();
        expect(p2.deck.handUids).toContain('GD03-047_enemy_valid_0001');
        expect(p1.deck.handUids).not.toContain('GD03-047_enemy_valid_0001');
    });
});
