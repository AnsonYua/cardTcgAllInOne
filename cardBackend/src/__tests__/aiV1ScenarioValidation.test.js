const {
    AI_SCENARIO_IDS,
    runScenarioValidation
} = require('../tests/aiValidationHarness');

describe('AI V1 scenario validation suite', () => {
    test.each(AI_SCENARIO_IDS)('%s resolves expected decisions and telemetry', async (scenarioId) => {
        const result = await runScenarioValidation(scenarioId);

        expect(result.unresolvedAiPromptCount).toBe(0);
        expect(result.stepResults.length).toBeGreaterThan(0);

        for (const step of result.stepResults) {
            expect(step.malformedProblems).toEqual([]);
            expect(step.expectation.passed).toBe(true);
            expect(step.lineHistory).toEqual(expect.any(Array));
            expect(step.promptChain).toEqual(expect.any(Array));
            expect(step.fallbackReason).toBeNull();
            expect(step.search).toEqual(expect.objectContaining({
                lineHistory: expect.any(Array),
                simulatedNodeCount: expect.any(Number),
                budgetUsedMs: expect.any(Number),
                budgetRemainingMs: expect.any(Number)
            }));
            expect(step.debugPayload).toEqual(expect.objectContaining({
                lineHistory: expect.any(Array),
                promptChain: expect.any(Array),
                simulatedNodeCount: expect.anything(),
                budgetUsedMs: expect.anything(),
                budgetRemainingMs: expect.anything()
            }));

            for (const assertion of step.stateAssertions) {
                expect(assertion.passed).toBe(true);
            }
        }

        if (result.autoplayResult) {
            expect(result.autoplayResult.success).toBe(true);
            expect(result.autoplayResult.unresolvedAiPromptCount).toBe(0);
            expect(result.autoplayResult.stalled).toBe(false);
            for (const assertion of result.autoplayResult.stateAssertions || []) {
                expect(assertion.passed).toBe(true);
            }
        }
    }, 120000);
});
