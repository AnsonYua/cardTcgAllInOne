# Effect Troubleshooting Checklist

## 1) Reproduce and Frame
- Confirm repo roots:
  - backend: `/Users/hello/Desktop/card/unity/cardGameRevamp/cardBackend`
  - frontend: `/Users/hello/Desktop/card/unity/cardGameFrontend`
- Confirm exact card/scenario path.
- Confirm expected behavior from `effects.rules` and `effects.description`.
- Capture current incorrect UI/backend behavior.
- Verify whether expected trigger needs `paired` or `linked`:
  - `paired`: same slot unit + pilot exists
  - `linked`: paired and unit `link` matches pilot name/trait

## 2) Data Inventory (Backend Truth)
- Scan all relevant set files in `cardBackend/src/data/*.json`.
- Extract suspect action families:
  - `allow_attack_target`
  - `restrict_attack`
  - related `conditions`/`sourceConditions`
- Capture dynamic filters:
  - `<=SOURCE_AP`, `<=SOURCE_LEVEL`, etc.
- For link-dependent effects, validate scenario slot composition against unit `link` entries.

## 3) Frontend Evaluator Inventory
- Check local evaluator modules (not backend-driven execution):
  - `src/phaser/controllers/attackTargetPolicy.ts`
  - `src/phaser/controllers/actionBar/slotAttackProvider.ts`
  - `src/phaser/game/actionEligibility.ts`
  - `src/phaser/game/activatedEffectAvailability.ts`
  - any module discovered by `rg` for parser/comparison logic.

## 4) Parity Checks
- Operator parity includes `!=` and alias `=`.
- Dynamic token parity includes:
  - uppercase and camel/lower variants.
- Stat source parity:
  - Use field totals when required (e.g., `fieldCardValue.totalAP`).
- Restriction parity:
  - `restrict_attack` must gate UI actions consistently.

## 5) Fix Strategy
- Centralize comparison parsing/evaluation in shared util.
- Remove duplicated ad-hoc parser logic.
- Add debug guardrails for unknown rule parameter keys.

## 6) Validation
- Add focused tests for each mismatch class.
- Run:
  - `npm test`
  - `npm run build`
- Document findings and fix status in `EFFECT_PARITY_AUDIT.md`.
