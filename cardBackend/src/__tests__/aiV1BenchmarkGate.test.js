const { runAiValidationBenchmark } = require('../tests/aiValidationHarness');

describe('AI V1 benchmark gate', () => {
    test('stays within latency and stability thresholds on curated scenarios and mirror matches', async () => {
        const benchmark = await runAiValidationBenchmark({
            starterSetIds: ['ST01', 'ST04', 'ST08']
        });

        expect(benchmark.summary.decisionCount).toBeGreaterThan(0);
        expect(benchmark.summary.averageLatencyMs).toBeLessThanOrEqual(750);
        expect(benchmark.summary.p95LatencyMs).toBeLessThanOrEqual(1000);
        expect(benchmark.summary.malformedDecisionCount).toBe(0);
        expect(benchmark.summary.emergencyFallbackRate).toBe(0);

        for (const scenario of benchmark.scenarioResults) {
            expect(scenario.unresolvedAiPromptCount).toBe(0);
            if (scenario.autoplay) {
                expect(scenario.autoplay.unresolvedAiPromptCount).toBe(0);
                expect(scenario.autoplay.stalled).toBe(false);
            }
        }

        for (const scenario of benchmark.tuningScenarioResults) {
            expect(scenario.unresolvedAiPromptCount).toBe(0);
            if (scenario.autoplay) {
                expect(scenario.autoplay.unresolvedAiPromptCount).toBe(0);
                expect(scenario.autoplay.stalled).toBe(false);
            }
        }

        for (const starter of benchmark.starterResults) {
            expect(starter.success).toBe(true);
            expect(starter.unresolvedAiPromptCount).toBe(0);
            expect(starter.stalled).toBe(false);
        }

        for (const starter of benchmark.crossMatchResults) {
            expect(starter.success).toBe(true);
            expect(starter.unresolvedAiPromptCount).toBe(0);
            expect(starter.stalled).toBe(false);
            expect(starter.lastAiDebugPayload).toBeTruthy();
        }
    }, 120000);
});
