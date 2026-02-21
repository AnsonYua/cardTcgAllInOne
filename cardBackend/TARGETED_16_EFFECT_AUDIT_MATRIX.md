# Targeted 16-Card Effect Audit Matrix

Generated: 2026-02-21

Scope:
- Cards: `GD01-008`, `GD01-020`, `GD01-052`, `GD02-046`, `GD01-044`, `GD01-003`, `ST03-001`, `GD02-036`, `GD01-093`, `GD01-088`, `ST03-013`, `GD01-111`, `GD01-100`, `GD02-107`, `GD01-128`, `ST03-015`
- Dimensions:
  - `effects.description` vs `effects.rules` semantic match
  - backend executability for trigger/condition/filter/target/action/sequence primitives
  - frontend target-choice/notification integration coverage
  - regression confidence from tests

Legend:
- `Aligned`
- `Partially aligned`
- `Mismatch`
- `Implemented with ambiguity`

| Card ID | Description clauses | Rule clauses | Description↔Rule match verdict | Backend implementation verdict | Frontend implementation verdict | Evidence (file:line) | Risk level | Fix required (Y/N) |
|---|---|---|---|---|---|---|---|---|
| GD01-008 | Deploy: choose 1 rested enemy Unit, deal 1 | `ENTERS_PLAY` + `damage` + `filters.status=rested` | Aligned | Aligned | Aligned (generic TARGET_CHOICE/notification path) | `src/data/gd01Card.json:444`, `src/services/targets/TargetResolver.ts:298`, `src/services/DeployTargetManager.ts:53`, `/Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/controllers/EffectTargetController.ts:51` | P3 | N |
| GD01-020 | Deploy: choose 1 rested enemy Unit, deal 1 | `ENTERS_PLAY` + `damage` + `filters.status=rested` | Aligned | Aligned | Aligned (generic TARGET_CHOICE/notification path) | `src/data/gd01Card.json:931`, `src/services/targets/TargetResolver.ts:298`, `src/services/DeployTargetManager.ts:53`, `/Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/controllers/targeting/TargetChoiceActionKinds.ts:1` | P3 | N |
| GD01-052 | Deploy: choose 1 enemy Unit, deal 1 | `ENTERS_PLAY` + `damage` target opponent unit count 1 | Aligned | Aligned | Aligned (generic TARGET_CHOICE/notification path) | `src/data/gd01Card.json:2420`, `src/services/effects/EffectExecutor.ts:92`, `src/services/DeployTargetManager.ts:53`, `/Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/animations/NotificationHandlers.ts:133` | P3 | N |
| GD02-046 | Deploy: choose 1 enemy Unit token, deal 2 | `ENTERS_PLAY` + `damage` + `filters.color=Token` | Aligned | Aligned | Aligned (generic TARGET_CHOICE/notification path) | `src/data/gd02Card.json:2245`, `src/services/targets/TargetFilterUtils.ts:45`, `src/services/targets/TargetResolver.ts:311`, `src/__tests__/targeted16EffectAuditCoverage.test.js:111` | P2 | N |
| GD01-044 | When paired w/(Cyber-Newtype or Newtype) pilot: choose 1-2 enemy Units, deal 1 | `PAIRING_COMPLETE` + `conditions.pairedPilotTraitAny` + `count={min:1,max:2}` + `damage` | Aligned | Aligned | Aligned (multi-target count surfaced to client dialog) | `src/data/gd01Card.json:1964`, `src/services/conditions/EffectConditionEvaluator.ts:154`, `src/services/targets/TargetCountUtils.ts:9`, `/Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/controllers/EffectTargetController.ts:141`, `src/__tests__/targeted16EffectAuditCoverage.test.js:248` | P2 | N |
| GD01-003 | During Link Attack: pay cost move 12 trash->deck shuffle; if paid set active + gain First Strike this turn | `ATTACK_PHASE` + `sourceConditions.linked` + `cost.moveFromTrashToDeck(count=12)` + `sequence(setActive, grant_keyword)` | Aligned | Aligned | Aligned (cost TARGET_CHOICE + continuation handled by generic flow) | `src/data/gd01Card.json:142`, `src/services/effects/AttackPhaseEffectManager.ts:33`, `src/services/costs/AttackCostFlowInterceptor.ts:53`, `src/services/effects/SequenceEffectManager.ts:53`, `src/__tests__/targeted16EffectAuditCoverage.test.js:145` | P2 | N |
| ST03-001 | During Pair gain High-Maneuver; during your turn when shield-area card destroyed by this unit’s battle damage, choose enemy unit deal 2 | continuous `grant_keyword(High-Maneuver)` + triggered `DEFENSE_AREA_BATTLE_DAMAGE` + `actionTurn=YOUR_TURN` + damage 2, parameters defenseAreas [`shield`,`base`] | Implemented with ambiguity | Aligned with accepted broader defense-area implementation | Aligned (generic trigger notification + target flow) | `src/data/st03Card.json:9`, `src/services/conditions/EffectConditionEvaluator.ts:29`, `src/services/effects/DefenseAreaBattleDamageTriggeredEffectManager.ts:1`, `src/services/BlockerChoiceManager.ts:56`, `src/services/BattlePhaseManager.ts:834` | P2 | N |
| GD02-036 | When linked gain Suppression this turn; during pair-(Neo Zeon) attack choose damaged enemy unit deal 2 | `PAIRING_COMPLETE grant_keyword(Suppression UNTIL_END_OF_TURN)` + `ATTACK_PHASE damage` + `pairedPilotTrait=Neo Zeon` + `filters.damaged=true` | Aligned | Aligned | Aligned (generic TARGET_CHOICE/notification path) | `src/data/gd02Card.json:1652`, `src/services/targets/TargetResolver.ts:290`, `src/services/conditions/EffectConditionEvaluator.ts:147`, `src/services/BattlePhaseManager.ts:834`, `src/__tests__/targeted16EffectAuditCoverage.test.js:199` | P2 | N |
| GD01-093 | Burst add to hand; during link attack choose enemy unit level <= source level deal 1 | `BURST_CONDITION addToHand` + `ATTACK_PHASE damage` + `filters.level=<=SOURCE_LEVEL` | Aligned | Aligned | Aligned (target title/description resolved from generic mapping) | `src/data/gd01Card.json:4238`, `src/services/targets/filters/DynamicComparisonFilterResolver.ts:20`, `src/services/targets/TargetResolver.ts:257`, `/Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/controllers/targeting/TargetChoiceEffectDescription.ts:70` | P2 | N |
| GD01-088 | Burst add to hand; when linked draw 1 | `BURST_CONDITION addToHand` + `PAIRING_COMPLETE draw(1)` + linked source condition | Aligned | Aligned | Aligned (generic draw/burst notifications) | `src/data/gd01Card.json:4011`, `src/services/PairingEffectManager.ts:371`, `src/services/effects/EffectExecutor.ts:52`, `src/__tests__/gd01088WhenLinkedDraw.test.js:5` | P3 | N |
| ST03-013 | Burst activates this card Main; Main/Action choose enemy unit deal 2 | `BURST_CONDITION action=activate_ability(abilityType=main)` + play effect `main_action_damage` windows `MAIN_PHASE`,`ACTION_STEP` | Aligned | Aligned | Aligned (burst + generic target choice) | `src/data/st03Card.json:572`, `src/services/BurstEffectManager.ts:341`, `src/services/BurstEffectManager.ts:383`, `src/services/DeployTargetManager.ts:53`, `src/__tests__/targeted16EffectAuditCoverage.test.js:289` | P2 | N |
| GD01-111 | Burst choose enemy unit deal 2; Main/Action choose damaged enemy unit deal 3 | burst `damage(2)` + play `damage(3)` + `filters.damaged=true` | Aligned | Aligned | Aligned (generic target filters + target choice UI) | `src/data/gd01Card.json:5222`, `src/services/targets/TargetResolver.ts:290`, `src/services/DeployTargetManager.ts:53`, `/Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/controllers/targeting/TargetChoiceTitles.ts:4` | P3 | N |
| GD01-100 | Main draw 2 | play `draw(value=2)` MAIN_PHASE | Aligned | Aligned | Aligned (draw notifications) | `src/data/gd01Card.json:4694`, `src/services/effects/EffectExecutor.ts:52`, `/Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/animations/NotificationHandlers.ts:195` | P3 | N |
| GD02-107 | Burst choose enemy unit deal 1; Main deal 1 to all enemy non-link units | burst sequence->damage(1 target), play sequence->damage(opponent_all, filter `pairedPilot=none`) | Aligned | Aligned | Aligned (generic sequence + no card-specific FE logic) | `src/data/gd02Card.json:5553`, `src/services/targets/TargetResolver.ts:348`, `src/services/effects/SequenceEffectManager.ts:53`, `src/__tests__/gd02107MainAllRangeAttack.test.js:6` | P2 | N |
| GD01-128 | Burst deploy this card; Deploy add 1 self shield to hand | `BURST_CONDITION deploy` + `ENTERS_PLAY addToHand(scope=self_shield, from=shield)` | Aligned | Aligned | Aligned (burst + generic add-to-hand flow) | `src/data/gd01Card.json:6262`, `src/services/BurstEffectManager.ts:530`, `src/services/effects/EffectExecutor.ts:218`, `src/services/targets/TargetResolver.ts:73`, `src/__tests__/targeted16EffectAuditCoverage.test.js:314` | P2 | N |
| ST03-015 | Burst deploy this card; Deploy add 1 self shield to hand, then choose enemy <=5 AP deal 1 | `BURST_CONDITION deploy` + deploy `sequence[addToHand(self_shield), damage(opponent ap<=5)]` | Aligned | Aligned | Aligned (sequence + target dialog handled generically) | `src/data/st03Card.json:674`, `src/services/effects/SequenceEffectManager.ts:53`, `src/services/targets/TargetNumericFilterUtils.ts:8`, `/Users/hello/Desktop/card/unity/cardGameFrontend/src/phaser/controllers/EffectTargetController.ts:141`, `src/__tests__/targeted16EffectAuditCoverage.test.js:364` | P2 | N |

## Backend primitive verification summary
- Trigger routing verified in runtime managers for `ENTERS_PLAY`, `PAIRING_COMPLETE`, `ATTACK_PHASE`, `BURST_CONDITION`, `DEFENSE_AREA_BATTLE_DAMAGE`.
- Condition/filter primitives confirmed in resolver/evaluator:
  - `status`, `damaged`, `color`, `ap`, `pairedPilot`, `pairedPilotTrait`, `pairedPilotTraitAny`, `<=SOURCE_LEVEL`.
- Multi-target semantics (`{min,max}`) enforced via `TargetCountUtils` and surfaced through TARGET_CHOICE.
- Sequence continuation (including choice pause/resume) verified via `SequenceEffectManager`.
- Keyword runtime effects confirmed:
  - `High-Maneuver` via blocker skip
  - `Suppression` via 2-shield attack
  - `First Strike` via battle resolution ordering.

## Frontend contract verification summary
- No card-specific frontend handlers are required for these 16 cards.
- Generic path covers all needed interactions:
  - `TARGET_CHOICE` dialog (single and multi target)
  - action-kind mapping/title derivation
  - source-card effect description resolution for choice headers
  - queue-ordered notification handling for target/option/prompt/burst flows.

## New regression coverage added in this pass
- `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/src/__tests__/targeted16EffectAuditCoverage.test.js`
  - Covers deploy rested filter (`GD01-008`, `GD01-020`)
  - Covers deploy any-unit damage (`GD01-052`)
  - Covers token-only targeting (`GD02-046`)
  - Covers linked attack cost + sequence continuation (`GD01-003`)
  - Covers damaged-only pair attack filter (`GD02-036`)
  - Covers 1..2 pairing target choice (`GD01-044`)
  - Covers burst activate-main flow (`ST03-013`)
  - Covers burst deploy + deploy shield pickup (`GD01-128`)
  - Covers deploy sequence shield->hand then AP-filtered damage (`ST03-015`)

