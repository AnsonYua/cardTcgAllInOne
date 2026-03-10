const { buildAiDebugPayload } = require('../services/ai/AiDebugTelemetry');

describe('AI debug telemetry formatter', () => {
    test('returns a compact debug payload from decision telemetry', () => {
        const payload = buildAiDebugPayload({
            kind: 'playerAction',
            reason: 'v1_attack_unit',
            telemetry: {
                selectedCandidateId: 'candidate-1',
                windowKind: 'MAIN_PHASE',
                tacticalScore: 44,
                simulationScore: 12,
                totalScore: 56,
                simulatedNodeCount: 6,
                budgetUsedMs: 41,
                budgetRemainingMs: 709,
                lineHistory: [
                    { candidateId: 'candidate-1', kind: 'attack', reason: 'v1_attack_unit', totalScore: 56 }
                ],
                promptChain: [
                    { promptType: 'TARGET_CHOICE', phase: 'initial', decisionKind: 'confirmTargetChoice', success: true }
                ],
                topCandidates: [
                    { candidateId: 'candidate-1', kind: 'attack', reason: 'v1_attack_unit', totalScore: 56 }
                ],
                search: {
                    maxDepthReached: 2,
                    bestLineScore: 56
                }
            }
        });

        expect(payload).toEqual({
            kind: 'playerAction',
            reason: 'v1_attack_unit',
            selectedCandidateId: 'candidate-1',
            windowKind: 'MAIN_PHASE',
            fallbackReason: null,
            fallbackKind: null,
            tacticalScore: 44,
            simulationScore: 12,
            totalScore: 56,
            simulatedNodeCount: 6,
            budgetUsedMs: 41,
            budgetRemainingMs: 709,
            searchSummary: {
                maxDepthReached: 2,
                bestLineScore: 56
            },
            lineHistory: [
                {
                    candidateId: 'candidate-1',
                    kind: 'attack',
                    reason: 'v1_attack_unit',
                    tacticalScore: null,
                    simulationScore: null,
                    totalScore: 56
                }
            ],
            promptChain: [
                {
                    promptType: 'TARGET_CHOICE',
                    phase: 'initial',
                    decisionKind: 'confirmTargetChoice',
                    reason: null,
                    success: true
                }
            ],
            topCandidates: [
                {
                    candidateId: 'candidate-1',
                    kind: 'attack',
                    reason: 'v1_attack_unit',
                    tacticalScore: null,
                    totalScore: 56
                }
            ]
        });
    });
});
