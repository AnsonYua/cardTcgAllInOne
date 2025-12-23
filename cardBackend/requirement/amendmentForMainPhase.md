Currently it is also main phase. however when battle start the phase should change to blocker phase ->action step phase -> main phase

sequence is like this 

player trigger attack  (main phase)->blocker phase ->action step phase -> main phase

For main phase , when gameEnv.phase = MAIN_PHASE and there is  object with BLOCKER_CHOICE in processingQueue and gameEnv.currentBattle = null , we can say it is in main phase (the status label should show Main Phase)

For blocker phase , when gameEnv.phase = MAIN_PHASE and there is  object with BLOCKER_CHOICE in processingQueue and no matter gameEnv.currentBattle = null , we can say it is in Blocker Phase (the status label should show Blocker Phase)
 
For Action step phase , when gameEnv.phase = MAIN_PHASE and there is no object with BLOCKER_CHOICE in processingQueue and  gameEnv.currentBattle is not null , we can say it is in Blocker Phase (the status label should Action Step phase)

Implementation recap:
- Added `BLOCKER_PHASE` and `ACTION_STEP_PHASE` to `GamePhase`. These are now persisted on `gameEnv.phase`.
- When a blocker choice event is enqueued we call `gameEnv.enterBlockerPhase()`, which records the prior phase and flips `phase` to `BLOCKER_PHASE`.
- Whenever `setCurrentBattle()` is invoked the context moves into `ACTION_STEP_PHASE`, ensuring action-step specific UI can rely on `gameEnv.phase`.
- `clearCurrentBattle()` (and the battle resolution path) call `resetBattlePhaseState()` so once the battle ends `phase` returns to the saved value (normally `MAIN_PHASE`).
- A `battlePhaseReturnPoint` field is serialized to keep state consistent across reloads; frontend polls can display the correct label directly from `gameEnv.phase`.
