const { GameEnvironment } = require('../models/GameEnvironment');
const { PairingEffectManager } = require('../services/PairingEffectManager');
const { PairingEffectOrderManager } = require('../services/effects/PairingEffectOrderManager');
const { EventFactory } = require('../services/EventQueue/EventFactory');
const { EventType } = require('../models/GameEnums');
const { ChoiceConfirmationService } = require('../services/choices/ChoiceConfirmationService');

const createEnemyUnit = (carduid, hp = 4) => ({
    carduid,
    cardData: {
        id: carduid.split('_')[0],
        name: 'Enemy Unit',
        cardType: 'unit',
        level: 3,
        color: 'Blue',
        ap: 2,
        hp,
        effects: { description: [], rules: [] }
    },
    isRested: false,
    damageReceived: 0
});

describe('Pairing effect order choice', () => {
    test('PAIRING_EFFECT_TRIGGERED with multiple effects schedules an OPTION_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        const enemy = gameEnv.addPlayer('playerId_2', 'P2');
        enemy.zones.slot1 = { unit: createEnemyUnit('ENEMY_0001') };

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
                    target: { type: 'unit', scope: 'opponent', count: 1, selection: { type: 'player_choice' } },
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
        expect(optionChoiceEvent.data.headerText).toBe('Choose Effect Order');
        expect(optionChoiceEvent.data.promptText).toBe('Select which effect resolves first.');
        expect(optionChoiceEvent.data.defaultOptionIndex).toBe(0);
        expect(optionChoiceEvent.data.layoutHint).toBe('text');
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

    test('auto-skips no-target pairing effect and resolves remaining effect without OPTION_CHOICE', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        player.deck.mainDeck = ['ST01-004_draw_test_0001'];

        const eventData = {
            carduid: 'pair_source_test_0001',
            effects: [
                {
                    effectId: 'paired_white_base_draw',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'draw',
                    sourceCarduid: 'pair_source_test_0001',
                    target: { scope: 'self' },
                    parameters: { value: 1 }
                },
                {
                    effectId: 'paired_rest_medium_hp',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'rest',
                    sourceCarduid: 'pilot_source_test_0002',
                    target: { type: 'unit', scope: 'opponent', count: 1, filters: { hp: '<=5' } }
                }
            ]
        };

        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', eventData);
        expect(result.success).toBe(true);
        expect(result.effectsProcessed).toBe(1);
        expect(player.deck.handUids).toContain('ST01-004_draw_test_0001');

        const optionChoiceEvent = gameEnv.processingQueue.find(e => e.type === EventType.OPTION_CHOICE);
        expect(optionChoiceEvent).toBeFalsy();

        const refresh = gameEnv.notificationQueue.find(n => n.type === 'GAME_ENV_REFRESH');
        expect(refresh).toBeTruthy();
        expect(refresh.payload.skippedNoTargetEffects).toBe(1);
    });

    test('confirmOptionChoice succeeds when draw resolves from object deck entries', async () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        const enemy = gameEnv.addPlayer('playerId_2', 'P2');
        player.deck.mainDeck = [{ carduid: 'ST01-004_objdeck_0001', cardId: 'ST01-004' }];
        enemy.zones.slot1 = { unit: createEnemyUnit('ENEMY_0002') };

        const effects = [
            {
                effectId: 'paired_white_base_draw',
                type: 'triggered',
                trigger: 'PAIRING_COMPLETE',
                action: 'draw',
                sourceCarduid: 'unit_source_test_0001',
                target: { scope: 'self' },
                parameters: { value: 1 }
            },
            {
                effectId: 'paired_rest_medium_hp',
                type: 'triggered',
                trigger: 'PAIRING_COMPLETE',
                action: 'rest',
                sourceCarduid: 'pilot_source_test_0001',
                target: { type: 'unit', scope: 'opponent', count: 1, filters: { hp: '<=5' } }
            }
        ];

        const optionChoice = EventFactory.createOptionChoiceEvent({
            playerId: 'playerId_1',
            sourceCarduid: 'pilot_source_test_0001',
            effect: { effectId: 'pairing_effect_order', type: 'internal', trigger: 'CHOICE', action: 'pairing_effect_order' },
            availableOptions: [
                { index: 0, label: 'draw first' },
                { index: 1, label: 'rest first' }
            ],
            context: { kind: 'PAIRING_EFFECT_ORDER', pairingCarduid: 'pilot_source_test_0001', effects }
        });
        gameEnv.processingQueue.push(optionChoice);

        const persistence = {
            loadGameFromFile: jest.fn(async () => gameEnv),
            saveGameToFile: jest.fn(async (_gameId, env) => {
                JSON.stringify(env);
            })
        };

        const result = await ChoiceConfirmationService.confirmOptionChoice(
            persistence,
            'test_game_id',
            'playerId_1',
            optionChoice.id,
            1
        );

        expect(result.success).toBe(true);
        expect(player.deck.handUids).toContain('ST01-004_objdeck_0001');
        expect(player.deck.handUids.every((uid) => typeof uid === 'string')).toBe(true);
    });

    test('disables pairing option when conditional-only sequence cannot execute now', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        player.zones.slot1 = {
            unit: {
                carduid: 'GD03-080_unit_0001',
                cardData: { id: 'GD03-080', name: 'Gundam Kimaris Trooper (Trooper Mode)', cardType: 'unit', traits: ['Gjallarhorn'] },
                isRested: false
            },
            pilot: {
                carduid: 'GD02-099_pilot_hand_0001',
                cardData: { id: 'GD02-099', name: 'Gaelio Bauduin', cardType: 'pilot', traits: ['Gjallarhorn'] },
                isRested: false
            }
        };
        player.zones.trashArea = [
            {
                carduid: 'GD02-118_trash_0001',
                cardData: { id: 'GD02-118', name: 'Heart Set on Revenge', cardType: 'command', traits: ['Gjallarhorn'] }
            },
            {
                carduid: 'GD02-119_trash_0001',
                cardData: { id: 'GD02-119', name: 'Persistent and Fortudinous', cardType: 'command', traits: ['Gjallarhorn'] }
            }
        ];

        const eventData = {
            carduid: 'GD02-099_pilot_hand_0001',
            effects: [
                {
                    effectId: 'linked_effect',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'sequence',
                    sourceCarduid: 'GD03-080_unit_0001',
                    pairedSlot: 'slot1',
                    parameters: {
                        text: 'Choose 1 (Gjallarhorn) Command card from your trash. Add it to your hand.',
                        version: 1,
                        steps: [
                            {
                                action: 'addToHand',
                                target: {
                                    type: 'card',
                                    scope: 'self_trash',
                                    count: 1,
                                    selection: { type: 'player_choice' },
                                    filters: { cardType: 'command', traits: ['Gjallarhorn'] }
                                },
                                parameters: { from: 'trash', value: 1 }
                            }
                        ]
                    },
                    sourceConditions: [{ type: 'linked' }]
                },
                {
                    effectId: 'pair_effect',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'sequence',
                    sourceCarduid: 'GD02-099_pilot_hand_0001',
                    pairedSlot: 'slot1',
                    parameters: {
                        text: 'If there are 4 or more (Gjallarhorn) cards in your trash, choose 1 enemy Unit. It gets AP-2 during this turn.',
                        version: 1,
                        steps: [
                            {
                                action: 'conditional',
                                parameters: {
                                    if: [
                                        { type: 'cardsInTrashWithTraitsAny', scope: 'self', traits: ['Gjallarhorn'], value: '>=4' }
                                    ],
                                    then: [
                                        {
                                            action: 'modifyAP',
                                            timing: { duration: 'UNTIL_END_OF_TURN' },
                                            target: {
                                                type: 'unit',
                                                scope: 'opponent',
                                                count: 1,
                                                selection: { type: 'player_choice' }
                                            },
                                            parameters: { value: -2 }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            ]
        };

        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', eventData);
        expect(result.success).toBe(true);

        const optionChoiceEvent = gameEnv.processingQueue.find(e => e.type === EventType.OPTION_CHOICE);
        expect(optionChoiceEvent).toBeTruthy();
        const pairOption = optionChoiceEvent.data.availableOptions.find((opt) => opt.label.includes('pair_effect'));
        expect(pairOption).toBeTruthy();
        expect(pairOption.disabled).toBe(true);
        expect(typeof pairOption.disabledReason).toBe('string');
        expect(pairOption.disabledReason.length).toBeGreaterThan(0);
    });

    test('confirmOptionChoice rejects disabled pairing option', async () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');

        const effects = [
            {
                effectId: 'e1',
                type: 'triggered',
                trigger: 'PAIRING_COMPLETE',
                action: 'draw',
                sourceCarduid: 'unit_source_test_0001',
                target: { scope: 'self' },
                parameters: { value: 1 }
            },
            {
                effectId: 'e2',
                type: 'triggered',
                trigger: 'PAIRING_COMPLETE',
                action: 'sequence',
                sourceCarduid: 'pilot_source_test_0001',
                parameters: { steps: [{ action: 'conditional', parameters: { if: [{ type: 'cardsInTrashWithTraitsAny', scope: 'self', traits: ['Gjallarhorn'], value: '>=4' }], then: [] } }] }
            }
        ];

        const optionChoice = EventFactory.createOptionChoiceEvent({
            playerId: 'playerId_1',
            sourceCarduid: 'pilot_source_test_0001',
            effect: { effectId: 'pairing_effect_order', type: 'internal', trigger: 'CHOICE', action: 'pairing_effect_order' },
            availableOptions: [
                { index: 0, label: 'e1' },
                { index: 1, label: 'e2', disabled: true, disabledReason: 'Condition not met: requires >=4 cards in trash (Gjallarhorn)' }
            ],
            context: { kind: 'PAIRING_EFFECT_ORDER', pairingCarduid: 'pilot_source_test_0001', effects }
        });
        gameEnv.processingQueue.push(optionChoice);

        const persistence = {
            loadGameFromFile: jest.fn(async () => gameEnv),
            saveGameToFile: jest.fn(async () => undefined)
        };

        const result = await ChoiceConfirmationService.confirmOptionChoice(
            persistence,
            'test_game_id',
            'playerId_1',
            optionChoice.id,
            1
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/disabled/i);
    });

    test('pairing_effect_order manager rejects disabled selected option defensively', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const effects = [
            {
                effectId: 'e1',
                type: 'triggered',
                trigger: 'PAIRING_COMPLETE',
                action: 'draw',
                sourceCarduid: 'unit_source_test_0001',
                target: { scope: 'self' },
                parameters: { value: 1 }
            }
        ];

        const optionChoice = EventFactory.createOptionChoiceEvent({
            playerId: 'playerId_1',
            sourceCarduid: 'pilot_source_test_0001',
            effect: { effectId: 'pairing_effect_order', type: 'internal', trigger: 'CHOICE', action: 'pairing_effect_order' },
            availableOptions: [
                { index: 0, label: 'e1', disabled: true, disabledReason: 'Condition not met' }
            ],
            context: { kind: 'PAIRING_EFFECT_ORDER', pairingCarduid: 'pilot_source_test_0001', effects }
        });

        optionChoice.status = 'RESOLVING';
        optionChoice.data.userDecisionMade = true;
        optionChoice.data.selectedOptionIndex = 0;

        const result = PairingEffectOrderManager.executeOptionChoice(optionChoice, gameEnv);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/disabled/i);
    });

    test('auto allow_attack_target pairing effect is hidden from order dialog and still resolves', () => {
        const gameEnv = new GameEnvironment();
        const player = gameEnv.addPlayer('playerId_1', 'P1');
        const enemy = gameEnv.addPlayer('playerId_2', 'P2');

        player.zones.slot1 = {
            unit: {
                carduid: 'GD03-077_unit_0001',
                cardData: { id: 'GD03-077', name: 'Justice Gundam (METEOR)', cardType: 'unit', level: 8, ap: 6, hp: 6, effects: { description: [], rules: [] } },
                isRested: false,
                damageReceived: 0
            },
            pilot: {
                carduid: 'ST04-011_pilot_0001',
                cardData: { id: 'ST04-011', name: 'Athrun Zala', cardType: 'pilot', level: 4, ap: 1, hp: 2, effects: { description: [], rules: [] } },
                isRested: false,
                damageReceived: 0
            }
        };
        enemy.zones.slot1 = { unit: createEnemyUnit('ENEMY_0003', 3) };

        const eventData = {
            carduid: 'ST04-011_pilot_0001',
            effects: [
                {
                    effectId: 'attack_active_low_level_5',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'allow_attack_target',
                    sourceCarduid: 'ST04-011_pilot_0001',
                    pairedSlot: 'slot1',
                    target: { scope: 'source_paired_unit', type: 'unit', count: 1 },
                    timing: { duration: 'UNTIL_END_OF_TURN' },
                    parameters: { status: 'active', level: '<=5' },
                    sourceConditions: [{ type: 'linked' }]
                },
                {
                    effectId: 'linked_effect',
                    type: 'triggered',
                    trigger: 'PAIRING_COMPLETE',
                    action: 'sequence',
                    sourceCarduid: 'GD03-077_unit_0001',
                    pairedSlot: 'slot1',
                    parameters: {
                        text: 'Choose 1 to 3 enemy Units with 3 or less HP. Return them to their owners hands.',
                        version: 1,
                        steps: [
                            {
                                action: 'returnToHand',
                                target: {
                                    type: 'unit',
                                    scope: 'opponent',
                                    count: { min: 1, max: 3 },
                                    selection: { type: 'player_choice' },
                                    filters: { hp: '<=3' }
                                }
                            }
                        ]
                    },
                    sourceConditions: [{ type: 'linked' }]
                }
            ]
        };

        const result = PairingEffectManager.processPairingEffect(gameEnv, 'playerId_1', eventData);
        expect(result.success).toBe(true);

        const optionChoiceEvent = gameEnv.processingQueue.find((event) => event.type === EventType.OPTION_CHOICE);
        expect(optionChoiceEvent).toBeFalsy();

        const linkedUnit = player.zones.slot1.unit;
        expect(Array.isArray(linkedUnit.temporaryEffects)).toBe(true);
        expect(linkedUnit.temporaryEffects.some((effect) => effect?.allowAttackTarget?.level === '<=5')).toBe(true);
    });

    test('pairing_effect_order uses option payload effectOrderIndex and preserves hidden auto effects order', () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');

        const effects = [
            {
                effectId: 'auto_draw',
                type: 'triggered',
                trigger: 'PAIRING_COMPLETE',
                action: 'draw',
                sourceCarduid: 'unit_source_test_0001',
                target: { scope: 'self' },
                parameters: { value: 1 }
            },
            {
                effectId: 'interactive_1',
                type: 'triggered',
                trigger: 'PAIRING_COMPLETE',
                action: 'destroy',
                optional: true,
                sourceCarduid: 'pilot_source_test_0001',
                target: { type: 'unit', scope: 'opponent', count: 1 }
            },
            {
                effectId: 'interactive_2',
                type: 'triggered',
                trigger: 'PAIRING_COMPLETE',
                action: 'rest',
                optional: true,
                sourceCarduid: 'pilot_source_test_0002',
                target: { type: 'unit', scope: 'opponent', count: 1 }
            }
        ];

        const optionChoice = EventFactory.createOptionChoiceEvent({
            playerId: 'playerId_1',
            sourceCarduid: 'some_pairing_source',
            effect: { effectId: 'pairing_effect_order', type: 'internal', trigger: 'CHOICE', action: 'pairing_effect_order' },
            availableOptions: [
                { index: 0, label: 'interactive_1', payload: { effectOrderIndex: 1 } },
                { index: 1, label: 'interactive_2', payload: { effectOrderIndex: 2 } }
            ],
            context: {
                kind: 'PAIRING_EFFECT_ORDER',
                pairingCarduid: 'some_pairing_source',
                effects: [effects[1], effects[2]],
                allEffects: effects
            }
        });

        optionChoice.status = 'RESOLVING';
        optionChoice.data.userDecisionMade = true;
        optionChoice.data.selectedOptionIndex = 1;

        const execResult = PairingEffectOrderManager.executeOptionChoice(optionChoice, gameEnv);
        expect(execResult.success).toBe(true);

        const queuedPairing = gameEnv.processingQueue.find((event) => event.type === EventType.PAIRING_EFFECT_TRIGGERED);
        expect(queuedPairing).toBeTruthy();
        expect(queuedPairing.data.effects[0].effectId).toBe('interactive_2');
        expect(queuedPairing.data.remainingEffects).toHaveLength(2);
        expect(queuedPairing.data.remainingEffects[0].effectId).toBe('auto_draw');
        expect(queuedPairing.data.remainingEffects[1].effectId).toBe('interactive_1');
    });
});
