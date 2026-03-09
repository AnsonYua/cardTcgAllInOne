# Search And Evaluation Spec

## Purpose

This document defines the intelligence core of the production AI: how legal candidates are prioritized, how simulated states are evaluated, and how hidden information is handled fairly for this specific GCG ruleset and card pool.

## Requirements

The search and evaluation system must:

- rank legal actions by projected game value
- respect bounded move-time budgets
- prioritize immediate tactical truths over slow broad search
- model hidden information without cheating
- reflect the actual GD/ST effect mix rather than a generic TCG heuristic
- provide both a scalar score and a structured breakdown
- degrade safely to simpler methods on timeout or internal failure

## Design

## Why This Evaluator Is GCG-Specific

This game is not only about static board strength. The current GD/ST card pool shows several recurring effect families that materially change what a strong evaluator must care about.

Observed card-pool patterns:

- `BURST_CONDITION` is the largest trigger family, so shield attacks must be scored with burst risk, not only shield count
- `ENTERS_PLAY`, `PAIRING_COMPLETE`, and `ATTACK_PHASE` effects are common, so deploy and pair timing often create immediate swing
- `ATTACK_REDIRECT` appears frequently, so combat access and blocker posture are first-class concerns
- `sequence` and `conditional` effects are common, so line value must include multi-step payoff, not only the first visible action
- `modifyAP`, `grant_keyword`, `damageShield`, `allow_attack_target`, `grant_breach`, `prevent_*`, `deploy`, `addToHand`, `select_from_top_deck`, and `redirect_attack` appear often enough to require evaluator-level awareness
- `END_OF_TURN` heal and `Repair` patterns are common enough that next-turn survivability and recovery thresholds matter

As a result, the evaluator must explicitly separate:

- burst pressure
- combat access
- board control
- race pressure
- synergy tempo from pairing and enters-play lines
- resilience from healing and prevention
- hidden-information uncertainty

## Search Pipeline

The v1 CPU uses a hybrid decision pipeline:

1. tactical override checks
2. window-aware legal action enumeration
3. candidate pruning
4. in-memory simulation
5. board evaluation
6. bounded search continuation
7. best-line selection within budget
8. fallback if budget or execution fails

This is `hybrid` because the move chooser combines:

- rule-driven legality
- search over future states
- evaluator scoring
- heuristics for pruning and fallback

## Search Windows

Search policy must be aware of the current gameplay window. A line that is correct in `MAIN_PHASE` is often wrong in `ACTION_STEP`, and burst-choice evaluation is a separate tactical problem.

### `MAIN_PHASE`

Prioritize:

- deploy lines
- pairing lines
- command use
- activated abilities
- attack declarations

Additional scoring rules:

- reward `ENTERS_PLAY` tempo, especially immediate damage, rest, add-to-hand, and free deployment effects
- reward `PAIRING_COMPLETE` tempo when pairing creates immediate swing, attack access, AP gain, or removal
- score whether a deploy or pair line opens better attack windows this turn rather than only raising static board value
- penalize deploy lines that overextend into likely opponent burst or crackback without immediate payoff

### `ACTION_STEP`

Prioritize:

- combat tricks
- AP swing effects
- prevention effects
- redirect-sensitive lines
- return-to-hand lines
- rest lines
- set-active interactions

Additional scoring rules:

- immediate tactical resolution matters more than long-term value
- lines that save lethal combat, preserve a premium attacker, or force favorable damage exchange outrank small resource gain
- attack-step `modifyAP`, `grant_keyword`, `prevent_battle_damage`, `returnToHand`, `destroy`, and `rest` effects should be evaluated with higher swing weights than in `MAIN_PHASE`

### `BURST / SHIELD_RESOLUTION`

Prioritize:

- burst choice that changes immediate tempo or survival
- free deploy from burst
- free add-to-hand from burst
- burst damage or rest that changes the current race or combat state

Additional scoring rules:

- free deploy and free add-to-hand should be scored separately because one is board tempo and one is card retention
- burst lines should be evaluated under strict tactical priority because they are free timing-window value, not normal paid actions

### `END_OF_TURN`

Prioritize:

- `Repair` and heal value
- survival thresholds into opponent turn
- lines that safely carry advantage through cleanup and turn pass

Additional scoring rules:

- score whether the line survives after end-of-turn healing
- reward recovery and protection that removes opponent lethal next turn
- penalize lines that look good only before end-of-turn state changes but collapse after turn pass

## Candidate Expansion Priority

The search frontier should be expanded according to the actual timing pressure of the card pool.

Highest priority:

- immediate lethal
- anti-lethal defense
- burst choice
- action-step trick
- attack that bypasses or punishes blockers
- pairing or deploy line with immediate tactical payoff

Medium priority:

- resource gain that unlocks a strong next-turn line
- continuous setup that changes attack math now or next turn
- hand-improving lines that materially increase next-turn playability

Lower priority:

- purely incremental value with no immediate race, combat, or survival consequence

## Board Evaluator

The board evaluator converts a simulated resulting state into a comparable value. It is explicitly GCG-specific and must reflect burst, redirect, pairing, deploy tempo, and resilience.

### Evaluator Inputs

- current player visible state
- simulated resulting state
- optional belief state over unknown opponent zones
- metadata from the simulated action
- search depth
- acting player and next player
- current window context

### Internal Contracts

```ts
type AiEvaluationBreakdown = {
  terminal: number;
  forcedOutcome: number;
  combatAccess: number;
  burstPressure: number;
  boardControl: number;
  racePressure: number;
  resourceTempo: number;
  synergyTempo: number;
  resilience: number;
  tacticalSwing: number;
  uncertaintyPenalty: number;
};

type AiEvaluationFlags = {
  isWinning: boolean;
  isLosing: boolean;
  hasImmediateLethal: boolean;
  facesImmediateLethal: boolean;
  highVarianceLine: boolean;
  fallbackSafe: boolean;
};

type AiEvaluationResult = {
  totalScore: number;
  breakdown: AiEvaluationBreakdown;
  flags: AiEvaluationFlags;
  reasonSummary: string[];
};

type AiBeliefState = {
  shieldBurstRisk: 'low' | 'medium' | 'high';
  handInteractionRisk: 'low' | 'medium' | 'high';
  removalRisk: 'low' | 'medium' | 'high';
  combatTrickRisk: 'low' | 'medium' | 'high';
  plausibleShieldProfiles: string[];
  plausibleHandProfiles: string[];
  notes: string[];
};

type AiWindowContext = {
  phase: string;
  isActionStep: boolean;
  hasPendingBurstChoice: boolean;
  hasPendingCombatChoice: boolean;
};

type AiThreatProfile = {
  canPresentLethal: boolean;
  facesLikelyLethal: boolean;
  hasBlockerBypassLine: boolean;
  burstPunishRisk: 'low' | 'medium' | 'high';
  crackbackRisk: 'low' | 'medium' | 'high';
};
```

### Evaluator Execution Order

The evaluator must run in this order:

1. terminal check
2. forced-outcome check
3. combat-access analysis
4. burst-risk and shield-race analysis
5. board-control analysis
6. resource and synergy-tempo analysis
7. resilience analysis
8. tactical swing from the chosen line
9. hidden-information uncertainty penalty
10. return scalar, breakdown, flags, and reason summary

This order is required because the card pool often rewards or punishes:

- whether attacks can connect at all
- whether a shield attack runs into plausible burst punishment
- whether deploy or pair timing creates immediate follow-up value
- whether prevention or healing changes next-turn lethal math

### Score Hierarchy

Priority order:

1. terminal win or loss
2. immediate lethal or immediate loss prevention
3. combat access and forced tactical windows
4. burst and race pressure
5. major tactical swing from the current line
6. board and synergy tempo
7. medium-term resource value

This means:

- terminal win is worth far more than positional advantage
- preventing immediate loss is worth more than incremental tempo gain
- getting access to connect the right attack can be worth more than raw AP total
- a shield line that is likely punished by burst should be discounted even if it looks good in perfect information

### Recommended Score Bands

- `terminal`: `+100000 / -100000`
- `forcedOutcome`: `-25000 .. +25000`
- `combatAccess`: `-5000 .. +5000`
- `burstPressure`: `-4500 .. +4500`
- `boardControl`: `-4000 .. +4000`
- `racePressure`: `-4000 .. +4000`
- `resourceTempo`: `-2000 .. +2000`
- `synergyTempo`: `-2500 .. +2500`
- `resilience`: `-2500 .. +2500`
- `tacticalSwing`: `-3500 .. +3500`
- `uncertaintyPenalty`: `0 .. -2000`

These are initial hierarchy anchors, not final tuned constants.

### Evaluator Formula

```text
Total =
  terminal +
  forcedOutcome +
  combatAccess +
  burstPressure +
  boardControl +
  racePressure +
  resourceTempo +
  synergyTempo +
  resilience +
  tacticalSwing -
  uncertaintyPenalty
```

## Feature Definitions

### `terminal`

Represents engine-detected game completion.

Must include:

- immediate win
- immediate loss
- forced terminal state created by the chosen line

This term dominates all non-terminal terms.

### `forcedOutcome`

Represents immediate tactical truth.

Must include:

- immediate lethal available now
- opponent immediate lethal if unanswered
- forced defense lines
- forced response windows created by the line
- action windows where failing to answer loses overwhelming value

### `combatAccess`

Represents the ability to actually convert board presence into meaningful combat.

Must include:

- blocker posture
- redirect risk
- attack-target permissions
- blocker bypass
- `High-Maneuver`
- `First Strike`
- `Suppression`
- `grant_breach`
- attack lines that can legally reach the best target

This term is required because combat quality in this card pool is often determined by access modifiers, not only raw AP.

### `burstPressure`

Represents shield-facing risk and value.

Must include:

- value gained from pressuring hidden shields or base
- likelihood that shield attack lines run into plausible burst punishment
- whether the line forces the opponent into weaker burst timing
- whether the AI exposes itself to high-value burst retaliation next cycle

### `boardControl`

Represents general battlefield advantage.

Must include:

- ready attackers
- blockers
- surviving AP and HP
- protected premium threats
- enemy threats neutralized or constrained
- damage-state quality after the line

### `racePressure`

Represents progress toward winning the shield/base race relative to the opponent.

Must include:

- current and projected pressure on opponent shield/base
- risk to own shield/base
- whether the line improves or worsens the race decisively
- `damageShield` and breach-like effects when they materially accelerate the race

### `resourceTempo`

Represents short-to-medium term resource strength.

Must include:

- available energy now
- total energy
- next-turn playability
- command or deploy efficiency
- hand improvements that materially change legal follow-up options
- top-deck selection value only when it affects likely next-turn strength

### `synergyTempo`

Represents immediate synergy value from this game’s major engine patterns.

Must include:

- `ENTERS_PLAY` tempo
- `PAIRING_COMPLETE` payoff
- link and paired status creation
- continuous aura setup that changes board math
- trait or faction synergies that produce immediate or near-immediate tactical value

This term exists because the card pool contains many deploy and pair lines that create real tempo immediately even when static board value changes only slightly.

### `resilience`

Represents how safely the position survives the next interaction cycle.

Must include:

- `heal`
- `Repair`
- `prevent_battle_damage`
- `prevent_damage`
- `prevent_shield_damage`
- `setActive`
- recovery from current damage state
- protection against likely crackback

This term should model whether a line changes lethal thresholds on the opponent's next turn.

### `tacticalSwing`

Represents the immediate value created by the chosen action line.

Must include:

- removal
- rest
- return to hand
- AP swing
- free deploy
- free card acquisition
- sequence or conditional second-step payoff
- line-specific value that is not fully captured by the board snapshot alone

This term is especially important for `sequence` and `conditional` effects, because the real value is often in the downstream step rather than the first step.

### `uncertaintyPenalty`

Represents confidence loss from hidden information or unstable outcomes.

Must include:

- shield burst uncertainty
- hidden hand interaction uncertainty
- removal uncertainty
- high variance across sampled determinizations
- narrow lines that are strong only in a small subset of plausible hidden worlds

## Dedicated Evaluator Awareness For Common Effect Families

The evaluator does not need custom per-card logic for every card. However, it must include explicit awareness of these recurring effect families because they appear frequently enough in the GD/ST pool to change core decision quality:

- `addToHand` from burst
- `deploy` from burst or enters-play chains
- `modifyAP`
- `grant_keyword`
- `damageShield`
- `redirect_attack`
- `allow_attack_target`
- `grant_breach`
- `rest`
- `prevent_battle_damage`
- `prevent_damage`
- `prevent_shield_damage`
- `select_from_top_deck`
- `scry_top_deck`
- `heal`
- `setActive`
- `returnToHand`
- `sequence`
- `conditional`

Requirement:

- not every action type needs a card-specific rule
- these families do need evaluator-level awareness because they recur often and strongly change tactical value

## Hidden-Information Model

Production AI must remain fair.

### Layer 1: Public Certainty

The AI may use:

- board state
- trash and other public zones
- revealed cards
- public counts such as hand size, deck count, shield count, and energy count
- known triggered effects and observed sequence history

### Layer 2: Coarse Threat Tags

The AI should derive:

- `shieldBurstRisk`
- `handInteractionRisk`
- `combatTrickRisk`
- `removalRisk`

These threat tags can be coarse in v1 and still improve real decision quality.

### Layer 3: Determinization

Later search phases may:

- sample plausible unseen cards from remaining candidate pools
- aggregate evaluator scores across several hidden-information worlds
- apply stronger uncertainty penalties when variance is high

### Fairness Rule

Production AI must not use:

- the exact cards in the opponent's hand
- the exact order of cards in either player's main deck, unless that order was legally revealed and has not been invalidated by shuffling or other randomization
- the exact identities of facedown shield cards on either side, unless those identities were legally revealed and are still known

## Search Tuning Policy

- evaluator weights must be config-driven
- weights may vary by difficulty tier
- `easy` may use shallower lookahead and stronger uncertainty discount
- `normal` should use bounded search under `2-3s`
- `hard` may use deeper bounded search and more determinization up to `5s`
- all tiers remain fair

## Test Plan

The evaluator and search design must be validated against scenarios that specifically reflect this card pool.

Required scenario groups:

- shield attacks into high burst-risk versus low burst-risk states
- blocker, redirect, and attack-target-permission decisions
- pairing lines that create immediate swing
- enters-play damage, rest, deploy, or tempo lines
- repair, heal, and prevention states that alter next-turn lethal math
- sequence and conditional effects where the second step materially changes line value
- `High-Maneuver`, `First Strike`, `Suppression`, and breach-style combat access
- determinization variance cases where uncertainty penalty should reduce greedy but fragile lines
- action-step tactical responses that beat generic board-value scoring

## Acceptance Criteria

- The search design is explicitly grounded in observed GD/ST effect patterns.
- The evaluator breakdown is GCG-specific and not generic.
- Combat access, burst pressure, synergy tempo, resilience, and uncertainty are all first-class terms.
- Hidden-information handling is fair and layered.
- Test requirements reflect the actual timing and effect families of the card pool.

## Risks

- If burst pressure is undervalued, the AI will over-attack shields into losing tempo.
- If combat access is collapsed into generic board control, the AI will misread redirect and blocker states.
- If synergy tempo is ignored, the AI will undervalue enters-play and pairing lines.
- If resilience is ignored, the AI will misjudge healing and prevention interactions.
- If uncertainty penalty is too weak, the AI will choose fragile lines that only work in oracle-like worlds.

- observed cards already revealed
- known counts and deck size
- known faction, color, or set composition clues
- whether burst or removal is plausible from the remaining unseen pool
- opponent prior actions that constrain likely hidden cards

Initial v1 policy:

- coarse hidden-info heuristics are acceptable
- for example, assign burst-risk or removal-risk tags without full probability inference

Later policy:

- add determinization sampling from the remaining plausible card pool
- aggregate evaluator results across sampled worlds

### Tuning Policy

- evaluator weights must be config-driven
- weights may differ by difficulty tier
- evaluator logic must not be hardcoded per individual card unless unavoidable for legality-adjacent features
- set-specific logic should stay in the engine, not leak into the generic evaluator when possible

## Acceptance Criteria

- The search pipeline is explicit and ordered.
- The evaluator defines input, output, formula, score hierarchy, and feature meanings.
- Hidden information is handled by belief and uncertainty, not cheating.
- Difficulty tiers can vary by search and evaluator settings without changing fairness.

## Risks

- If score bands are not hierarchical enough, the AI may prefer minor value over lethal or survival.
- If the evaluator overcounts raw board stats, it may misread tactical timing windows.
- If uncertainty penalty is absent, the AI may overcommit to fragile lines against hidden burst or removal.
