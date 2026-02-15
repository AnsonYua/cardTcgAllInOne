import { GameLogic } from '../GameLogic';
import { GameEnvironment } from '../../models/GameEnvironment';
import { PlayerActionType } from '../../models/GameEnums';
import { PlayerAction } from '../../models/EventInterfaces';
import { AiDecision } from './AiTypes';
import { GameLogicResult } from '../GameLogic';
import { PlayerZones } from '../../models/Player';
import { SLOT_NAMES } from './AiTypes';

type DecisionPayload = Record<string, unknown>;
type TargetSelection = { carduid: string; zone: string; playerId: string };
type SlotLike = { unit?: { carduid?: string }; pilot?: { carduid?: string } };

export class AiDecisionExecutor {
    constructor(private readonly gameLogic: GameLogic) {}

    private static asRecord(value: unknown): Record<string, unknown> {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};
    }

    private static asString(value: unknown, fallback: string = ''): string {
        return typeof value === 'string' ? value : fallback;
    }

    private static asBoolean(value: unknown, fallback: boolean = false): boolean {
        return typeof value === 'boolean' ? value : fallback;
    }

    private static asNumber(value: unknown, fallback: number = 0): number {
        const parsed = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    private static asTargetSelections(value: unknown): TargetSelection[] {
        if (!Array.isArray(value)) return [];
        return value
            .map((entry) => AiDecisionExecutor.asRecord(entry))
            .map((entry) => ({
                carduid: AiDecisionExecutor.asString(entry.carduid),
                zone: AiDecisionExecutor.asString(entry.zone),
                playerId: AiDecisionExecutor.asString(entry.playerId)
            }))
            .filter((entry) => Boolean(entry.carduid && entry.zone && entry.playerId));
    }

    private static payloadOf(decision: AiDecision): DecisionPayload {
        return AiDecisionExecutor.asRecord(decision.payload);
    }

    async execute(gameId: string, aiPlayerId: string, decision: AiDecision): Promise<GameLogicResult> {
        const payload = AiDecisionExecutor.payloadOf(decision);
        switch (decision.kind) {
            case 'chooseFirstPlayer':
                return this.gameLogic.chooseFirstPlayer(
                    gameId,
                    aiPlayerId,
                    AiDecisionExecutor.asString(payload.chosenFirstPlayerId, aiPlayerId)
                );
            case 'startReady':
                return this.gameLogic.startReady(
                    gameId,
                    aiPlayerId,
                    AiDecisionExecutor.asBoolean(payload.isRedraw)
                );
            case 'confirmBurstChoice':
                return this.gameLogic.confirmBurstChoice(
                    gameId,
                    aiPlayerId,
                    AiDecisionExecutor.asString(payload.eventId),
                    AiDecisionExecutor.asBoolean(payload.confirmed)
                );
            case 'confirmTargetChoice':
                return this.gameLogic.confirmTargetChoice(
                    gameId,
                    aiPlayerId,
                    AiDecisionExecutor.asString(payload.eventId),
                    AiDecisionExecutor.asTargetSelections(payload.selectedTargets)
                );
            case 'confirmBlockerChoice':
                return this.gameLogic.confirmBlockerChoice(
                    gameId,
                    aiPlayerId,
                    AiDecisionExecutor.asString(payload.eventId),
                    AiDecisionExecutor.asTargetSelections(payload.selectedTargets)
                );
            case 'confirmTokenChoice':
                return this.gameLogic.confirmTokenChoice(
                    gameId,
                    aiPlayerId,
                    AiDecisionExecutor.asString(payload.eventId),
                    AiDecisionExecutor.asNumber(payload.selectedChoiceIndex, 0)
                );
            case 'confirmOptionChoice':
                return this.gameLogic.confirmOptionChoice(
                    gameId,
                    aiPlayerId,
                    AiDecisionExecutor.asString(payload.eventId),
                    AiDecisionExecutor.asNumber(payload.selectedOptionIndex, 0)
                );
            case 'playerAction':
                return this.executePlayerAction(gameId, aiPlayerId, payload);
            case 'playCard':
                return this.gameLogic.playCardWithAction(
                    gameId,
                    aiPlayerId,
                    { ...AiDecisionExecutor.asRecord(payload.action) }
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

    private async executePlayerAction(gameId: string, aiPlayerId: string, payload: DecisionPayload): Promise<GameLogicResult> {
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
        const attackerCarduid = AiDecisionExecutor.asString(payload.attackerCarduid);
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
            const zones = player?.zones;
            if (!zones) continue;
            for (const slotName of SLOT_NAMES) {
                const slot = zones[slotName as keyof PlayerZones] as unknown as SlotLike | undefined;
                if (slot?.unit?.carduid === carduid || slot?.pilot?.carduid === carduid) {
                    return playerId;
                }
            }
        }
        return null;
    }
}
