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

describe('AiAutoplayCoordinator setup phase liveness', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('describeAutoplayState reports AI work when AI owns choose-first-player setup', () => {
        jest.spyOn(AiAutoplayCoordinator.pacingStore, 'getThrottleWaitMs').mockReturnValue(0);

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('player_human', 'Human');
        gameEnv.addPlayer('player_ai', 'AI');
        gameEnv.aiPlayerIds = ['player_ai'];
        gameEnv.gameStarted = true;
        gameEnv.phase = GamePhase.DECIDE_FIRST_PLAYER_PHASE;
        gameEnv.firstPlayerChooser = 'player_ai';

        const coordinator = new AiAutoplayCoordinator(new InMemoryAutoplayGameLogic(gameEnv));
        const summary = coordinator.describeAutoplayState('game_setup_choose_ai', gameEnv);

        expect(summary.isAiMatch).toBe(true);
        expect(summary.hasMoreAiWork).toBe(true);
    });

    test('describeAutoplayState reports no AI work when human owns choose-first-player setup', () => {
        jest.spyOn(AiAutoplayCoordinator.pacingStore, 'getThrottleWaitMs').mockReturnValue(0);

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('player_human', 'Human');
        gameEnv.addPlayer('player_ai', 'AI');
        gameEnv.aiPlayerIds = ['player_ai'];
        gameEnv.gameStarted = true;
        gameEnv.phase = GamePhase.DECIDE_FIRST_PLAYER_PHASE;
        gameEnv.firstPlayerChooser = 'player_human';

        const coordinator = new AiAutoplayCoordinator(new InMemoryAutoplayGameLogic(gameEnv));
        const summary = coordinator.describeAutoplayState('game_setup_choose_human', gameEnv);

        expect(summary.hasMoreAiWork).toBe(false);
    });

    test('describeAutoplayState reports AI work when AI still needs redraw confirmation', () => {
        jest.spyOn(AiAutoplayCoordinator.pacingStore, 'getThrottleWaitMs').mockReturnValue(0);

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('player_human', 'Human');
        gameEnv.addPlayer('player_ai', 'AI');
        gameEnv.aiPlayerIds = ['player_ai'];
        gameEnv.gameStarted = true;
        gameEnv.phase = GamePhase.REDRAW_PHASE;
        gameEnv.players.player_human.confirmIsRedraw = true;
        gameEnv.players.player_ai.confirmIsRedraw = false;

        const coordinator = new AiAutoplayCoordinator(new InMemoryAutoplayGameLogic(gameEnv));
        const summary = coordinator.describeAutoplayState('game_setup_redraw_ai', gameEnv);

        expect(summary.hasMoreAiWork).toBe(true);
    });

    test('describeAutoplayState reports no AI work when only human redraw confirmation is pending', () => {
        jest.spyOn(AiAutoplayCoordinator.pacingStore, 'getThrottleWaitMs').mockReturnValue(0);

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('player_human', 'Human');
        gameEnv.addPlayer('player_ai', 'AI');
        gameEnv.aiPlayerIds = ['player_ai'];
        gameEnv.gameStarted = true;
        gameEnv.phase = GamePhase.REDRAW_PHASE;
        gameEnv.players.player_human.confirmIsRedraw = false;
        gameEnv.players.player_ai.confirmIsRedraw = true;

        const coordinator = new AiAutoplayCoordinator(new InMemoryAutoplayGameLogic(gameEnv));
        const summary = coordinator.describeAutoplayState('game_setup_redraw_human', gameEnv);

        expect(summary.hasMoreAiWork).toBe(false);
    });

    test('advanceAiStep executes choose-first-player during setup and clears pending AI work', async () => {
        jest.spyOn(AiAutoplayCoordinator.pacingStore, 'getThrottleWaitMs').mockReturnValue(0);

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('player_human', 'Human');
        gameEnv.addPlayer('player_ai', 'AI');
        gameEnv.aiPlayerIds = ['player_ai'];
        gameEnv.gameStarted = true;
        gameEnv.phase = GamePhase.DECIDE_FIRST_PLAYER_PHASE;
        gameEnv.firstPlayerChooser = 'player_ai';
        gameEnv.hasChosenFirstPlayer = false;

        const chooseFirstPlayerCalls = [];
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
            async chooseFirstPlayer(_gameId, playerId, chosenFirstPlayerId) {
                chooseFirstPlayerCalls.push({ playerId, chosenFirstPlayerId });
                this.gameEnv.firstPlayerDecision = chosenFirstPlayerId;
                this.gameEnv.firstPlayer = chosenFirstPlayerId === this.gameEnv.playerId_1 ? 1 : 2;
                this.gameEnv.hasChosenFirstPlayer = true;
                this.gameEnv.firstPlayerChooser = null;
                this.gameEnv.currentPlayer = chosenFirstPlayerId;
                this.gameEnv.phase = GamePhase.REDRAW_PHASE;
                return { success: true, gameEnv: this.gameEnv };
            },
            async startReady() {
                return { success: false, error: 'unexpected startReady' };
            },
            async playerActionWithAction() {
                return { success: false, error: 'unexpected playerActionWithAction' };
            },
            async playCardWithAction() {
                return { success: false, error: 'unexpected playCardWithAction' };
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
            async processAction() {
                return { success: false, error: 'unexpected processAction' };
            }
        };

        const decideSpy = jest.spyOn(GameAiService, 'decide');
        const coordinator = new AiAutoplayCoordinator(logic);
        const result = await coordinator.advanceAiStep('game_setup_choose_exec', 'player_human', 1);

        expect(result.success).toBe(true);
        expect(result.aiStepExecuted).toBe(true);
        expect(result.hasMoreAiWork).toBe(true);
        expect(chooseFirstPlayerCalls).toEqual([
            { playerId: 'player_ai', chosenFirstPlayerId: 'player_ai' }
        ]);
        expect(decideSpy).toHaveBeenCalledTimes(1);
        expect(gameEnv.hasChosenFirstPlayer).toBe(true);
        expect(gameEnv.phase).toBe(GamePhase.REDRAW_PHASE);
    });
});

describe('AiAutoplayCoordinator scheduled follow-up pacing', () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('runs the next AI action only after the shorter recovery fallback delay', async () => {
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

        await jest.advanceTimersByTimeAsync(2499);
        expect(endTurnCalls).toHaveLength(0);
        expect(decideSpy).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1);
        await Promise.resolve();

        expect(endTurnCalls).toHaveLength(1);
        expect(decideSpy).toHaveBeenCalledTimes(2);
        expect(gameEnv.currentPlayer).toBe('player_human');
    });

    test('keeps a prompt follow-up on the same 2 second delay boundary', async () => {
        jest.useFakeTimers();
        jest.spyOn(AiAutoplayCoordinator.pacingStore, 'getThrottleWaitMs').mockReturnValue(0);

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('player_human', 'Human');
        gameEnv.addPlayer('player_ai', 'AI');
        gameEnv.aiPlayerIds = ['player_ai'];
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.currentTurn = 4;
        gameEnv.currentPlayer = 'player_ai';
        gameEnv.gameStarted = true;
        gameEnv.notificationQueue = [
            {
                id: 'target_prompt_1',
                type: 'TARGET_CHOICE',
                payload: {
                    playerId: 'player_ai',
                    isCompleted: false,
                    event: {
                        id: 'target_prompt_1',
                        type: 'TARGET_CHOICE',
                        status: 'DECLARED',
                        playerId: 'player_ai',
                        data: {
                            playerId: 'player_ai',
                            availableTargets: [
                                { carduid: 'enemy_unit_1', zone: 'slot1', playerId: 'player_human' }
                            ]
                        }
                    }
                }
            }
        ];

        const confirmTargetCalls = [];
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
            async playCardWithAction() {
                return { success: false, error: 'unexpected playCardWithAction' };
            },
            async confirmBurstChoice() {
                return { success: false, error: 'unexpected confirmBurstChoice' };
            },
            async confirmTargetChoice(_gameId, _playerId, payload) {
                confirmTargetCalls.push(payload);
                this.gameEnv.notificationQueue[0].payload.isCompleted = true;
                return { success: true, gameEnv: this.gameEnv };
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
                kind: 'confirmTargetChoice',
                reason: 'test_confirm_target',
                payload: {
                    eventId: 'target_prompt_1',
                    selectedTargets: [{ carduid: 'enemy_unit_1', zone: 'slot1', playerId: 'player_human' }]
                }
            })
            .mockResolvedValueOnce({
                kind: 'endTurn',
                reason: 'test_end_turn_after_prompt'
            })
            .mockResolvedValue({
                kind: 'wait',
                reason: 'test_wait'
            });

        const coordinator = new AiAutoplayCoordinator(logic);
        const result = await coordinator.maybeRunAiAfterHuman('game_follow_up_prompt', 'player_human', gameEnv);

        expect(result.success).toBe(true);
        expect(confirmTargetCalls).toHaveLength(1);
        expect(endTurnCalls).toHaveLength(0);
        expect(decideSpy).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(2499);
        expect(endTurnCalls).toHaveLength(0);
        expect(decideSpy).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1);
        await Promise.resolve();

        expect(endTurnCalls).toHaveLength(1);
        expect(decideSpy).toHaveBeenCalledTimes(2);
        expect(gameEnv.currentPlayer).toBe('player_human');
    });

    test('advanceAiStep executes only one decision and reports remaining AI work', async () => {
        jest.spyOn(AiAutoplayCoordinator.pacingStore, 'getThrottleWaitMs').mockReturnValue(0);

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('player_human', 'Human');
        gameEnv.addPlayer('player_ai', 'AI');
        gameEnv.aiPlayerIds = ['player_ai'];
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.currentTurn = 5;
        gameEnv.currentPlayer = 'player_ai';
        gameEnv.gameStarted = true;

        const playCardCalls = [];
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
            async processAction() {
                return { success: false, error: 'unexpected processAction' };
            }
        };

        const decideSpy = jest.spyOn(GameAiService, 'decide')
            .mockResolvedValueOnce({
                kind: 'playCard',
                reason: 'single_visible_step',
                payload: {
                    action: {
                        type: 'PlayCard',
                        carduid: 'ST01-010_ai_pair_hand_0001',
                        playAs: 'pilot',
                        targetUnit: 'unit_1'
                    }
                }
            })
            .mockResolvedValue({
                kind: 'endTurn',
                reason: 'next_step'
            });

        const coordinator = new AiAutoplayCoordinator(logic);
        const result = await coordinator.advanceAiStep('game_frontend_step', 'player_human', 1);

        expect(result.success).toBe(true);
        expect(result.aiStepExecuted).toBe(true);
        expect(result.hasMoreAiWork).toBe(true);
        expect(playCardCalls).toHaveLength(1);
        expect(decideSpy).toHaveBeenCalledTimes(1);
    });

    test('advanceAiStep reports throttle wait without executing a second visible action early', async () => {
        jest.spyOn(AiAutoplayCoordinator.pacingStore, 'getThrottleWaitMs').mockReturnValue(750);

        const gameEnv = new GameEnvironment();
        gameEnv.addPlayer('player_human', 'Human');
        gameEnv.addPlayer('player_ai', 'AI');
        gameEnv.aiPlayerIds = ['player_ai'];
        gameEnv.phase = GamePhase.MAIN_PHASE;
        gameEnv.currentTurn = 6;
        gameEnv.currentPlayer = 'player_ai';
        gameEnv.gameStarted = true;

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
            }
        };

        const decideSpy = jest.spyOn(GameAiService, 'decide');
        const coordinator = new AiAutoplayCoordinator(logic);
        const result = await coordinator.advanceAiStep('game_frontend_throttle', 'player_human', 1);

        expect(result.success).toBe(true);
        expect(result.aiStepExecuted).toBe(false);
        expect(result.hasMoreAiWork).toBe(true);
        expect(result.throttleWaitMs).toBe(750);
        expect(decideSpy).not.toHaveBeenCalled();
    });
});
