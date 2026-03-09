# Computer Opponent Implementation Plan

## Purpose

Define a practical plan for building the first computer opponent that can play full matches against a human player in this backend.

This document is intentionally narrower than the broader research notes. It focuses on match-play logic, legality, timing windows, and the current card pool.

## Inputs Used For This Plan

- `requirement/deep-research-report.md`
- current card data in `src/data/gd01Card.json`, `gd02Card.json`, `gd03Card.json`, `st01Card.json`, `st02Card.json`, `st03Card.json`, `st04Card.json`, `st05Card.json`, `st06Card.json`, `st07Card.json`, `st08Card.json`

## What The Rules Say The Bot Must Handle

From the rules research, the first playable computer opponent must handle these windows correctly:

- `MAIN_PHASE`
- attack declaration
- blocker choice
- battle `ACTION_STEP`
- damage and burst resolution
- end-step `ACTION_STEP`
- mandatory triggered or prompted choices

The most important rule pressures on the bot are:

- legal actions change sharply by timing window
- battle windows are interactive and can loop until both players pass
- burst timing can reverse tempo immediately
- new triggered effects can jump ahead of older queued effects
- hidden information must stay hidden in production mode

## What The Current Card Pool Actually Emphasizes

Across the current 538 cards, the most common structured action families are:

- `sequence`: 156
- `addToHand`: 119
- `modifyAP`: 93
- `damage`: 85
- `conditional`: 70
- `deploy`: 46
- `rest`: 41
- `designate_pilot`: 40
- `redirect_attack`: 36
- `grant_keyword`: 34
- `draw`: 31
- `heal`: 30
- `returnToHand`: 21
- `conditionalTokenDeploy`: 19
- `allow_attack_target`: 17
- `destroy`: 16
- `setActive`: 14
- `prevent_battle_damage`: 14
- `damageShield`: 13

Important keyword families include:

- `High-Maneuver`
- `First Strike`
- `Suppression`
- `Repair`
- `Blocker`

This means the first bot should be designed around:

- combat access and blocker denial
- AP modification and battle tricks
- deploy and pairing tempo
- direct damage and shield pressure
- burst risk
- event ordering for `sequence` and `conditional` effects

## Product Goal

The first version does not need to be a perfect strategist. It needs to:

- play legally
- finish games reliably
- handle all bot-owned prompts
- make sensible combat and main-phase choices
- be clearly stronger than a random or naive script

## Build Strategy

Build the computer opponent in three layers.

### Layer 1: Always-Legal Match Driver

This layer is responsible for:

- reading the current hidden-information-safe player view
- identifying the current timing window
- enumerating only legal actions
- resolving all bot-owned prompts
- ending the current window or turn when appropriate

This layer alone should already allow full autoplay without getting stuck.

### Layer 2: Tactical Rules

This layer handles short-horizon decisions that should not require deep search.

Add hard-priority rules for:

- immediate lethal
- preventing immediate loss
- mandatory blocker decisions
- burst choices
- attack target selection
- obvious high-value action-step responses
- obvious deploy or pairing plays that create immediate board swing

This layer should be explicit and inspectable. It is the part that makes the bot feel coherent before deeper simulation exists.

### Layer 3: Limited Lookahead

After Layers 1 and 2 are stable, add bounded simulation for the most important decision points:

- best attack order
- whether to attack shield, base, or unit
- whether to spend a command now or hold it
- whether to deploy another unit before attacking
- whether to expose the board to a likely crackback

Keep this limited at first. The goal is better combat sequencing and tempo use, not a general-purpose research engine.

## Recommended Implementation Order

### Step 1: Bot-Owned Choice Coverage

Finish support for every bot-owned prompt and decision kind:

- play card
- activate ability
- attack shield or base
- attack unit
- confirm battle
- blocker choice
- target choice
- token choice
- option choice
- prompt choice
- burst choice
- end turn

Success condition:
- the bot can finish complete games without waiting for manual input

### Step 2: Window-Aware Action Enumerator

Create one enumerator that branches by timing window.

Minimum windows:

- `MAIN_PHASE`
- `BLOCKER_STEP`
- `ACTION_STEP`
- `BURST_RESOLUTION`
- forced prompt windows

Success condition:
- every returned action is executable through the current backend path

### Step 3: Tactical Scoring Without Deep Search

Score actions using immediate board logic first.

Important signals:

- lethal or anti-lethal value
- unit survival after battle
- shield damage gained
- base damage gained
- AP swing created
- blocker posture improved or bypassed
- immediate burst exposure
- crackback risk after the line
- deploy or pair tempo created this turn

Success condition:
- main-phase and combat decisions stop looking random

### Step 4: Card-Effect Family Coverage

Prioritize testing and scoring support for the most common or most game-warping effect families:

- `damage`
- `damageShield`
- `modifyAP`
- `rest`
- `setActive`
- `redirect_attack`
- `grant_keyword`
- `allow_attack_target`
- `deploy`
- `addToHand`
- `heal`
- `returnToHand`
- `prevent_battle_damage`
- `designate_pilot`
- `sequence`
- `conditional`

Success condition:
- the bot handles the card pool's main tactical patterns, not just vanilla stats

### Step 5: Limited Simulation For Combat And Turn Order

Add cloned-state simulation for a small number of important branches:

- attack order
- attack target
- whether to spend one more main-phase action before combat
- whether to pass in action step

Start with shallow depth and strict budgets.

Success condition:
- the bot chooses better lines in combat-heavy states without blowing up move time

### Step 6: Difficulty Tiers

Create difficulty through behavior limits, not cheating.

- `easy`: legal but mostly tactical, shallow, more conservative
- `normal`: stable tactical rules plus limited simulation
- `hard`: deeper candidate comparison within the same hidden-information rules

Success condition:
- each tier feels different while staying fair

## Decision Logic Priorities By Window

### Main Phase

Prioritize:

- lethal setup
- strong deploy or pair tempo
- command usage that changes combat access
- preserving enough ready pressure for attacks

Avoid:

- low-value overextension
- spending strong action-step cards too early

### Attack Declaration

Prioritize:

- lethal first
- profitable attacks on rested units
- shield attacks only when burst risk is acceptable
- attack orders that preserve the best later attackers

### Blocker And Action Step

Prioritize:

- preventing lethal
- winning high-value combat trades
- using `First Strike`, `High-Maneuver`, `Suppression`, damage prevention, and redirect effects correctly

Avoid:

- wasting combat tricks on low-impact exchanges

### Burst And Prompted Choices

Prioritize:

- immediate board swing
- free deploy value
- saving base or shield state when relevant
- minimizing follow-up risk

## Testing Plan For The First Playable Version

Create focused scenario suites for:

- lethal detection
- anti-lethal defense
- blocker usage
- `High-Maneuver` attack lines
- `First Strike` trade logic
- burst choices
- deploy and pairing tempo
- shield-vs-unit attack choice
- end-turn discipline
- no-stall prompt resolution

## What To Avoid In V1

- building a general RL pipeline first
- pushing Python into live gameplay
- trying to model every hidden-card probability perfectly
- making the scoring system too abstract before tactical rules are stable
- adding deep search before legal windows and prompt handling are fully correct

## Definition Of Success

The first computer opponent is successful if:

- it can play full matches against a human without getting stuck
- it uses the normal backend rules path
- it does not cheat on hidden information
- it makes reasonable main-phase, combat, blocker, and burst decisions
- it is stable enough to benchmark and improve incrementally
