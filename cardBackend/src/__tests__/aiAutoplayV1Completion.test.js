const { GamePhase, PlayerActionType } = require('../models/GameEnums');
const { GameEnvironment } = require('../models/GameEnvironment');
const { AiAutoplayCoordinator } = require('../services/ai/AiAutoplayCoordinator');

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
