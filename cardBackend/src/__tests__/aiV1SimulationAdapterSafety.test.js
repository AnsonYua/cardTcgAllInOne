const { GamePhase } = require('../models/GameEnums');
const { GameEnvironment } = require('../models/GameEnvironment');
const { createUnitZoneCard } = require('./helpers/zoneCardFactory');
const {
    createBurstEffectChoiceEvent,
    createBlockerChoiceEvent,
    createTargetChoiceEvent
} = require('../services/EventQueue/factories/ChoiceEventFactories');
const { GameEnvViewBuilder } = require('../services/views/GameEnvViewBuilder');
const { GameEnvAiContextAdapter } = require('../services/ai/v1/AiV1ContextAdapter');
const { AiLocalSimulationAdapter } = require('../services/ai/v1/AiV1SimulationAdapter');

describe('AiLocalSimulationAdapter', () => {
    test('runs on a clone and does not mutate the live game environment on failure', async () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.gameStarted = true;
        gameEnv.currentTurn = 2;
        gameEnv.currentPlayer = 'playerId_1';

        const before = gameEnv.toPersistenceJSON();
        const view = GameEnvViewBuilder.toPlayerView(gameEnv, 'playerId_1');
        const context = new GameEnvAiContextAdapter().buildContext(view, 'playerId_1', gameEnv);
        const candidate = {
            candidateId: 'bad_attack',
            kind: 'attack',
            decision: {
                kind: 'playerAction',
                reason: 'bad_attack',
                payload: {
                    actionType: 'attackShieldArea',
                    attackerCarduid: 'missing_attacker'
                }
            },
            windowKind: 'MAIN_PHASE',
            estimatedScore: 0,
            tags: [],
            requiresSimulation: true
        };

        const result = await new AiLocalSimulationAdapter().simulateCandidate(context, candidate);

        expect(result).toBeTruthy();
        expect(result.supported).toBe(true);
        expect(result.success).toBe(false);
        expect(gameEnv.toPersistenceJSON()).toEqual(before);
    });

    test('resolves follow-up target choice during simulation using the candidate target plan', async () => {
        const gameEnv = new GameEnvironment();
        const aiPlayerId = 'playerId_1';
        const opponentId = 'playerId_2';
        const aiPlayer = gameEnv.addPlayer(aiPlayerId, 'P1');
        gameEnv.addPlayer(opponentId, 'P2');
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.gameStarted = true;
        gameEnv.currentTurn = 2;
        gameEnv.currentPlayer = aiPlayerId;

        aiPlayer.zones.slot1.unit = createUnitZoneCard({
            carduid: 'ai_source_unit',
            cardId: 'AI-SOURCE',
            name: 'AI Source Unit',
            ap: 3,
            hp: 4,
            effectsRules: [
                {
                    effectId: 'activate_damage',
                    type: 'activated',
                    action: 'damage',
                    target: {
                        type: 'unit',
                        scope: 'opponent',
                        count: 1
                    },
                    parameters: {
                        value: 2
                    },
                    timing: {
                        windows: ['MAIN_PHASE']
                    }
                }
            ],
            zoneExtras: {
                canAttackThisTurn: true,
                playedThisTurn: false
            }
        });

        gameEnv.players[opponentId].zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_big',
            cardId: 'ENEMY-BIG',
            name: 'Enemy Big',
            ap: 5,
            hp: 5
        });
        gameEnv.players[opponentId].zones.slot2.unit = createUnitZoneCard({
            carduid: 'enemy_small',
            cardId: 'ENEMY-SMALL',
            name: 'Enemy Small',
            ap: 1,
            hp: 3
        });

        const before = gameEnv.toPersistenceJSON();
        const view = GameEnvViewBuilder.toPlayerView(gameEnv, aiPlayerId);
        const context = new GameEnvAiContextAdapter().buildContext(view, aiPlayerId, gameEnv);
        const candidate = {
            candidateId: 'activate_targeted_damage',
            kind: 'activate',
            decision: {
                kind: 'playerAction',
                reason: 'activate_damage:0',
                payload: {
                    actionType: 'activateCardAbility',
                    carduid: 'ai_source_unit',
                    effectId: 'activate_damage'
                }
            },
            windowKind: 'MAIN_PHASE',
            estimatedScore: 20,
            tags: [],
            requiresSimulation: true,
            telemetry: {
                selectedTargets: [
                    { carduid: 'enemy_small', zone: 'slot2', playerId: opponentId }
                ]
            }
        };

        const result = await new AiLocalSimulationAdapter().simulateCandidate(context, candidate);

        expect(result).toBeTruthy();
        expect(result.supported).toBe(true);
        expect(result.success).toBe(true);
        expect(result.remainingHpByCarduid.enemy_small).toBe(1);
        expect(result.remainingHpByCarduid.enemy_big).toBe(5);
        expect(gameEnv.toPersistenceJSON()).toEqual(before);
    });

    test('simulates a direct burst choice decision on a clone without mutating live state', async () => {
        const gameEnv = new GameEnvironment();
        const defenderId = 'playerId_1';
        gameEnv.addPlayer(defenderId, 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.gameStarted = true;
        gameEnv.currentTurn = 3;
        gameEnv.currentPlayer = 'playerId_2';

        const burstCard = {
            carduid: 'burst_shield_001',
            cardId: 'BURST-001',
            cardData: {
                id: 'BURST-001',
                name: 'Burst To Hand',
                cardType: 'command',
                effects: {
                    rules: [
                        {
                            effectId: 'burst_add_to_hand',
                            type: 'triggered',
                            trigger: 'BURST_CONDITION',
                            action: 'addToHand'
                        }
                    ]
                }
            }
        };

        gameEnv.players[defenderId].zones.shieldArea.push(burstCard);
        const burstChoiceEvent = createBurstEffectChoiceEvent(defenderId, [burstCard]);
        gameEnv.processingQueue = [burstChoiceEvent];
        gameEnv.notificationQueue = [
            {
                id: burstChoiceEvent.id,
                type: 'BURST_EFFECT_CHOICE',
                payload: {
                    playerId: defenderId,
                    event: burstChoiceEvent,
                    isCompleted: false
                },
                metadata: {
                    timestamp: Date.now(),
                    expiresAt: Number.MAX_SAFE_INTEGER,
                    requiresAcknowledgment: true,
                    priority: 'high'
                }
            }
        ];

        const before = gameEnv.toPersistenceJSON();
        const view = GameEnvViewBuilder.toPlayerView(gameEnv, defenderId);
        const context = new GameEnvAiContextAdapter().buildContext(view, defenderId, gameEnv);
        const candidate = {
            candidateId: 'confirm_burst_choice',
            kind: 'prompt',
            decision: {
                kind: 'confirmBurstChoice',
                reason: 'confirm_burst_choice',
                payload: {
                    eventId: burstChoiceEvent.id,
                    confirmed: true
                }
            },
            windowKind: 'OWNED_PROMPT',
            estimatedScore: 0,
            tags: [],
            requiresSimulation: true
        };

        const result = await new AiLocalSimulationAdapter().simulateCandidate(context, candidate);

        expect(result).toBeTruthy();
        expect(result.supported).toBe(true);
        expect(result.success).toBe(true);
        expect(gameEnv.toPersistenceJSON()).toEqual(before);
    });

    test('simulates a direct blocker choice decision on a clone without mutating live state', async () => {
        const gameEnv = new GameEnvironment();
        const defenderId = 'playerId_1';
        const attackerId = 'playerId_2';
        gameEnv.addPlayer(defenderId, 'P1');
        gameEnv.addPlayer(attackerId, 'P2');
        gameEnv.phase = GamePhase.BLOCKER_PHASE;
        gameEnv.gameStarted = true;
        gameEnv.currentTurn = 3;
        gameEnv.currentPlayer = attackerId;

        gameEnv.players[defenderId].zones.slot1.unit = createUnitZoneCard({
            carduid: 'defender_target',
            cardId: 'DEF-TARGET',
            name: 'Defender Target',
            ap: 2,
            hp: 4
        });
        gameEnv.players[defenderId].zones.slot2.unit = createUnitZoneCard({
            carduid: 'defender_blocker',
            cardId: 'DEF-BLOCKER',
            name: 'Defender Blocker',
            ap: 3,
            hp: 4,
            effectsRules: [
                {
                    effectId: 'blocker_effect',
                    type: 'triggered',
                    trigger: 'ATTACK_REDIRECT',
                    action: 'redirect_attack'
                }
            ]
        });
        gameEnv.players[attackerId].zones.slot1.unit = createUnitZoneCard({
            carduid: 'attacker_unit',
            cardId: 'ATK-UNIT',
            name: 'Attacker Unit',
            ap: 4,
            hp: 4
        });

        const originalAttackEvent = {
            id: 'attack_for_blocker_test',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: attackerId,
            timestamp: Date.now(),
            data: {
                playerId: attackerId,
                actionType: 'attackUnit',
                attackerCarduid: 'attacker_unit',
                targetUnitUid: 'defender_target',
                targetPlayerId: defenderId,
                fromBurst: false
            }
        };
        const blockerChoiceEvent = createBlockerChoiceEvent({
            blockingPlayerId: defenderId,
            originalAttackEvent,
            availableTargets: [
                {
                    carduid: 'defender_blocker',
                    zone: 'slot2',
                    playerId: defenderId
                }
            ]
        });

        gameEnv.processingQueue = [blockerChoiceEvent];
        gameEnv.notificationQueue = [
            {
                id: blockerChoiceEvent.id,
                type: 'BLOCKER_CHOICE',
                payload: {
                    playerId: defenderId,
                    event: blockerChoiceEvent,
                    isCompleted: false
                },
                metadata: {
                    timestamp: Date.now(),
                    expiresAt: Number.MAX_SAFE_INTEGER,
                    requiresAcknowledgment: true,
                    priority: 'high'
                }
            }
        ];

        const before = gameEnv.toPersistenceJSON();
        const view = GameEnvViewBuilder.toPlayerView(gameEnv, defenderId);
        const context = new GameEnvAiContextAdapter().buildContext(view, defenderId, gameEnv);
        const candidate = {
            candidateId: 'confirm_blocker_choice',
            kind: 'prompt',
            decision: {
                kind: 'confirmBlockerChoice',
                reason: 'confirm_blocker_choice',
                payload: {
                    eventId: blockerChoiceEvent.id,
                    selectedTargets: [
                        {
                            carduid: 'defender_blocker',
                            zone: 'slot2',
                            playerId: defenderId
                        }
                    ]
                }
            },
            windowKind: 'OWNED_PROMPT',
            estimatedScore: 0,
            tags: [],
            requiresSimulation: true
        };

        const result = await new AiLocalSimulationAdapter().simulateCandidate(context, candidate);

        expect(result).toBeTruthy();
        expect(result.supported).toBe(true);
        expect(result.success).toBe(true);
        expect(gameEnv.toPersistenceJSON()).toEqual(before);
    });

    test('resolves chained burst follow-up prompts on a clone after the first burst confirmation', async () => {
        const gameEnv = new GameEnvironment();
        const defenderId = 'playerId_1';
        const attackerId = 'playerId_2';
        gameEnv.addPlayer(defenderId, 'P1');
        gameEnv.addPlayer(attackerId, 'P2');
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.gameStarted = true;
        gameEnv.currentTurn = 5;
        gameEnv.currentPlayer = attackerId;

        gameEnv.players[attackerId].zones.slot1.unit = createUnitZoneCard({
            carduid: 'enemy_big',
            cardId: 'ENEMY-BIG',
            name: 'Enemy Big',
            ap: 5,
            hp: 5
        });
        gameEnv.players[attackerId].zones.slot2.unit = createUnitZoneCard({
            carduid: 'enemy_small',
            cardId: 'ENEMY-SMALL',
            name: 'Enemy Small',
            ap: 1,
            hp: 2
        });

        const burstToHandCard = {
            carduid: 'burst_shield_001',
            cardId: 'BURST-001',
            cardData: {
                id: 'BURST-001',
                name: 'Burst To Hand',
                cardType: 'command',
                effects: {
                    rules: [
                        {
                            effectId: 'burst_add_to_hand',
                            type: 'triggered',
                            trigger: 'BURST_CONDITION',
                            action: 'addToHand'
                        }
                    ]
                }
            }
        };

        const burstDamageCard = {
            carduid: 'burst_shield_002',
            cardId: 'BURST-002',
            cardData: {
                id: 'BURST-002',
                name: 'Burst Damage',
                cardType: 'command',
                effects: {
                    rules: [
                        {
                            effectId: 'burst_damage_enemy',
                            type: 'triggered',
                            trigger: 'BURST_CONDITION',
                            action: 'damage',
                            target: {
                                type: 'unit',
                                scope: 'opponent',
                                count: 1
                            },
                            parameters: {
                                value: 2
                            }
                        }
                    ]
                }
            }
        };

        gameEnv.players[defenderId].zones.shieldArea.push(burstToHandCard, burstDamageCard);
        const firstBurstEvent = createBurstEffectChoiceEvent(defenderId, [burstToHandCard]);
        const secondBurstEvent = createBurstEffectChoiceEvent(defenderId, [burstDamageCard]);
        gameEnv.processingQueue = [firstBurstEvent, secondBurstEvent];
        gameEnv.notificationQueue = [
            {
                id: firstBurstEvent.id,
                type: 'BURST_EFFECT_CHOICE',
                payload: {
                    playerId: defenderId,
                    event: firstBurstEvent,
                    isCompleted: false
                },
                metadata: {
                    timestamp: Date.now(),
                    expiresAt: Number.MAX_SAFE_INTEGER,
                    requiresAcknowledgment: true,
                    priority: 'high'
                }
            },
            {
                id: secondBurstEvent.id,
                type: 'BURST_EFFECT_CHOICE',
                payload: {
                    playerId: defenderId,
                    event: secondBurstEvent,
                    isCompleted: false
                },
                metadata: {
                    timestamp: Date.now(),
                    expiresAt: Number.MAX_SAFE_INTEGER,
                    requiresAcknowledgment: true,
                    priority: 'high'
                }
            }
        ];

        const before = gameEnv.toPersistenceJSON();
        const view = GameEnvViewBuilder.toPlayerView(gameEnv, defenderId);
        const context = new GameEnvAiContextAdapter().buildContext(view, defenderId, gameEnv);
        const candidate = {
            candidateId: 'confirm_first_burst_choice',
            kind: 'prompt',
            decision: {
                kind: 'confirmBurstChoice',
                reason: 'confirm_first_burst_choice',
                payload: {
                    eventId: firstBurstEvent.id,
                    confirmed: true
                }
            },
            windowKind: 'OWNED_PROMPT',
            estimatedScore: 0,
            tags: [],
            requiresSimulation: true
        };

        const result = await new AiLocalSimulationAdapter().simulateCandidate(context, candidate);

        expect(result).toBeTruthy();
        expect(result.supported).toBe(true);
        expect(result.success).toBe(true);
        expect(result.remainingHpByCarduid.enemy_big).toBe(3);
        expect(result.remainingHpByCarduid.enemy_small).toBe(2);
        expect(result.promptChain).toEqual([
            expect.objectContaining({
                source: 'initial',
                promptType: 'BURST_EFFECT_CHOICE',
                decisionKind: 'confirmBurstChoice',
                confirmed: true,
                success: true
            }),
            expect.objectContaining({
                source: 'follow_up',
                promptType: 'BURST_EFFECT_CHOICE',
                decisionKind: 'confirmBurstChoice',
                confirmed: true,
                success: true
            }),
            expect.objectContaining({
                source: 'follow_up',
                promptType: 'TARGET_CHOICE',
                decisionKind: 'confirmTargetChoice',
                success: true
            })
        ]);
        expect(gameEnv.toPersistenceJSON()).toEqual(before);
    });

    test('resolves chained follow-up target choice after blocker confirmation on a clone', async () => {
        const gameEnv = new GameEnvironment();
        const defenderId = 'playerId_1';
        const attackerId = 'playerId_2';
        gameEnv.addPlayer(defenderId, 'P1');
        gameEnv.addPlayer(attackerId, 'P2');
        gameEnv.phase = GamePhase.BLOCKER_PHASE;
        gameEnv.gameStarted = true;
        gameEnv.currentTurn = 6;
        gameEnv.currentPlayer = attackerId;

        gameEnv.players[defenderId].zones.slot1.unit = createUnitZoneCard({
            carduid: 'defender_target',
            cardId: 'DEF-TARGET',
            name: 'Defender Target',
            ap: 2,
            hp: 4
        });
        gameEnv.players[defenderId].zones.slot2.unit = createUnitZoneCard({
            carduid: 'defender_blocker',
            cardId: 'DEF-BLOCKER',
            name: 'Defender Blocker',
            ap: 3,
            hp: 4,
            effectsRules: [
                {
                    effectId: 'blocker_effect',
                    type: 'triggered',
                    trigger: 'ATTACK_REDIRECT',
                    action: 'redirect_attack'
                }
            ]
        });
        gameEnv.players[attackerId].zones.slot1.unit = createUnitZoneCard({
            carduid: 'battle_attacker',
            cardId: 'ATK-BATTLE',
            name: 'Battle Attacker',
            ap: 5,
            hp: 5
        });
        gameEnv.players[attackerId].zones.slot2.unit = createUnitZoneCard({
            carduid: 'follow_up_big',
            cardId: 'ATK-BIG',
            name: 'Follow Up Big',
            ap: 5,
            hp: 5
        });
        gameEnv.players[attackerId].zones.slot3.unit = createUnitZoneCard({
            carduid: 'follow_up_small',
            cardId: 'ATK-SMALL',
            name: 'Follow Up Small',
            ap: 1,
            hp: 2
        });

        const originalAttackEvent = {
            id: 'attack_for_blocker_follow_up_test',
            type: 'PLAYER_ACTION',
            status: 'DECLARED',
            priority: 1,
            playerId: attackerId,
            timestamp: Date.now(),
            data: {
                playerId: attackerId,
                actionType: 'attackUnit',
                attackerCarduid: 'battle_attacker',
                targetUnitUid: 'defender_target',
                targetPlayerId: defenderId,
                fromBurst: false
            }
        };
        const blockerChoiceEvent = createBlockerChoiceEvent({
            blockingPlayerId: defenderId,
            originalAttackEvent,
            availableTargets: [
                {
                    carduid: 'defender_blocker',
                    zone: 'slot2',
                    playerId: defenderId
                }
            ]
        });
        const targetChoiceEvent = createTargetChoiceEvent({
            playerId: defenderId,
            sourceCarduid: 'defender_blocker',
            effect: {
                effectId: 'follow_up_damage',
                type: 'activated',
                action: 'damage',
                target: {
                    type: 'unit',
                    scope: 'opponent',
                    count: 1
                },
                parameters: {
                    value: 2
                }
            },
            availableTargets: [
                {
                    carduid: 'follow_up_big',
                    zone: 'slot2',
                    playerId: attackerId
                },
                {
                    carduid: 'follow_up_small',
                    zone: 'slot3',
                    playerId: attackerId
                }
            ]
        });

        gameEnv.processingQueue = [blockerChoiceEvent, targetChoiceEvent];
        gameEnv.notificationQueue = [
            {
                id: blockerChoiceEvent.id,
                type: 'BLOCKER_CHOICE',
                payload: {
                    playerId: defenderId,
                    event: blockerChoiceEvent,
                    isCompleted: false
                },
                metadata: {
                    timestamp: Date.now(),
                    expiresAt: Number.MAX_SAFE_INTEGER,
                    requiresAcknowledgment: true,
                    priority: 'high'
                }
            }
        ];

        const before = gameEnv.toPersistenceJSON();
        const view = GameEnvViewBuilder.toPlayerView(gameEnv, defenderId);
        const context = new GameEnvAiContextAdapter().buildContext(view, defenderId, gameEnv);
        const candidate = {
            candidateId: 'confirm_blocker_choice_follow_up',
            kind: 'prompt',
            decision: {
                kind: 'confirmBlockerChoice',
                reason: 'confirm_blocker_choice_follow_up',
                payload: {
                    eventId: blockerChoiceEvent.id,
                    selectedTargets: [
                        {
                            carduid: 'defender_blocker',
                            zone: 'slot2',
                            playerId: defenderId
                        }
                    ]
                }
            },
            windowKind: 'OWNED_PROMPT',
            estimatedScore: 0,
            tags: [],
            requiresSimulation: true
        };

        const result = await new AiLocalSimulationAdapter().simulateCandidate(context, candidate);

        expect(result).toBeTruthy();
        expect(result.supported).toBe(true);
        expect(result.success).toBe(true);
        expect(result.remainingHpByCarduid.follow_up_big).toBe(3);
        expect(result.remainingHpByCarduid.follow_up_small).toBe(2);
        expect(result.promptChain).toEqual([
            expect.objectContaining({
                source: 'initial',
                promptType: 'BLOCKER_CHOICE',
                decisionKind: 'confirmBlockerChoice',
                success: true
            }),
            expect.objectContaining({
                source: 'follow_up',
                promptType: 'TARGET_CHOICE',
                decisionKind: 'confirmTargetChoice',
                success: true
            })
        ]);
        expect(gameEnv.toPersistenceJSON()).toEqual(before);
    });
});
