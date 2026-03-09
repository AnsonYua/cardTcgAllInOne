# Incident Reference: GD03-073 ACTION_STEP UI false-positive + battle target scope gap

## Incident Summary
- Card: `GD03-073` (`Graze Ein`)
- Symptoms:
  - Frontend showed `Trigger Pilot Effect` during `ACTION_STEP` for a slot whose pilot card was a command with an `ACTION_STEP` **play** rule, not an activated ability.
  - Backend `GD03-073` activated effect (`AP-3 during this battle`) could target a generic opponent unit because `target.scope: "opponent_battling_source"` had no specialized resolver.
  - Frontend still hid `GD03-073` activated effect in a valid unit battle because runtime phase string was `ACTION_STEP_PHASE` while rule timing window used `ACTION_STEP`.
  - Backend initially rejected valid off-turn `ACTION_STEP` ability requests (`Not your turn`) even when `currentBattle.actionTargets` explicitly allowed the effect.
  - Backend link checks failed in some live payloads because command-as-pilot runtime state omitted `playedAs`, causing link resolution to use command card name instead of `designate_pilot.pilotName`.
  - After successful activation and AP reduction, battle sometimes stalled in `ACTION_STEP` with `confirmations` true for both players and empty `actionTargets`.

## Root Causes

### 1) Frontend action-step button false positive (P1 UX/action mismatch)
- `ActionStepCoordinator` used a broad heuristic:
  - "does this card have any rule with `compiledTiming.activationWindows` or `timing.activationWindows` containing `ACTION_STEP`?"
- This did **not** check:
  - `rule.type === "activated"`
  - server-provided `currentBattle.actionTargets[playerId][].effectIds`
- Result:
  - pilot command cards with `type: "play"` + `ACTION_STEP` timing incorrectly surfaced as `Trigger Pilot Effect`.

### 1b) Frontend timing-window phase-name mismatch (P1 valid action hidden)
- Frontend timing checks in `actionEligibility` compared phase strings by exact equality.
- Runtime state used enum-like values such as:
  - `ACTION_STEP_PHASE`
- Card rules used canonical timing window names such as:
  - `ACTION_STEP`
- Result:
  - `getActivatedEffectOptions(...)` returned no activated effects even when backend `actionTargets[].effectIds` correctly allowed `activate_effect`.

### 2) Backend battle-scope target resolution gap (P1 functional mismatch)
- `GD03-073` effect uses:
  - `target.scope: "opponent_battling_source"`
- `TargetScopeResolverRegistry` lacked a resolver for that scope.
- Generic `TargetResolver` treated `opponent_*` as opponent player slots and returned normal opponent units.
- Additional subtle bug:
  - specialized resolver returning `[]` was collapsed to `null`, which triggered fallback to generic target generation.

### 3) Backend response-window turn validation gap (P1 valid action rejected)
- Backend action validation enforced `currentPlayer === playerId` for `activateCardAbility`.
- In `ACTION_STEP` response windows, defending player may legally act off-turn if listed in:
  - `currentBattle.actionTargets[playerId]`
- Result:
  - backend rejected a valid frontend/server-authorized response with `Not your turn`.

### 4) Backend command-pilot link identity gap (P1 conditional false negative)
- Link detection for command cards used as pilots relied on `playedAs === "pilot"` to decide whether to use `designate_pilot.parameters.pilotName`.
- Some persisted/live `slot.pilot` payloads omitted `playedAs`.
- Result:
  - link checks used command card name (e.g. `Heart Set on Revenge`) instead of pilot identity (`Ein Dalton`), failing `isLinked`.

### 5) Backend ACTION_STEP post-activation progression gap (P1 flow stall)
- After successful activated ability resolution in battle `ACTION_STEP`, backend did not always recompute response targets / confirmations.
- A terminal-but-unadvanced state could remain:
  - `currentBattle.status = "ACTION_STEP"`
  - `confirmations[playerId_1] = true`
  - `confirmations[playerId_2] = true`
  - `actionTargets` empty
- Result:
  - frontend appeared hung in `ACTION_STEP_PHASE` despite effect already applying.

## Fix Applied

### Frontend
1. Added `effectIds` support to action-step target payload typing.
2. Centralized action-step slot effect eligibility in shared helper:
   - intersect frontend activated-effect options with server `effectIds`.
3. Updated `ActionStepCoordinator` to use centralized slot-level availability summary.
4. Implemented `Trigger Unit Effect` / `Trigger Pilot Effect` handlers:
   - direct activation for one effect
   - filtered ability-choice dialog for multiple effects
5. Normalized phase names in frontend timing checks (`*_PHASE` -> base phase token) for:
   - activated-effect timing
   - command timing-window checks

### Backend
1. Added `BattleOpponentOfSourceTargetResolver` for `opponent_battling_source`.
2. Registered resolver in `TargetScopeResolverRegistry`.
3. Preserved empty resolver results (`[]`) instead of falling back to generic target generation.
4. Added regression tests for:
   - only battling enemy gets AP-3
   - shield attack no-op (no battling enemy unit target)
5. Allowed off-turn `ACTION_STEP` responses in backend action validation, but only when:
   - action is response-capable (`activateCardAbility` / `useCommandCard`)
   - `currentBattle.status === "ACTION_STEP"`
   - `confirmations[playerId] === false`
   - `actionTargets[playerId]` is non-empty
6. Fixed command-as-pilot link identity resolution:
   - command cards in `slot.pilot` use `designate_pilot.parameters.pilotName` for link checks even if `playedAs` is missing
7. Added post-activated-ability ACTION_STEP progression handling:
   - refresh action-step targets / confirmations and auto-progress battle when no response actions remain

## Detection Heuristic (Reusable)
Treat as high risk when all are true:
1. frontend action-step UI builds buttons from local card rules
2. server sends action-step target payload with `effectIds`
3. frontend ignores `effectIds` and/or ignores `rule.type`
4. card/pilot has any `ACTION_STEP` rule that is not an activated ability

Treat as high risk when:
1. backend/gameEnv phase names use enum variants (e.g. `ACTION_STEP_PHASE`)
2. effect timing uses canonical activation-window tokens (e.g. `ACTION_STEP`)
3. frontend uses exact string equality for timing checks

Also treat as high risk when:
1. card data introduces custom `target.scope` (e.g. `*_battling_source`)
2. no dedicated resolver exists in `TargetScopeResolverRegistry`
3. registry converts resolver `[]` into `null` (accidental fallback)

Also treat as high risk when:
1. frontend and backend both agree effect is legal in `currentBattle.actionTargets`
2. action is attempted by non-current player during `ACTION_STEP`
3. backend still enforces generic turn ownership before response-window legality checks

Also treat as high risk when:
1. command card is attached in `slot.pilot`
2. link-dependent effect condition uses `isLinked`
3. runtime payload omits `playedAs`
4. link resolution falls back to command card name instead of `designate_pilot.pilotName`

Also treat as high risk when:
1. `ACTION_STEP` ability succeeds and modifies state (e.g. `CARD_STAT_MODIFIED` emitted)
2. `currentBattle` remains in `ACTION_STEP`
3. `confirmations` are all true and `actionTargets` are empty
4. no battle progression occurs

## Rule Authoring / Engine Checklist Delta
- Frontend `ACTION_STEP` effect buttons:
  - must use `activated` rule semantics, not raw timing-window presence
  - should prefer backend-authoritative `actionTargets[].effectIds` to avoid false positives
- Frontend timing-window matching:
  - normalize phase names before comparing (e.g. `ACTION_STEP_PHASE` -> `ACTION_STEP`)
  - apply same normalization to both command play timing checks and activated-effect timing checks
- Backend target scopes:
  - custom semantic scopes (battle-relative, paired-relative, etc.) require explicit resolver support
  - resolver returning `[]` is a valid outcome and must not silently fall back to generic scope behavior
- Backend response windows:
  - turn validation must account for off-turn legal responses in `ACTION_STEP`
  - backend should treat `currentBattle.actionTargets[playerId]` as authority for whether a response action is legal to attempt
- Backend link identity:
  - for command cards attached as pilots, derive pilot identity from `designate_pilot` metadata even if runtime placement flags are missing
- Backend ACTION_STEP progression:
  - after activated ability resolution, refresh response targets and progress battle if action-step is exhausted

## Risk Classification
- `P1`:
  - invalid UI action surfaced (`Trigger Pilot Effect`)
  - battle-only targeting semantics could affect wrong opponent unit
