# Domain Definitions

## Purpose

This document explains the main words used in the computer-opponent requirement set.
Use these meanings consistently in design docs, code comments, telemetry, and tests.

## Requirements

The definitions below are the standard meanings for this project.

## Definitions

### Core Computer Opponent Terms

- `computer opponent`
  - The in-game bot that plays against a human player.
  - Example: the side controlled by the game during a normal match.

- `decision logic`
  - The backend code that decides what the computer opponent should do next.
  - Example: choosing whether `GD01-027 Big Zam` should attack now or wait.

- `legal action`
  - A move the rules allow right now in the current game state and timing window.
  - Example: using `ST01-014 Unforeseen Incident` is legal only in its `[Main]` or `[Action]` timing.

- `candidate action`
  - One legal move that the bot is thinking about before it picks the best one.
  - Example: “attack with `GD01-042 Duo's Leo`” and “end turn” can both be candidate actions.

- `simulation`
  - A test run in memory to see what may happen after a move.
  - Example: the bot can simulate pairing `GD01-001 Gundam` before deciding whether the extra draw is worth it.

- `simulation fidelity`
  - How closely the test run matches the real game engine.
  - Example: if simulated combat with `GD01-025 Gundam Deathscythe` gives the same result as real combat, fidelity is high.

- `hidden-information-safe view`
  - The game view the bot is allowed to use in a fair match, without secret information.
  - Example: the bot must not know a facedown shield is `GD01-123 Nahel Argama` unless it was legally revealed.

- `state score`
  - A simple rating of how good the board looks after a move.
  - Example: a board with healthy Units like `GD01-004 Guncannon`, ready attackers, and better shield pressure gets a better score.

- `decision budget`
  - How much time or work the bot is allowed to spend on one choice.
  - Example: the bot may only have a few seconds to decide whether to attack or play another card first.

- `difficulty tier`
  - A bot level that changes how carefully the bot thinks without letting it cheat.
  - Example: `easy` may check fewer options, while `hard` may compare more legal lines.

- `production bot`
  - The real bot used in live matches, not a debug or test version.
  - Example: the bot a player faces when starting a normal game against the computer opponent.

### Game Logic Concepts

- `tactical line`
  - A short move sequence that gives value right away.
  - Example: pair `GD01-025 Gundam Deathscythe`, gain `First Strike`, then attack in the same turn.

- `tempo`
  - Getting ahead so the opponent must react to you instead of following their own plan.
  - Example: `GD01-008 Guntank` deals damage when deployed, so it changes the board immediately and gives tempo.

- `synergy tempo`
  - Fast value that comes from cards working well together, not just from raw stats.
  - Example: `GD01-001 Gundam` helps `White Base Team` Units with `Repair` and can draw when paired.

- `board control`
  - Having the stronger position on the battlefield.
  - Example: if your Units are still active and the opponent's best Unit is rested, you have good board control.

- `combat access`
  - How easily your Units can hit the targets you want.
  - Example: `GD01-042 Duo's Leo` can attack an active enemy Unit of Lv.2 or lower, so it has better combat access than a normal Unit.

- `shield race`
  - A situation where both players mainly care about breaking shields faster.
  - Example: `GD01-027 Big Zam` with `Breach` can make shield damage more important than slow value plays.

- `burst pressure`
  - The reward and danger that come from attacking facedown shields.
  - Example: attacking shields is risky because a card like `GD01-123 Nahel Argama` may deploy for free.

- `base pressure`
  - How close you are to threatening the enemy base directly.
  - Example: if blockers are gone and your strong attackers are still ready, your base pressure is high.

- `crackback risk`
  - The chance that the opponent can punish your move on their next turn.
  - Example: if you attack with everything and leave no defense, the opponent may hit back hard.

- `burst exposure`
  - How badly your plan loses if the opponent's shield burst is strong.
  - Example: a weak shield attack looks worse if the top shield might be `GD01-123 Nahel Argama` or `ST01-010 Amuro Ray`.

- `overextension`
  - Using too many cards or Units for one push and leaving yourself open.
  - Example: spending your whole hand to force one attack can backfire if the opponent survives and turns the game around.

- `lethal line`
  - A move sequence that wins the game right now, or almost certainly wins it.
  - Example: if the opponent has no shields left and you still have a legal attack on player, that can be a lethal line.

- `forced response`
  - A threat so strong that the opponent must answer it soon.
  - Example: if your next attack will finish the game unless stopped, the opponent is under a forced response.

- `action-step leverage`
  - How much value you can gain during battle tricks and response windows.
  - Example: `ST01-014 Unforeseen Incident` can reduce an enemy Unit's AP during `[Action]` and swing combat.

- `blocker posture`
  - How strong your defense is when blockers and attack redirection matter.
  - Example: `GD01-019 Byarlant Custom` gaining `Blocker` makes your defense much better.

- `resilience`
  - How well your board survives damage and recovers later.
  - Example: `GD01-004 Guncannon` with `Repair 1` and `GD01-091 Chang Wufei` preventing some battle damage both add resilience.

- `line volatility`
  - How much a plan changes between best case and worst case.
  - Example: a shield attack is high-volatility if it is great when no burst appears but bad when burst appears.

- `event-order sensitivity`
  - When the order of effects matters a lot for the final result.
  - Example: burst effects and newly triggered effects can change what happens next during a complicated battle.

### Execution Terms

- `tactical override`
  - A simple top-priority rule that beats normal scoring.
  - Example: if the bot sees a lethal attack, it should take it even if another move also looks good.

- `pruning`
  - Cutting away weak options so the bot does not waste time checking everything.
  - Example: if `ST01-015 White Base` clearly gives the best board development, the bot may ignore obviously bad low-value actions.

- `fallback mode`
  - A safe backup way to choose moves if deeper logic fails.
  - Example: if simulation times out, the bot can still pick a simple legal attack or end turn safely.

- `deterministic mode`
  - A debug mode where the same state gives the same choice every time.
  - Example: this helps engineers check why the bot attacked with `GD02-001 Psycho Gundam` in one test case.

- `equivalence test`
  - A test that checks whether simulation and real execution give the same important result.
  - Example: simulating `GD01-008 Guntank` deploy damage should match what the real engine does.

## Design

### Terminology Policy

- Use `fair` to mean the bot respects hidden information.
- Use `oracle` only for explicit debug or analysis modes that can see secret information.
- Use `computer opponent` or `CPU opponent` for the player-facing bot.
- Use `decision logic` for the backend code that chooses legal actions.
- Use `search` only when the bot is truly looking ahead through future legal actions.

## Acceptance Criteria

- Other requirement docs can use these terms without redefining them.
- The wording is simple enough for engineers and designers to read quickly.
- Player-facing words and implementation words stay clearly separated.

## Risks

- If `legal action` and `candidate action` are mixed up, action selection code may become inconsistent.
- If `fair` and `oracle` are mixed up, tests and benchmarks may accidentally let the bot cheat.
