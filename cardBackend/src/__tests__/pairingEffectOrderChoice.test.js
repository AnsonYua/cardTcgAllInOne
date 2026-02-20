const { GameEnvironment } = require('../models/GameEnvironment');
const { PairingEffectManager } = require('../services/PairingEffectManager');
const { PairingEffectOrderManager } = require('../services/effects/PairingEffectOrderManager');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { EventType } = require('../models/GameEnums');

describe('Pairing effect order choice', () => {
    test('PAIRING_EFFECT_TRIGGERED with multiple effects schedules an OPTION_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const multiEffectsEventData = {
            carduid: 'some_pairing_source',
            effects: [
                {
                    effectId: 'e1',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'destroy',
                    optional: true,
                    pairedSlot: 'slot1',
                    sourceCarduid: 'u1',
                    target: { type: 'unit', scope: 'opponent', count: 1 }
                },
                {
                    effectId: 'e2',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'modifyAP',
                    optional: false,
                    pairedSlot: 'slot1',
                    sourceCarduid: 'p1',
                    target: { type: 'unit', scope: 'opponent', count: 1 },
                    parameters: { value: -2 }
                }
            ]
        };

        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', multiEffectsEventData);
        expect(result.success).toBe(true);

        const optionChoiceEvent = gameEnv.processingQueue.find(e => e.type === EventType.OPTION_CHOICE);
        expect(optionChoiceEvent).toBeTruthy();
        expect(optionChoiceEvent.data.effect.action).toBe('pairing_effect_order');
        expect(optionChoiceEvent.data.availableOptions).toHaveLength(2);
        expect(optionChoiceEvent.data.availableOptions[0].display).toBeTruthy();
        expect(optionChoiceEvent.data.availableOptions[0].display.mode).toBe('text');
    });

    test('non-conflicting pairing effects auto-resolve in card-text order (no OPTION_CHOICE)', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');

        const energyBefore = Array.isArray(player.zones.energyArea) ? player.zones.energyArea.length : 0;

        const eventData = {
            carduid: 'some_pairing_source',
            effects: [
                {
                    effectId: 'e1',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'addExtraEnergy',
                    optional: false,
                    pairedSlot: 'slot1',
                    sourceCarduid: 'u1',
                    parameters: { value: 1, rested: true }
                },
                {
                    effectId: 'e2',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'addExtraEnergy',
                    optional: false,
                    pairedSlot: 'slot1',
                    sourceCarduid: 'u1',
                    parameters: { value: 1, rested: false }
                }
            ]
        };

        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', eventData);
        expect(result.success).toBe(true);
        expect(result.effectsProcessed).toBe(1);

        const optionChoiceEvent = gameEnv.processingQueue.find(e => e.type === EventType.OPTION_CHOICE);
        expect(optionChoiceEvent).toBeFalsy();

        const queuedPairing = gameEnv.processingQueue.find(e => e.type === EventType.PAIRING_EFFECT_TRIGGERED);
        expect(queuedPairing).toBeTruthy();
        expect(queuedPairing.data.effects).toHaveLength(1);
        expect(queuedPairing.data.effects[0].effectId).toBe('e2');

        const energyAfter = Array.isArray(player.zones.energyArea) ? player.zones.energyArea.length : 0;
        expect(energyAfter).toBe(energyBefore + 1);
    });

    test('pairing_effect_order OPTION_CHOICE enqueues a single-effect pairing event + remainingEffects', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const effects = [
            {
                effectId: 'e1',
                type: 'triggered',
                trigger: 'PAIRING_COMPLETE',
                action: 'destroy',
                optional: true,
                pairedSlot: 'slot1',
                sourceCarduid: 'u1',
                target: { type: 'unit', scope: 'opponent', count: 1 }
            },
            {
                effectId: 'e2',
                type: 'triggered',
                trigger: 'PAIRING_COMPLETE',
                action: 'modifyAP',
                optional: false,
                pairedSlot: 'slot1',
                sourceCarduid: 'p1',
                target: { type: 'unit', scope: 'opponent', count: 1 },
                parameters: { value: -2 }
            }
        ];

        const optionChoice = EventFactory.createOptionChoiceEvent({
            playerId: 'playerId_1',
            sourceCarduid: 'some_pairing_source',
            effect: { effectId: 'pairing_effect_order', type: 'internal', trigger: 'CHOICE', action: 'pairing_effect_order' },
            availableOptions: [
                { index: 0, label: 'e1' },
                { index: 1, label: 'e2' }
            ],
            context: { kind: 'PAIRING_EFFECT_ORDER', pairingCarduid: 'some_pairing_source', effects }
        });

        // Simulate the choice being resolved by the player selecting index 1.
        optionChoice.status = 'RESOLVING';
        optionChoice.data.userDecisionMade = true;
        optionChoice.data.selectedOptionIndex = 1;

        const execResult = PairingEffectOrderManager.executeOptionChoice(optionChoice, gameEnv);
        expect(execResult.success).toBe(true);

        const queuedPairing = gameEnv.processingQueue.find(e => e.type === EventType.PAIRING_EFFECT_TRIGGERED);
        expect(queuedPairing).toBeTruthy();
        expect(queuedPairing.data.effects).toHaveLength(1);
        expect(queuedPairing.data.effects[0].effectId).toBe('e2');
        expect(queuedPairing.data.remainingEffects).toHaveLength(1);
        expect(queuedPairing.data.remainingEffects[0].effectId).toBe('e1');
    });

    test('after resolving one pairing effect, emits GAME_ENV_REFRESH notification', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        player.deck.mainDeck = ['GD02-066_draw_00021'];

        const eventData = {
            carduid: 'GD03-094_action_0001',
            effects: [
                {
                    effectId: 'draw_1',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'draw',
                    optional: false,
                    pairedSlot: 'slot1',
                    sourceCarduid: 'GD03-094_action_0001',
                    target: { type: 'player', scope: 'self', count: 1 },
                    parameters: { value: 1 }
                }
            ],
            remainingEffects: [
                {
                    effectId: 'noop_remaining',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'draw',
                    optional: false,
                    pairedSlot: 'slot1',
                    sourceCarduid: 'GD03-094_action_0001',
                    target: { type: 'player', scope: 'self', count: 1 },
                    parameters: { value: 1 }
                }
            ]
        };

        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', eventData);
        expect(result.success).toBe(true);

        const refresh = gameEnv.notificationQueue.find(n => n.type === 'GAME_ENV_REFRESH');
        expect(refresh).toBeTruthy();
        expect(refresh.payload.reason).toBe('PAIRING_EFFECT_STEP_RESOLVED');
        expect(refresh.payload.effectId).toBe('draw_1');
        expect(refresh.payload.remainingEffects).toBe(1);
    });
});
