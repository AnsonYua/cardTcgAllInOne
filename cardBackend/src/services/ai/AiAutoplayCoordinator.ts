import { GameLogic } from '../GameLogic';
import { GameEnvironment } from '../../models/GameEnvironment';
import { PlayerActionType } from '../../models/GameEnums';
import { PlayerAction } from '../../models/EventInterfaces';
import { GameEnvViewBuilder } from '../views/GameEnvViewBuilder';
import { GameAiService } from './GameAiService';

export class AiAutoplayCoordinator {
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
                return this.gameLogic.playerActionWithAction(
                    gameId,
                    aiPlayerId,
                    { ...(decision.payload || {}) }
                );
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
        return this.runAiAutoplayForHuman(gameId, humanPlayerId);
    }
}

