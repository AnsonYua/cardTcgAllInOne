import { applySlotOverlaySet, applySlotTotalsVisibility, finalizeSlotOverlayState } from './PowerOverlayCoordinator.js';

// Synchronises card/component data with the latest zone payload without recreating sprites.
// Used by slot/base managers so overlays can be refreshed in-place when the backend sends
// new state for an existing card.
export function mergeCardZoneData(card, cardData) {
  if (!card || !cardData) {
    return;
  }

  card.fullCardData = { ...card.fullCardData, ...cardData };

  if (card.cardData && cardData.cardData) {
    card.cardData = { ...card.cardData, ...cardData.cardData };
  }

  if (card.setRested) {
    card.setRested(cardData.isRested || false);
  }
}

// Centralised three-step overlay sync used by slots, bases, previews, and dialogs.
// 1. applySlotOverlaySet: align printed stats and compute combined totals.
// 2. applySlotTotalsVisibility: decide which card (unit/pilot) should surface aggregated labels.
// 3. finalizeSlotOverlayState: push totals + rested status to the overlay component.
export function applyOverlayPipeline({
  unitCard,
  pilotCard,
  unitData,
  pilotData,
  slotFieldValue,
  zone
}) {
  const overlayState = applySlotOverlaySet({
    unitCard: unitCard || null,
    pilotCard: pilotCard || null,
    unitData: unitData || null,
    pilotData: pilotData || null,
    slotFieldValue: slotFieldValue || null
  });

  applySlotTotalsVisibility(unitCard || null, pilotCard || null, {
    unitShowsTotals: overlayState.unitShowsTotals,
    pilotShowsTotals: overlayState.pilotShowsTotals,
    zone: zone || 'slot1'
  });

  finalizeSlotOverlayState(overlayState);
  return overlayState;
}
