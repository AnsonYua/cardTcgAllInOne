const { EventPriority, EventStatus } = require('../services/EventQueue/interfaces/GameEvent');
const { EventType, GamePhase } = require('../models/GameEnums');
const { GameEnvironment } = require('../models/GameEnvironment');
const { GameEnvViewBuilder } = require('../services/views/GameEnvViewBuilder');
const { GameAiService } = require('../services/ai/GameAiService');

function createUnit(carduid, ap, hp, isRested = true) {
    return {
        carduid,
        cardId: carduid,
        cardData: {
            cardType: 'unit',
            name: carduid,
            ap,
            hp
        },
        originalAP: ap,
        originalHP: hp,
        damageReceived: 0,
        isRested,
        playedThisTurn: false,
        canAttackThisTurn: true,
        canAttackOnPlayTurn: true
    };
}

describe('GameAiService v1 notification-first prompt handling', () => {
    test('resolves target choice from notification data and prefers the stronger enemy target', async () => {
        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('playerId_1', 'P1');
        gameEnv.addPlayer('playerId_2', 'P2');
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.currentPlayer = 'playerId_2';

        gameEnv.players.playerId_1.zones.slot1.unit = createUnit('enemy_small', 1, 2, true);
        gameEnv.players.playerId_1.zones.slot2.unit = createUnit('enemy_big', 4, 5, true);
        gameEnv.players.playerId_2.zones.slot1.unit = createUnit('ai_unit', 3, 4, false);

        const targetChoiceEvent = {
            id: 'target_choice_pick_big',
            type: EventType.TARGET_CHOICE,
            status: EventStatus.DECLARED,
            priority: EventPriority.IMMEDIATE,
            playerId: 'playerId_2',
            timestamp: Date.now(),
            data: {
                choiceId: 'choice_target_choice_pick_big',
                userDecisionMade: false,
                sourceCarduid: 'ai_unit',
                effect: {
                    effectId: 'effect_pick_enemy',
                    action: 'damage',
                    optional: false,
                    target: {
                        count: 1,
                        scope: 'opponent'
                    }
                },
                availableTargets: [
                    { carduid: 'enemy_small', zone: 'slot1', playerId: 'playerId_1', cardData: { ap: 1, hp: 2 } },
                    { carduid: 'enemy_big', zone: 'slot2', playerId: 'playerId_1', cardData: { ap: 4, hp: 5 } }
                ]
            }
        };

        gameEnv.processingQueue = [targetChoiceEvent];
        gameEnv.notificationQueue = [
            {
                id: 'target_choice_pick_big',
                type: 'TARGET_CHOICE',
                metadata: {
                    timestamp: Date.now(),
                    expiresAt: Number.MAX_SAFE_INTEGER,
                    requiresAcknowledgment: true,
                    priority: 'high'
                },
                payload: {
                    playerId: 'playerId_2',
                    isCompleted: false,
                    event: targetChoiceEvent
                }
            }
        ];

        const view = GameEnvViewBuilder.toPlayerView(gameEnv, 'playerId_2');
        const decision = await GameAiService.decide(view, 'playerId_2', { rawGameEnv: gameEnv });

        expect(decision.kind).toBe('confirmTargetChoice');
        expect(decision.payload.eventId).toBe('target_choice_pick_big');
        expect(decision.payload.selectedTargets).toEqual([
            expect.objectContaining({ carduid: 'enemy_big' })
        ]);
    });

    test('surfaces simulated prompt-chain telemetry on the chosen v1 decision', async () => {
        const gameEnv = new GameEnvironment();
        const aiPlayerId = 'playerId_1';
        const opponentId = 'playerId_2';
        const aiPlayer = gameEnv.addPlayer(aiPlayerId, 'P1');
        gameEnv.addPlayer(opponentId, 'P2');
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.currentPlayer = aiPlayerId;
        gameEnv.currentTurn = 4;
        gameEnv.gameStarted = true;

        aiPlayer.zones.slot1.unit = {
            carduid: 'ai_source_unit',
            cardId: 'AI-SOURCE',
            cardData: {
                cardType: 'unit',
                name: 'AI Source Unit',
                ap: 3,
                hp: 4,
                effects: {
                    rules: [
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
                    ]
                }
            },
            originalAP: 3,
            originalHP: 4,
            damageReceived: 0,
            isRested: true,
            playedThisTurn: false,
            canAttackThisTurn: false,
            canAttackOnPlayTurn: false,
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
            ]
        };

        gameEnv.players[opponentId].zones.slot1.unit = createUnit('enemy_small', 1, 2, true);
        gameEnv.players[opponentId].zones.slot2.unit = createUnit('enemy_big', 4, 5, true);

        const view = GameEnvViewBuilder.toPlayerView(gameEnv, aiPlayerId);
        const decision = await GameAiService.decide(view, aiPlayerId, { rawGameEnv: gameEnv });

        expect(decision.kind).toBe('playerAction');
        expect(decision.payload).toEqual(expect.objectContaining({
            actionType: 'activateCardAbility',
            carduid: 'ai_source_unit',
            effectId: 'activate_damage'
        }));
        expect(decision.telemetry.promptChain).toEqual([
            expect.objectContaining({
                source: 'follow_up',
                promptType: 'TARGET_CHOICE',
                decisionKind: 'confirmTargetChoice',
                success: true
            })
        ]);
        expect(decision.telemetry.simulation).toEqual(expect.objectContaining({
            success: true,
            promptChain: expect.any(Array)
        }));
    });
});
