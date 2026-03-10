import { GameLogic } from '../GameLogic';
import { GameEnvironment } from '../../models/GameEnvironment';
import { GameEnvViewBuilder } from '../views/GameEnvViewBuilder';
import { GameAiService } from './GameAiService';
import { AsyncMutex } from '../../utils/AsyncMutex';
import { AI_ACTION_DELAY_MS, AI_AUTOPLAY_DEFAULT_STEPS, AI_TURN_START_DELAY_MS } from './AiAutoplayConfig';
import { AiAutoplayPacingStore } from './AiAutoplayPacingStore';
import { getPendingAiChoiceOwners, hasPendingChoiceForNonAi } from './AiAutoplayChoiceGuards';
import { AiDecisionExecutor } from './AiDecisionExecutor';
import { AiDecision } from './AiTypes';
import { GameLogicResult } from '../GameLogic';

export type AiAutoplayStateSummary = {
    isAiMatch: boolean;
    aiPlayerIds: string[];
    hasMoreAiWork: boolean;
    throttleWaitMs: number;
};

export type AiAutoplayRunResult = {
    success: boolean;
    gameEnv?: GameEnvironment;
    error?: string;
    aiStepExecuted?: boolean;
    hasMoreAiWork?: boolean;
    throttleWaitMs?: number;
};

export class AiAutoplayCoordinator {
    private static readonly gameLocks = new Map<string, AsyncMutex>();
    private static readonly scheduledAutoplayByGameId = new Map<string, NodeJS.Timeout>();
    private static readonly pacingStore = new AiAutoplayPacingStore();
    private readonly decisionExecutor: AiDecisionExecutor;

    constructor(private readonly gameLogic: GameLogic) {
        this.decisionExecutor = new AiDecisionExecutor(gameLogic);
    }

    static normalizeAiFlag(raw: unknown): boolean {
        if (raw === true) return true;
        if (typeof raw !== 'string') return false;
        const normalized = raw.trim().toLowerCase();
        return ['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(normalized);
    }

    getAiPlayerIds(gameEnv: GameEnvironment | null | undefined): string[] {
        if (!gameEnv || !Array.isArray(gameEnv.aiPlayerIds)) {
            return [];
        }
        return gameEnv.aiPlayerIds.filter((playerId: unknown): playerId is string => typeof playerId === 'string');
    }

    private hasAiWork(gameEnv: GameEnvironment | null | undefined, aiPlayerIds: string[]): boolean {
        if (!gameEnv || gameEnv.gameEnded || aiPlayerIds.length === 0) {
            return false;
        }

        if (hasPendingChoiceForNonAi(gameEnv, aiPlayerIds)) {
            return false;
        }

        if (getPendingAiChoiceOwners(gameEnv, aiPlayerIds).length > 0) {
            return true;
        }

        const currentPlayer = typeof gameEnv.currentPlayer === 'string' ? gameEnv.currentPlayer : '';
        if (currentPlayer && aiPlayerIds.includes(currentPlayer)) {
            return true;
        }

        const battle = gameEnv.currentBattle;
        if (!battle) {
            return false;
        }

        return aiPlayerIds.includes(battle.attackingPlayerId) || aiPlayerIds.includes(battle.defendingPlayerId);
    }

    private static getGameLock(gameId: string): AsyncMutex {
        let lock = this.gameLocks.get(gameId);
        if (!lock) {
            lock = new AsyncMutex();
            this.gameLocks.set(gameId, lock);
        }
        return lock;
    }

    private static clearScheduledAutoplay(gameId: string): void {
        const timer = this.scheduledAutoplayByGameId.get(gameId);
        if (!timer) {
            return;
        }
        clearTimeout(timer);
        this.scheduledAutoplayByGameId.delete(gameId);
    }

    private static getFollowUpDelayMs(): number {
        return Math.max(AI_ACTION_DELAY_MS, AI_TURN_START_DELAY_MS, 1000) + 2000;
    }

    async runWithGameLock<T>(gameId: string, work: () => Promise<T>): Promise<T> {
        const lock = AiAutoplayCoordinator.getGameLock(gameId);
        return lock.runExclusive(work);
    }

    isAiPlayer(gameEnv: GameEnvironment | null | undefined, playerId: string): boolean {
        return this.getAiPlayerIds(gameEnv).includes(playerId);
    }

    async saveAiPlayerIds(gameId: string, aiPlayerIds: string[]): Promise<void> {
        const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
        if (!gameEnv) {
            throw new Error('Game not found while saving AI metadata');
        }
        const deduped = Array.from(new Set(aiPlayerIds.filter((playerId) => typeof playerId === 'string' && playerId.length > 0)));
        gameEnv.aiPlayerIds = deduped;
        await this.gameLogic.saveGameToFile(gameId, gameEnv);
    }

    async executeAiDecision(gameId: string, aiPlayerId: string, decision: AiDecision): Promise<GameLogicResult> {
        return this.decisionExecutor.execute(gameId, aiPlayerId, decision);
    }

    async executeAiDecisionExclusive(gameId: string, aiPlayerId: string, decision: AiDecision): Promise<GameLogicResult> {
        return this.runWithGameLock(gameId, () => this.executeAiDecision(gameId, aiPlayerId, decision));
    }

    describeAutoplayState(gameId: string, gameEnv: GameEnvironment | null | undefined): AiAutoplayStateSummary {
        const aiPlayerIds = this.getAiPlayerIds(gameEnv);
        const now = Date.now();
        return {
            isAiMatch: aiPlayerIds.length > 0,
            aiPlayerIds,
            hasMoreAiWork: this.hasAiWork(gameEnv, aiPlayerIds),
            throttleWaitMs: gameEnv ? AiAutoplayCoordinator.pacingStore.getThrottleWaitMs(gameId, gameEnv, aiPlayerIds, now) : 0,
        };
    }

    async runAiAutoplay(
        gameId: string,
        viewerPlayerId: string,
        maxSteps: number = AI_AUTOPLAY_DEFAULT_STEPS
    ): Promise<AiAutoplayRunResult> {
        let aiStepExecuted = false;
        for (let step = 0; step < maxSteps; step++) {
            const latestState = await this.gameLogic.getPlayerGameState(gameId, viewerPlayerId);
            if (!latestState.success || !latestState.gameEnv) {
                return { success: false, error: latestState.error || 'Failed to load game state during AI autoplay' };
            }

            const gameEnv = latestState.gameEnv;
            if (gameEnv.gameEnded) {
                return { success: true, gameEnv };
            }

            const aiPlayerIds = this.getAiPlayerIds(gameEnv);
            if (aiPlayerIds.length === 0) {
                return { success: true, gameEnv };
            }

            const now = Date.now();
            const throttleWaitMs = AiAutoplayCoordinator.pacingStore.getThrottleWaitMs(gameId, gameEnv, aiPlayerIds, now);
            if (throttleWaitMs > 0) {
                return {
                    success: true,
                    gameEnv,
                    aiStepExecuted,
                    hasMoreAiWork: this.hasAiWork(gameEnv, aiPlayerIds),
                    throttleWaitMs,
                };
            }

            if (hasPendingChoiceForNonAi(gameEnv, aiPlayerIds)) {
                return { success: true, gameEnv };
            }

            let progressed = false;
            const priorityAiPlayerIds = getPendingAiChoiceOwners(gameEnv, aiPlayerIds);
            const actingAiPlayerIds = priorityAiPlayerIds.length > 0 ? priorityAiPlayerIds : aiPlayerIds;

            for (const aiPlayerId of actingAiPlayerIds) {
                const aiView = GameEnvViewBuilder.toPlayerView(gameEnv, aiPlayerId);
                const decision = await GameAiService.decide(aiView, aiPlayerId, { rawGameEnv: gameEnv });
                if (decision.kind === 'wait') {
                    continue;
                }

                const execution = await this.executeAiDecision(gameId, aiPlayerId, decision);
                if (!execution?.success) {
                    return { success: false, error: execution?.error || 'AI decision execution failed' };
                }

                AiAutoplayCoordinator.pacingStore.recordAction(gameId);
                aiStepExecuted = true;
                progressed = true;
                break;
            }

            if (!progressed) {
                return {
                    success: true,
                    gameEnv,
                    aiStepExecuted,
                    hasMoreAiWork: this.hasAiWork(gameEnv, aiPlayerIds),
                    throttleWaitMs: 0,
                };
            }
        }

        const finalState = await this.gameLogic.getPlayerGameState(gameId, viewerPlayerId);
        if (!finalState.success || !finalState.gameEnv) {
            return { success: false, error: finalState.error || 'Failed to load final game state after AI autoplay' };
        }
        const autoplayState = this.describeAutoplayState(gameId, finalState.gameEnv);
        return {
            success: true,
            gameEnv: finalState.gameEnv,
            aiStepExecuted,
            hasMoreAiWork: autoplayState.hasMoreAiWork,
            throttleWaitMs: autoplayState.throttleWaitMs,
        };
    }

    async runAiAutoplayForHuman(
        gameId: string,
        humanPlayerId: string,
        maxSteps: number = AI_AUTOPLAY_DEFAULT_STEPS
    ): Promise<AiAutoplayRunResult> {
        return this.runAiAutoplay(gameId, humanPlayerId, maxSteps);
    }

    async advanceAiStep(
        gameId: string,
        viewerPlayerId: string,
        maxSteps: number = AI_AUTOPLAY_DEFAULT_STEPS
    ): Promise<AiAutoplayRunResult> {
        return this.runWithGameLock(gameId, async () => {
            AiAutoplayCoordinator.clearScheduledAutoplay(gameId);
            const result = await this.runAiAutoplay(gameId, viewerPlayerId, maxSteps);
            if (result.success && result.gameEnv && result.hasMoreAiWork) {
                this.scheduleFollowUpAutoplay(gameId, viewerPlayerId);
            }
            return result;
        });
    }

    private scheduleFollowUpAutoplay(gameId: string, viewerPlayerId: string): void {
        AiAutoplayCoordinator.clearScheduledAutoplay(gameId);
        const timer = setTimeout(() => {
            AiAutoplayCoordinator.scheduledAutoplayByGameId.delete(gameId);
            void this.runWithGameLock(gameId, async () => {
                const result = await this.runAiAutoplayForHuman(gameId, viewerPlayerId, AI_AUTOPLAY_DEFAULT_STEPS);
                if (!result.success || !result.gameEnv) {
                    console.error('❌ Scheduled AI autoplay failed:', result.error || 'unknown_error');
                    return;
                }

                if (result.hasMoreAiWork) {
                    this.scheduleFollowUpAutoplay(gameId, viewerPlayerId);
                }
            });
        }, AiAutoplayCoordinator.getFollowUpDelayMs());
        timer.unref?.();
        AiAutoplayCoordinator.scheduledAutoplayByGameId.set(gameId, timer);
    }

    async maybeRunAiAfterHuman(
        gameId: string,
        humanPlayerId: string,
        gameEnv: GameEnvironment
    ): Promise<{ success: boolean; gameEnv?: GameEnvironment; error?: string }> {
        if (this.isAiPlayer(gameEnv, humanPlayerId) || this.getAiPlayerIds(gameEnv).length === 0) {
            return { success: true, gameEnv };
        }
        return this.runWithGameLock(gameId, async () => {
            AiAutoplayCoordinator.clearScheduledAutoplay(gameId);
            const result = await this.runAiAutoplayForHuman(gameId, humanPlayerId, AI_AUTOPLAY_DEFAULT_STEPS);
            if (result.success && result.gameEnv && result.hasMoreAiWork) {
                this.scheduleFollowUpAutoplay(gameId, humanPlayerId);
            }
            return result;
        });
    }
}
