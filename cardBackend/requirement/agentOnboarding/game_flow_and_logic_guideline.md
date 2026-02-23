# Easy Guide: How This Card Game Backend Flows

This guide is written for beginners.  
Think of the backend like a game referee that follows steps in order.

## Big Idea
The game is controlled by one main object called `GameEnvironment`.

File:
- `src/models/GameEnvironment.ts`

It stores things like:
- whose turn it is (`currentPlayer`)
- which phase the game is in (`phase`)
- cards on the board (`players` and zones)
- what actions are waiting to happen (`processingQueue`)

## 1) The Queue (Very Important)
Imagine a line at a shop. Actions wait in line.

The line is `processingQueue`.

Each action (event) has 3 states:
1. `DECLARED` = waiting to be handled
2. `RESOLVING` = being handled now
3. `RESOLVED` = finished

Main files:
- `src/services/StaticEventProcessor.ts`
- `src/services/GameEngine.ts`

### Why actions sometimes stop
If the first event in line needs a player choice, the backend pauses.

This check is `needsPlayerInput()` in:
- `src/models/GameEnvironment.ts`

So if a choice is waiting, the player must answer that choice first.

## 2) Full Path of a Player Action
When a player does something, backend flow is:

1. API route receives request.
2. Controller checks request body.
3. `GameLogic` loads game state.
4. Action is turned into an event.
5. Event is added to queue.
6. Queue processor runs events.
7. `GameEngine` sends event to correct manager.
8. New game state is saved.

Main files:
- `src/routes/gameRoutes.ts`
- `src/controllers/gameController.ts`
- `src/services/GameLogic.ts`
- `src/services/actions/ActionProcessor.ts`
- `src/services/actions/ActionEventFactory.ts`
- `src/services/StaticEventProcessor.ts`
- `src/services/GameEngine.ts`

## 3) Match Start Flow
### Step A: Create game
One player creates room.

### Step B: Join game
Second player joins.

### Step C: Choose first player
System moves to first-player setup.

### Step D: Redraw / ready
Both players confirm ready state.

### Step E: Gameplay begins
Backend gives starting energy/shields/base, then starts first turn.

Main file:
- `src/services/effects/PhaseTransitionManager.ts`

## 4) Turn Flow (Simple Version)
Each turn is mostly this:

1. `DRAW_PHASE`
2. `MAIN_PHASE` (play cards, use actions)
3. `END_PHASE`
4. next player turn starts

Turn helper file:
- `src/services/TurnLifecycleManager.ts`

State-based checks file:
- `src/services/EventQueue/StateBasedActionEngine.ts`

## 4.1) Defense Area, Base, and Shield (Simple)
- `Defense area` means two zones together: `shield area` + `base`.
- `Base` is the first defense target in this game flow.
- `Shield area` is the follow-up defense side after `base` is cleared.
- `Slot` is a board position where unit/pilot cards are placed (`slot1` to `slot6`).
- `Pilot card` is the pilot part of a pair. It usually works with a unit in the same slot.
- `Command card` is a one-time effect card. You play it to do an effect, then it usually leaves play.
- `Base card` is your core defense card in base zone, behind shields.
- `Trash` is the discard zone. Destroyed or used cards usually go there.
- `Blocker` means defender can redirect an incoming attack to a blocker unit.
- In short: when people say \"attack defense area,\" it usually means base first, then shield side.

## 5) Playing a Card
When player calls play card API:

1. Backend checks if play is legal.
2. Backend checks/uses energy cost.
3. Card is placed into correct zone.
4. Enter-play effects are triggered.
5. If pair/link is created, extra effects may trigger.

Unit-slot full rule:
- If `slot1` to `slot6` all have units, playing another `unit` must include `replaceSlot`.
- If `replaceSlot` is missing, backend rejects play with: `Board is full. Choose a slot to replace.`
- If `replaceSlot` is valid, backend sends old unit in that slot to `trash`, then places new unit.
- If board is not full, sending `replaceSlot` is invalid.

Main file:
- `src/services/CardPlayExecutor.ts`

Related files:
- `src/services/PlayCardPreparationManager.ts`
- `src/services/PlayerCardManager.ts`
- `src/services/CardEnteredPlayManager.ts`
- `src/services/playCard/UnitReplaceSlotCoordinator.ts`

## 6) Battle Flow (Attack)
When player attacks:

1. Attack is declared (`attackUnit` or `attackShieldArea`).
2. `attackShieldArea` means attacking the defender's defense area (shield/base side).
3. Attack-phase effects run.
4. Defender may get blocker choice.
5. If blocker choice appears, game pauses for that choice.
6. If no blocker choice, battle enters action step.
7. Players confirm battle.
8. Battle resolves.

### 6.1) Destroy Timing Rules (Important)
The backend uses one shared destruction pipeline based on **slot total HP** (unit + pilot in same slot).

Rule summary:
1. If destruction is from **unit battle damage** (`attackUnit` resolution):
   - queue destruction first
   - emit `BATTLE_RESOLVED`
   - then run `DESTROYED` effects and move cards to trash
2. If destruction is from **non-battle paths** (command/effect/cost/rule destroy):
   - resolve destruction immediately
   - `DESTROYED` effects trigger immediately (no need to wait for battle resolution)

Deterministic order for simultaneous unit-battle lethal:
- defender slot destruction resolves first, attacker slot second.

Main files for this timing model:
- `src/services/destruction/DestructionCoordinator.ts`
- `src/services/destruction/BattleDestructionOrchestrator.ts`
- `src/services/destruction/SlotHpDestructionChecker.ts`
- `src/services/BattlePhaseManager.ts`

`Suppression` note (shield attack path):
- If attacker has keyword `Suppression` and battle resolves to shield side, backend targets up to first 2 shield cards.
- This logic is in shield resolution branch. If defender still has `base`, base branch is resolved first.

Main file:
- `src/services/BattlePhaseManager.ts`

Blocker file:
- `src/services/BlockerChoiceManager.ts`

### 6.2) Battle Abandon / Abort Logic (Important)
In this project, "battle abandon" means backend **ends battle early as a valid result**, not as an API error.

Main policy:
1. If declared attacker or target is no longer on board before normal battle resolve, battle is aborted.
2. Backend returns success path (do not fail the player action with HTTP error).
3. The declared attack is consumed (no auto-retarget fallback).

When this can happen:
- During pre-battle attack effects (`ATTACK_PHASE`) that remove/destroy/return declared target.
- During `ACTION_STEP` if command/effect/cost removes attacker or target while battle is open.

Notification contract:
1. Existing `UNIT_ATTACK_DECLARED` is updated with `payload.battleEnd = true`.
2. Backend emits `BATTLE_RESOLVED` with aborted result payload, including:
   - `aborted: true`
   - `battleEndedEarly: true`
   - `abortReason: TARGET_NOT_ON_BOARD` or `ATTACKER_NOT_ON_BOARD`
   - `targetMissing` / `attackerMissing` flags when applicable

Rules interaction notes:
- Pre-battle target removal is **not** battle damage.
- `BATTLE_DESTROY` triggers should not fire from this pre-battle removal path.

Main files for this logic:
- `src/services/BattlePhaseManager.ts`
- `src/services/battle/ActionStepBattleConsistencyService.ts`

## 7) Choice Events (What Player Must Answer)
These choices can pause the queue:
- `BURST_EFFECT_CHOICE`
- `TARGET_CHOICE`
- `BLOCKER_CHOICE`
- `TOKEN_CHOICE`
- `OPTION_CHOICE`
- `PROMPT_CHOICE`

Use matching APIs:
- `POST /api/game/player/confirmBurstChoice`
- `POST /api/game/player/confirmTargetChoice`
- `POST /api/game/player/confirmBlockerChoice`
- `POST /api/game/player/confirmTokenChoice`
- `POST /api/game/player/confirmOptionChoice`

Choice logic file:
- `src/services/choices/ChoiceConfirmationService.ts`

## 8) End of Turn and Automatic Checks
In `END_PHASE`, backend checks in order:
1. repair effects
2. end-turn triggered effects
3. move to next player turn

Important file:
- `src/services/EventQueue/StateBasedActionEngine.ts`

## 9) How Game Ends
One real game-end path is in shield attack resolution:
- if defender base side is cleared and the defense-area attack connects to shield side, game can end.

Files:
- `src/services/BattlePhaseManager.ts`
- `src/services/GameEndManager.ts`

## 10) Rules for an AI Agent (Easy Checklist)
Before sending any action:

1. Get latest game state from server.
2. If `gameEnded` is true, stop.
3. Check first event in `processingQueue`.
4. If first event is unresolved choice, answer that choice first.
5. If not your turn, wait.
6. After every POST action, fetch latest state again.

Good habit:
- Treat backend state as truth.
- Never guess local state after clicking.

## 11) Quick Debug Guide
If something breaks, check this first:

1. `phase`
2. `currentPlayer`
3. first event in `processingQueue`
4. `currentBattle`
5. `notificationQueue`

Useful test commands:
```bash
npm run test:quick
npm run test:list
npm run test:single -- <name>
npm run test:dynamic run shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario>.json --verbose
```

## 12) Helpful Scenario References
Onboarding docs:
- `requirement/agentOnboarding/testScenarioAuthoring.md`
- `requirement/agentOnboarding/gd01-125_worked_example.md`

Example scenarios:
- `shared/testScenarios/gameStates/GD01/GD01-125/burst_deploy_opponent_turn_skip_optional_deploy.json`
- `shared/testScenarios/gameStates/ST01/ST01-009/blocker_choice_redirect.json`
- `shared/testScenarios/gameStates/ST01/ST01-014/action_step_ap_reduction.json`
- `shared/testScenarios/gameStates/GD01/GD01-044/pair_damage_1_choose_1_to_2_enemy_units.json`
