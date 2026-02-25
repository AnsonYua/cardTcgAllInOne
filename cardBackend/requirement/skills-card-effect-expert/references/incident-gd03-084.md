# Incident Reference: GD03-084 "other Unit" target leakage

## Incident Summary
- Card: `GD03-084` (`Paptimus Scirocco`)
- Symptom: Linked effect drew 1 card when it should not.
- Scenario shape:
  - linked unit had trait `(Jupitris)`
  - another friendly unit existed without `(Jupitris)`
  - expected: draw depends on chosen "other Unit", not linked unit by default

## Root Cause (P1)
- Rule text: "Choose 1 of your other Units..."
- Rule encoding originally allowed self-scoped auto-resolution on the first sequence step:
  - `grant_keyword` step had `target.scope: "self"` without explicit player choice/exclusion.
- Engine normalization for pilot self-targeting mapped to `source_paired_unit`.
- Conditional step `previousTargetHasTrait: "Jupitris"` then evaluated the paired unit and incorrectly passed.

## Why this bug is subtle
- JSON schema was valid.
- Effect looked semantically plausible at a glance.
- Failure appears only when:
  - trigger is `PAIRING_COMPLETE` from pilot source
  - first step writes `previousTargets`
  - later `conditional` depends on `previousTargets`.

## Fix Applied
1. Card data guardrails on first step:
   - add `selection: { type: "player_choice" }`
   - add `parameters.excludePairedUnit: true`
2. Engine hardening:
   - `excludePairedUnit` now resolves paired unit by slot metadata when present
   - fallback added for sequence-step contexts where `pairedSlot` metadata is absent:
     derive paired slot from `sourceCarduid` location when source is pilot.
3. Regression coverage:
   - case where linked unit is `(Jupitris)` but chosen other unit is not -> must not draw.

## Detection Heuristic (Reusable)
Treat as high risk when all are true:
1. description/`parameters.text` contains "choose ... your other Unit(s)"
2. trigger is pair/link path (`PAIRING_COMPLETE`, `sourceConditions: linked/paired`)
3. sequence writes target in step A (grant/modify/etc.) and later step uses `previousTarget*` condition
4. step A target uses `scope: "self"` without explicit exclusion/choice

## Rule Authoring Checklist Delta
- For pilot-triggered pair/link effects targeting "other friendly unit":
  - never rely on implicit self normalization
  - require explicit choice and explicit exclusion semantics
- If downstream condition depends on selected target (`previousTarget...`), enforce target correctness at step 1.

## Risk Classification
- `P1` functional mismatch:
  - player gets extra card draw from an ineligible target path.
