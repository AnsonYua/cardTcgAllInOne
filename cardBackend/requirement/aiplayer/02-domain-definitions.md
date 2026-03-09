# Domain Definitions

## Purpose

This document defines the vocabulary used throughout the AI player requirement set. These terms should be used consistently in design docs, code comments, telemetry, and benchmark reports.

## Requirements

The following definitions are normative for this AI program.

## Definitions

### Core AI Terms

- `CPU opponent`
  - A computer-controlled opponent that players can face in the game.
- `strong CPU opponent`
  - A CPU opponent whose AI player plays legally, finishes games reliably, and materially outperforms the current heuristic bot under fair information constraints.
- `legal action`
  - An action that the current game state, rules, timing window, and engine validators would accept if submitted through the normal backend flow.
- `candidate action`
  - A legal action considered by the AI during selection, usually enriched with metadata used for pruning, simulation, and ranking.
- `simulation`
  - Executing a candidate action against an in-memory cloned game state using the same authoritative rule path as real gameplay.
- `simulation fidelity`
  - The degree to which a simulated result matches real execution for the same starting state and action, ignoring only approved non-semantic fields.
- `determinization`
  - Sampling one plausible fully specified hidden-information world from the set of states consistent with the public information.
- `belief state`
  - A structured representation of what hidden cards are still plausible, with optional coarse probabilities or risk tags.
- `evaluation function`
  - A scoring function that converts a simulated state into a scalar score plus a structured breakdown.
- `rollout policy`
  - A cheaper default action-selection policy used when search depth is capped or when continuation requires fast approximations.
- `principal variation`
  - The best action sequence found by the search procedure within its budget.
- `search budget`
  - The maximum time, nodes, determinizations, or depth allowed for one decision.
- `difficulty tier`
  - A configuration profile that changes search depth, pruning aggressiveness, and evaluation sophistication without cheating.
- `production AI`
  - The live backend decision system that powers the fair CPU opponent in normal gameplay.
- `research tooling`
  - Non-production tools used for analysis, self-play, telemetry processing, or experimental model work.

### Game-AI Concepts

- `tactical line`
  - A short sequence of actions whose value comes from immediate consequences in the current timing window, such as lethal, anti-lethal defense, blocker bypass, burst choice, attack-step trick, or a pairing/deploy line that changes the board immediately.
  - Example: a line that pairs `GD01-025 Gundam Deathscythe` to place a rested Resource and gain `First Strike` this turn is a tactical line because it changes combat immediately.
- `tempo`
  - Short-term initiative measured by the ability to develop board, pressure shields or base, improve attack access, and force the opponent to spend their next action window answering your line instead of advancing their own plan.
  - Example: `GD01-008 Guntank` dealing 1 damage to a rested enemy Unit on deploy is tempo because it develops a body while changing the board at once.
- `synergy tempo`
  - Immediate value created by `ENTERS_PLAY`, `PAIRING_COMPLETE`, link, continuous aura setup, or trait/faction synergy lines that become relevant this turn or by the next action window.
  - Example: `GD01-001 Gundam` granting `Repair 1` to your White Base Team Units and drawing on pairing is synergy tempo because the value comes from tribal and pairing structure, not only raw stats.
- `board control`
  - Advantage in battlefield influence, including ready attackers, blockers, paired strength, durable threats, attack target access, and the ability to deny or weaken the opponent's combat options.
  - Example: if your board keeps multiple ready attackers while the opponent's best unit is rested or damaged, you have board control even before direct shield damage happens.
- `combat access`
  - The ability to convert board presence into meaningful attacks despite blockers, redirect effects, target restrictions, or combat keywords. This includes access created by `High-Maneuver`, `First Strike`, `Suppression`, `allow_attack_target`, `grant_breach`, or blocker denial.
  - Example: `GD01-042 Duo's Leo` can attack an active enemy Unit of Lv.2 or lower, and `High-Maneuver` lines from cards in `st03` can bypass blockers entirely. Both improve combat access.
- `shield race`
  - A game state where relative speed toward breaking the opponent's shields or base matters more than slower resource gain, and where the main question is which player reaches a decisive defense-area break first.
  - Example: once both players already have boards, a `Breach` attacker like `GD01-027 Big Zam` can make the shield race more important than drawing one extra card.
- `burst pressure`
  - The value or risk created by interacting with facedown shields. This includes the upside of breaking shields quickly and the downside of triggering plausible `BURST_CONDITION` effects such as free deployment, free add-to-hand, or burst tempo reversal.
  - Example: attacking a shield is higher risk when burst effects like `GD01-123 Nahel Argama` can deploy for free or `GD01-087 Sayla Mass` can jump to hand.
- `base pressure`
  - Threat level against the opponent's base once shields are no longer the main defensive layer, including whether current AP and attack access can convert into immediate or near-immediate game-ending damage.
  - Example: a high-AP attacker with open combat access against an unprotected base creates base pressure even before it is technically lethal.
- `crackback risk`
  - The risk that after your current line resolves, the opponent can punish you on their next turn or next action window with a strong counter-attack, combat trick, or tempo swing.
  - Example: a shield attack that leaves your best unit rested and exposed to an opponent counterattack has high crackback risk.
- `burst exposure`
  - The likelihood that a line is weak against plausible facedown shield burst outcomes, especially when a shield attack gains little immediate value but opens the door to strong burst tempo for the opponent.
  - Example: a low-value shield poke into an opponent who may reveal burst deploy or burst add-to-hand has high burst exposure.
- `overextension`
  - Committing too many resources to the current line such that common opposing responses, burst triggers, action-step tricks, or removal effects create a large negative swing.
  - Example: spending too many cards to force one shield break can be overextension if a burst deploy and an action-step trick immediately reverse the board.
- `lethal line`
  - A line that produces immediate game win or creates a forced win sequence unless the opponent has one of a narrow set of valid answers.
  - Example: when the opponent has no shields or base left, any successful player attack from a legal attacker becomes a lethal line.
- `forced response`
  - A situation where the opponent must answer a specific threat in the next legal window or lose overwhelming value, such as immediate lethal, base collapse, loss of combat access, or a premium board swing.
  - Example: if your next attack will break the last layer of defense unless stopped, the opponent is under a forced response.
- `action-step leverage`
  - The degree to which a player can gain value in combat or end-step interaction windows through `ACTION_STEP` cards, AP swing, prevention, return-to-hand, rest, or set-active effects.
  - Example: combat tricks like AP boosts, prevention, or bounce effects in the attack window give high action-step leverage because they can flip combat after attackers are already committed.
- `blocker posture`
  - The quality of a player's current defensive redirection setup, including whether blockers exist, whether they can legally trigger, whether they are turned off by keywords like `High-Maneuver`, and whether redirect lines still preserve a favorable trade.
  - Example: `GD01-019 Byarlant Custom` gaining `Blocker` when the enemy has four or more Units changes blocker posture because it creates a live redirect defender.
- `resilience`
  - The ability of a position to remain favorable after damage exchange or turn pass, including `heal`, `Repair`, `prevent_battle_damage`, `prevent_damage`, `prevent_shield_damage`, and recovery of key units or base thresholds.
  - Example: `GD01-004 Guncannon` with `Repair 1` or `GD01-091 Chang Wufei` preventing some battle damage both increase resilience.
- `line volatility`
  - How much the value of a line changes across plausible hidden-information worlds, especially due to burst outcomes, unknown combat tricks, or unseen removal.
  - Example: a shield attack that is excellent if no burst appears but bad if burst deploy appears is a high-volatility line.
- `event-order sensitivity`
  - The degree to which a line depends on exact effect ordering, such as burst priority, newly triggered effects interrupting older queue items, or same-window trigger resolution order.
  - Example: a shield-damage line can be event-order sensitive because burst resolution and newly triggered effects may change the board before older queued effects finish.

### Execution Terms

- `tactical override`
  - A hard-priority rule that short-circuits normal scoring, such as immediate lethal, required defense against immediate loss, or mandatory choice resolution.
- `pruning`
  - Removing low-value, redundant, or dominated candidate actions before deeper simulation.
- `fallback mode`
  - A safe policy used when search or enumeration fails, usually a simpler heuristic chooser that still respects legality.
- `deterministic mode`
  - A debugging mode where random seeds, candidate ordering, and sampling are fixed for reproducibility.
- `equivalence test`
  - A test that checks simulated execution and real execution produce the same meaningful outcome.

## Design

### Terminology Policy

- Use `fair` to mean hidden information is respected.
- Use `oracle` only for explicit debug or analysis modes.
- Use `CPU opponent` for player-facing behavior and difficulty descriptions.
- Use `AI player` for technical design, search, evaluator, and simulation discussions.
- Use `search` to mean bounded lookahead over legal actions; do not use it as a synonym for simple heuristics.

## Acceptance Criteria

- All downstream documents can reference these terms without re-defining them inconsistently.
- Hidden-information and simulation terminology is explicit enough for engineering and test work.
- The difference between production AI and research tooling is unambiguous.

## Risks

- If `legal action` and `candidate action` are conflated, later enumeration and pruning code will become inconsistent.
- If `fair_cpu` and `oracle` are not clearly separated, benchmark results will be misleading.
