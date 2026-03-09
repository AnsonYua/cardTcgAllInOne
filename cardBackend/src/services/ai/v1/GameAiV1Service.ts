import type { AiDecision } from '../AiTypes';
import type { AiGameEnvView } from '../AiViewTypes';
import { GameEnvViewBuilder } from '../../views/GameEnvViewBuilder';
import { GameEnvironment } from '../../../models/GameEnvironment';
import { GameEnvAiActionAdapter } from './AiV1CandidateEnumerator';
import { GameEnvAiContextAdapter } from './AiV1ContextAdapter';
import { AiLocalSimulationAdapter } from './AiV1SimulationAdapter';
import { scoreAiCandidates } from './AiV1TacticalScorer';
import type {
    AiActionAdapter,
    AiActionCandidate,
    AiContextAdapter,
    AiDecisionContext,
    AiMoveBudget,
    AiSearchTrace,
    AiSimulationAdapter,
    AiSimulationResult,
    AiTurnLineNode,
    AiTurnLineResult
} from './AiV1Types';

type DecisionRuntime = {
    rawGameEnv?: GameEnvironment;
};

const DEFAULT_MOVE_BUDGET: Omit<AiMoveBudget, 'startedAtMs'> = {
    maxDecisionMs: 750,
    beamWidth: 4,
    maxRootSimulations: 6,
    maxSimulatedNodes: 12,
    maxMainPhaseDepth: 4,
    maxBattleDepth: 3
};

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const nowMs = (): number => Date.now();

const getBudgetUsedMs = (budget: AiMoveBudget): number => Math.max(0, nowMs() - budget.startedAtMs);

const getBudgetRemainingMs = (budget: AiMoveBudget): number => Math.max(0, budget.maxDecisionMs - getBudgetUsedMs(budget));

const hasBudgetRemaining = (budget: AiMoveBudget): boolean => getBudgetRemainingMs(budget) > 0;

const sanitizeSimulation = (simulation: AiSimulationResult | null | undefined): Record<string, unknown> | undefined => {
    if (!simulation) {
        return undefined;
    }
    const { nextStateJson: _nextStateJson, ...safeSimulation } = simulation;
    return safeSimulation;
};

const summarizeCandidate = (candidate: AiActionCandidate): Record<string, unknown> => ({
    candidateId: candidate.candidateId,
    kind: candidate.kind,
    reason: candidate.decision.reason,
    tacticalScore: candidate.tacticalScore,
    simulationScore: candidate.simulationScore,
    totalScore: candidate.totalScore,
    tags: candidate.tags,
    telemetry: {
        ...(candidate.telemetry || {}),
        ...(candidate.telemetry?.simulation
            ? { simulation: sanitizeSimulation(candidate.telemetry.simulation as AiSimulationResult) }
            : {})
    }
});

const compareCandidates = (left: AiActionCandidate, right: AiActionCandidate): number => {
    const leftScore = left.totalScore ?? left.tacticalScore ?? left.estimatedScore;
    const rightScore = right.totalScore ?? right.tacticalScore ?? right.estimatedScore;
    if (rightScore !== leftScore) {
        return rightScore - leftScore;
    }
    return left.candidateId.localeCompare(right.candidateId);
};

const compareNodes = (left: AiTurnLineNode, right: AiTurnLineNode): number => {
    if (right.score !== left.score) {
        return right.score - left.score;
    }
    return left.candidate.candidateId.localeCompare(right.candidate.candidateId);
};

const buildLineHistoryEntry = (candidate: AiActionCandidate) => ({
    candidateId: candidate.candidateId,
    kind: candidate.kind,
    reason: candidate.decision.reason,
    tacticalScore: candidate.tacticalScore,
    simulationScore: candidate.simulationScore,
    totalScore: candidate.totalScore
});

const getRootNode = (node: AiTurnLineNode): AiTurnLineNode => {
    let current = node;
    while (current.parent) {
        current = current.parent;
    }
    return current;
};

const getDepthLimit = (windowKind: AiDecisionContext['windowKind'], budget: AiMoveBudget): number => {
    if (windowKind === 'MAIN_PHASE') {
        return budget.maxMainPhaseDepth;
    }
    if (windowKind === 'ACTION_STEP' || windowKind === 'BATTLE_RESOLVE' || windowKind === 'BLOCKER_STEP') {
        return budget.maxBattleDepth;
    }
    return 2;
};

const canExpandNode = (node: AiTurnLineNode, budget: AiMoveBudget): boolean => {
    if (!node.simulation?.success || !node.simulation?.nextStateJson) {
        return false;
    }
    return node.depth < getDepthLimit(node.context.windowKind, budget);
};

const getSimulationTelemetry = (candidate: AiActionCandidate): Record<string, unknown> | undefined =>
    sanitizeSimulation(candidate.telemetry?.simulation as AiSimulationResult | undefined);

const summarizeTopCandidates = (candidates: AiActionCandidate[]): Array<Record<string, unknown>> =>
    candidates.slice(0, 6).map((candidate) => ({
        candidateId: candidate.candidateId,
        kind: candidate.kind,
        reason: candidate.decision.reason,
        tacticalScore: candidate.tacticalScore,
        simulationScore: candidate.simulationScore,
        totalScore: candidate.totalScore,
        tags: candidate.tags,
        simulation: getSimulationTelemetry(candidate),
        promptChainLength: Array.isArray(asRecord(candidate.telemetry?.simulation).promptChain)
            ? (asRecord(candidate.telemetry?.simulation).promptChain as unknown[]).length
            : 0
    }));

export class GameAiV1Service {
    private static readonly contextAdapter: AiContextAdapter = new GameEnvAiContextAdapter();
    private static readonly actionAdapter: AiActionAdapter = new GameEnvAiActionAdapter();
    private static readonly simulationAdapter: AiSimulationAdapter = new AiLocalSimulationAdapter();

    private static buildBudget(): AiMoveBudget {
        return {
            ...DEFAULT_MOVE_BUDGET,
            startedAtMs: nowMs()
        };
    }

    private static async scoreAndSimulateCandidates(
        context: AiDecisionContext,
        candidates: AiActionCandidate[],
        maxSimulationCount: number,
        budget: AiMoveBudget
    ): Promise<AiActionCandidate[]> {
        const scoredCandidates = scoreAiCandidates(context, candidates).sort(compareCandidates);
        const simulationCandidates = scoredCandidates
            .filter((candidate) => candidate.requiresSimulation)
            .slice(0, maxSimulationCount);

        for (const candidate of simulationCandidates) {
            if (!hasBudgetRemaining(budget)) {
                break;
            }
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

        return scoredCandidates.sort(compareCandidates);
    }

    private static async buildRootNodes(
        context: AiDecisionContext,
        budget: AiMoveBudget
    ): Promise<{ rootNodes: AiTurnLineNode[]; scoredCandidates: AiActionCandidate[]; simulatedNodeCount: number }> {
        const candidates = this.actionAdapter.enumerateCandidates(context);
        if (candidates.length === 0) {
            return {
                rootNodes: [],
                scoredCandidates: [],
                simulatedNodeCount: 0
            };
        }

        const scoredCandidates = await this.scoreAndSimulateCandidates(
            context,
            candidates,
            budget.maxRootSimulations,
            budget
        );

        const rootNodes = scoredCandidates
            .slice(0, budget.maxRootSimulations)
            .map((candidate) => ({
                depth: 1,
                score: candidate.totalScore || candidate.tacticalScore || candidate.estimatedScore,
                candidate,
                context,
                simulation: (candidate.telemetry?.simulation as AiSimulationResult | undefined) || null,
                parent: null,
                history: [buildLineHistoryEntry(candidate)]
            }))
            .sort(compareNodes);

        return {
            rootNodes,
            scoredCandidates,
            simulatedNodeCount: rootNodes.filter((node) => Boolean(node.simulation)).length
        };
    }

    private static async expandNode(
        node: AiTurnLineNode,
        budget: AiMoveBudget,
        remainingNodeBudget: number
    ): Promise<{ children: AiTurnLineNode[]; exploredCount: number }> {
        if (!node.simulation?.nextStateJson || remainingNodeBudget <= 0 || !hasBudgetRemaining(budget)) {
            return { children: [], exploredCount: 0 };
        }

        const nextGameEnv = GameEnvironment.fromJSON(node.simulation.nextStateJson);
        const nextView = GameEnvViewBuilder.toPlayerView(nextGameEnv, node.context.aiPlayerId);
        const nextContext = this.contextAdapter.buildContext(nextView as never, node.context.aiPlayerId, nextGameEnv);

        if (nextContext.windowKind === 'WAIT') {
            return { children: [], exploredCount: 0 };
        }

        const nextCandidates = this.actionAdapter.enumerateCandidates(nextContext);
        if (nextCandidates.length === 0) {
            return { children: [], exploredCount: 0 };
        }

        const scoredChildren = await this.scoreAndSimulateCandidates(
            nextContext,
            nextCandidates,
            Math.min(budget.beamWidth, remainingNodeBudget),
            budget
        );

        const children = scoredChildren
            .slice(0, Math.min(budget.beamWidth, remainingNodeBudget))
            .map((candidate) => ({
                depth: node.depth + 1,
                score: node.score + (candidate.totalScore || candidate.tacticalScore || candidate.estimatedScore),
                candidate,
                context: nextContext,
                simulation: (candidate.telemetry?.simulation as AiSimulationResult | undefined) || null,
                parent: node,
                history: [...node.history, buildLineHistoryEntry(candidate)]
            }))
            .sort(compareNodes);

        return {
            children,
            exploredCount: children.filter((child) => Boolean(child.simulation)).length
        };
    }

    private static async selectBestLine(context: AiDecisionContext, budget: AiMoveBudget): Promise<AiTurnLineResult | null> {
        const rootBuild = await this.buildRootNodes(context, budget);
        const { rootNodes, scoredCandidates } = rootBuild;
        if (rootNodes.length === 0) {
            return null;
        }

        let simulatedNodeCount = rootBuild.simulatedNodeCount;
        let frontier = rootNodes.filter((node) => canExpandNode(node, budget)).sort(compareNodes);
        const visitedNodes = [...rootNodes];
        let maxDepthReached = rootNodes.reduce((maxDepth, node) => Math.max(maxDepth, node.depth), 1);

        while (
            frontier.length > 0
            && simulatedNodeCount < budget.maxSimulatedNodes
            && hasBudgetRemaining(budget)
        ) {
            const beam = frontier.slice(0, budget.beamWidth);
            const nextFrontier: AiTurnLineNode[] = [];

            for (const node of beam) {
                if (!hasBudgetRemaining(budget) || simulatedNodeCount >= budget.maxSimulatedNodes) {
                    break;
                }

                const expansion = await this.expandNode(
                    node,
                    budget,
                    budget.maxSimulatedNodes - simulatedNodeCount
                );

                simulatedNodeCount += expansion.exploredCount;
                visitedNodes.push(...expansion.children);
                nextFrontier.push(...expansion.children.filter((child) => canExpandNode(child, budget)));
                maxDepthReached = expansion.children.reduce(
                    (maxDepth, child) => Math.max(maxDepth, child.depth),
                    maxDepthReached
                );
            }

            frontier = nextFrontier.sort(compareNodes);
        }

        const sortedVisitedNodes = [...visitedNodes].sort(compareNodes);
        const bestNode = sortedVisitedNodes[0];
        const rootNode = getRootNode(bestNode);
        const searchTrace: AiSearchTrace = {
            rootCandidates: summarizeTopCandidates(scoredCandidates),
            beamCandidates: frontier.slice(0, budget.beamWidth).map((node) => ({
                score: node.score,
                depth: node.depth,
                rootCandidateId: getRootNode(node).candidate.candidateId,
                candidate: summarizeCandidate(node.candidate)
            })),
            lineHistory: bestNode.history,
            simulatedNodeCount,
            budgetUsedMs: getBudgetUsedMs(budget),
            budgetRemainingMs: getBudgetRemainingMs(budget),
            maxDepthReached,
            bestLineScore: bestNode.score
        };

        return {
            bestCandidate: rootNode.candidate,
            bestNode,
            searchTrace
        };
    }

    private static buildEmergencyFallback(context: AiDecisionContext, reason: string): AiDecision {
        if (context.activePrompt) {
            const promptCandidates = scoreAiCandidates(context, this.actionAdapter.enumerateCandidates(context)).sort(compareCandidates);
            const bestPrompt = promptCandidates[0];
            if (bestPrompt) {
                return {
                    ...bestPrompt.decision,
                    telemetry: {
                        ...(bestPrompt.decision.telemetry || {}),
                        fallbackReason: reason,
                        fallbackKind: 'owned_prompt',
                        selectedCandidateId: bestPrompt.candidateId,
                        windowKind: context.windowKind
                    }
                };
            }
        }

        if (context.battle?.bothConfirmed) {
            return {
                kind: 'playerAction',
                reason: 'v1_emergency_resolve_battle',
                payload: {
                    actionType: 'resolveBattle'
                },
                telemetry: {
                    fallbackReason: reason,
                    fallbackKind: 'battle_resolve',
                    windowKind: context.windowKind
                }
            };
        }

        if (context.battle?.aiParticipant && !context.battle.aiConfirmed) {
            return {
                kind: 'playerAction',
                reason: 'v1_emergency_confirm_battle',
                payload: {
                    actionType: 'confirmBattle'
                },
                telemetry: {
                    fallbackReason: reason,
                    fallbackKind: 'battle_confirm',
                    windowKind: context.windowKind
                }
            };
        }

        if (context.windowKind === 'MAIN_PHASE' && context.currentPlayerId === context.aiPlayerId) {
            return {
                kind: 'endTurn',
                reason: 'v1_emergency_end_turn',
                telemetry: {
                    fallbackReason: reason,
                    fallbackKind: 'end_turn',
                    windowKind: context.windowKind
                }
            };
        }

        return {
            kind: 'wait',
            reason: 'v1_wait',
            telemetry: {
                fallbackReason: reason,
                fallbackKind: 'wait',
                windowKind: context.windowKind
            }
        };
    }

    static async decide(
        gameEnvView: AiGameEnvView,
        aiPlayerId: string,
        runtime: DecisionRuntime = {}
    ): Promise<AiDecision> {
        const context = this.contextAdapter.buildContext(gameEnvView, aiPlayerId, runtime.rawGameEnv);
        if (context.windowKind === 'WAIT') {
            return {
                kind: 'wait',
                reason: 'v1_wait',
                telemetry: {
                    windowKind: context.windowKind,
                    budgetUsedMs: 0,
                    budgetRemainingMs: DEFAULT_MOVE_BUDGET.maxDecisionMs
                }
            };
        }

        const budget = this.buildBudget();
        const lineResult = await this.selectBestLine(context, budget);
        if (!lineResult) {
            const normalWaitOnly =
                !context.activePrompt
                && !context.battle?.bothConfirmed
                && !(context.battle?.aiParticipant && !context.battle.aiConfirmed)
                && !(context.windowKind === 'MAIN_PHASE' && context.currentPlayerId === context.aiPlayerId);

            if (normalWaitOnly) {
                return {
                    kind: 'wait',
                    reason: 'v1_wait',
                    telemetry: {
                        windowKind: context.windowKind,
                        budgetUsedMs: getBudgetUsedMs(budget),
                        budgetRemainingMs: getBudgetRemainingMs(budget)
                    }
                };
            }
            return this.buildEmergencyFallback(context, 'no_legal_candidates');
        }

        const best = lineResult.bestCandidate;
        const bestSimulation = getSimulationTelemetry(best);
        return {
            ...best.decision,
            telemetry: {
                ...(best.decision.telemetry || {}),
                selectedCandidateId: best.candidateId,
                windowKind: context.windowKind,
                tacticalScore: best.tacticalScore,
                simulationScore: best.simulationScore,
                totalScore: best.totalScore,
                simulation: bestSimulation,
                promptChain: Array.isArray(asRecord(best.telemetry?.simulation).promptChain)
                    ? asRecord(best.telemetry?.simulation).promptChain
                    : [],
                topCandidates: lineResult.searchTrace.rootCandidates,
                search: lineResult.searchTrace,
                lineHistory: lineResult.searchTrace.lineHistory,
                simulatedNodeCount: lineResult.searchTrace.simulatedNodeCount,
                budgetUsedMs: lineResult.searchTrace.budgetUsedMs,
                budgetRemainingMs: lineResult.searchTrace.budgetRemainingMs
            }
        };
    }
}
