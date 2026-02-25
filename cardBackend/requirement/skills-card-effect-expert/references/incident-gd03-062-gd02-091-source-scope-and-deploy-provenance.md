# Incident: `GD03-062` / `GD02-091` Source-Condition Scope Defaults and Deploy Provenance

## Summary
- `GD03-062` deploy conditional (`sourceDeployedFrom = trash`) did not fire even when deployed from trash.
- `GD02-091` pairing conditional (`sourceColor = Red`) could fail because the card rule omitted `scope`.

Both were caused by backend engine assumptions, not card text intent.

## Root Causes

### 1) Missing runtime deploy provenance (`GD03-062`)
- `sourceDeployedFrom` reads `sourceCard.deployedFrom`.
- Deploy flow passed `fromZone` through notifications but did not persist it on the deployed unit card instance.
- Result: `sourceDeployedFrom` saw no value and returned false.

## 2) Missing `scope` on `source*` conditions defaulted to `player`
- `EffectConditionEvaluator` defaulted omitted `scope` to `"player"`.
- `sourceDeployedFrom` / `sourceColor` evaluators require source scope semantics.
- Card data in real sets omits `scope` on some `source*` conditions (valid shorthand pattern).
- Result: condition silently failed despite correct effect text/rule intent.

## Fix Pattern
- Persist deploy provenance on runtime units:
  - `UnitZoneCard.deployedFrom`
  - set during deploy (`fromZone` -> normalized lowercase)
- Centralize source-condition scope fallback:
  - if condition `type` starts with `source` and `scope` is omitted, treat as `scope: "source"`

## Regression Coverage
- `GD03-062`: deploy from trash triggers damage; deploy from hand does not.
- `GD02-091`: omitted-scope `sourceColor` condition evaluates correctly.
- `GD03-088`: omitted-scope `sourceTrait` remains compatible after generalized source-scope defaulting.

## Reusable Audit Heuristic
- Scan all card data for `conditions` / nested sequence conditionals where `type` starts with `source` and `scope` is missing.
- Prefer engine-level source-scope defaulting over patching individual card JSON files.
- When a condition depends on source origin (`from trash`, `from hand`, etc.), verify runtime source-card metadata exists (not just notification payloads).
