# Backend Game Flow and Logic Guideline (Agent Onboarding)

This guide teaches a new AI agent how the backend game loop works, how to decide legal next actions, and how to debug issues without breaking queue semantics.

Scope:
- Backend only (`cardBackend`).
- Documentation-only; no API/type changes.
- Skill system design intentionally postponed.

## 1) Core Model

### 1.1 Source of truth
`GameEnvironment` is the authoritative state model.

Primary file:
- `src/models/GameEnvironment.ts`

Key state fields an agent must read before acting:
- `phase`
- `currentPlayer`
- `currentTurn`
- `players`
- `processingQueue`
- `currentBattle`
- `notificationQueue`
- `gameEnded`, `winnerId`, `endReason`

### 1.2 Event queue lifecycle
Events move through:
1. `DECLARED`
2. `RESOLVING`
3. `RESOLVED`

Primary files:
- `src/services/StaticEventProcessor.ts`
- `src/services/EventQueue/interfaces/GameEvent.ts`

Behavior summary:
- `DECLARED`: validation, trigger checks, replacement checks.
- `RESOLVING`: dispatched to `GameEngine.execute(...)`.
- `RESOLVED`: state-based actions may enqueue new events; resolved event is removed.

### 1.3 Why `needsPlayerInput()` gates progression
The processor loop halts when the queue head is a declared unresolved choice event.

Primary file:
- `src/models/GameEnvironment.ts` (`needsPlayerInput`, `getCurrentPlayerChoice`)

Choice event types that block progression:
- `BURST_EFFECT_CHOICE`
- `TARGET_CHOICE`
- `BLOCKER_CHOICE`
- `TOKEN_CHOICE`
- `OPTION_CHOICE`
- `PROMPT_CHOICE`

Implication for agents:
- Never enqueue or send unrelated actions while a blocking choice event is unresolved at queue head.

## 2) End-to-End Action Pipeline

### 2.1 API to engine path
The backend path for gameplay actions is:

1. Route receives request.
2. Controller validates payload and session.
3. `GameLogic` loads game, builds player action/event.
4. `processAction(...)` creates event via `ActionEventFactory`.
5. Event is enqueued in `GameEnvironment.processingQueue`.
6. `GameEnvironment.processEvents()` runs `StaticEventProcessor.processQueue(...)`.
7. `GameEngine.execute(...)` routes to the specific manager.
8. Updated game state is saved.

Primary files:
- `src/routes/gameRoutes.ts`
- `src/controllers/gameController.ts`
- `src/services/GameLogic.ts`
- `src/services/actions/ActionProcessor.ts`
- `src/services/actions/ActionEventFactory.ts`
- `src/services/StaticEventProcessor.ts`
- `src/services/GameEngine.ts`

### 2.2 Route families relevant to agents
Core action routes:
- `POST /api/game/player/playCard`
- `POST /api/game/player/playerAction`
- `POST /api/game/player/endTurn`

Choice routes:
- `POST /api/game/player/confirmBurstChoice`
- `POST /api/game/player/confirmTargetChoice`
- `POST /api/game/player/confirmBlockerChoice`
- `POST /api/game/player/confirmTokenChoice`
- `POST /api/game/player/confirmOptionChoice`
- `POST /api/game/player/cancelChoice`

Polling/state route:
- `GET /api/game/player/:playerId?gameId=...`

## 3) Match Lifecycle

### 3.1 Create and join
- `CREATE_GAME` initializes first player and waiting state.
- `JOIN_GAME` attaches second player, sets chooser for first player, enters first-player decision phase.

Primary logic:
- `src/services/effects/PhaseTransitionManager.ts`

### 3.2 Choose first player
`CHOOSE_FIRST_PLAYER` sets:
- `currentPlayer`
- `firstPlayer`, `firstPlayerDecision`
- phase to `REDRAW_PHASE`
- game setup with submitted decks

Primary logic:
- `src/services/effects/PhaseTransitionManager.ts`
- `src/services/GameSetupManager.ts`

### 3.3 Redraw/start-ready and gameplay begin
When both players are ready and redraw-confirmed, state-based actions enqueue `GAMEPLAY_BEGINS`.

`GAMEPLAY_BEGINS` does:
- initial energy setup
- shield creation
- base creation
- first player draw
- phase to `DRAW_PHASE`

Primary logic:
- `src/services/effects/PhaseTransitionManager.ts`
- `src/services/EventQueue/StateBasedActionEngine.ts`

### 3.4 Turn progression
Turn transitions are driven by phase events + SBAs:
- `DRAW_PHASE` -> `PHASE_ADVANCE` -> `MAIN_PHASE`
- `END_TURN` enters `END_PHASE`
- `END_PHASE` triggers repair/end-turn checks first, then `NEXT_PLAYER_TURN`
- `NEXT_PLAYER_TURN` sets new `currentPlayer`, increments turn, starts turn, prepares main phase

Primary logic:
- `src/services/effects/PhaseTransitionManager.ts`
- `src/services/TurnLifecycleManager.ts`
- `src/services/EventQueue/StateBasedActionEngine.ts`

## 4) Card Play Flow (`PLAY_CARD`)

Primary orchestrator:
- `src/services/CardPlayExecutor.ts`

Execution sequence:
1. Validate turn/legality and prepare play context (`PlayCardPreparationManager`).
2. Pay/tap energy; keep rollback closure for failure cases.
3. Place card into correct zone (`PlayerCardManager.placeCardWithEventData`).
4. Emit card-play notification.
5. Handle enter-play hooks (`CardEnteredPlayManager`).
6. If pair formed, enqueue pairing effects and global pairing effects.
7. If link formed, apply link-based immediate updates.
8. If action-step battle is active and player is participant, enqueue `ACTION_STEP_POST_PLAY` to refresh battle action targets.

Related files:
- `src/services/PlayCardPreparationManager.ts`
- `src/services/PlayerCardManager.ts`
- `src/services/CardEnteredPlayManager.ts`
- `src/services/PairingEffectManager.ts`
- `src/services/effects/PairingGlobalEffectManager.ts`

## 5) Battle Flow

Primary orchestrator:
- `src/services/BattlePhaseManager.ts`

### 5.1 Attack entry
Player uses `playerAction` with:
- `actionType: "attackUnit"` or
- `actionType: "attackShieldArea"`

Routing path:
- `PlayerActionExecutor` -> `BattlePhaseManager.initiateAttack(...)`

### 5.2 Attack phase effects and blocker branch
After declaration:
1. forced-target constraints are enforced.
2. attack-phase effects are processed.
3. blocker manager checks if defender can/should choose blocker.

If blocker choice needed:
- `BLOCKER_CHOICE` event is queued.
- queue blocks on player input.

If no blocker choice needed:
- battle starts immediately.

Files:
- `src/services/PlayerActionExecutor.ts`
- `src/services/BattlePhaseManager.ts`
- `src/services/BlockerChoiceManager.ts`

### 5.3 Action step window
When battle starts:
- `currentBattle.status = "ACTION_STEP"`
- confirmations tracked per participant
- action targets refreshed

Players may:
- play allowed action-step cards/effects
- call `confirmBattle` via `playerAction`

### 5.4 Resolve battle
Resolution prerequisites:
- both participants confirmed
- battle consistency checks pass

Resolution path:
- `resolveUnitBattle(...)` or `resolveShieldBattle(...)`
- emit battle result notifications
- clear battle context
- process resulting queued effects/events

### 5.5 Auto-resolve behavior
If both confirmations are true and no remaining blockers/choices prevent it, manager auto-resolves.

Important edge case handled in choice confirmation service:
- if choice resolution finishes while both players already confirmed action step, battle resolve is re-triggered to avoid stuck state.

## 6) Choice Event Matrix

All choice handling must match queue-head event type and player ownership.

### 6.1 `BURST_EFFECT_CHOICE`
- Typical trigger: shield card attacked and burst conditions detected.
- Confirm endpoint: `POST /api/game/player/confirmBurstChoice`
- Payload keys: `gameId`, `playerId`, `eventId`, `confirmed` (boolean)
- Queue behavior: event is marked `userDecisionMade`, moved to front, then processed.

### 6.2 `TARGET_CHOICE`
- Typical trigger: effects requiring explicit target selection.
- Confirm endpoint: `POST /api/game/player/confirmTargetChoice`
- Payload keys: `gameId`, `playerId`, `eventId`, `selectedTargets` (array of target refs)
- Queue behavior: validates against `availableTargets`, sets selected targets, marks resolved notification, then processes.

### 6.3 `BLOCKER_CHOICE`
- Typical trigger: defending player has blocker options for incoming attack.
- Confirm endpoint: `POST /api/game/player/confirmBlockerChoice`
- Payload keys: `gameId`, `playerId`, `eventId`, `selectedTarget` or `selectedTargets`, optional `notificationId`
- Queue behavior: validates chosen blocker from available list, marks decision, moves event to front, then processes.

### 6.4 `TOKEN_CHOICE`
- Typical trigger: choose-one token deployment effects.
- Confirm endpoint: `POST /api/game/player/confirmTokenChoice`
- Payload keys: `gameId`, `playerId`, `eventId`, `selectedChoiceIndex`
- Queue behavior: validate option index, mark decision, then process.

### 6.5 `OPTION_CHOICE`
- Typical trigger: generic choose-one option branches.
- Confirm endpoint: `POST /api/game/player/confirmOptionChoice`
- Payload keys: `gameId`, `playerId`, `eventId`, `selectedOptionIndex`
- Queue behavior: validate option, mark decision, then process.

### 6.6 `PROMPT_CHOICE`
- Typical trigger: prompt-based option choices.
- Confirm endpoint: currently shares `confirmOptionChoice` handling path.
- Payload keys: `gameId`, `playerId`, `eventId`, `selectedOptionIndex`
- Queue behavior: same processing path as `OPTION_CHOICE` in `ChoiceConfirmationService`.

### 6.7 Cancel semantics
`POST /api/game/player/cancelChoice` supports cancellation for:
- burst (decline)
- target choice (empty selection)
- blocker choice (decline)

Token/option/prompt are generally non-cancelable by default.

## 7) State-Based Actions

Primary engine:
- `src/services/EventQueue/StateBasedActionEngine.ts`

### 7.1 End-phase ordering (important)
In `END_PHASE`, SBA checks run in this order:
1. repair checks
2. end-turn-triggered checks
3. phase transition checks (`NEXT_PLAYER_TURN`)

This ordering prevents skipping required end-turn effects.

### 7.2 Phase transitions
`PhaseTransitionManager` checks and enqueues state transitions for:
- redraw to gameplay begin
- draw to main
- end to next-player

### 7.3 Game-end checks
Game-end state is actively concluded in battle resolution path:
- if defender has no shields and attack connects, `GameEndManager.endGame(...)` is called.

Files:
- `src/services/BattlePhaseManager.ts`
- `src/services/GameEndManager.ts`

Note:
- `GameStateManager` exists but many generic validation checks are currently TODO scaffolds; do not assume full rule enforcement lives there.

## 8) Operational Rules for Agents

Use this deterministic routine before every action:

1. Load latest state (`GET /api/game/player/:playerId?...`).
2. If `gameEnded` is true, do not send gameplay actions.
3. Inspect `processingQueue[0]`.
4. If queue head is unresolved choice event and owned by your player, send only its matching confirm endpoint.
5. If queue head is unresolved choice event owned by opponent, wait.
6. If action step exists (`currentBattle.status === "ACTION_STEP"`), use confirm-battle flow and only allowed action-step plays.
7. Otherwise, validate turn ownership (`currentPlayer === playerId`) before standard `playCard`/`playerAction`/`endTurn`.

Safe assumptions:
- Backend state is authoritative.
- Queue head governs UI and legal action ordering.
- Choice events must be resolved before unrelated actions.

Anti-patterns to avoid:
- Sending multiple concurrent actions while one request is pending.
- Ignoring unresolved queue-head choice events.
- Assuming local optimistic state after POST; always re-read from backend snapshot.

## 9) Debugging Playbook

### 9.1 Symptom -> first file to inspect
- Card cannot be played: `src/services/CardPlayExecutor.ts`, `src/services/PlayCardPreparationManager.ts`
- Attack invalid or stuck: `src/services/BattlePhaseManager.ts`, `src/services/AttackPreparationManager.ts`
- Blocker flow broken: `src/services/BlockerChoiceManager.ts`, `src/services/GameLogic.ts` (`confirmBlockerChoice`)
- Target/token/option choice not resolving: `src/services/choices/ChoiceConfirmationService.ts`
- Phase stuck or not advancing: `src/services/effects/PhaseTransitionManager.ts`, `src/services/EventQueue/StateBasedActionEngine.ts`
- Queue not draining: `src/services/StaticEventProcessor.ts`, `src/models/GameEnvironment.ts`

### 9.2 Minimal inspection checklist
For any bug, capture:
- `phase`
- `currentPlayer`
- `currentTurn`
- `processingQueue` (id/type/status/head)
- `needsPlayerInput()` implication (from queue head)
- `currentBattle` object and confirmations
- `notificationQueue` high-priority entries

### 9.3 Recommended reproducible commands
From backend root (`cardBackend`):

```bash
npm run test:quick
npm run test:single -- <scenario-or-test-name>
npm run test:dynamic run shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario>.json --verbose
npm run test:list
```

For manual API verification, use the flow in:
- `requirement/apiForGameFlow.txt`

## 10) Reference Scenarios

Canonical authoring docs:
- `requirement/agentOnboarding/testScenarioAuthoring.md`
- `requirement/agentOnboarding/gd01-125_worked_example.md`

Representative scenario files:
- Burst flow:
  - `shared/testScenarios/gameStates/GD01/GD01-125/burst_deploy_opponent_turn_skip_optional_deploy.json`
  - `shared/testScenarios/gameStates/ST01/ST01-011/burst_add_to_hand.json`
- Blocker flow:
  - `shared/testScenarios/gameStates/ST01/ST01-009/blocker_choice_redirect.json`
  - `shared/testScenarios/gameStates/ST01/ST01-008/blocker_choice_multiple.json`
- Action-step behavior:
  - `shared/testScenarios/gameStates/ST01/ST01-014/action_step_ap_reduction.json`
  - `shared/testScenarios/gameStates/ST01/ST01-016/boost_then_action_step_ap_reduction.json`
- Target-choice behavior:
  - `shared/testScenarios/gameStates/GD01/GD01-044/pair_damage_1_choose_1_to_2_enemy_units.json`
  - `shared/testScenarios/gameStates/ST01/ST01-014/main_ap_reduction_multi_target.json`

---

## Quick Agent Checklist (TL;DR)
1. Read fresh game state.
2. Respect queue head.
3. Resolve mandatory choice events first.
4. In action step, confirm battle correctly.
5. After every mutation API call, re-poll and continue from server truth.
