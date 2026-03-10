const {
    AI_TUNING_SCENARIO_IDS,
    runScenarioValidation
} = require('../tests/aiValidationHarness');

describe('AI V1 tuning scenario suite', () => {
    test.each(AI_TUNING_SCENARIO_IDS)('%s keeps the tuned first decision stable', async (scenarioId) => {
        const result = await runScenarioValidation(scenarioId);

        expect(result.unresolvedAiPromptCount).toBe(0);
        expect(result.stepResults.length).toBeGreaterThan(0);

        for (const step of result.stepResults) {
            expect(step.malformedProblems).toEqual([]);
            expect(step.expectation.passed).toBe(true);
            expect(step.debugPayload).toEqual(expect.objectContaining({
                kind: expect.any(String),
                reason: expect.any(String),
                lineHistory: expect.any(Array),
                promptChain: expect.any(Array)
            }));
        }
    }, 120000);
});
