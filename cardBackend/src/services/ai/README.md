# AI Runtime Notes

## Live path

The live backend computer opponent uses only the v1 path:

- `GameAiService`
- `GameAiV1Service`
- `AiV1ContextAdapter`
- `AiV1CandidateEnumerator`
- `AiV1TacticalScorer`
- `AiV1SimulationAdapter`
- `AiDecisionExecutor`

`GameAiService` is the only production entrypoint.

## Production boundary

- The AI core reads normalized AI context only.
- Live writes still go through the existing executor and action-confirm APIs.
- Core game-rule semantics must not be changed just to support the AI.

## Legacy modules

Legacy heuristic AI modules remain in the repo for comparison and isolated tests only. They are not on the live decision path.

## Required green suites before tuning changes merge

- `src/__tests__/gameAiV1Cutover.test.js`
- `src/__tests__/aiV1ScenarioValidation.test.js`
- `src/__tests__/aiV1DeckMatrix.test.js`
- `src/__tests__/aiV1BenchmarkGate.test.js`
- `src/__tests__/aiV1SimulationAdapterSafety.test.js`
- `src/__tests__/gameAiV1NotificationChoiceDecision.test.js`

Use `npm run benchmark:ai` when tuning search, ordering, or tactical weights.
