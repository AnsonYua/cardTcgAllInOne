import { GameLogic } from '../GameLogic';
import { GameEnvironment } from '../../models/GameEnvironment';
import { PlayerActionType } from '../../models/GameEnums';
import { PlayerAction } from '../../models/EventInterfaces';
import { GameEnvViewBuilder } from '../views/GameEnvViewBuilder';
import { GameAiService } from './GameAiService';
import { CHOICE_EVENT_TYPES } from './AiTypes';
import { AsyncMutex } from '../../utils/AsyncMutex';

export class AiAutoplayCoordinator {
    private static readonly gameLocks = new Map<string, AsyncMutex>();

    constructor(private readonly gameLogic: GameLogic) {}

    static normalizeAiFlag(raw: unknown): boolean {
        if (raw === true) return true;
        if (typeof raw !== 'string') return false;
        const normalized = raw.trim().toLowerCase();
        return ['1', 'true', 'yes', 'on', 'enable', 'enabled'].includes(normalized);
    }

    getAiPlayerIds(gameEnv: GameEnvironment | null | undefined): string[] {
        if (!gameEnv || !Array.isArray((gameEnv as any).aiPlayerIds)) {
            return [];
        }
        return (gameEnv as any).aiPlayerIds.filter((playerId: unknown): playerId is string => typeof playerId === 'string');
    }

    private static getGameLock(gameId: string): AsyncMutex {
        let lock = this.gameLocks.get(gameId);
        if (!lock) {
            lock = new AsyncMutex();
            this.gameLocks.set(gameId, lock);
        }
        return lock;
    }

    async runWithGameLock<T>(gameId: string, work: () => Promise<T>): Promise<T> {
        const lock = AiAutoplayCoordinator.getGameLock(gameId);
        return lock.runExclusive(work);
    }

    private static getChoiceOwner(event: any): string | null {
        if (!event) return null;
        if (typeof event.playerId === 'string' && event.playerId.length > 0) {
            return event.playerId;
        }
        const data = event.data || {};
        if (typeof data.blockingPlayerId === 'string' && data.blockingPlayerId.length > 0) {
            return data.blockingPlayerId;
        }
        if (typeof data.playerId === 'string' && data.playerId.length > 0) {
            return data.playerId;
        }
        return null;
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
        (gameEnv as any).aiPlayerIds = deduped;
        await this.gameLogic.saveGameToFile(gameId, gameEnv);
    }

    async executeAiDecision(gameId: string, aiPlayerId: string, decision: any): Promise<any> {
        switch (decision.kind) {
            case 'chooseFirstPlayer':
                return this.gameLogic.chooseFirstPlayer(
                    gameId,
                    aiPlayerId,
                    String(decision.payload?.chosenFirstPlayerId || aiPlayerId)
                );
            case 'startReady':
                return this.gameLogic.startReady(
                    gameId,
                    aiPlayerId,
                    Boolean(decision.payload?.isRedraw)
                );
            case 'confirmBurstChoice':
                return this.gameLogic.confirmBurstChoice(
                    gameId,
                    aiPlayerId,
                    String(decision.payload?.eventId || ''),
                    Boolean(decision.payload?.confirmed)
                );
            case 'confirmTargetChoice':
                return this.gameLogic.confirmTargetChoice(
                    gameId,
                    aiPlayerId,
                    String(decision.payload?.eventId || ''),
                    Array.isArray(decision.payload?.selectedTargets) ? decision.payload.selectedTargets : []
                );
            case 'confirmBlockerChoice':
                return this.gameLogic.confirmBlockerChoice(
                    gameId,
                    aiPlayerId,
                    String(decision.payload?.eventId || ''),
                    Array.isArray(decision.payload?.selectedTargets) ? decision.payload.selectedTargets : []
                );
            case 'confirmTokenChoice':
                return this.gameLogic.confirmTokenChoice(
                    gameId,
                    aiPlayerId,
                    String(decision.payload?.eventId || ''),
                    Number(decision.payload?.selectedChoiceIndex ?? 0)
                );
            case 'confirmOptionChoice':
                return this.gameLogic.confirmOptionChoice(
                    gameId,
                    aiPlayerId,
                    String(decision.payload?.eventId || ''),
                    Number(decision.payload?.selectedOptionIndex ?? 0)
                );
            case 'playerAction':
                return this.executePlayerAction(gameId, aiPlayerId, decision);
            case 'playCard':
                return this.gameLogic.playCardWithAction(
                    gameId,
                    aiPlayerId,
                    { ...(decision.payload?.action as Record<string, unknown>) }
                );
            case 'endTurn': {
                const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
                if (!gameEnv) {
                    return { success: false, error: 'Game not found' };
                }
                if (gameEnv.currentPlayer !== aiPlayerId) {
                    return { success: false, error: `Not AI turn. Current player: ${gameEnv.currentPlayer}` };
                }
                const endTurnAction: PlayerAction = {
                    type: PlayerActionType.END_TURN,
                    playerId: aiPlayerId,
                    gameId,
                    currentTurn: gameEnv.currentTurn
                };
                const actionResult = await this.gameLogic.processAction(gameEnv, endTurnAction);
                if (!actionResult.success) {
                    return { success: false, error: actionResult.error || 'Failed to end turn' };
                }
                await this.gameLogic.saveGameToFile(gameId, gameEnv);
                return { success: true, gameId, gameEnv };
            }
            default:
                return { success: false, error: `Unsupported AI decision: ${decision.kind}` };
        }
    }

    private async executePlayerAction(gameId: string, aiPlayerId: string, decision: any): Promise<any> {
        const payload = { ...(decision.payload || {}) };
        const result = await this.gameLogic.playerActionWithAction(gameId, aiPlayerId, payload);
        if (result?.success || result?.errorCode !== 'FORCED_ATTACK_TARGET_REQUIRED') {
            return result;
        }

        const errorMessage = typeof result?.error === 'string' ? result.error : '';
        const match = errorMessage.match(/targetUnitUid=([A-Za-z0-9_-]+)/);
        if (!match) {
            return result;
        }

        const forcedTargetUid = match[1];
        const attackerCarduid = typeof payload.attackerCarduid === 'string' ? payload.attackerCarduid : '';
        if (!attackerCarduid) {
            return result;
        }

        const gameEnv = await this.gameLogic.loadGameFromFile(gameId);
        if (!gameEnv) {
            return result;
        }

        const targetPlayerId = this.findPlayerIdByCarduid(gameEnv, forcedTargetUid);
        if (!targetPlayerId) {
            return result;
        }

        return this.gameLogic.playerActionWithAction(gameId, aiPlayerId, {
            actionType: 'attackUnit',
            attackerCarduid,
            targetPlayerId,
            targetUnitUid: forcedTargetUid
        });
    }

    private findPlayerIdByCarduid(gameEnv: GameEnvironment, carduid: string): string | null {
        for (const [playerId, player] of Object.entries(gameEnv.players || {})) {
            const zones = (player as any)?.zones || {};
            for (let i = 1; i <= 6; i++) {
                const slot = zones[`slot${i}`];
                if (slot?.unit?.carduid === carduid || slot?.pilot?.carduid === carduid) {
                    return playerId;
                }
            }
        }
        return null;
    }

    async executeAiDecisionExclusive(gameId: string, aiPlayerId: string, decision: any): Promise<any> {
        return this.runWithGameLock(gameId, () => this.executeAiDecision(gameId, aiPlayerId, decision));
    }

    async runAiAutoplayForHuman(
        gameId: string,
        humanPlayerId: string,
        maxSteps: number = 64
    ): Promise<{ success: boolean; gameEnv?: GameEnvironment; error?: string }> {
        for (let step = 0; step < maxSteps; step++) {
            const latestState = await this.gameLogic.getPlayerGameState(gameId, humanPlayerId);
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

            const pendingChoice = gameEnv.processingQueue.find((event: any) =>
                event?.status === 'DECLARED' && CHOICE_EVENT_TYPES.has(event?.type)
            );
            const choiceOwner = AiAutoplayCoordinator.getChoiceOwner(pendingChoice);
            if (choiceOwner && !aiPlayerIds.includes(choiceOwner)) {
                return { success: true, gameEnv };
            }

            let progressed = false;

            for (const aiPlayerId of aiPlayerIds) {
                const aiView = GameEnvViewBuilder.toPlayerView(gameEnv, aiPlayerId);
                const decision = GameAiService.decide(aiView, aiPlayerId);
                if (decision.kind === 'wait') {
                    continue;
                }

                const execution = await this.executeAiDecision(gameId, aiPlayerId, decision);
                if (!execution?.success) {
                    return { success: false, error: execution?.error || 'AI decision execution failed' };
                }

                progressed = true;
                break;
            }

            if (!progressed) {
                return { success: true, gameEnv };
            }
        }

        const finalState = await this.gameLogic.getPlayerGameState(gameId, humanPlayerId);
        if (!finalState.success || !finalState.gameEnv) {
            return { success: false, error: finalState.error || 'Failed to load final game state after AI autoplay' };
        }
        return { success: true, gameEnv: finalState.gameEnv };
    }

    async maybeRunAiAfterHuman(
        gameId: string,
        humanPlayerId: string,
        gameEnv: GameEnvironment
    ): Promise<{ success: boolean; gameEnv?: GameEnvironment; error?: string }> {
        if (this.isAiPlayer(gameEnv, humanPlayerId) || this.getAiPlayerIds(gameEnv).length === 0) {
            return { success: true, gameEnv };
        }
        return this.runWithGameLock(gameId, () => this.runAiAutoplayForHuman(gameId, humanPlayerId));
    }
}
