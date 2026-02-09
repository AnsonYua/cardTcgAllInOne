const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployEffectManager } = require('../services/DeployEffectManager');
const { DeployEffectOrderManager } = require('../services/effects/DeployEffectOrderManager');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { EventType } = require('../models/GameEnums');

describe('Deploy effect order choice', () => {
    test('DEPLOY_EFFECT_TRIGGERED with multiple effects schedules an OPTION_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const deployEvent = {
            id: 'deploy_test_1',
            type: EventType.DEPLOY_EFFECT_TRIGGERED,
            status: 'RESOLVING',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                carduid: 'some_unit_1',
                effects: [
                    {
                        effectId: 'deploy_draw_1',
                        type: 'triggered',
                        trigger: 'ENTERS_PLAY',
                        action: 'draw',
                        target: { type: 'player', scope: 'self', count: 1 },
                        parameters: { value: 1 }
                    },
                    {
                        effectId: 'deploy_draw_2',
                        type: 'triggered',
                        trigger: 'ENTERS_PLAY',
                        action: 'draw',
                        target: { type: 'player', scope: 'self', count: 1 },
                        parameters: { value: 1 }
                    }
                ]
            }
        };

        const result = DeployEffectManager.executeDeployEffect(deployEvent, gameEnv);
        expect(result.success).toBe(true);

        const optionChoiceEvent = gameEnv.processingQueue.find(e => e.type === EventType.OPTION_CHOICE);
        expect(optionChoiceEvent).toBeTruthy();
        expect(optionChoiceEvent.data.effect.action).toBe('deploy_effect_order');
        expect(optionChoiceEvent.data.availableOptions).toHaveLength(2);
    });

    test('deploy_effect_order OPTION_CHOICE enqueues a single-effect deploy event + remainingEffects', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const effects = [
            {
                effectId: 'deploy_draw_1',
                type: 'triggered',
                trigger: 'ENTERS_PLAY',
                action: 'draw',
                target: { type: 'player', scope: 'self', count: 1 },
                parameters: { value: 1 }
            },
            {
                effectId: 'deploy_draw_2',
                type: 'triggered',
                trigger: 'ENTERS_PLAY',
                action: 'draw',
                target: { type: 'player', scope: 'self', count: 1 },
                parameters: { value: 1 }
            }
        ];

        const optionChoice = EventFactory.createOptionChoiceEvent({
            playerId: 'playerId_1',
            sourceCarduid: 'some_unit_1',
            effect: { effectId: 'deploy_effect_order', type: 'internal', trigger: 'CHOICE', action: 'deploy_effect_order' },
            availableOptions: [
                { index: 0, label: 'deploy_draw_1' },
                { index: 1, label: 'deploy_draw_2' }
            ],
            context: { kind: 'DEPLOY_EFFECT_ORDER', deployCarduid: 'some_unit_1', effects }
        });

        optionChoice.status = 'RESOLVING';
        optionChoice.data.userDecisionMade = true;
        optionChoice.data.selectedOptionIndex = 0;

        const execResult = DeployEffectOrderManager.executeOptionChoice(optionChoice, gameEnv);
        expect(execResult.success).toBe(true);

        const queuedDeploy = gameEnv.processingQueue.find(e => e.type === EventType.DEPLOY_EFFECT_TRIGGERED);
        expect(queuedDeploy).toBeTruthy();
        expect(queuedDeploy.data.effects).toHaveLength(1);
        expect(queuedDeploy.data.effects[0].effectId).toBe('deploy_draw_1');
        expect(queuedDeploy.data.remainingEffects).toHaveLength(1);
        expect(queuedDeploy.data.remainingEffects[0].effectId).toBe('deploy_draw_2');
    });
});

