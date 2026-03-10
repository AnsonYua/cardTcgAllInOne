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
- `src/__tests__/aiV1TuningScenarioValidation.test.js`
- `src/__tests__/aiV1DeckMatrix.test.js`
- `src/__tests__/aiV1BenchmarkGate.test.js`
- `src/__tests__/aiV1SimulationAdapterSafety.test.js`
- `src/__tests__/gameAiV1NotificationChoiceDecision.test.js`

Use `npm run benchmark:ai` when tuning search, ordering, or tactical weights.

## Debugging

- Use `src/services/ai/AiDebugTelemetry.ts` to build a compact AI debug payload from decision telemetry.
- The validation harness records the last AI debug payload for stalled, bounded, and failed autoplay runs.

## Pacing

- Live AI autoplay is intentionally one decision at a time.
- Default backend pacing is `2000ms` between AI-owned actions.
- Frontend polling must stay fast enough to show delayed AI steps separately. The current expected real-game poll interval is `250ms`.

## Manual QA

- Start a game with AI enabled.
- Make a player action that leaves the AI with at least two follow-up decisions, such as `playCard -> endTurn` or prompt resolution -> `endTurn`.
- Verify the first AI action appears.
- Verify the next AI action appears about 2 seconds later, not in the same visible update.
