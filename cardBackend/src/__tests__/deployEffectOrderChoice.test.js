const { GameEnvironment } = require('../models/GameEnvironment');
const { DeployEffectManager } = require('../services/DeployEffectManager');
const { DeployEffectOrderManager } = require('../services/effects/DeployEffectOrderManager');
const { PromptChoiceManager } = require('../services/effects/PromptChoiceManager');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { EventType } = require('../models/GameEnums');
const fs = require('fs');

describe('Deploy effect order choice', () => {
    test('DEPLOY_EFFECT_TRIGGERED with multiple effects schedules a PROMPT_CHOICE', () => {
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

        const promptChoiceEvent = gameEnv.processingQueue.find(e => e.type === EventType.PROMPT_CHOICE);
        expect(promptChoiceEvent).toBeTruthy();
        expect(promptChoiceEvent.data.context.kind).toBe('DEPLOY_EFFECT_ORDER');
        expect(promptChoiceEvent.data.availableOptions).toHaveLength(2);
        expect(promptChoiceEvent.data.headerText).toBe('Choose Deploy Effect');
        expect(promptChoiceEvent.data.availableOptions[0].display).toMatchObject({
            mode: 'text',
            label: promptChoiceEvent.data.availableOptions[0].label
        });
        expect(promptChoiceEvent.data.availableOptions[1].display).toMatchObject({
            mode: 'text',
            label: promptChoiceEvent.data.availableOptions[1].label
        });
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

    test('DEPLOY_EFFECT_ORDER PROMPT_CHOICE routes through PromptChoiceManager', () => {
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

        const promptChoice = EventFactory.createPromptChoiceEvent({
            playerId: 'playerId_1',
            choiceId: 'deploy_effect_order_test',
            headerText: 'Choose Deploy Effect',
            promptText: 'Select which deploy effect to resolve first.',
            sourceCarduid: 'some_unit_1',
            availableOptions: [
                { index: 0, label: 'Draw cards' },
                { index: 1, label: 'Draw cards' }
            ],
            context: { kind: 'DEPLOY_EFFECT_ORDER', deployCarduid: 'some_unit_1', effects }
        });

        promptChoice.status = 'RESOLVING';
        promptChoice.data.userDecisionMade = true;
        promptChoice.data.selectedOptionIndex = 1;

        const execResult = PromptChoiceManager.executePromptChoice(promptChoice, gameEnv);
        expect(execResult.success).toBe(true);

        const queuedDeploy = gameEnv.processingQueue.find(e => e.type === EventType.DEPLOY_EFFECT_TRIGGERED);
        expect(queuedDeploy).toBeTruthy();
        expect(queuedDeploy.data.effects).toHaveLength(1);
        expect(queuedDeploy.data.effects[0].effectId).toBe('deploy_draw_2');
        expect(queuedDeploy.data.remainingEffects).toHaveLength(1);
        expect(queuedDeploy.data.remainingEffects[0].effectId).toBe('deploy_draw_1');
    });

    test('shield-then sequence deploy does not schedule deploy effect order prompt', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const st02 = JSON.parse(
            fs.readFileSync(
                '/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/data/st02Card.json',
                'utf8'
            )
        );
        const card = st02.cards['ST02-016'];
        const effects = (card?.effects?.rules || []).filter((rule) => rule && rule.timing?.eventTrigger === 'ENTERS_PLAY');
        expect(effects).toHaveLength(1);
        expect(effects[0].action).toBe('sequence');

        const deployEvent = {
            id: 'deploy_st02_016_sequence',
            type: EventType.DEPLOY_EFFECT_TRIGGERED,
            status: 'RESOLVING',
            priority: 1,
            playerId: 'playerId_1',
            timestamp: Date.now(),
            data: {
                carduid: 'ST02-016_test_uid',
                effects,
            }
        };

        const result = DeployEffectManager.executeDeployEffect(deployEvent, gameEnv);
        expect(result.success).toBe(true);
        expect(result.error).toBeUndefined();

        const promptChoiceEvent = gameEnv.processingQueue.find((e) => e.type === EventType.PROMPT_CHOICE);
        const optionChoiceEvent = gameEnv.processingQueue.find((e) => e.type === EventType.OPTION_CHOICE);
        expect(promptChoiceEvent).toBeFalsy();
        expect(optionChoiceEvent).toBeFalsy();
    });
});
