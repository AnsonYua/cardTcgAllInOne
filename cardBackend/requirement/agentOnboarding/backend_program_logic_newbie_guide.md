# Backend Program Logic Guide (Secondary School Friendly)

This guide explains how the code works behind gameplay.  
Think of it as "how the referee software thinks."

## 1) Big Picture
The backend is event-driven.

Main idea:
1. Player sends action API.
2. Backend converts action to event.
3. Event enters queue.
4. Queue processes in order.
5. Game state updates and saves.

## 2) Main Core Object
The center object is `GameEnvironment`.

File:
- `src/models/GameEnvironment.ts`

It stores:
- phase, current player, turn number
- players and zones
- processing queue
- current battle state
- notification queue

## 3) Event Queue Model
Queue event states:
- `DECLARED`
- `RESOLVING`
- `RESOLVED`

Processor:
- `src/services/StaticEventProcessor.ts`

Execution router:
- `src/services/GameEngine.ts`

Important gate:
- `needsPlayerInput()` in `GameEnvironment`
- If first queue event needs player decision, processing pauses.

## 4) End-to-End Request Pipeline
1. Route receives API request.
2. Controller validates request/session.
3. `GameLogic` loads game file state.
4. `ActionProcessor` creates event from action.
5. Event added to queue.
6. `StaticEventProcessor` loops queue.
7. `GameEngine` sends event to manager.
8. Updated state is saved.

Main files:
- `src/routes/gameRoutes.ts`
- `src/controllers/gameController.ts`
- `src/services/GameLogic.ts`
- `src/services/actions/ActionProcessor.ts`
- `src/services/actions/ActionEventFactory.ts`

## 5) Phase and Turn Logic
Phase transitions are managed by:
- `src/services/effects/PhaseTransitionManager.ts`

Turn helpers are managed by:
- `src/services/TurnLifecycleManager.ts`

State-based automatic checks are managed by:
- `src/services/EventQueue/StateBasedActionEngine.ts`

## 6) Card Play Logic
Main play executor:
- `src/services/CardPlayExecutor.ts`

Typical steps:
1. validate play and cost
2. spend/tap energy
3. place card in zone
4. trigger enter-play effects
5. trigger pair/link follow-up logic

Related files:
- `src/services/PlayCardPreparationManager.ts`
- `src/services/PlayerCardManager.ts`
- `src/services/CardEnteredPlayManager.ts`

## 7) Battle Logic
Battle manager:
- `src/services/BattlePhaseManager.ts`

Flow:
1. attack declared
2. attack effects run
3. blocker branch may happen
4. action step opens
5. players confirm
6. battle resolves

Blocker flow:
- `src/services/BlockerChoiceManager.ts`

Game-end call path example:
- shield/base resolution can call `GameEndManager.endGame(...)`
- file: `src/services/GameEndManager.ts`

## 8) Effect System Logic
### Schema and typing
- `EffectDefinition` type: `src/services/EventQueue/interfaces/GameEvent.ts`
- Canonical trigger/condition sets: `src/services/effects/schema/EffectSchema.ts`

### Rule normalization and collection
- Rule collection: `src/services/effects/EffectRuleCatalog.ts`
- Rule normalization: `src/utils/EffectNormalizationUtils.ts`

### Effect execution
- Direct handlers: `src/services/effects/EffectExecutor.ts`
- Routed multi-step actions: `src/services/effects/EffectActionRouter.ts`

## 9) Choice Resolution Logic
Choice APIs in routes:
- `confirmBurstChoice`
- `confirmTargetChoice`
- `confirmBlockerChoice`
- `confirmTokenChoice`
- `confirmOptionChoice`

Choice service:
- `src/services/choices/ChoiceConfirmationService.ts`

Rule:
- unresolved choice event at queue head must resolve first.

## 10) Data and Persistence Logic
Card data sources:
- `src/data/*.json`

Game state persistence:
- loaded/saved through `GameLogic` (`loadGameFromFile`, `saveGameToFile`).

Audit and review artifacts:
- `requirement/review/st_effect_audit_report.md`
- `requirement/review/st_effect_audit_report.json`
- `GD01_EFFECT_AUDIT_MATRIX.md`, `GD02_EFFECT_AUDIT_MATRIX.md`, `GD03_EFFECT_AUDIT_MATRIX.md`

## 11) Debugging Method (Simple)
When something is wrong:
1. inspect `phase`, `currentPlayer`, queue head event
2. inspect `currentBattle`
3. inspect last choice event and whether user decision was saved
4. inspect effect trigger/action/target shape
5. check matching manager file

## 12) Mapping Bugs to Files
- Play card fails: `CardPlayExecutor`, `PlayCardPreparationManager`
- Attack flow stuck: `BattlePhaseManager`, `BlockerChoiceManager`
- Choice not clearing: `ChoiceConfirmationService`, `GameEnvironment.needsPlayerInput`
- Trigger not firing: `EffectRuleCatalog`, `EffectNormalizationUtils`, specific trigger manager
- End turn not moving: `StateBasedActionEngine`, `PhaseTransitionManager`

## 13) Safe Logic Checklist for New Contributors
Before saying "fixed":
1. queue order still correct
2. choice gating still works
3. trigger/action names are canonical
4. no turn-rule bypass created
5. scenario/test still passes

## 14) Useful Commands
```bash
npm run test:quick
npm run test:list
npm run review:effects
npm run review:unresolved
npm run test:dynamic run shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario>.json --verbose
```

## 15) Learn Path for Students
1. Read gameplay guide first.
2. Read effect schema guide second.
3. Read this backend logic guide third.
4. Replay one scenario while tracing queue events.

Related docs:
- `requirement/agentOnboarding/gameplay_newbie_comprehensive_guide.md`
- `requirement/agentOnboarding/effects_rules_schema_guide.md`
- `requirement/agentOnboarding/game_flow_and_logic_guideline.md`
- `requirement/agentOnboarding/card_effects_implemented_guide.md`
