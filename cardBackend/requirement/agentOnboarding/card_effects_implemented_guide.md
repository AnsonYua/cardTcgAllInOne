# Card Effects Guide: Matrix by Turn Timing

## What This Page Is
This page is a cheat sheet for card effects.  
It maps card text to game timing and backend behavior.  
Use it to understand when an effect should happen.  
Use it to check if the backend already supports that effect.  
Current audit reports are also summarized near the end.

## How to Read Card Text Quickly
- `Deploy`: effect happens when card enters play.
- `Pair`: effect happens when unit and pilot finish pairing.
- `Attack`: effect happens during attack flow.
- `Burst`: effect happens when shield is damaged and burst can trigger.
- `End Turn`: effect happens in end-turn cleanup timing.
- `Linked`: effect needs true linked state, not only paired.
  Engine rule: linked = paired + link identity match (`LinkUtils.isLinkedPair`).
- `Continuous`: effect stays active while condition stays true.
- `Slot`: board position where unit/pilot cards are placed (`slot1` to `slot6`).
- `Pilot card`: pilot part of a pair, usually attached in the same slot.
- `Command card`: one-time effect card. You play it, resolve effect, then it usually leaves play.
- `Base card`: core defense card in base zone, behind shields.
- `Trash`: discard zone where destroyed or used cards go.
- `Main`: effect can be used in your main phase.
- `Action Step`: effect can be used during battle action step.
- `Blocker`: this card can block an incoming attack.
- `Repair`: effect heals damage (HP).
- `Breach`: gain a breach value first, then on `BATTLE_DESTROY` apply extra defense-area damage (`damageShield`).
- `Suppression`: on shield-side attack, attacker can target up to first 2 shields in one attack event.
- `First Strike`: this card deals battle damage first.
- `High-Maneuver`: this card follows special attack target rules.
- `Activate` / `Activated`: player chooses when to use this effect.
- `Cost`: what you must pay before the effect happens.
- `Target`: who or what this effect applies to.
- `Optional` / `You may`: you can choose to skip the effect.
- `Once per turn`: this effect can only happen one time each turn.
- `Once per turn` support note: backend tracks this with usage trackers, so repeat use in the same turn is blocked.
  Main files: `src/services/effects/EffectUsageTracker.ts`, `src/services/effects/attack/AttackEffectUsageTracker.ts`.

## Turn Timeline (Simple)
Start Turn -> Draw -> Main -> Attack/Blocker/Action Step -> End Turn

Rule of queue:
If a choice event is unresolved, answer it first.

## Card Text Matrix by Turn Timing (Main Table)

| When (Turn Timing) | Card Text Clue | Effect Type | What Happens (Simple) | Backend Path (File) | Needs Player Choice? |
|---|---|---|---|---|---|
| Start/Draw | "At start of turn", "draw" | Triggered / action | System draws card or applies start-turn effects | `src/services/effects/PhaseTransitionManager.ts`, `src/services/TurnLifecycleManager.ts`, `src/services/effects/EffectExecutor.ts` | Usually no |
| Deploy timing | "[Deploy] ..." / "When this enters play" | Triggered | Card enters zone, then deploy effects run | `src/services/CardPlayExecutor.ts`, `src/services/DeployEffectManager.ts`, `src/services/effects/EffectRuleCatalog.ts` | Sometimes (`TARGET_CHOICE`, `TOKEN_CHOICE`, etc.) |
| Pairing timing | "[Pair] ..." / "When paired" | Triggered | Pairing complete event triggers pair effects | `src/services/PairingEffectManager.ts`, `src/services/GameEngine.ts` | Sometimes |
| Attack timing | "[Attack] ..." | Triggered | Attack effects run before/inside battle resolution | `src/services/BattlePhaseManager.ts`, `src/services/effects/AttackPhaseEffectManager.ts` | Sometimes |
| Blocker timing | "Blocker", "redirect attack" | Triggered / choice flow | Defender may choose blocker, then battle target may change | `src/services/BlockerChoiceManager.ts`, `src/services/BattlePhaseManager.ts`, `src/services/GameEngine.ts` | Yes (`BLOCKER_CHOICE`) |
| Burst timing | "[Burst] ..." | Triggered / choice flow | Shield hit can open burst choice, then effect resolves | `src/services/BurstEffectManager.ts`, `src/services/GameEngine.ts` | Yes (`BURST_EFFECT_CHOICE`) |
| End-turn timing | "End of turn" | Triggered | End-turn effects and repair checks run, then next turn | `src/services/EventQueue/StateBasedActionEngine.ts`, `src/services/effects/EndTurnTriggeredEffectManager.ts` | Sometimes |
| Continuous timing | "While ...", "during ..." | Continuous | Effect stays active while condition is true | `src/services/ContinuousEffectManager.ts`, `src/services/effects/continuous/*` | Usually no |

## Action Matrix (What Engine Already Supports)

The actions below are wired in runtime handlers.
Main source: `src/services/effects/EffectExecutor.ts` (`ACTION_HANDLERS`).

| Action | Plain meaning | Typical card text wording | Main code file |
|---|---|---|---|
| `draw` | Draw cards | "Draw 1/2 cards" | `src/services/effects/EffectExecutor.ts` |
| `addToHand` | Move card to hand | "Add to your hand" | `src/services/effects/EffectExecutor.ts` |
| `deploy` | Put card/token into play | "Deploy ..." | `src/services/effects/actions/EffectDeployActions.ts` |
| `deploy_from_hand` | Deploy from hand by effect | "Deploy from your hand" | `src/services/effects/actions/EffectDeployFromHandActions.ts` |
| `destroy` | Destroy target | "Destroy target unit" | `src/services/effects/actions/EffectDestroyActions.ts` |
| `damage` | Deal effect damage | "Deal X damage" | `src/services/effects/actions/EffectDamageActions.ts` |
| `rest` | Set card rested | "Rest target" | `src/services/effects/actions/EffectRestActions.ts` |
| `setActive` | Set card active | "Set active" | `src/services/effects/actions/EffectSetActiveActions.ts` |
| `grant_keyword` | Give keyword | "Gain First Strike/Blocker" | `src/services/effects/actions/EffectKeywordActions.ts` |
| `allow_attack_target` | Expand legal attack target | "Can attack ..." | `src/services/effects/actions/EffectAllowAttackTargetActions.ts` |
| `restrict_attack` | Restrict who can attack | "Cannot attack ..." | `src/services/effects/actions/EffectRestrictAttackActions.ts` |
| `pair_from_hand` | Pair from hand | "Pair from hand" | `src/services/effects/actions/EffectPairActions.ts` |
| `pair_from_trash` | Pair from trash | "Pair from trash" | `src/services/effects/actions/EffectPairActions.ts` |
| `discardFromHand` | Discard card(s) | "Discard ..." | `src/services/effects/actions/EffectDiscardActions.ts` |
| `moveFromHandToDeckBottom` | Move hand card to deck bottom | "Put hand card to deck bottom" | `src/services/effects/actions/EffectDeckActions.ts` |
| `moveFromTrashToDeck` | Move trash card to deck | "Return from trash to deck" | `src/services/effects/actions/EffectDeckActions.ts` |
| `exileFromTrash` | Exile card from trash | "Exile from trash" | `src/services/effects/actions/EffectExileActions.ts` |
| `addBasicEnergy` | Add normal energy | "Add 1 energy" | `src/services/effects/actions/EffectEnergyActions.ts` |
| `addExtraEnergy` | Add extra energy | "Add extra energy" | `src/services/effects/actions/EffectEnergyActions.ts` |
| `prevent_battle_damage` | Prevent battle damage | "Prevent battle damage" | `src/services/effects/actions/EffectBattleDamagePreventionActions.ts` |
| `prevent_damage` | Prevent effect damage | "Prevent damage" | `src/services/effects/actions/EffectEffectDamagePreventionActions.ts` |
| `prevent_set_active_next_turn` | Lock set-active next turn | "Cannot be set active next turn" | `src/services/effects/actions/EffectActivationLockActions.ts` |
| `returnToHand` | Return card to hand | "Return target to hand" | `src/services/effects/actions/EffectReturnToHandActions.ts` |
| `setActive_then_restrict_attack` | Set active, then apply attack lock | "Set active. It cannot ..." | `src/services/effects/actions/EffectSetActiveThenRestrictAttackActions.ts` |
| `damageShield` | Damage shield area | "Damage shield" | `src/services/effects/actions/EffectShieldActions.ts` |
| `prevent_shield_damage` | Prevent shield damage | "Prevent shield damage" | `src/services/effects/actions/EffectShieldActions.ts` |
| `grant_breach` | Give breach value to target card. Follow-up damage happens later on `BATTLE_DESTROY` (base first, else shield). | "Gain Breach" | `src/services/effects/actions/EffectBreachActions.ts`, `src/services/effects/BattleDestroyEffectManager.ts`, `src/services/effects/actions/EffectShieldActions.ts` |
| `scry_top_deck` | Look/filter top deck | "Look at top cards" | `src/services/effects/actions/EffectScryActions.ts` |

Special keyword runtime note:
- `Suppression` shield targeting is applied in battle resolution path: `src/services/BattlePhaseManager.ts` + `src/services/battle/BattleShieldUtils.ts`.

Also routed effect actions (special managers):
- `choose_one_then_deploy_token` -> `src/services/effects/TokenChoiceManager.ts`
- `draw_then_discard` -> `src/services/effects/DrawThenDiscardManager.ts`
- `tutor_top_deck` -> `src/services/effects/TutorTopDeckManager.ts`
- `deploy_from_top_deck` -> `src/services/effects/DeployFromTopDeckManager.ts`
- `sequence` -> `src/services/effects/SequenceEffectManager.ts`
- `conditional` -> `src/services/effects/ConditionalEffectManager.ts`

Router source:
- `src/services/effects/EffectActionRouter.ts`

## Choice Matrix (Player Must Click/Choose)

| Event | When it appears | API to resolve | What to send | What happens if skipped |
|---|---|---|---|---|
| `BURST_EFFECT_CHOICE` | Burst can trigger after shield damage | `POST /api/game/player/confirmBurstChoice` | `gameId`, `playerId`, `eventId`, `confirmed` | Can decline burst; queue continues |
| `TARGET_CHOICE` | Effect needs manual targets | `POST /api/game/player/confirmTargetChoice` | `gameId`, `playerId`, `eventId`, `selectedTargets[]` | Optional ones may allow empty; required ones fail if empty |
| `BLOCKER_CHOICE` | Defender has blocker options | `POST /api/game/player/confirmBlockerChoice` | `gameId`, `playerId`, `eventId`, blocker target(s) | Can decline blocker; attack continues normally |
| `TOKEN_CHOICE` | Effect says choose one token option | `POST /api/game/player/confirmTokenChoice` | `gameId`, `playerId`, `eventId`, `selectedChoiceIndex` | Invalid index fails; queue stays blocked |
| `OPTION_CHOICE` | Effect has generic option branches | `POST /api/game/player/confirmOptionChoice` | `gameId`, `playerId`, `eventId`, `selectedOptionIndex` | Invalid option fails; queue stays blocked |
| `PROMPT_CHOICE` | Prompt-style option event | `POST /api/game/player/confirmOptionChoice` | `gameId`, `playerId`, `eventId`, `selectedOptionIndex` | Invalid option fails; queue stays blocked |

Route source:
- `src/routes/gameRoutes.ts`

## Audit Status (Current)

Latest ST audit summary:
- Report: `requirement/review/st_effect_audit_report.md`
- Data: `requirement/review/st_effect_audit_report.json`
- Result: `Rows: 176 | PASS: 176 | WARN: 0 | FAIL: 0`

GD audit matrices are also present and reviewed:
- `GD01_EFFECT_AUDIT_MATRIX.md`
- `GD02_EFFECT_AUDIT_MATRIX.md`
- `GD03_EFFECT_AUDIT_MATRIX.md`

Simple meaning:
- Current audits show implemented effects are aligned with card text mapping.
- For new card data changes, rerun audits and quick tests before release.

### Re-check note (for future edits)
- If a new rule/action is added, confirm handler path still exists.
- If a trigger name changes, confirm route/manager still catches it.
- If targeting changes, confirm required choice flow still resolves.

## Mini Examples (Student-Friendly)

### 1) Deploy example
Card text says: "[Deploy] Deal 1 damage."  
Then system runs deploy trigger handlers.  
If target is needed, system opens `TARGET_CHOICE` first.

### 2) Attack and blocker example
Card text says: "[Attack] Gain AP."  
Then attack starts and attack effects run.  
If defender has blocker, player may need blocker choice first.

### 3) Burst example
Card text says: "[Burst] Deploy this card."  
Then shield damage can open burst choice event.  
User confirms burst, then card deploy logic runs.

## Quick Check Before Saying "Implemented"
1. Find the effect trigger in card `effects.rules`.
2. Find the effect action in the same rule.
3. Confirm handler exists in `EffectExecutor` or `EffectActionRouter`.
4. Confirm choice API route exists if the flow needs choice.
5. Run a related scenario or test command.

Suggested commands:
```bash
npm run test:quick
npm run test:list
npm run test:dynamic run shared/testScenarios/gameStates/<SET>/<CARD_ID>/<scenario>.json --verbose
npm run review:effects
npm run review:unresolved
```
