import { GameEnvironment } from '../../models/GameEnvironment';
import { AI_ACTION_DELAY_MS, AI_TURN_START_DELAY_MS } from './AiAutoplayConfig';

type PacingState = {
    lastActionAt: number;
    turnDelayKey: string | null;
    turnDelayUntil: number;
};

export class AiAutoplayPacingStore {
    private readonly pacingByGameId = new Map<string, PacingState>();

    private getState(gameId: string): PacingState {
        let state = this.pacingByGameId.get(gameId);
        if (!state) {
            state = { lastActionAt: 0, turnDelayKey: null, turnDelayUntil: 0 };
            this.pacingByGameId.set(gameId, state);
        }
        return state;
    }

    private static buildCurrentAiTurnKey(gameEnv: GameEnvironment, aiPlayerIds: string[]): string | null {
        const currentPlayer = typeof gameEnv.currentPlayer === 'string' ? gameEnv.currentPlayer : '';
        if (!currentPlayer || !aiPlayerIds.includes(currentPlayer)) {
            return null;
        }
        return `${currentPlayer}:${gameEnv.currentTurn}`;
    }

    getThrottleWaitMs(gameId: string, gameEnv: GameEnvironment, aiPlayerIds: string[], now: number): number {
        const state = this.getState(gameId);
        let waitUntil = state.lastActionAt + AI_ACTION_DELAY_MS;

        const currentAiTurnKey = AiAutoplayPacingStore.buildCurrentAiTurnKey(gameEnv, aiPlayerIds);
        if (currentAiTurnKey) {
            if (state.turnDelayKey !== currentAiTurnKey) {
                state.turnDelayKey = currentAiTurnKey;
                state.turnDelayUntil = now + AI_TURN_START_DELAY_MS;
            }
            waitUntil = Math.max(waitUntil, state.turnDelayUntil);
        } else {
            state.turnDelayKey = null;
            state.turnDelayUntil = 0;
        }

        return Math.max(0, waitUntil - now);
    }

    recordAction(gameId: string, atMs: number = Date.now()): void {
        const state = this.getState(gameId);
        state.lastActionAt = atMs;
    }
}
