import type { GameEnvironment } from '../../../models/GameEnvironment';
import type { AiDecision } from '../AiTypes';
import type { AiGameEnvView } from '../AiViewTypes';
import { GameEnvAiActionAdapter } from './AiV1CandidateEnumerator';
import { GameEnvAiContextAdapter } from './AiV1ContextAdapter';
import { AiLocalSimulationAdapter } from './AiV1SimulationAdapter';
import { scoreAiCandidates } from './AiV1TacticalScorer';
import type { AiActionAdapter, AiContextAdapter, AiSimulationAdapter } from './AiV1Types';

type DecisionRuntime = {
    rawGameEnv?: GameEnvironment;
};

const summarizeTopCandidates = (candidates: ReturnType<typeof scoreAiCandidates>): Array<Record<string, unknown>> =>
    candidates.slice(0, 5).map((candidate) => ({
        candidateId: candidate.candidateId,
        kind: candidate.kind,
        reason: candidate.decision.reason,
        tacticalScore: candidate.tacticalScore,
        simulationScore: candidate.simulationScore,
        totalScore: candidate.totalScore,
        tags: candidate.tags
    }));

export class GameAiV1Service {
    private static readonly contextAdapter: AiContextAdapter = new GameEnvAiContextAdapter();
    private static readonly actionAdapter: AiActionAdapter = new GameEnvAiActionAdapter();
    private static readonly simulationAdapter: AiSimulationAdapter = new AiLocalSimulationAdapter();

    static async decide(
        gameEnvView: AiGameEnvView,
        aiPlayerId: string,
        runtime: DecisionRuntime = {}
    ): Promise<AiDecision | null> {
        const context = this.contextAdapter.buildContext(gameEnvView, aiPlayerId, runtime.rawGameEnv);
        if (context.windowKind === 'WAIT') {
            return {
                kind: 'wait',
                reason: 'v1_wait',
                telemetry: {
                    windowKind: context.windowKind
                }
            };
        }

        const candidates = this.actionAdapter.enumerateCandidates(context);
        if (candidates.length === 0) {
            return null;
        }

        const scoredCandidates = scoreAiCandidates(context, candidates);
        const simulationCandidates = scoredCandidates
            .filter((candidate) => candidate.requiresSimulation)
            .slice(0, 3);

        for (const candidate of simulationCandidates) {
            const simulation = await this.simulationAdapter.simulateCandidate(context, candidate);
            if (!simulation) {
                continue;
            }
            candidate.simulationScore = simulation.totalScore;
            candidate.totalScore = (candidate.tacticalScore || 0) + simulation.totalScore;
            candidate.telemetry = {
                ...(candidate.telemetry || {}),
                simulation
            };
        }

        scoredCandidates.sort((left, right) => (right.totalScore || 0) - (left.totalScore || 0));
        const best = scoredCandidates[0];
        return {
            ...best.decision,
            telemetry: {
                ...(best.decision.telemetry || {}),
                selectedCandidateId: best.candidateId,
                windowKind: context.windowKind,
                tacticalScore: best.tacticalScore,
                simulationScore: best.simulationScore,
                totalScore: best.totalScore,
                topCandidates: summarizeTopCandidates(scoredCandidates)
            }
        };
    }
}
