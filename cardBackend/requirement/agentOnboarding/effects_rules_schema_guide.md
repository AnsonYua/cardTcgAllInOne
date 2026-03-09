# effects.rules Schema Guide (Student-Friendly)

## 1) What is `effects.rules`?
`effects.rules` is the instruction list on a card.

Think of each rule like:

- what kind of rule is this
- what timing makes it legal or causes it to run
- what action does it do
- who or what does it affect

A card can have one rule or many rules. Each rule is one behavior unit. The backend reads these rules, normalizes them, compiles timing metadata, and then executes them through the normal engine flow.

## 2) The One-Line Mental Model
> `type` tells **what kind of rule this is**, `timing` tells **when it starts or when you may use it**, `action` tells **what it does**, and `target` plus `conditions` tell **who it affects and when it is allowed**.

## 3) Source Authoring Model
Source card JSON now uses a split timing model. At authoring time, do not put top-level `trigger` on a rule.

Use:

- `timing.eventTrigger`
- `timing.activationWindows`
- `timing.duration`

Do not author:

- top-level `trigger`
- `timing.windows`
- `timing.internalHook`

### Simple triggered rule

```json
{
  "effectId": "deploy_damage_1",
  "type": "triggered",
  "timing": {
    "eventTrigger": "ENTERS_PLAY"
  },
  "action": "damage",
  "target": { "scope": "opponent", "type": "unit", "count": 1 },
  "parameters": { "value": 1 }
}
```

### Simple activated rule

```json
{
  "effectId": "activate_heal",
  "type": "activated",
  "timing": {
    "activationWindows": ["ACTION_STEP"]
  },
  "action": "heal",
  "target": { "scope": "any", "type": "unit", "count": 1 },
  "parameters": { "value": 1 }
}
```

### Simple continuous rule

```json
{
  "effectId": "during_pair_buff",
  "type": "continuous",
  "timing": {
    "duration": "continuous",
    "actionTurn": "YOUR_TURN"
  },
  "sourceConditions": [{ "type": "paired" }],
  "action": "modifyAP",
  "target": { "scope": "self_all_unit", "type": "unit", "count": 1 },
  "parameters": { "value": 1 }
}
```

### Special play-mode rule

```json
{
  "effectId": "pilot_designation",
  "type": "special",
  "timing": {
    "activationWindows": ["MAIN_PHASE"]
  },
  "action": "designate_pilot",
  "parameters": {
    "pilotName": "Lucrezia Noin",
    "AP": 1,
    "HP": 0
  }
}
```

## 4) Source Timing vs Compiled Timing

There are now two timing views:

### A) Source card authoring timing
This is what card JSON should store.

```ts
type SourceEffectTiming = {
  eventTrigger?: string;
  activationWindows?: string[];
  duration?: string;
  actionTurn?: string;
  endOnSourceDestroyed?: boolean;
};
```

### B) Compiled runtime timing
This is what the backend, AI, and frontend consume after card data is normalized.

```ts
type CompiledEffectTiming = {
  eventTrigger?: string;
  activationWindows?: string[];
  duration?: string;
  internalHook?: string;
  timingClass:
    | "event_triggered"
    | "player_activated"
    | "continuous_passive"
    | "temporary_effect"
    | "engine_internal";
  windows?: string[];
  legacyTrigger?: string;
};
```

Important rules:

- `internalHook` is runtime-only.
- `internalHook` is not normal card text timing.
- `legacyTrigger` and `windows` may still appear in bridged runtime payloads for compatibility.
- New source card JSON should not rely on those legacy fields.

## 5) Field-by-Field Student Table

| Field | What it means (simple) | Typical values | Required? | Notes |
|---|---|---|---|---|
| `effectId` | Rule ID/name | `"pair_draw"`, `"burst_deploy"` | Recommended | Fallback exists, but explicit IDs are safer |
| `type` | Rule category | `triggered`, `continuous`, `activated`, `play`, `special` | Strongly recommended | Tells the engine what rule family this is |
| `timing.eventTrigger` | Real game event that starts the rule | `ENTERS_PLAY`, `PAIRING_COMPLETE`, `ATTACK_PHASE`, `BURST_CONDITION` | Required for triggered rules | Replaces authored top-level `trigger` |
| `timing.activationWindows` | Window where player may use the rule | `MAIN_PHASE`, `ACTION_STEP` | Required for activated/play/special rules unless event-driven | Use explicit arrays |
| `timing.duration` | How long the effect lasts | `continuous`, `UNTIL_END_OF_TURN`, `UNTIL_END_OF_BATTLE` | Required for continuous or temporary effects | Use canonical casing |
| `action` | What rule does | `damage`, `draw`, `deploy`, `rest`, etc. | Required for most runtime rules | Flow actions like `sequence` and `conditional` also live here for now |
| `target` | Who/what action applies to | `{ scope, type, count, filters }` | Required for targeted actions | Target shape must match the action |
| `conditions` | Extra IF checks | arrays of condition objects | Optional | Checked against current state/event |
| `sourceConditions` | Conditions on the source card/player | condition objects | Optional | Common for `linked`, `paired`, turn-owner checks |
| `cost` | Payment before effect | discard/rest/exile-like keys | Optional | Used by activated/play rules |
| `parameters` | Extra action data | numeric/flag/config object | Optional | Action-specific details |
| `optional` | Can player skip? | `true`, `false` | Optional | Important for burst and tutor-like flows |
| `compiledTiming` | Normalized timing metadata | runtime-only | No | Added by backend bridge/compiler |

## 6) Timing Matrix

| Timing concept | Examples | Simple meaning |
|---|---|---|
| `eventTrigger` | `ENTERS_PLAY`, `PAIRING_COMPLETE`, `ATTACK_PHASE`, `BURST_CONDITION` | A real game event causes the rule to run |
| `activationWindows` | `MAIN_PHASE`, `ACTION_STEP` | Player may choose to use the rule in these windows |
| `duration` | `continuous`, `UNTIL_END_OF_TURN`, `UNTIL_END_OF_BATTLE` | How long the effect stays active |
| `timingClass` | `event_triggered`, `player_activated`, `continuous_passive` | Compiler-produced summary for backend/UI/AI |

Important distinction:

- `ATTACK_PHASE` is an `eventTrigger`
- `ACTION_STEP` is usually an `activationWindow`
- `UNTIL_END_OF_TURN` is a `duration`

These are not the same kind of timing.

## 7) How Backend Reads Your Rule (Pipeline)
1. Load card JSON from set data files.
2. Normalize rule fields (`normalizeEffectRule`).
3. Compile timing metadata (`compileEffectTimingFromRule`).
4. Bridge compatibility fields for older runtime surfaces if needed.
5. Collect matching rules by event timing (`EffectRuleCatalog`) or by activation window.
6. Route action to executor/router.
7. If user choice is needed, queue pauses for choice event.
8. After choice resolve, queue continues until event is done.

Main sources:

- `src/services/effects/timing/EffectTimingCompiler.ts`
- `src/utils/EffectNormalizationUtils.ts`
- `src/services/effects/EffectRuleCatalog.ts`
- `src/services/effects/EffectExecutor.ts`
- `src/services/effects/EffectActionRouter.ts`
- `src/models/CardSystem.ts`
- `src/services/effects/CardDataResolver.ts`

## 8) How Frontend Reads Timing Now
Frontend timing checks should read compiled timing descriptors first.

Main reader:

- `src/phaser/game/effectTiming.ts`

Current consumers:

- `src/phaser/game/actionEligibility.ts`
- `src/phaser/controllers/ActionStepCoordinator.ts`

Frontend rule:

- do not re-interpret raw authored timing by hand if `compiledTiming` is available
- prefer `compiledTiming.activationWindows` and `compiledTiming.eventTrigger`
- use legacy `trigger` or `timing.windows` only as compatibility fallback

## 9) Common Mistakes and Fixes

### Mistake 1: authoring top-level `trigger`
Bad:
```json
{ "type": "triggered", "trigger": "ENTERS_PLAY", "action": "damage" }
```
Good:
```json
{
  "type": "triggered",
  "timing": { "eventTrigger": "ENTERS_PLAY" },
  "action": "damage"
}
```

### Mistake 2: using `timing.windows` in new source data
Bad:
```json
{ "type": "activated", "timing": { "windows": ["ACTION_STEP"] }, "action": "heal" }
```
Good:
```json
{
  "type": "activated",
  "timing": { "activationWindows": ["ACTION_STEP"] },
  "action": "heal"
}
```

### Mistake 3: missing action
Bad:
```json
{ "type": "triggered", "timing": { "eventTrigger": "ATTACK_PHASE" } }
```
Good:
```json
{
  "type": "triggered",
  "timing": { "eventTrigger": "ATTACK_PHASE" },
  "action": "damage"
}
```

### Mistake 4: incorrect duration casing
Bad:
```json
{ "timing": { "duration": "until_end_turn" } }
```
Good:
```json
{ "timing": { "duration": "UNTIL_END_OF_TURN" } }
```

### Mistake 5: forgetting explicit activation window
Bad:
```json
{ "type": "special", "action": "designate_pilot" }
```
Good:
```json
{
  "type": "special",
  "timing": { "activationWindows": ["MAIN_PHASE"] },
  "action": "designate_pilot"
}
```

### Mistake 6: action needs choice but no target setup
Bad:
```json
{ "action": "destroy" }
```
Good:
```json
{
  "action": "destroy",
  "target": { "scope": "opponent", "type": "unit", "count": 1 }
}
```

## 10) Choice Needed (Mini Section)
These events mean player input is required:

- `TARGET_CHOICE`
- `BLOCKER_CHOICE`
- `TOKEN_CHOICE`
- `OPTION_CHOICE`
- `PROMPT_CHOICE`
- `BURST_EFFECT_CHOICE`

Simple rule:
if one of these is at queue head, resolve it first.

## 11) Student Checklist: "Is my new rule good?"
1. Rule `type` is correct.
2. Timing is expressed with `timing.eventTrigger`, `timing.activationWindows`, or `timing.duration`.
3. New source data does not author top-level `trigger` or `timing.windows`.
4. Action has handler path in executor/router.
5. Target and conditions match what the action needs.
6. If choice is needed, confirm queue/route flow exists.
7. Run scenario/test and confirm real behavior.

Useful commands:
```bash
npm run review:effects
npm run review:unresolved
npm run test:quick
```

## 12) Appendix: Short Canonical Lists

### Most-used event triggers
- `ENTERS_PLAY`
- `PAIRING_COMPLETE`
- `ATTACK_PHASE`
- `ATTACK_REDIRECT`
- `END_OF_TURN`
- `BURST_CONDITION`
- `BATTLE_DESTROY`

### Most-used activation windows
- `MAIN_PHASE`
- `ACTION_STEP`

### Most-used durations
- `continuous`
- `UNTIL_END_OF_TURN`
- `UNTIL_END_OF_BATTLE`

Source:
- `src/services/effects/schema/EffectSchema.ts`
- `src/services/effects/timing/EffectTimingCompiler.ts`

Definition note:
- `paired`: unit and pilot both exist in the same slot.
- `linked`: `paired` plus link identity match passes (`LinkUtils.isLinkedPair`).

Source:
- `src/services/effects/schema/EffectSchema.ts`

### Alias note
Some names are normalized by backend.
Example:
- `sourceAP` -> `sourceAp`
- `sourceHP` -> `sourceHp`

Source:
- `src/services/effects/schema/EffectSchema.ts` (`CONDITION_TYPE_ALIASES`)
