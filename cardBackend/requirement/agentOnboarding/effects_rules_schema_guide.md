# effects.rules Schema Guide (Student-Friendly)

## 1) What is `effects.rules`?
`effects.rules` is the instruction list on a card.  
Think of each rule like: **IF this time happens, THEN do this action**.  
A card can have one rule or many rules.  
Each rule is one behavior unit.  
The backend reads these rules and turns them into game events.  
If the rule needs player input, the queue pauses and waits.

## 2) The One-Line Mental Model
> `trigger` tells **WHEN**, `action` tells **WHAT**, `target` tells **WHO/WHAT**, and `conditions` tell **IF allowed**.

## 3) Core Rule Shape (Simple JSON)

```json
{
  "effectId": "example_damage",
  "type": "triggered",
  "trigger": "ENTERS_PLAY",
  "action": "damage",
  "target": { "scope": "opponent", "type": "unit", "count": 1 }
}
```

How to read this:
- `effectId`: this rule's name/id.
- `type`: rule style (`triggered`, `continuous`, etc.).
- `trigger`: when the rule starts.
- `action`: what the rule does.
- `target`: which card/player is affected.

## 4) Field-by-Field Student Table

| Field | What it means (simple) | Typical values | Required? | Backend source file |
|---|---|---|---|---|
| `effectId` | Rule ID/name | `"pair_draw"`, `"burst_deploy"` | Recommended (fallback exists) | `src/services/EventQueue/interfaces/GameEvent.ts`, `src/utils/EffectNormalizationUtils.ts` |
| `type` | Rule category | `triggered`, `continuous`, `activated`, `play` | Optional but strongly recommended | `src/services/EventQueue/interfaces/GameEvent.ts`, `src/services/effects/canonical/EffectCanonicalSchema.ts` |
| `trigger` | When rule runs | `ENTERS_PLAY`, `PAIRING_COMPLETE`, `ATTACK_PHASE`, `BURST_CONDITION`, `END_OF_TURN`, `continuous` | Required for trigger-driven rules | `src/services/effects/schema/EffectSchema.ts`, `src/utils/EffectNormalizationUtils.ts` |
| `action` | What rule does | `damage`, `draw`, `deploy`, `rest`, etc. | Required for most runtime rules | `src/services/effects/EffectExecutor.ts`, `src/services/effects/EffectActionRouter.ts` |
| `target` | Who/what action applies to | `{ scope, type, count, filters }` | Required for targeted actions | `src/services/EventQueue/interfaces/GameEvent.ts`, `src/utils/EffectNormalizationUtils.ts` |
| `conditions` | Extra IF checks | arrays of condition objects | Optional | `src/services/EventQueue/interfaces/GameEvent.ts`, `src/services/effects/schema/EffectSchema.ts` |
| `sourceConditions` | Conditions on source card/player | condition objects | Optional | `src/services/EventQueue/interfaces/GameEvent.ts`, `src/utils/EffectNormalizationUtils.ts` |
| `cost` | Payment before effect | discard/rest/exile-like keys | Optional | `src/services/EventQueue/interfaces/GameEvent.ts`, `src/utils/EffectNormalizationUtils.ts` |
| `timing` | Duration/window details | `duration`, `windows`, `actionTurn` | Optional | `src/services/EventQueue/interfaces/GameEvent.ts`, `src/utils/EffectNormalizationUtils.ts` |
| `parameters` | Extra action data | numeric/flag/config object | Optional | `src/services/EventQueue/interfaces/GameEvent.ts`, `src/utils/EffectNormalizationUtils.ts` |
| `optional` | Can player skip? | `true`, `false` | Optional | `src/services/EventQueue/interfaces/GameEvent.ts` |
| `description` | Human text note | string or string[] | Optional | `src/services/EventQueue/interfaces/GameEvent.ts` |

## 5) Trigger-by-Turn Matrix

| Turn timing | Trigger examples | Simple meaning | Backend source file |
|---|---|---|---|
| Start/Draw | `EFFECT_DRAW` | Runs around draw-related moments | `src/services/GameEngine.ts`, `src/services/effects/EffectDrawTriggeredEffectManager.ts` |
| Main | `MAIN_PHASE`, some `none`/activated paths | Rule can be used in main phase | `src/services/PlayerActionExecutor.ts`, `src/services/effects/MainPhaseAbilityManager.ts` |
| Attack / Action Step | `ATTACK_PHASE`, `ATTACK_REDIRECT`, `BATTLE_DESTROY` | Runs in battle flow | `src/services/BattlePhaseManager.ts`, `src/services/effects/AttackPhaseEffectManager.ts` |
| Pair timing | `PAIRING_COMPLETE`, `PAIRING_COMPLETE_GLOBAL` | Runs after unit+pilot pairing | `src/services/PairingEffectManager.ts`, `src/services/effects/PairingGlobalEffectManager.ts` |
| End Turn | `END_OF_TURN` | Runs in end-turn checks/cleanup | `src/services/EventQueue/StateBasedActionEngine.ts`, `src/services/effects/EndTurnTriggeredEffectManager.ts` |
| Burst | `BURST_CONDITION` | Runs when burst condition is met | `src/services/BurstEffectManager.ts` |
| Continuous | `continuous` | Stays active while condition is true | `src/services/ContinuousEffectManager.ts`, `src/services/effects/continuous/*` |

## 6) Action Families Matrix (Simple)

| Action family | Example actions | Plain meaning | Primary code path |
|---|---|---|---|
| Card movement | `addToHand`, `deploy`, `deploy_from_hand`, `returnToHand`, `moveFromTrashToDeck` | Move cards between zones or put cards into play | `src/services/effects/EffectExecutor.ts`, `src/services/effects/actions/EffectDeployFromHandActions.ts`, `src/services/effects/actions/EffectDeckActions.ts` |
| Combat impact | `damage`, `destroy`, `rest`, `setActive`, `allow_attack_target`, `restrict_attack` | Change battle state and target rules | `src/services/effects/EffectExecutor.ts`, `src/services/effects/actions/EffectDamageActions.ts`, `src/services/effects/actions/EffectDestroyActions.ts` |
| Resource/control | `addBasicEnergy`, `addExtraEnergy`, `discardFromHand`, `exileFromTrash` | Pay/manage resources and hand/trash flow | `src/services/effects/actions/EffectEnergyActions.ts`, `src/services/effects/actions/EffectDiscardActions.ts`, `src/services/effects/actions/EffectExileActions.ts` |
| Keywords/protection | `grant_keyword`, `grant_breach`, `prevent_battle_damage`, `prevent_damage` | Give abilities or prevent damage | `src/services/effects/actions/EffectKeywordActions.ts`, `src/services/effects/actions/EffectBreachActions.ts`, `src/services/effects/actions/EffectBattleDamagePreventionActions.ts` |
| Multi-step flows | `sequence`, `conditional`, `draw_then_discard`, `tutor_top_deck` | Run multi-step or branch logic | `src/services/effects/EffectActionRouter.ts`, `src/services/effects/SequenceEffectManager.ts`, `src/services/effects/ConditionalEffectManager.ts` |

## 7) How Backend Reads Your Rule (Pipeline)
1. Load card JSON from set data files.
2. Collect matching rules by trigger (`EffectRuleCatalog`).
3. Normalize fields and aliases (`normalizeEffectRule`).
4. Route action to executor/router (`EffectExecutor` or `EffectActionRouter`).
5. If user choice is needed, queue pauses for choice event.
6. After choice resolve, queue continues until event is done.

Main sources:
- `src/services/effects/EffectRuleCatalog.ts`
- `src/utils/EffectNormalizationUtils.ts`
- `src/services/effects/EffectExecutor.ts`
- `src/services/effects/EffectActionRouter.ts`
- `src/models/GameEnvironment.ts`
- `src/services/StaticEventProcessor.ts`

## 8) Common Mistakes and Fixes

### Mistake 1: wrong trigger spelling
Bad:
```json
{ "trigger": "ENTER_PLAY", "action": "damage" }
```
Good:
```json
{ "trigger": "ENTERS_PLAY", "action": "damage" }
```

### Mistake 2: missing action
Bad:
```json
{ "trigger": "ATTACK_PHASE" }
```
Good:
```json
{ "trigger": "ATTACK_PHASE", "action": "damage" }
```

### Mistake 3: target count mismatch
Bad:
```json
{ "action": "damage", "target": { "count": 0 } }
```
Good:
```json
{ "action": "damage", "target": { "count": 1 } }
```

### Mistake 4: alias not normalized in docs/data
Bad:
```json
{ "conditions": [{ "type": "sourceAP", "value": ">=5" }] }
```
Good:
```json
{ "conditions": [{ "type": "sourceAp", "value": ">=5" }] }
```
Note: backend alias normalization exists, but canonical naming is safer.

### Mistake 5: ambiguous condition object
Bad:
```json
{ "conditions": [{ "value": 2 }] }
```
Good:
```json
{ "conditions": [{ "type": "unitsInPlay", "value": ">=2" }] }
```

### Mistake 6: forgetting `optional` on skippable choice
Bad:
```json
{ "trigger": "BURST_CONDITION", "action": "deploy" }
```
Good:
```json
{ "trigger": "BURST_CONDITION", "action": "deploy", "optional": true }
```

### Mistake 7: incorrect timing casing/value
Bad:
```json
{ "timing": { "duration": "until_end_turn" } }
```
Good:
```json
{ "timing": { "duration": "UNTIL_END_OF_TURN" } }
```

### Mistake 8: invalid scope/type combo
Bad:
```json
{ "target": { "scope": "deck", "type": "unit" } }
```
Good:
```json
{ "target": { "scope": "opponent", "type": "unit", "zone": ["slot"] } }
```

### Mistake 9: action needs choice but no target setup
Bad:
```json
{ "action": "destroy" }
```
Good:
```json
{ "action": "destroy", "target": { "scope": "opponent", "type": "unit", "count": 1 } }
```

### Mistake 10: wrong cost object shape
Bad:
```json
{ "cost": "discard1" }
```
Good:
```json
{ "cost": { "discardFromHand": { "count": 1 } } }
```

## 9) Choice Needed (Mini Section)
These events mean player input is required:
- `TARGET_CHOICE`
- `BLOCKER_CHOICE`
- `TOKEN_CHOICE`
- `OPTION_CHOICE`
- `PROMPT_CHOICE`
- `BURST_EFFECT_CHOICE`

Simple rule:
If one of these is at queue head, resolve it first.

Related files:
- `src/models/GameEnvironment.ts` (`needsPlayerInput`)
- `src/routes/gameRoutes.ts` (confirm APIs)
- `src/services/choices/ChoiceConfirmationService.ts`

## 10) Schema + Current Status
Current status from audits:
- ST report markdown: `requirement/review/st_effect_audit_report.md`
- ST report json: `requirement/review/st_effect_audit_report.json`
- ST summary at generation time: `Rows: 176 | PASS: 176 | WARN: 0 | FAIL: 0`

GD audit matrices:
- `GD01_EFFECT_AUDIT_MATRIX.md`
- `GD02_EFFECT_AUDIT_MATRIX.md`
- `GD03_EFFECT_AUDIT_MATRIX.md`

Cautious note:
Current audits show aligned coverage.  
Re-run audits and quick tests after schema/data changes.

## 11) Student Checklist: "Is my new rule good?"
1. Trigger exists in known trigger set.
2. Action has handler path in executor/router.
3. Target and conditions match what action needs.
4. If choice is needed, confirm route/flow exists.
5. Run scenario/test and confirm real behavior.

Useful commands:
```bash
npm run review:effects
npm run review:unresolved
npm run test:quick
```

## 12) Appendix: Short Canonical Lists

### Most-used triggers
- `ENTERS_PLAY`
- `PAIRING_COMPLETE`
- `ATTACK_PHASE`
- `ATTACK_REDIRECT`
- `END_OF_TURN`
- `BURST_CONDITION`
- `BATTLE_DESTROY`
- `continuous`

Source:
- `src/services/effects/schema/EffectSchema.ts`

### Most-used condition types
- `linked`
- `paired`
- `turnPlayer`
- `sourceAp`
- `sourceHp`
- `cardsInTrash`
- `unitsInPlay`
- `hasAnotherLinkedUnit`

Source:
- `src/services/effects/schema/EffectSchema.ts`

### Alias note
Some names are normalized by backend.
Example:
- `sourceAP` -> `sourceAp`
- `sourceHP` -> `sourceHp`

Source:
- `src/services/effects/schema/EffectSchema.ts` (`CONDITION_TYPE_ALIASES`)
