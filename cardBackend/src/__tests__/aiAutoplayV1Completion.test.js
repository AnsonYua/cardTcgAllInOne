const { GamePhase, PlayerActionType } = require('../models/GameEnums');
const { GameEnvironment } = require('../models/GameEnvironment');
const { AiAutoplayCoordinator } = require('../services/ai/AiAutoplayCoordinator');
const { GameAiService } = require('../services/ai/GameAiService');

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

class InMemoryAutoplayGameLogic {
    constructor(gameEnv) {
        this.gameEnv = gameEnv;
    }

    async getPlayerGameState(gameId) {
        return {
            success: true,
            gameId,
            gameEnv: this.gameEnv
        };
    }

    async loadGameFromFile() {
        return this.gameEnv;
    }

    async saveGameToFile(_gameId, gameEnv) {
        this.gameEnv = gameEnv;
    }

    async playerActionWithAction(gameId, aiPlayerId, payload) {
        if (payload.actionType === 'attackShieldArea' || payload.actionType === 'attackUnit') {
            this.gameEnv.gameEnded = true;
            this.gameEnv.winnerId = aiPlayerId;
            return {
                success: true,
                gameId,
                gameEnv: this.gameEnv
            };
        }

        if (payload.actionType === 'confirmBattle' || payload.actionType === 'resolveBattle') {
            return {
                success: true,
                gameId,
                gameEnv: this.gameEnv
            };
        }

        return {
            success: false,
            error: `Unexpected player action: ${payload.actionType}`
        };
    }

    async playCardWithAction() {
        return {
            success: false,
            error: 'Unexpected playCardWithAction in autoplay completion test'
        };
    }

    async confirmBurstChoice() {
        return { success: false, error: 'Unexpected confirmBurstChoice in autoplay completion test' };
    }

    async confirmTargetChoice() {
        return { success: false, error: 'Unexpected confirmTargetChoice in autoplay completion test' };
    }

    async confirmBlockerChoice() {
        return { success: false, error: 'Unexpected confirmBlockerChoice in autoplay completion test' };
    }

    async confirmTokenChoice() {
        return { success: false, error: 'Unexpected confirmTokenChoice in autoplay completion test' };
    }

    async confirmOptionChoice() {
        return { success: false, error: 'Unexpected confirmOptionChoice in autoplay completion test' };
    }

    async processAction(gameEnv, action) {
        if (action.type === PlayerActionType.END_TURN) {
            const playerIds = Object.keys(gameEnv.players || {});
            const nextPlayerId = playerIds.find((playerId) => playerId !== action.playerId) || action.playerId;
            gameEnv.currentPlayer = nextPlayerId;
            gameEnv.currentTurn += 1;
            gameEnv.phase = GamePhase.MAIN_PHASE;
            return { success: true };
        }

        return { success: false, error: `Unexpected processAction type: ${action.type}` };
    }
}

function createAutoplayGame({ aiPlayerIds, currentPlayerId, attackerOwnerId, defenderId }) {
    const gameEnv = new GameEnvironment();
    for (const playerId of ['player_human', 'player_ai_1', 'player_ai_2']) {
        if (!gameEnv.players[playerId]) {
            gameEnv.addPlayer(playerId, playerId);
        }
    }
    gameEnv.aiPlayerIds = aiPlayerIds;
    gameEnv.phase = GamePhase.MAIN_PHASE;
    gameEnv.currentTurn = 2;
    gameEnv.currentPlayer = currentPlayerId;
    gameEnv.gameStarted = true;

    gameEnv.players[attackerOwnerId].zones.slot1.unit = createUnit('ai_attacker', 4, 4, false);
    gameEnv.players[defenderId].zones.shieldCount = 0;
    gameEnv.players[defenderId].zones.slot1.unit = createUnit('defender_unit', 2, 2, true);

    return gameEnv;
}

describe('AiAutoplayCoordinator v1 completion', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('completes a human-vs-AI autoplay line through the v1-only path', async () => {
        jest.spyOn(AiAutoplayCoordinator.pacingStore, 'getThrottleWaitMs').mockReturnValue(0);

        const gameEnv = createAutoplayGame({
            aiPlayerIds: ['player_ai_1'],
            currentPlayerId: 'player_ai_1',
            attackerOwnerId: 'player_ai_1',
            defenderId: 'player_human'
        });

        const coordinator = new AiAutoplayCoordinator(new InMemoryAutoplayGameLogic(gameEnv));
        const result = await coordinator.runAiAutoplayForHuman('game_human_vs_ai', 'player_human', 4);

        expect(result.success).toBe(true);
        expect(result.gameEnv.gameEnded).toBe(true);
        expect(result.gameEnv.winnerId).toBe('player_ai_1');
    });

    test('completes an AI-vs-AI autoplay line through the generic coordinator loop', async () => {
        jest.spyOn(AiAutoplayCoordinator.pacingStore, 'getThrottleWaitMs').mockReturnValue(0);

        const gameEnv = createAutoplayGame({
            aiPlayerIds: ['player_ai_1', 'player_ai_2'],
            currentPlayerId: 'player_ai_1',
            attackerOwnerId: 'player_ai_1',
            defenderId: 'player_ai_2'
        });

        const coordinator = new AiAutoplayCoordinator(new InMemoryAutoplayGameLogic(gameEnv));
        const result = await coordinator.runAiAutoplay('game_ai_vs_ai', 'player_ai_1', 4);

        expect(result.success).toBe(true);
        expect(result.gameEnv.gameEnded).toBe(true);
        expect(result.gameEnv.winnerId).toBe('player_ai_1');
    });
});

describe('AiAutoplayCoordinator scheduled follow-up pacing', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('runs the next AI action only after the 1 second follow-up delay', async () => {
        jest.useFakeTimers();
        jest.spyOn(AiAutoplayCoordinator.pacingStore, 'getThrottleWaitMs').mockReturnValue(0);

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('player_human', 'Human');
        gameEnv.addPlayer('player_ai', 'AI');
        gameEnv.aiPlayerIds = ['player_ai'];
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.currentTurn = 3;
        gameEnv.currentPlayer = 'player_ai';
        gameEnv.gameStarted = true;

        const playCardCalls = [];
        const endTurnCalls = [];

        const logic = {
            gameEnv,
            async getPlayerGameState() {
                return { success: true, gameEnv: this.gameEnv };
            },
            async loadGameFromFile() {
                return this.gameEnv;
            },
            async saveGameToFile(_gameId, nextGameEnv) {
                this.gameEnv = nextGameEnv;
            },
            async playerActionWithAction() {
                return { success: false, error: 'unexpected playerActionWithAction' };
            },
            async playCardWithAction(_gameId, _playerId, action) {
                playCardCalls.push(action);
                return { success: true, gameEnv: this.gameEnv };
            },
            async confirmBurstChoice() {
                return { success: false, error: 'unexpected confirmBurstChoice' };
            },
            async confirmTargetChoice() {
                return { success: false, error: 'unexpected confirmTargetChoice' };
            },
            async confirmBlockerChoice() {
                return { success: false, error: 'unexpected confirmBlockerChoice' };
            },
            async confirmTokenChoice() {
                return { success: false, error: 'unexpected confirmTokenChoice' };
            },
            async confirmOptionChoice() {
                return { success: false, error: 'unexpected confirmOptionChoice' };
            },
            async processAction(currentEnv, action) {
                if (action.type === PlayerActionType.END_TURN) {
                    endTurnCalls.push(action);
                    currentEnv.currentPlayer = 'player_human';
                    currentEnv.currentTurn += 1;
                    return { success: true };
                }
                return { success: false, error: `Unexpected processAction type: ${action.type}` };
            }
        };

        const decideSpy = jest.spyOn(GameAiService, 'decide')
            .mockResolvedValueOnce({
                kind: 'playCard',
                reason: 'test_play_card',
                payload: {
                    action: {
                        type: 'PlayCard',
                        carduid: 'ST01-010_ai_pair_hand_0001',
                        playAs: 'pilot',
                        targetUnit: 'unit_1'
                    }
                }
            })
            .mockResolvedValueOnce({
                kind: 'endTurn',
                reason: 'test_end_turn'
            })
            .mockResolvedValue({
                kind: 'wait',
                reason: 'test_wait'
            });

        const coordinator = new AiAutoplayCoordinator(logic);
        const result = await coordinator.maybeRunAiAfterHuman('game_follow_up', 'player_human', gameEnv);

        expect(result.success).toBe(true);
        expect(playCardCalls).toHaveLength(1);
        expect(endTurnCalls).toHaveLength(0);
        expect(decideSpy).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(999);
        expect(endTurnCalls).toHaveLength(0);
        expect(decideSpy).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1);
        await Promise.resolve();

        expect(endTurnCalls).toHaveLength(1);
        expect(decideSpy).toHaveBeenCalledTimes(2);
        expect(gameEnv.currentPlayer).toBe('player_human');
    });
});
