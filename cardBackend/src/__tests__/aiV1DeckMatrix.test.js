const {
    STARTER_SET_IDS,
    loadAiScenarioDefinition,
    buildGameEnvFromScenarioDefinition,
    createTempGameLogic,
    injectGameEnv,
    runCoordinatorAutoplay,
    runStarterMirrorMatch
} = require('../tests/aiValidationHarness');

describe('AI V1 live autoplay validation', () => {
    test('coordinator autoplay executes the live human-vs-AI lethal-race scenario through v1', async () => {
        const definition = loadAiScenarioDefinition('ai-v1-lethal-race');
        const { logic, cleanup } = createTempGameLogic();

        try {
            const gameId = `ai_v1_live_lethal_${Date.now()}`;
            const gameEnv = buildGameEnvFromScenarioDefinition(definition);
            await injectGameEnv(logic, gameId, gameEnv);

            const result = await runCoordinatorAutoplay({
                logic,
                gameId,
                viewerPlayerId: 'playerId_2',
                maxSteps: 12
            });

            expect(result.success).toBe(true);
            expect(result.unresolvedAiPromptCount).toBe(0);
            expect(result.finalState.currentPlayer).toBe('playerId_2');
            expect(result.finalState.players.playerId_1.zones.slot1.unit.isRested).toBe(true);
        } finally {
            cleanup();
        }
    }, 120000);

    test.each(STARTER_SET_IDS)('starter-set mirror autoplay stays valid for %s', async (setId) => {
        const result = await runStarterMirrorMatch(setId, {
            aiPlayerIds: ['playerId_1', 'playerId_2'],
            currentPlayer: 'playerId_1',
            maxSteps: 40
        });

        expect(result.success).toBe(true);
        expect(result.unresolvedAiPromptCount).toBe(0);
        expect(result.stalled).toBe(false);

        const malformedDecisionCount = result.decisionSamples.reduce(
            (sum, sample) => sum + sample.malformedProblems.length,
            0
        );

        expect(malformedDecisionCount).toBe(0);
        expect(result.finalState).toBeTruthy();
        expect(result.finalState.gameEnded || result.boundedOut).toBe(true);
    }, 120000);
});
