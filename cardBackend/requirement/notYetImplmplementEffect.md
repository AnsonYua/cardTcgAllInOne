# Not Yet Implemented Effects (Auto-captured)

This file lists effect actions present in card data (ST03–ST08) that do not have matching handler implementations in backend services. These actions currently appear in `cardBackend/src/data` but are not referenced in `cardBackend/src/services`.

## Actions with no handler

- `moveTopDeckToTrash` (e.g., `ST07-001` in `st07Card.json`)
- `draw_if_moved_cards_match_traits` (e.g., `ST07-001` in `st07Card.json`)
- `tutor_top_deck` (e.g., `ST03-006`, `ST06-009`, `ST06-012`, `ST07-014`)
- `prevent_battle_damage` (e.g., `ST03-014`, `ST06-013`, `ST07-012`)
- `prevent_damage` (e.g., `ST07-015`)
- `prevent_set_active_next_turn` (e.g., `ST08-009`)
- `modifyCost` (e.g., `ST08-001`)
- `modifyLevel` (e.g., `ST08-001`)
- `deploy_from_hand` (e.g., `ST03-010`)
- `choose_one_then_deploy_token` (e.g., `ST04-012`)

## Notes

- These are action names found in card data but not referenced in backend service handlers (e.g., `EffectExecutor`, `EffectStatApplier`, `AttackPreparationManager`, or other effect managers).
- If you plan to support these actions, implement corresponding handlers and add them to the effect dispatch paths.

