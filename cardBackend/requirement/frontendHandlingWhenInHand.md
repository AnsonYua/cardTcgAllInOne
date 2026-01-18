when card in hand or in field/zones/slot/baseArea. supposing in hand when can play card (play unit/play pilot/play command) etc and in field/zones/slot/baseArea, if some card have effect we can trigger the effect (eg. ST01-015 【Activate･Main】【Once per Turn】②：Deploy 1 [Gundam]((White Base Team)･AP3･HP3) Unit token if you have no Units in play, deploy 1 [Guncannon]((White Base Team)･AP2･HP2) Unit token if you have only 1 Unit in play, or deploy 1 [Guntank]((White Base Team)･AP1･HP1) Unit token if you have 2 or more Units in play.)

Indeed i need to have some handling in frontend, for example if player have  ST01-015  in baseArea and the player have enough cost to trigger the effect, when player click the card , it will show active effect button so that then player will call api to trigger the effect. 
for hand card, if player not have enough cost, when player click the card it will not show any play card button , but if have enough cost it will have play card button. keep of like this.


Review all card effect,(also with supplement information of test case under requirement/testDoc folder), please suggest the frontend handling requirement for all cards. 


 Global gating (always)

  - If processingQueue[0] is a declared choice (BLOCKER_CHOICE, TARGET_CHOICE, BURST_EFFECT_CHOICE), show that modal and
    block all other actions.
  - If an API call is pending, disable all inputs until it completes.
  - After any POST, wait for the next poll to update state; do not assume local state.

  ———

  ## 1) Hand card buttons (data‑driven)

  When a hand card is clicked, show only buttons whose conditions all pass:

  Play Unit

  - cardData.cardType === 'unit'
  - gameEnv.phase === 'MAIN_PHASE'
  - player.energy.active >= cardData.cost
  - player.hasEmptyUnitSlot === true

  Play Base

  - cardData.cardType === 'base'
  - gameEnv.phase === 'MAIN_PHASE'
  - player.energy.active >= cardData.cost
  - player.hasEmptyBaseSlot === true

  Play Pilot

  - cardData.cardType === 'pilot' OR cardData.effects.rules includes action: designate_pilot
  - gameEnv.phase === 'MAIN_PHASE'
  - player.energy.active >= cardData.cost
  - player.hasPairableUnit === true (must be an open unit slot with no pilot, or your rule for pairing)

  Play Command

  - cardData.cardType === 'command'
  - player.energy.active >= cardData.cost
  - Current phase is allowed by any play rule’s timing.windows (MAIN_PHASE or ACTION_STEP)
  - If the command has target filters, there must be at least one valid target; otherwise hide the button.

  ———

    ## 2) Field/Base activated abilities (data‑driven)

  For a card already in zone (slot/base), only consider effects.rules[] with type === 'activated' if the cardType is unit or base.
  Command cards never show a zone “Activate” button (they resolve on play from hand using type === 'play').

    Show Activate button only if:

    - Current phase is included in rule.timing.windows
  - Costs are payable:
      - rule.cost.resource <= active energy
      - rule.cost.tap/rest available (e.g., base not rested if rest: "self")
      - rule.cost.oncePerTurn not yet used
    - If a target exists, there is at least one valid target

    If multiple valid targets exist, expect TARGET_CHOICE after activation.

  Auto‑trigger note:
  - Effects that are not type === 'activated' (triggered/continuous/keyword/play/special) are automatic and never show an
    Activate button, even if they have no cost. Example: Deploy/When Paired/Burst/End of Turn effects.

    ———

    ## Frontend handling for zone activated ability

    When a player clicks a slot/basearea card(unit /base card in slot or base area) :

    1. Read cardData.cardType:
        - If command: do not show zone activate buttons.
        - If unit or base: continue.
    2. Collect activated rules:
        - rules.filter(r => r.type === 'activated')
  3. For each rule, compute canActivate:
      - phaseOk = rule.timing.windows.includes(gameEnv.phase)
      - energyOk = !rule.cost?.resource || activeEnergy >= rule.cost.resource
      - restOk = !(rule.cost?.rest === 'self') || card.isRested === false
        (if the cost requires resting self, hide/disable Activate when the base is already rested)
        - onceOk = !rule.cost?.oncePerTurn || !card.usedThisTurn?.[rule.effectId]
            (use your existing “once per turn” flag location in gameEnv)
        - targetOk = !rule.target || hasValidTargets(rule.target, gameEnv)
    4. Show button only if all are true.
    5. On click:
        - Call activateCardAbility (only base zone activation is supported right now).
        - If targetOk had multiple targets, expect a TARGET_CHOICE event in the queue.
        - If a unit card ever gets an activated effect, it still must not show a zone Activate button until a backend
            unit-zone activation endpoint is implemented.
    ———

  ## 3) Attacking (unit in slot)

  Show attack options only if:

  - unit.isRested === false
  - unit.canAttack === true (or your equivalent flag)
  - Game is in a phase that permits attack (as defined by backend)

  Attack Unit: always allowed if above checks pass and there is at least one enemy unit.

  Attack Shield: allowed only if above checks pass and the unit does NOT have an active restriction:

  - Any active effect with:
      - action === 'restrict_attack'
      - parameters.restriction === 'cannot_attack_player'

  If restriction is present, hide or disable the “Attack Shield” button.


 - unit.isRested check is missing. The requirement says unit.isRested === false and unit.canAttack === true. Current gating only checks canAttackThisTurn and never
    checks isRested directly (src/phaser/controllers/ActionBarCoordinator.ts, src/phaser/ui/SlotTypes.ts).
  - Enemy unit presence check is too strict. getOpponentRestedUnitSlots() only returns rested enemy units (unit.isRested === true) in src/phaser/controllers/
    OpponentResolver.ts. Requirement says “at least one enemy unit” regardless of rested state.
  ———

  ## 4) Choice handling (BLOCKER/TARGET/BURST)

  - When the queue head is a choice event:
      - show modal with options
      - block all other buttons
      - call the correct API (confirmBlockerChoice, confirmTargetChoice, confirmBurstChoice)
      - keep modal open until next poll shows it resolved

  ———

  # Card‑specific expectations (ST01)

  Use the generic rules above; no hard‑coding required except for one special restriction:

  ST01‑009 (Zowort)

  - Has restrict_attack with cannot_attack_player → hide “Attack Shield” for this unit.

  Everything else is already handled by generic rules:

  - ST01‑001: continuous AP+1 during your turn when paired; Repair 2 at end of your turn; no activate button.
  - ST01‑002: pairing with White Base Team pilot draws 1; no activate button.
  - ST01‑004: deploy rest enemy HP<=2; may require target choice if multiple.
  - ST01‑006: pairing AP‑3 to Lv<=5 enemy; may require target choice; lasts until end of turn.
  - ST01‑008: blocker only via BLOCKER_CHOICE.
  - ST01‑010: pairing rest enemy HP<=5; target choice if multiple; Burst adds to hand.
  - ST01‑011: on attack once per turn set a resource active; Burst adds to hand.
  - ST01‑012: command in MAIN only if there’s a rested enemy; pilot designation available.
  - ST01‑013: command in MAIN only if friendly unit exists; pilot designation available.
  - ST01‑014: command in MAIN or ACTION_STEP; Burst activates main; target choice if multiple.
  - ST01‑015: base activate in MAIN if energy>=2, once per turn, empty slot exists.
  - ST01‑016: base activate in MAIN if not rested; affects linked units.

  ———
