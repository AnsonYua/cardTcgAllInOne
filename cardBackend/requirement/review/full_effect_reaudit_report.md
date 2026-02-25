# Full Card Effect Re-Audit Report (11 Files)

Generated: 2026-02-25T03:42:24.180Z

## Scope
- src/data/gd01Card.json
- src/data/gd02Card.json
- src/data/gd03Card.json
- src/data/st01Card.json
- src/data/st02Card.json
- src/data/st03Card.json
- src/data/st04Card.json
- src/data/st05Card.json
- src/data/st06Card.json
- src/data/st07Card.json
- src/data/st08Card.json

## Summary
- Cards scanned: 538
- Distinct actions: 44
- Description/rule count mismatches: 0
- Unresolved catalog entries: 0

## Action Coverage Matrix Check
- Unmapped actions: 0
- All actions map to executable runtime paths (executor/router/continuous/burst/subsystems).

## High-Confidence Defects
- None found in this re-audit pass.

## Residual Risks
- Natural-language descriptions may still contain nuanced semantics that static checks cannot fully prove without scenario simulations.
- Distributed subsystem actions (blocker/cost replacement/forced target/burst) should continue to be covered by targeted scenario tests when new cards are added.

## Validation Commands Run
- npm run validate:effects:strict
- npm run review:effects
- npm run review:unresolved
- npm test -- src/__tests__/cardDataCanonicalPatchPlanRegression.test.js src/__tests__/cardNameAliasMatching.test.js src/__tests__/effectSchemaCanonicalValidation.test.js src/__tests__/preventDamageVariantUtils.test.js

## Conclusion
- Descriptions, rule schemas, and runtime execution mappings are aligned for the audited 11 files with no high-confidence conflicts detected.