# Newbie Gameplay Guide (Secondary School Friendly)

This guide teaches how to play the game from zero.  
Use it like a class note: read top to bottom, then practice.

## 1) Game Goal
Your goal is to break through your opponent's defense and win.

Important idea:
- Defense area = `shield area` + `base`.
- Usually attacks hit `base` first.
- If `base` is empty and attack connects to `shield` side, game can end.

## 2) Card and Zone Basics

### Card types
- `Unit card`: main fighter on board.
- `Pilot card`: attaches with a unit in the same slot to create pair/link power.
- `Command card`: one-time effect card.
- `Base card`: core defense card behind shields.

### Zones
- `slot1` to `slot6`: where units and pilots stand.
- `shield area`: front defense layer.
- `base`: core defense zone.
- `energy area`: resources used to pay costs.
- `trash`: used/destroyed card zone.
- `hand`: cards you can play.

## 3) Turn Timeline (Simple)
Start Turn -> Draw -> Main -> Attack/Blocker/Action Step -> End Turn

### What each part means
- `Draw`: take card/resource updates happen.
- `Main`: play cards, use main effects.
- `Attack`: choose a target to attack.
- `Blocker`: defender may redirect attack with blocker card.
- `Action Step`: both players can react (if allowed).
- `End Turn`: cleanup and end-turn effects.

## 4) Keywords You Must Know
- `Deploy`: effect when card enters play.
- `Pair`: effect when unit + pilot pairing completes.
- `Linked`: linked state between cards (often pair context).
- `Attack`: effect during attack flow.
- `Burst`: shield-triggered effect.
- `Continuous`: always active while condition is true.
- `Blocker`: can intercept attacks.
- `Repair`: heal HP.
- `Breach`: pushes extra shield damage pressure.
- `First Strike`: hits first in battle order.
- `High-Maneuver`: special attack targeting rule.
- `Activate`: player chooses when to use.
- `Cost`: what you pay to use effect.
- `Target`: who/what effect hits.
- `Optional` / `You may`: can skip.
- `Once per turn`: only one time each turn.

## 5) How a Normal Turn Feels
1. Check your hand, energy, board.
2. Play cards in main phase.
3. Use optional activate actions if helpful.
4. Attack enemy unit or defense area.
5. Handle blocker/action-step choices.
6. End turn and let end-turn effects resolve.

## 6) Battle Flow You Need to Memorize
1. Attacker declares target (`attackUnit` or `attackShieldArea`).
2. Attack effects may trigger.
3. Defender may get `BLOCKER_CHOICE`.
4. If blocker used, target changes.
5. Action step opens for both sides.
6. Both players confirm battle.
7. Battle resolves, then follow-up effects trigger.

### `Blocker` concept (important)
- `Blocker` is the defender's intercept tool during an incoming attack.
- When `BLOCKER_CHOICE` appears, defender can choose to block or skip.
- If defender blocks, attack target can change to the blocker unit.
- If defender skips, attack continues on the original target.

### Keyword concepts (important)
- `Burst`: a shield-hit trigger. When burst condition is met, a burst choice/effect can appear.
- `Breach`: pressure effect tied to battle outcomes. It helps push damage pressure toward defense cards.
- `First Strike`: this unit deals battle damage first in combat order.
- `High-Maneuver`: this unit follows special attack-targeting rules and is harder to stop in normal lines.
- `Repair`: this effect heals damage (HP), usually in allowed timing like end-turn or card text timing.
- `Activate`: this is a player-chosen effect. You decide when to use it if timing and cost are valid.

### Quick examples
- `Burst` example: Your shield card is damaged. A `BURST_EFFECT_CHOICE` pops up, and you may activate burst text.
- `Breach` example: Your attacker wins battle and has `Breach`, so extra pressure is applied to opponent defense cards.
- `First Strike` example: Two units battle. The one with `First Strike` deals battle damage first.
- `High-Maneuver` example: Your unit attacks using special targeting rules, so normal defense lines are harder to use.
- `Repair` example: Your unit took 2 damage earlier. A `Repair` effect triggers, and that unit recovers HP.
- `Activate` example: In `Main` phase, you choose to use an `Activate` skill, pay `cost`, then resolve its effect.

## 7) Choice Rules (Very Important)
If a choice event appears, resolve it first.

Common choice events:
- `BURST_EFFECT_CHOICE`
- `TARGET_CHOICE`
- `BLOCKER_CHOICE`
- `TOKEN_CHOICE`
- `OPTION_CHOICE`
- `PROMPT_CHOICE`

Simple rule:
- Do not send random new actions while unresolved choice is waiting.

## 8) Reading Card Text Quickly
Use this formula:

`WHEN` + `WHO` + `WHAT` + `LIMIT`

Example:
- "[Deploy] Choose 1 enemy Unit. Rest it."
- WHEN = Deploy
- WHO = 1 enemy Unit
- WHAT = Rest
- LIMIT = exactly 1 target

## 9) Easy Effect Timing Matrix

| Card text clue | When it happens | Example result |
|---|---|---|
| `[Deploy] ...` | When card enters play | damage/rest/draw/etc. |
| `[When Paired] ...` | After pair completes | buff/debuff/draw |
| `[Attack] ...` | During attack flow | boost/damage/control |
| `[Burst] ...` | When burst condition is met | deploy/add to hand/use main |
| `End of turn ...` | End-turn check | heal/reset/cleanup |
| `While ...` | Continuous timing | passive buff/restriction |

## 10) Beginner Mistakes to Avoid
- Playing without enough cost.
- Ignoring unresolved choice event.
- Forgetting blocker exists.
- Forgetting once-per-turn limit.
- Ending turn too early with playable action left.
- Not checking whether effect is optional or required.

## 11) Practice Plan (Good for New Players)
1. Practice one deck with simple deploy + attack cards.
2. Practice blocker scenarios.
3. Practice burst scenarios.
4. Practice pair and linked effects.
5. Practice end-turn and repair timing.

## 12) Quick Self-Check Before You Act
- Is it my turn?
- Do I have enough cost?
- Is there unresolved choice event?
- Do I understand target and effect result?
- If battle is active, did both players confirm?

## 13) Helpful References
- `requirement/agentOnboarding/game_flow_and_logic_guideline.md`
- `requirement/agentOnboarding/card_effects_implemented_guide.md`
- `requirement/agentOnboarding/effects_rules_schema_guide.md`

Scenario examples:
- `shared/testScenarios/gameStates/GD01/GD01-125/burst_deploy_opponent_turn_skip_optional_deploy.json`
- `shared/testScenarios/gameStates/ST01/ST01-009/blocker_choice_redirect.json`
- `shared/testScenarios/gameStates/ST01/ST01-014/action_step_ap_reduction.json`
