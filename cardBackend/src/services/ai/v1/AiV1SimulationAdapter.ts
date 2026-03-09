import { GamePhase, PlayerActionType } from '../../../models/GameEnums';
import type { PlayerAction } from '../../../models/EventInterfaces';
import { GameEnvironment } from '../../../models/GameEnvironment';
import { processAction } from '../../actions/ActionProcessor';
import { GameEnvViewBuilder } from '../../views/GameEnvViewBuilder';
import type { AiActionCandidate, AiDecisionContext, AiSimulationAdapter, AiSimulationResult } from './AiV1Types';
import { GameEnvAiContextAdapter } from './AiV1ContextAdapter';
import { evaluateBoardState } from './AiV1TacticalScorer';

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const toSimulationAction = (context: AiDecisionContext, candidate: AiActionCandidate, clone: GameEnvironment): PlayerAction | null => {
    switch (candidate.decision.kind) {
        case 'playCard': {
            const action = asRecord(candidate.decision.payload?.action);
            return {
                type: PlayerActionType.PLAY_CARD,
                playerId: context.aiPlayerId,
                gameId: '__ai_simulation__',
                carduid: typeof action.carduid === 'string' ? action.carduid : '',
                playAs: typeof action.playAs === 'string' ? action.playAs : undefined,
                targetUnit: typeof action.targetUnit === 'string' ? action.targetUnit : undefined,
                replaceSlot: typeof action.replaceSlot === 'string' ? action.replaceSlot : undefined
            };
        }
        case 'playerAction':
            return {
                type: PlayerActionType.PLAYER_ACTION,
                playerId: context.aiPlayerId,
                gameId: '__ai_simulation__',
                ...asRecord(candidate.decision.payload)
            };
        case 'endTurn':
            return {
                type: PlayerActionType.END_TURN,
                playerId: context.aiPlayerId,
                gameId: '__ai_simulation__',
                currentTurn: clone.currentTurn
            };
        default:
            return null;
    }
};

const collectRemainingHp = (gameEnvView: Record<string, unknown>): Record<string, number> => {
    const players = asRecord(gameEnvView.players);
    const remainingHpByCarduid: Record<string, number> = {};
    for (const player of Object.values(players)) {
        const zones = asRecord(asRecord(player).zones);
        for (const slotName of ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6']) {
            const slot = asRecord(zones[slotName]);
            const unit = asRecord(slot.unit);
            const field = asRecord(slot.fieldCardValue);
            const carduid = typeof unit.carduid === 'string' ? unit.carduid : '';
            if (!carduid) {
                continue;
            }
            const totalHp = Number(field.totalHP ?? unit.originalHP ?? asRecord(unit.cardData).hp ?? 0);
            const damage = Number(field.totalDamageReceived ?? unit.damageReceived ?? 0);
            remainingHpByCarduid[carduid] = Math.max(0, totalHp - damage);
        }
    }
    return remainingHpByCarduid;
};

export class AiLocalSimulationAdapter implements AiSimulationAdapter {
    private readonly contextAdapter = new GameEnvAiContextAdapter();

    async simulateCandidate(context: AiDecisionContext, candidate: AiActionCandidate): Promise<AiSimulationResult | null> {
        if (!candidate.requiresSimulation || !context.rawGameEnv) {
            return null;
        }

        const clone = GameEnvironment.fromJSON(context.rawGameEnv.toPersistenceJSON());
        const action = toSimulationAction(context, candidate, clone);
        if (!action) {
            return null;
        }

        const beforeView = GameEnvViewBuilder.toPlayerView(clone, context.aiPlayerId);
        const beforeContext = this.contextAdapter.buildContext(beforeView as never, context.aiPlayerId, clone);
        const beforeScore = evaluateBoardState(beforeContext);
        const beforeRemainingHp = collectRemainingHp(beforeView);
        const beforeCarduids = new Set(Object.keys(beforeRemainingHp));

        const result = await processAction(clone, action);
        if (!result?.success) {
            return {
                supported: true,
                success: false,
                totalScore: -80,
                reason: 'simulation_failed',
                summary: String(result?.error || 'simulation_failed'),
                destroyedCarduids: [],
                remainingHpByCarduid: beforeRemainingHp,
                hpDeltas: {}
            };
        }

        if (candidate.decision.kind === 'endTurn' && clone.phase === GamePhase.END_PHASE) {
            clone.phase = GamePhase.MAIN_PHASE;
        }

        const afterView = GameEnvViewBuilder.toPlayerView(clone, context.aiPlayerId);
        const afterContext = this.contextAdapter.buildContext(afterView as never, context.aiPlayerId, clone);
        const afterScore = evaluateBoardState(afterContext);
        const afterRemainingHp = collectRemainingHp(afterView);
        const afterCarduids = new Set(Object.keys(afterRemainingHp));
        const destroyedCarduids = Array.from(beforeCarduids).filter((carduid) => !afterCarduids.has(carduid));

        const hpDeltas: Record<string, number> = {};
        for (const [carduid, remainingHp] of Object.entries(afterRemainingHp)) {
            hpDeltas[carduid] = remainingHp - (beforeRemainingHp[carduid] ?? remainingHp);
        }

        return {
            supported: true,
            success: true,
            totalScore: afterScore - beforeScore,
            reason: 'simulation_complete',
            summary: `delta=${Math.round(afterScore - beforeScore)} destroyed=${destroyedCarduids.length}`,
            destroyedCarduids,
            remainingHpByCarduid: afterRemainingHp,
            hpDeltas
        };
    }
}
