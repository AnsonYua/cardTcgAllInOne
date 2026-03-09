# Effect Scheme Summary

## Purpose
This document is a practical summary of the card effect scheme used in the backend after the trigger-first timing refactor. It is meant to help a reader quickly understand:

- how effect data is authored in card JSON
- how timing is split into clearer concepts
- which timing and action families appear most often in the GD/ST card pool
- which patterns matter most for engine work, frontend timing gates, and AI evaluation

It does not replace the full schema guide in `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/requirement/agentOnboarding/effects_rules_schema_guide.md`. This document is the shorter, more practical version.

## One-Line Mental Model
Each effect rule answers five questions:

- `type`: what kind of rule is this
- `timing.eventTrigger`: what game event starts it, if any
- `timing.activationWindows`: when the player may use it, if any
- `timing.duration`: how long it lasts, if it persists
- `action`: what it does

Then `target`, `conditions`, `sourceConditions`, and `parameters` explain who it affects and how it resolves.

Important wording rule for this document:

- when this document says `event trigger`, it means `timing.eventTrigger`
- source card data should be written with `timing.*` fields only

## Current Timing Model

### Source authoring timing
Source card JSON should use:

```json
{
  "timing": {
    "eventTrigger": "ENTERS_PLAY",
    "activationWindows": ["MAIN_PHASE"],
    "duration": "UNTIL_END_OF_TURN"
  }
}
```

Not every rule uses all three fields. Typical usage is:

- `triggered` rules use `timing.eventTrigger`
- `activated`, `play`, and `special` rules use `timing.activationWindows`
- `continuous` or temporary effects use `timing.duration`

### Compiled runtime timing
At runtime, the backend also derives:

- `compiledTiming.eventTrigger`
- `compiledTiming.activationWindows`
- `compiledTiming.duration`
- `compiledTiming.timingClass`

Important rule:

- new source card JSON should use `timing.eventTrigger`, `timing.activationWindows`, and `timing.duration`
- `internalHook` is runtime-only and not normal card authoring data

## Card Data Shape
At the set-data level, each card file is shaped like this:

```json
{
  "metadata": { "setId": "GD01" },
  "cards": {
    "GD01-001": {
      "id": "GD01-001",
      "name": "Gundam",
      "cardType": "unit",
      "level": 4,
      "cost": 3,
      "ap": 3,
      "hp": 4,
      "effects": {
        "rules": [
          {
            "effectId": "pair_draw",
            "type": "triggered",
            "timing": {
              "eventTrigger": "PAIRING_COMPLETE"
            },
            "action": "draw"
          }
        ]
      }
    }
  }
}
```

Important top-level card fields:

- `id`: card number like `GD01-001`
- `cardType`: `unit`, `pilot`, `command`, or `base`
- `link`, `traits`, `color`, `level`, `cost`, `ap`, `hp`: card identity and stats
- `effects.rules[]`: the real runtime effect list

## Core Rule Shape
A typical rule contains these fields:

```json
{
  "effectId": "deploy_damage_1",
  "type": "triggered",
  "timing": {
    "eventTrigger": "ENTERS_PLAY"
  },
  "target": {
    "type": "unit",
    "scope": "opponent",
    "count": 1
  },
  "action": "damage",
  "parameters": {
    "value": 1
  }
}
```

Common fields and what they mean:

| Field | Meaning |
|---|---|
| `effectId` | stable identifier for this rule |
| `type` | rule family such as `triggered`, `play`, `continuous`, `special`, `activated` |
| `timing` | source timing metadata using `eventTrigger`, `activationWindows`, and/or `duration` |
| `action` | effect operation to execute |
| `target` | which card/player/zone the action applies to |
| `conditions` | requirements checked on game state or event context |
| `sourceConditions` | requirements checked on the source card |
| `cost` | payment or usage limit such as `oncePerTurn` |
| `parameters` | action-specific values and nested flow config |
| `optional` | whether the effect may be declined |
| `compiledTiming` | runtime-only normalized timing descriptor |

## What The Real Card Pool Looks Like
Across `GD01`, `GD02`, `GD03`, and `ST01` to `ST08`, the card data currently contains:

- `538` cards
- `699` effect rules
- card types:
  - `unit`: `345`
  - `command`: `88`
  - `pilot`: `63`
  - `base`: `42`
- rule types:
  - `triggered`: `448`
  - `play`: `90`
  - `continuous`: `83`
  - `special`: `40`
  - `activated`: `38`

This means the backend is mostly dealing with triggered effects, with a meaningful second layer of play, continuous, special, and activated rules.

## Rule Types In Practice

### `triggered`
This is the most common rule family. It waits for a real event such as deploy, pair, attack, burst, destruction, or end of turn.

Common examples:
- `ENTERS_PLAY`
- `PAIRING_COMPLETE`
- `ATTACK_PHASE`
- `BURST_CONDITION`
- `BATTLE_DESTROY`
- `END_OF_TURN`

Example:

```json
{
  "effectId": "pair_draw",
  "type": "triggered",
  "timing": {
    "eventTrigger": "PAIRING_COMPLETE"
  },
  "action": "draw",
  "conditions": [
    { "type": "unitsInPlay", "value": ">=3" }
  ],
  "parameters": { "value": 1 }
}
```

This says: when pairing finishes, if you have at least 3 units in play, draw 1.

### `play`
This is used for effects that are part of playing a command or using a card during a legal window.

Example:

```json
{
  "effectId": "main_bounce_enemy",
  "type": "play",
  "timing": {
    "activationWindows": ["MAIN_PHASE"]
  },
  "action": "conditional"
}
```

Important note:
some `play` rules are still event-shaped edge cases, such as cost-replacement rules triggered by `COST`. In those cases, `timing.eventTrigger` is valid for a `play` rule.

This is common for command cards that branch based on current board state.

### `continuous`
This stays active while its conditions are true. It is not a one-shot event.

Example:

```json
{
  "effectId": "continuous_prevent_battle_damage",
  "type": "continuous",
  "action": "prevent_battle_damage",
  "conditions": [
    { "type": "turnPlayer", "scope": "self" }
  ],
  "timing": {
    "duration": "continuous",
    "endOnSourceDestroyed": true
  }
}
```

This is the pattern for auras, passive protection, and static modifiers.

### `special`
This is used for special handling that does not fit ordinary play or triggered flow. In the current card pool, the main example is command cards that can be used as pilots.

Example:

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

This matters because command cards with `designate_pilot` create a second legal play family: they can be played as commands or used as pilots.

### `activated`
This is a player-chosen ability that becomes legal in a specific timing window.

Example:

```json
{
  "effectId": "activate_heal",
  "type": "activated",
  "timing": {
    "activationWindows": ["ACTION_STEP"]
  },
  "cost": { "oncePerTurn": true },
  "target": {
    "type": "unit",
    "scope": "any",
    "count": 1
  },
  "action": "heal",
  "parameters": { "value": 1 },
  "sourceConditions": [
    { "type": "linked" }
  ]
}
```

This is the pattern for `[Main]`, `[Action]`, and other opt-in card abilities.

## Event Trigger Families That Matter Most
Top event-trigger families in the current card pool:

| Event trigger | Count | Why it matters |
|---|---:|---|
| `BURST_CONDITION` | 134 | shield pressure and burst choice are major parts of the game |
| `ENTERS_PLAY` | 101 | deploy tempo is a central source of immediate value |
| `continuous` | 83 | passive modifiers and restrictions are common |
| `PAIRING_COMPLETE` | 59 | pair/link timing creates large swings |
| `ATTACK_PHASE` | 40 | attack timing is a major tactical window |
| `ATTACK_REDIRECT` | 35 | blocker and redirect logic strongly affect combat access |
| `BATTLE_DESTROY` | 24 | breach and destroy payoff matter for race pressure |
| `DESTROYED` | 20 | death triggers change trade evaluation |
| `END_OF_TURN` | 17 | repair and delayed recovery matter for survival math |

What this means in gameplay terms:

- The game is burst-heavy, not only board-heavy.
- Enter-play value is a major source of tempo.
- Pairing is not cosmetic. It creates real tactical and resource spikes.
- Attack and blocker timing are a major part of effect value.
- End-of-turn healing and delayed effects change whether a board is actually safe.

## Action Families That Matter Most
Top action families in the current card pool:

| Action | Count | What it usually means |
|---|---:|---|
| `sequence` | 156 | multi-step effect flow |
| `addToHand` | 119 | burst retrieval, search, recovery |
| `modifyAP` | 93 | combat math swing |
| `damage` | 85 | deploy ping, attack support, removal |
| `conditional` | 70 | branch by board state or card state |
| `deploy` | 46 | burst/base deploy or free field presence |
| `rest` | 41 | open attacks or disable defenders |
| `designate_pilot` | 40 | command card can act as pilot |
| `redirect_attack` | 36 | blocker posture and combat access |
| `grant_keyword` | 34 | grant keywords like `High-Maneuver`, `Blocker`, or `First Strike` |
| `heal` | 30 | repair or survivability |
| `returnToHand` | 21 | bounce tempo |
| `allow_attack_target` | 17 | attack active units or otherwise expand legal targets |
| `destroy` | 16 | hard removal |
| `setActive` | 14 | re-open attack or activation lines |
| `prevent_battle_damage` | 14 | protect against combat trades |
| `damageShield` | 13 | breach / defense-area pressure |
| `select_from_top_deck` | 11 | tutor-like top-deck selection |
| `grant_breach` | 11 | extra shield/base pressure after battle destroy |
| `activate_ability` | 5 | burst or effect path that tells engine to run another ability |

The important lesson is that a lot of cards are not simple one-shot effects. The data is full of nested branches, multi-step resolution, and timing-sensitive combat actions.

## Activation Windows And Durations

### Activation windows

| Activation window | Meaning |
|---|---|
| `MAIN_PHASE` | normal play or main-phase activation |
| `ACTION_STEP` | battle-response window |

### Durations

| Duration | Meaning |
|---|---|
| `continuous` | passive effect stays active |
| `UNTIL_END_OF_TURN` | temporary effect for the current turn |
| `UNTIL_END_OF_BATTLE` | temporary battle-only effect |

This tells you the game is not only about board state. Timing is part of both legality and value.

## Common Schema Patterns

### 1. Simple targeted effect
This is the easiest pattern: event timing plus target plus one action.

Example: `GD01-008 Guntank`

```json
{
  "effectId": "deploy_damage_1",
  "type": "triggered",
  "timing": {
    "eventTrigger": "ENTERS_PLAY"
  },
  "target": {
    "type": "unit",
    "scope": "opponent",
    "filters": { "status": "rested" },
    "count": 1,
    "selection": { "type": "player_choice" }
  },
  "action": "damage",
  "parameters": { "value": 1 }
}
```

### 2. Burst self-resolution
This pattern is very common. A shield card is broken, then the effect uses the shield card itself as the target.

Example: `GD01-087 Sayla Mass`

```json
{
  "effectId": "burst_add_to_hand",
  "type": "triggered",
  "timing": {
    "eventTrigger": "BURST_CONDITION"
  },
  "target": {
    "type": "card",
    "scope": "self"
  },
  "action": "addToHand"
}
```

Related burst deploy pattern:

```json
{
  "effectId": "burst_deploy",
  "type": "triggered",
  "timing": {
    "eventTrigger": "BURST_CONDITION"
  },
  "target": {
    "type": "card",
    "scope": "self"
  },
  "action": "deploy"
}
```

### 3. Activated effect in an action window
This pattern is important for both human play and AI action enumeration.

Example: `GD01-014 G-Sky Easy`

```json
{
  "effectId": "activate_heal",
  "type": "activated",
  "timing": {
    "activationWindows": ["ACTION_STEP"]
  },
  "cost": {
    "oncePerTurn": true
  },
  "target": {
    "type": "unit",
    "scope": "any",
    "count": 1
  },
  "action": "heal",
  "parameters": {
    "value": 1
  }
}
```

### 4. Command card as pilot
This is a special play-family pattern. The rule does not directly deal damage or draw cards. Instead, it changes how the card may legally be played.

Example: `GD01-101 Deep Devotion`

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

### 5. Burst telling the engine to run another ability
Some burst cards do not directly express the whole effect body. They tell the engine to activate another defined ability, usually the card's main effect.

Example: `ST01-014 Unforeseen Incident`

```json
{
  "effectId": "burst_activate_main",
  "type": "triggered",
  "timing": {
    "eventTrigger": "BURST_CONDITION"
  },
  "action": "activate_ability",
  "parameters": {
    "abilityType": "main"
  }
}
```

This matters because the runtime must support burst-triggered ability activation as a distinct decision path.

### 6. Top-deck selection flow
This is a structured tutor/search pattern. The rule looks at a fixed number of cards, optionally selects one that matches filters, then moves the rest somewhere else.

Example: `GD01-045 Duel Gundam (Assault Shroud)`

```json
{
  "effectId": "pair_look_top_3_deploy_zaft_unit_le_4",
  "type": "triggered",
  "timing": {
    "eventTrigger": "PAIRING_COMPLETE"
  },
  "action": "select_from_top_deck",
  "parameters": {
    "lookCount": 3,
    "select": {
      "count": 1,
      "optional": true,
      "toZone": "play",
      "filters": {
        "cardType": "unit",
        "traitsAny": ["ZAFT"],
        "level": "<=4"
      }
    }
  }
}
```

### 7. Sequence plus conditional
This is the most important advanced pattern in the card pool. Many rules are not one action. They are a mini-program.

Example: `GD01-027 Big Zam`

```json
{
  "effectId": "deploy_damage_all_4",
  "type": "triggered",
  "timing": {
    "eventTrigger": "ENTERS_PLAY"
  },
  "action": "sequence",
  "parameters": {
    "steps": [
      {
        "action": "conditional",
        "parameters": {
          "if": [
            {
              "type": "cardsInTrash",
              "scope": "self",
              "cardType": "unit",
              "traitsAny": ["Zeon", "Neo Zeon"],
              "value": ">=10"
            }
          ],
          "then": [
            {
              "action": "damage",
              "target": {
                "type": "unit",
                "scope": "any_all_unit",
                "filters": {
                  "keywords": ["Blocker"]
                }
              },
              "parameters": { "value": 4 }
            }
          ]
        }
      }
    ]
  }
}
```

If you only read the top-level action name, you miss the real effect logic. This is why effect parsing, auditing, and AI evaluation must understand nested structure.

## Target And Scope Patterns
Common target concepts:

- `scope: self`: the source card or source player side
- `scope: opponent`: opposing side
- `scope: any`: either side
- `scope: source`: the source card itself
- `scope: opponent_shield`: shield-side target family
- `scope: any_all_unit`: all units meeting filters

Common target filters:

- `status: rested`
- `hp: <=N`
- `level: <=N`
- `ap: <=N`
- `keywords: ["Blocker"]`
- `traitsAny: [...]`
- `isLinkUnit: true`

Common selection notes:

- `selection.type: player_choice` means a choice event may be required.
- `count` controls how many targets or choices are needed.
- `optional: true` allows the effect to skip the selection path.

## Common Condition Families
The most common condition families are board-state or pair-state checks:

| Condition | Count | Typical use |
|---|---:|---|
| `unitsInPlayWithFilter` | 13 | board-state threshold with filters |
| `unitsInPlayWithTrait` | 12 | trait count checks |
| `pairedPilotTrait` | 8 | pair/link identity checks |
| `cardsInTrash` | 7 | graveyard threshold |
| `sourceAp` | 6 | AP-based branch |
| `hasAnotherUnitWithTrait` | 5 | support-piece requirement |
| `attackTargetCardType` | 5 | attack target-specific logic |
| `pairedUnitTrait` | 5 | unit trait requirement on pair |
| `turnPlayer` | 4 | only on your turn / enemy turn |
| `sourceDamaged` | 4 | source card damage-state gating |

The current schema is therefore less like a flat keyword list and more like a small rule language for event-driven board checks.

## Choice-Driven Effects
Even when a rule looks short in JSON, it may create a choice event. The main choice families the runtime already uses are:

- `TARGET_CHOICE`
- `BLOCKER_CHOICE`
- `TOKEN_CHOICE`
- `OPTION_CHOICE`
- `PROMPT_CHOICE`
- `BURST_EFFECT_CHOICE`

Practical reading rule:

- If `selection` is `player_choice`, the effect may pause for input.
- If the rule uses branch actions, tokens, burst, or blocker redirects, assume the queue may stop for a decision.
- For AI work, these are real action families, not implementation details.

## What This Means For AI, Frontend, And Debugging
The effect scheme has several consequences for AI and debugging:

- `BURST_CONDITION` is the largest event-trigger family, so shield risk is a first-class concern.
- `ENTERS_PLAY` and `PAIRING_COMPLETE` are common, so tempo must reward deploy and pair timing.
- `ATTACK_REDIRECT`, `allow_attack_target`, and `grant_keyword` mean combat access is a separate concept from raw AP/HP.
- `heal`, `prevent_battle_damage`, and `END_OF_TURN` effects mean survival math cannot stop at current damage totals.
- `sequence` and `conditional` are everywhere, so the evaluator and test tooling must understand nested effect flow.
- `designate_pilot` means command cards can create alternate play lines, not only one-shot spell lines.
- `activate_ability` means some rules intentionally route into another ability rather than expressing the full resolution in one node.
- frontend timing gates should use compiled timing descriptors first, not raw authored timing guesses
- AI enumeration should use compiled timing metadata instead of reparsing ad hoc timing values

## Recommended Reading Order
If you are new to the backend effect system, read these in order:

1. `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/requirement/agentOnboarding/effect_scheme_summary.md`
2. `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/requirement/agentOnboarding/effects_rules_schema_guide.md`
3. `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/requirement/agentOnboarding/card_effects_implemented_guide.md`
4. `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend/requirement/deep-research-report.md`

## Acceptance Criteria For Understanding A New Effect
A developer or AI agent should not say an effect is understood until it can answer all of these:

1. What is the rule `type`?
2. Is the rule driven by `timing.eventTrigger`, `timing.activationWindows`, or `timing.duration`?
3. What is the real `action` family?
4. Does it contain nested `sequence` or `conditional` steps?
5. Does it require `target`, `option`, `token`, `prompt`, `blocker`, or `burst` choice?
6. Does it depend on traits, link state, trash count, AP, or attack target filters?
7. Is it one-shot, end-of-turn, until-end-of-battle, or continuous?
8. Does it create a normal play line, an activated line, a burst line, or a command-as-pilot line?

If any of those answers are missing, the effect is not fully summarized yet.
