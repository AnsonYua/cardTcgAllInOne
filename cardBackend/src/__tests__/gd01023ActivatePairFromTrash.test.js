const { GameEnvironment } = require('../models/GameEnvironment');
const { BaseAbilityManager } = require('../services/effects/BaseAbilityManager');
const { DeployTargetManager } = require('../services/DeployTargetManager');
const { SequenceContinuationManager } = require('../services/effects/SequenceContinuationManager');
const { EventStatus } = require('../services/EventQueue/interfaces/GameEvent');
const gd01 = require('../data/gd01Card.json');

describe('GD01-023 activate effect', () => {
    test('discardFromHand sequence cost resolves and pairs Newtype pilot from trash', () => {
        const gameEnv = new GameEnvironment();
        const p1 = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        gameEnv.currentTurn = 1;
        gameEnv.currentPlayer = 'playerId_1';
        gameEnv.phase = 'MAIN_PHASE';

        const activateEffect = gd01.cards['GD01-023'].effects.rules.find((rule) => rule.effectId === 'activate_effect');
        expect(activateEffect).toBeTruthy();

        p1.zones.slot1.unit = {
            carduid: 'GD01-023_unit_0001',
            cardId: 'GD01-023',
            placedAt: 0,
            placedBy: 'playerId_1',
            isRested: false,
            damageReceived: 0,
            modifyAP: 0,
            modifyHP: 0,
            continueModifyAP: 0,
            continueModifyHP: 0,
            originalAP: 4,
            originalHP: 3,
            playedThisTurn: false,
            canAttackOnPlayTurn: false,
            canAttackThisTurn: true,
            isFirstPlay: false,
            temporaryEffects: [],
            effectUsage: {},
            cardData: {
                ...gd01.cards['GD01-023'],
                effects: {
                    description: gd01.cards['GD01-023'].effects.description,
                    rules: [activateEffect]
                }
            }
        };

        p1.deck._handUids = ['ST03-006_hand_0001', 'GD01-052_hand_0002'];
        p1.deck.handUids = [...p1.deck._handUids];

        p1.zones.trashArea = [
            {
                carduid: 'GD01-087_trash_0001',
                cardId: 'GD01-087',
                placedAt: 0,
                placedBy: 'playerId_1',
                isRested: false,
                isFirstPlay: false,
                cardData: gd01.cards['GD01-087']
            }
        ];

        const startTrashSize = p1.zones.trashArea.length;
        const result = BaseAbilityManager.executeBaseAbility(gameEnv, {
            id: 'player_action_1',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                playerId: 'playerId_1',
                actionType: 'activateCardAbility',
                carduid: 'GD01-023_unit_0001',
                effectId: 'activate_effect'
            }
        });

        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.requiresSelection).toBe(true);

        const costChoice = gameEnv.processingQueue.find((event) => event.type === 'TARGET_CHOICE');
        expect(costChoice).toBeTruthy();
        expect(costChoice.data.effect.action).toBe('discardFromHand');
        expect(costChoice.data.availableTargets).toHaveLength(2);

        costChoice.status = EventStatus.RESOLVING;
        costChoice.data.selectedTargets = [costChoice.data.availableTargets[0]];
        const choiceResult = DeployTargetManager.executeTargetChoice(costChoice, gameEnv);
        expect(choiceResult.success).toBe(true);

        const continuation = gameEnv.processingQueue.find(
            (event) => event.type === 'PLAYER_ACTION' && event.data?.actionType === 'continueSequence'
        );
        expect(continuation).toBeTruthy();

        const continueResult = SequenceContinuationManager.continueSequence(gameEnv, continuation);
        expect(continueResult.success).toBe(true);

        expect(p1.deck._handUids).toHaveLength(1);
        expect(p1.zones.slot1.pilot?.carduid).toBe('GD01-087_trash_0001');
        expect(p1.zones.trashArea).toHaveLength(startTrashSize);
    });
});
