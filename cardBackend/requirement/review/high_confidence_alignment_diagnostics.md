# High-Confidence Alignment Diagnostics

Scope: gd01/gd02/gd03/st01-st08 card data (`effects.description` vs `effects.rules`) with high-confidence-only policy.

## Fixed in this pass

- `GD01-038` (`gd01Card.json`): deploy rule now matches text (`>=5` enemy units gate + all-enemy damage target).
- `GD02-118` (`gd02Card.json`): action target rule now enforces battle-context requirement (`isBattling` + battling opponent has `Blocker`).

## Unresolved / Ambiguous (diagnostic only)

These were intentionally not auto-fixed because they require product/rules confirmation:

- `once per turn` text appearing in lines where runtime gating may be implemented via cost flow or effect-usage trackers instead of explicit `restrictions` field.
- `during pair` wording that can map to either `paired` or `linked` depending on card-family conventions.
- `during your turn` wording in continuous effects where timing is represented by conditional blocks rather than top-level `timing.actionTurn`.
- Text/rule alignment cases where sequence-encoded `steps` already represent "all target" semantics but shallow line mapping appears single-target.

Representative cards requiring manual adjudication:

- `GD01-046`
- `GD02-069`
- `GD03-015`
- `ST01-015`
- `ST04-015`
- `ST08-006`

## Notes

- No broad medium-confidence normalization was applied.
- This report is diagnostic-only and does not alter source-of-truth runtime logic by itself.
