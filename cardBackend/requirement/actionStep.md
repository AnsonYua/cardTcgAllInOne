 Action Step Definition

 Action Step is the battle subphase that begins when an attack is declared and a battle context is created.
 It is entered inside `GameEnvironment.setCurrentBattle(...)`, which sets `currentBattle.status = "ACTION_STEP"`
 and switches the phase to `ACTION_STEP_PHASE`.

 Trigger path (high level):
 1) Player declares an attack via `POST /api/game/player/playerAction` with `actionType: attackUnit` or `attackShieldArea`.
 2) `BattlePhaseManager.startBattle(...)` builds a `BattleContext` and calls `gameEnv.setCurrentBattle(...)`.
 3) The game enters `ACTION_STEP_PHASE` and `currentBattle.status` is set to `ACTION_STEP`.
 4) Blocker choice runs first; if blockers exist, a `BLOCKER_CHOICE` event is created and the battle waits.
    If no blockers are available or blocking is declined, the battle remains in ACTION_STEP until both players confirm
    and `resolveBattle` is called.

 Minimal scenario to trigger Action Step:
 - Scenario file: `shared/testScenarios/gameStates/ActionStep/action_step_trigger_basic.json`
 - Setup: P1 has a unit in slot1, P2 has a unit in slot1, currentPlayer = P1, phase = MAIN_PHASE.
 - Action: call `POST /api/game/player/playerAction` with
   `{ actionType: "attackUnit", attackerCarduid, targetPlayerId, targetUnitUid }`.
 - Expect: `gameEnv.phase` becomes `ACTION_STEP_PHASE` and `gameEnv.currentBattle.status` is `ACTION_STEP`.
