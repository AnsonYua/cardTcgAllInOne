const { GamePhase } = require('../models/GameEnums');
const { GameEnvironment } = require('../models/GameEnvironment');
const { GameEnvViewBuilder } = require('../services/views/GameEnvViewBuilder');
const { GameAiService } = require('../services/ai/GameAiService');
const { GameAiV1Service } = require('../services/ai/v1/GameAiV1Service');

function createUnit(carduid, ap, hp, isRested = false) {
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
        canAttackThisTurn: !isRested,
        canAttackOnPlayTurn: true
    };
}

describe('GameAiService v1-only cutover', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('returns v1 search telemetry on a live decision', async () => {
        const gameEnv = new GameEnvironment();
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';
        gameEnv.addPlayer(aiPlayerId, 'AI');
        gameEnv.addPlayer(opponentId, 'Opponent');
        gameEnv.aiPlayerIds = [aiPlayerId];
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.currentTurn = 3;
        gameEnv.currentPlayer = aiPlayerId;
        gameEnv.gameStarted = true;

        gameEnv.players[aiPlayerId].zones.slot1.unit = createUnit('attacker', 4, 4, false);
        gameEnv.players[opponentId].zones.slot1.unit = createUnit('enemy_target', 3, 4, true);

        const view = GameEnvViewBuilder.toPlayerView(gameEnv, aiPlayerId);
        const decision = await GameAiService.decide(view, aiPlayerId, { rawGameEnv: gameEnv });

        expect(decision).toBeTruthy();
        expect(decision.telemetry).toEqual(expect.objectContaining({
            lineHistory: expect.any(Array),
            search: expect.objectContaining({
                rootCandidates: expect.any(Array),
                simulatedNodeCount: expect.any(Number),
                budgetUsedMs: expect.any(Number),
                budgetRemainingMs: expect.any(Number),
                bestLineScore: expect.any(Number)
            }),
            topCandidates: expect.any(Array)
        }));
        expect(decision.telemetry.search.budgetRemainingMs).toBeLessThanOrEqual(750);
        expect(decision.telemetry.search.budgetRemainingMs).toBeGreaterThanOrEqual(0);
    });

    test('breaks equal-score ties deterministically', async () => {
        const aiPlayerId = 'player_ai';
        const opponentId = 'player_op';
        const gameEnvView = {
            phase: GamePhase.MAIN_PHASE,
            currentPlayer: aiPlayerId,
            currentTurn: 3,
            playerId_1: aiPlayerId,
            playerId_2: opponentId,
            notificationQueue: [],
            players: {
                [aiPlayerId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        shieldCount: 3,
                        energyArea: [],
                        trashArea: [],
                        base: [],
                        slot1: {
                            unit: createUnit('attacker', 4, 5, false),
                            fieldCardValue: {
                                totalAP: 4,
                                totalHP: 5,
                                totalDamageReceived: 0
                            }
                        }
                    }
                },
                [opponentId]: {
                    deck: { hand: [], handCount: 0 },
                    zones: {
                        shieldCount: 3,
                        energyArea: [],
                        trashArea: [],
                        base: [],
                        slot1: {
                            unit: createUnit('enemy_alpha', 2, 4, true),
                            fieldCardValue: {
                                totalAP: 2,
                                totalHP: 4,
                                totalDamageReceived: 0
                            }
                        },
                        slot2: {
                            unit: createUnit('enemy_beta', 2, 4, true),
                            fieldCardValue: {
                                totalAP: 2,
                                totalHP: 4,
                                totalDamageReceived: 0
                            }
                        }
                    }
                }
            }
        };

        const decisions = await Promise.all([
            GameAiService.decide(gameEnvView, aiPlayerId),
            GameAiService.decide(gameEnvView, aiPlayerId),
            GameAiService.decide(gameEnvView, aiPlayerId)
        ]);

        expect(decisions.every((decision) => decision.kind === 'playerAction')).toBe(true);
        expect(new Set(decisions.map((decision) => decision.payload.targetUnitUid)).size).toBe(1);
        expect(decisions[0].payload.targetUnitUid).toBe('enemy_alpha');
    });

    test('uses the v1 wrapper emergency fallback when the v1 service throws', async () => {
        jest.spyOn(GameAiV1Service, 'decide').mockRejectedValue(new Error('boom'));

        const decision = await GameAiService.decide({
            phase: GamePhase.MAIN_PHASE,
            currentPlayer: 'player_ai',
            currentTurn: 1,
            playerId_1: 'player_ai',
            playerId_2: 'player_op',
            notificationQueue: [],
            players: {
                player_ai: { deck: { hand: [], handCount: 0 }, zones: { shieldCount: 3, energyArea: [], trashArea: [], base: [] } },
                player_op: { deck: { hand: [], handCount: 0 }, zones: { shieldCount: 3, energyArea: [], trashArea: [], base: [] } }
            }
        }, 'player_ai');

        expect(decision.kind).toBe('endTurn');
        expect(decision.reason).toBe('v1_wrapper_emergency_end_turn');
        expect(decision.telemetry).toEqual(expect.objectContaining({
            fallbackReason: 'v1_pipeline_error',
            fallbackKind: 'wrapper_end_turn'
        }));
    });

    test('returns the v1 decision unchanged on the normal live path', async () => {
        jest.spyOn(GameAiV1Service, 'decide').mockResolvedValue({
            kind: 'wait',
            reason: 'v1_wait',
            telemetry: {
                windowKind: 'WAIT',
                budgetUsedMs: 0,
                budgetRemainingMs: 750
            }
        });

        const decision = await GameAiService.decide({
            phase: GamePhase.MAIN_PHASE,
            currentPlayer: 'player_op',
            currentTurn: 1,
            playerId_1: 'player_ai',
            playerId_2: 'player_op',
            notificationQueue: [],
            players: {
                player_ai: { deck: { hand: [], handCount: 0 }, zones: { shieldCount: 3, energyArea: [], trashArea: [], base: [] } },
                player_op: { deck: { hand: [], handCount: 0 }, zones: { shieldCount: 3, energyArea: [], trashArea: [], base: [] } }
            }
        }, 'player_ai');

        expect(decision).toEqual({
            kind: 'wait',
            reason: 'v1_wait',
            telemetry: {
                windowKind: 'WAIT',
                budgetUsedMs: 0,
                budgetRemainingMs: 750
            }
        });
        expect(decision.telemetry.fallbackReason).toBeUndefined();
    });
});
