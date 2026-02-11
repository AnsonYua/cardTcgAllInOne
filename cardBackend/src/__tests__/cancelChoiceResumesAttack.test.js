const { GameEnvironment } = require('../models/GameEnvironment');
const { EventType } = require('../models/GameEnums');
const { DeployTargetManager } = require('../services/DeployTargetManager');

describe('cancelChoice optional COST resumes attack', () => {
    test('executeTargetChoice runs context handler on empty selection', () => {
        const gameEnv = new GameEnvironment();

        const event = {
            id: 'target_choice_cost_1',
            type: EventType.TARGET_CHOICE,
            status: 'RESOLVING',
            priority: 0,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                choiceId: 'choice_cost_1',
                userDecisionMade: true,
                sourceCarduid: 'SRC_CARD',
                effect: {
                    effectId: 'attack_effect_cost_moveFromTrashToDeck',
                    type: 'internal',
                    trigger: 'COST',
                    optional: true,
                    action: 'moveFromTrashToDeck',
                    target: { type: 'card', scope: 'self_trash', count: 12, selection: { type: 'player_choice' } },
                    parameters: { shuffle: true }
                },
                availableTargets: [],
                selectedTargets: [],
                context: {
                    kind: 'COST_MOVE_FROM_TRASH_TO_DECK_THEN_EFFECT',
                    attackPlayerId: 'playerId_1',
                    sourceCarduid: 'SRC_CARD',
                    followUpEffect: {
                        effectId: 'attack_effect',
                        type: 'triggered',
                        trigger: 'ATTACK_PHASE',
                        action: 'sequence',
                        parameters: { steps: [] }
                    },
                    attackEventData: {
                        gameId: 'game1',
                        attackerCarduid: 'SRC_CARD',
                        targetType: 'shield',
                        targetPlayerId: 'playerId_2'
                    },
                    attackActionType: 'attackShieldArea',
                    attackEffectUsageId: 'attack_effect',
                    cardPlayNotificationId: 'attack_notif_1'
                }
            }
        };

        const result = DeployTargetManager.executeTargetChoice(event, gameEnv);
        expect(result.success).toBe(true);

        const resumeEvent = gameEnv.processingQueue.find((e) => e.type === EventType.PLAYER_ACTION);
        expect(resumeEvent).toBeTruthy();
        expect(resumeEvent.data.skipAttackDeclaration).toBe(true);
        expect(resumeEvent.data.skipAttackPhaseEffects).toBe(true);
        expect(resumeEvent.data.resumeAfterChoiceEventId).toBe('target_choice_cost_1');
    });
});

