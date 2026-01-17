  - Hand selection actions are built in src/phaser/game/GameEngine.ts via getAvailableActions() +
    canPlaySelectedHandCard(). These only check energy/level; there’s no check for
    player.hasEmptyUnitSlot, player.hasEmptyBaseSlot, or player.hasPairableUnit, so “Play Unit/Base/
    Pilot” can appear even when those slot requirements aren’t met.
  - Pilot eligibility from effects.rules is only detected as effectId === "pilot_designation" in src/
    phaser/ui/HandPresenter.ts; there’s no handling for effects.rules[].action === "designate_pilot".
    So “pilot by rule action” won’t be recognized.
  - Command timing windows aren’t enforced for the button. Hand selection in main phase always allows
    “Play Card” for commands if energy is ok (getAvailableActions()), even if the command only has
    ACTION_STEP timing. In ACTION_STEP, the UI uses “Trigger Card Effect” (not “Play Command”) via src/
    phaser/controllers/ActionStepCoordinator.ts.
  - Command target availability is not checked before showing the play button. There’s no
    pre‑validation of effects.rules[].target.filters or “has at least one valid target”; src/phaser/
    controllers/EffectTargetController.ts only reacts after the backend provides availableTargets.
  - Button labels are generic “Play Card” for all card types in src/phaser/game/GameEngine.ts. Your
    requirement expects “Play Unit/Base/Pilot/Command”.
  - A “Cancel” button is always added for hand selection (getAvailableActions()), even when the play
    button is hidden; your spec says “show only the buttons below if all conditions are met.”

  What already aligns

  - Buttons are hidden when enabled === false because ActionButtonBarHandler skips disabled
    descriptors, so once the conditions are actually enforced, the hide/show behavior will match.
  - Main‑phase gating for hand actions is indirectly enforced by
    ActionBarCoordinator.applyMainPhaseDefaults() and SelectionHandler turn checks, but card‑specific
    timing windows are not.

