# Not Yet Implemented Effects (Auto-captured)

This file lists effect actions and related schema primitives present in card data that are not referenced in backend services.
These items need implementation or explicit mapping so that all card effects can be executed.

## ST Actions with no handler

- `modifyCost` (e.g., `ST08-001` in `st08Card.json`)
- `modifyLevel` (e.g., `ST08-001` in `st08Card.json`)
- `prevent_battle_damage` (e.g., `ST06-013` in `st06Card.json`)
- `prevent_damage` (e.g., `ST07-015` in `st07Card.json`)
- `prevent_set_active_next_turn` (e.g., `ST08-009` in `st08Card.json`)
- `redirect_attack` (e.g., `ST07-004` in `st07Card.json`)
- `returnToHand` (e.g., `ST04-001` in `st04Card.json`)
- `tutor_top_deck` (e.g., `ST06-009` in `st06Card.json`)

## GD Actions with no handler

- `applyStatusEffect` (e.g., `GD03-120` in `gd03Card.json`)
- `deploy_from_top_deck` (e.g., `GD01-045` in `gd01Card.json`)
- `exileFromTrash` (e.g., `GD02-111` in `gd02Card.json`)
- `modifyCost` (e.g., `GD01-016` in `gd01Card.json`)
- `pair_from_trash` (e.g., `GD01-023` in `gd01Card.json`)
- `prevent_battle_damage` (e.g., `GD02-006` in `gd02Card.json`)
- `prevent_damage` (e.g., `GD02-064` in `gd02Card.json`)
- `prevent_set_active_next_turn` (e.g., `GD02-004` in `gd02Card.json`)
- `redirect_attack` (e.g., `GD01-065` in `gd01Card.json`)
- `registerDelayedTrigger` (e.g., `GD03-120` in `gd03Card.json`)
- `replace_cost` (e.g., `GD03-079` in `gd03Card.json`)
- `require_attack_target_if_available` (e.g., `GD03-019` in `gd03Card.json`)
- `restrict_pairing` (e.g., `T-021` in `gd03Card.json`)
- `restrict_set_active` (e.g., `T-021` in `gd03Card.json`)
- `returnToHand` (e.g., `GD01-005` in `gd01Card.json`)
- `tutor_top_deck` (e.g., `GD01-048` in `gd01Card.json`)

## Condition types with no reference in services

- `attackTargetCardType` (e.g., `GD01-050` in `gd01Card.json`)
- `battleDestroyEvent` (e.g., `GD02-002` in `gd02Card.json`)
- `battleOpponentLevel` (e.g., `GD01-063` in `gd01Card.json`)
- `cardsInPlay` (e.g., `ST07-004` in `st07Card.json`)
- `hasAnotherLinkedUnit` (e.g., `ST04-009` in `st04Card.json`)
- `hasAnotherLinkedUnitWithTrait` (e.g., `GD02-033` in `gd02Card.json`)
- `hasAnotherUnitWithTrait` (e.g., `GD01-007` in `gd01Card.json`)
- `noPairedPilot` (e.g., `GD01-023` in `gd01Card.json`)
- `opponentHandSize` (e.g., `GD01-097` in `gd01Card.json`)
- `pairedPilotColor` (e.g., `GD02-034` in `gd02Card.json`)
- `pairedPilotLevel` (e.g., `ST04-001` in `st04Card.json`)
- `pairedPilotTrait` (e.g., `GD01-025` in `gd01Card.json`)
- `pairedPilotTraitAny` (e.g., `GD01-044` in `gd01Card.json`)
- `pairedUnitColor` (e.g., `ST08-011` in `st08Card.json`)
- `pairedUnitTrait` (e.g., `ST07-010` in `st07Card.json`)
- `playerLevel` (e.g., `GD02-031` in `gd02Card.json`)
- `shieldAreaCardDamagedByBattleDamage` (e.g., `GD02-001` in `gd02Card.json`)
- `sourceAP` (e.g., `GD03-042` in `gd03Card.json`)
- `sourceAp` (e.g., `GD01-050` in `gd01Card.json`)
- `sourceDamaged` (e.g., `ST05-001` in `st05Card.json`)
- `sourceHP` (e.g., `GD03-061` in `gd03Card.json`)
- `sourceLevel` (e.g., `GD02-095` in `gd02Card.json`)
- `sourceStatus` (e.g., `GD03-070` in `gd03Card.json`)
- `unitsInPlayWithFilter` (e.g., `ST06-014` in `st06Card.json`)
- `unitsInPlayWithStatus` (e.g., `GD01-047` in `gd01Card.json`)

## Source condition types with no reference in services

- None

## Target scopes not explicitly handled in TargetResolver

- `all` (e.g., `GD03-041` in `gd03Card.json`)
- `any_all_unit` (e.g., `GD01-108` in `gd01Card.json`)
- `battle_opponent` (e.g., `GD02-073` in `gd02Card.json`)
- `previous_target` (e.g., `GD01-069` in `gd01Card.json`)
- `source_paired_pilot` (e.g., `GD01-005` in `gd01Card.json`)
- `source_paired_unit` (e.g., `ST07-009` in `st07Card.json`)

## Cost keys with no reference in services

- `destroyFriendlyUnit` (e.g., `GD02-057` in `gd02Card.json`)
- `discardFromHand` (e.g., `GD01-023` in `gd01Card.json`)
- `exileFromTrash` (e.g., `GD03-054` in `gd03Card.json`)
- `moveFromHandToDeckBottom` (e.g., `ST08-006` in `st08Card.json`)
- `moveFromTrashToDeck` (e.g., `GD01-003` in `gd01Card.json`)
- `restSelf` (e.g., `ST06-014` in `st06Card.json`)

## Timing windows used in data

- `ACTION_STEP` (e.g., `ST06-011` in `st06Card.json`)
- `MAIN_PHASE` (e.g., `ST06-003` in `st06Card.json`)

## Timing durations used in data

- `CONTINUOUS` (e.g., `GD02-023` in `gd02Card.json`)
- `UNTIL_END_OF_BATTLE` (e.g., `GD01-058` in `gd01Card.json`)
- `UNTIL_END_OF_TURN` (e.g., `ST06-001` in `st06Card.json`)
- `continuous` (e.g., `ST07-005` in `st07Card.json`)
- `instant` (e.g., `ST01-001` in `st01Card.json`)

## Keywords used in data

- `Blocker` (e.g., `GD01-019` in `gd01Card.json`)
- `Breach` (e.g., `GD03-088` in `gd03Card.json`)
- `Breach 1` (e.g., `GD02-089` in `gd02Card.json`)
- `Breach 4` (e.g., `GD03-015` in `gd03Card.json`)
- `First Strike` (e.g., `ST06-001` in `st06Card.json`)
- `High-Maneuver` (e.g., `GD01-009` in `gd01Card.json`)
- `Repair` (e.g., `GD01-001` in `gd01Card.json`)
- `Repair 2` (e.g., `GD03-008` in `gd03Card.json`)
- `Suppression` (e.g., `ST05-001` in `st05Card.json`)

## Triggers used in data

- `AP_REDUCED_BY_ENEMY_EFFECT` (e.g., `GD02-009` in `gd02Card.json`)
- `ATTACK_PHASE` (e.g., `ST06-005` in `st06Card.json`)
- `ATTACK_REDIRECT` (e.g., `ST07-004` in `st07Card.json`)
- `BATTLE_DESTROY` (e.g., `ST06-005` in `st06Card.json`)
- `BURST_CONDITION` (e.g., `ST06-009` in `st06Card.json`)
- `CUSTOM` (e.g., `GD03-060` in `gd03Card.json`)
- `DEFENSE_AREA_BATTLE_DAMAGE` (e.g., `GD03-049` in `gd03Card.json`)
- `DESTROYED` (e.g., `ST07-010` in `st07Card.json`)
- `EFFECT_DAMAGE_RECEIVED` (e.g., `GD02-010` in `gd02Card.json`)
- `END_OF_TURN` (e.g., `ST07-001` in `st07Card.json`)
- `ENTERS_PLAY` (e.g., `ST06-002` in `st06Card.json`)
- `EX_RESOURCE_PLACED` (e.g., `GD02-022` in `gd02Card.json`)
- `PAIRING_COMPLETE` (e.g., `ST06-001` in `st06Card.json`)
- `SHIELD_AREA_CARD_DAMAGED` (e.g., `GD02-001` in `gd02Card.json`)
- `continuous` (e.g., `ST07-005` in `st07Card.json`)

## Notes

- This list reflects normalized action names after recent schema alignment.
- “No reference in services” is based on text search in `cardBackend/src/services`; it highlights likely missing handlers or evaluators.
- Some items may be handled indirectly; verify before implementing.
