import type { AiDecision } from './AiTypes';

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const takePromptChain = (value: unknown): Array<Record<string, unknown>> =>
    asArray(value).slice(0, 6).map((entry) => {
        const record = asRecord(entry);
        return {
            promptType: record.promptType || null,
            phase: record.phase || null,
            decisionKind: record.decisionKind || null,
            reason: record.reason || null,
            success: record.success === true
        };
    });

const takeLineHistory = (value: unknown): Array<Record<string, unknown>> =>
    asArray(value).slice(0, 6).map((entry) => {
        const record = asRecord(entry);
        return {
            candidateId: record.candidateId || null,
            kind: record.kind || null,
            reason: record.reason || null,
            tacticalScore: typeof record.tacticalScore === 'number' ? record.tacticalScore : null,
            simulationScore: typeof record.simulationScore === 'number' ? record.simulationScore : null,
            totalScore: typeof record.totalScore === 'number' ? record.totalScore : null
        };
    });

const takeTopCandidates = (value: unknown): Array<Record<string, unknown>> =>
    asArray(value).slice(0, 5).map((entry) => {
        const record = asRecord(entry);
        return {
            candidateId: record.candidateId || null,
            kind: record.kind || null,
            reason: record.reason || null,
            tacticalScore: typeof record.tacticalScore === 'number' ? record.tacticalScore : null,
            totalScore: typeof record.totalScore === 'number' ? record.totalScore : null
        };
    });

export const buildAiDebugPayload = (decision: AiDecision | null | undefined): Record<string, unknown> => {
    const telemetry = asRecord(decision?.telemetry);
    const search = asRecord(telemetry.search);

    return {
        kind: decision?.kind || null,
        reason: decision?.reason || null,
        selectedCandidateId: telemetry.selectedCandidateId || null,
        windowKind: telemetry.windowKind || null,
        fallbackReason: telemetry.fallbackReason || null,
        fallbackKind: telemetry.fallbackKind || null,
        tacticalScore: typeof telemetry.tacticalScore === 'number' ? telemetry.tacticalScore : null,
        simulationScore: typeof telemetry.simulationScore === 'number' ? telemetry.simulationScore : null,
        totalScore: typeof telemetry.totalScore === 'number' ? telemetry.totalScore : null,
        simulatedNodeCount: typeof telemetry.simulatedNodeCount === 'number' ? telemetry.simulatedNodeCount : null,
        budgetUsedMs: typeof telemetry.budgetUsedMs === 'number' ? telemetry.budgetUsedMs : null,
        budgetRemainingMs: typeof telemetry.budgetRemainingMs === 'number' ? telemetry.budgetRemainingMs : null,
        searchSummary: {
            maxDepthReached: typeof search.maxDepthReached === 'number' ? search.maxDepthReached : null,
            bestLineScore: typeof search.bestLineScore === 'number' ? search.bestLineScore : null
        },
        lineHistory: takeLineHistory(telemetry.lineHistory),
        promptChain: takePromptChain(telemetry.promptChain),
        topCandidates: takeTopCandidates(telemetry.topCandidates)
    };
};
