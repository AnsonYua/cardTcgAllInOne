import OverlayStatUtils from './OverlayStatUtils.js';

// Synchronises card/component data with the latest zone payload without recreating sprites.
// Used by slot/base managers so overlays can be refreshed in-place when the backend sends
// new state for an existing card.
export function mergeCardZoneData(card, cardData) {
  if (!card || !cardData) {
    return;
  }

  // Store old card data to detect changes that require image update
  const oldCardId = card.cardData?.id;
  const oldCarduid = card.fullCardData?.carduid;

  card.fullCardData = { ...card.fullCardData, ...cardData };

  if (card.cardData && cardData.cardData) {
    card.cardData = { ...card.cardData, ...cardData.cardData };
  }

  if (card.setRested) {
    card.setRested(cardData.isRested || false);
  }

  // Check if card ID or carduid changed, indicating the card image should be updated
  const newCardId = card.cardData?.id;
  const newCarduid = card.fullCardData?.carduid;
  
  if ((oldCardId !== newCardId) || (oldCarduid !== newCarduid)) {
    console.log(`[mergeCardZoneData] Card image needs update: ID ${oldCardId} → ${newCardId}, carduid ${oldCarduid} → ${newCarduid}`);
    if (card.updateCardImage && typeof card.updateCardImage === 'function') {
      card.updateCardImage();
    } else {
      console.warn(`[mergeCardZoneData] Card ${newCardId} does not have updateCardImage method`);
    }
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
  const overlayState = OverlayStatUtils.applySlotOverlaySet({
    unitCard: unitCard || null,
    pilotCard: pilotCard || null,
    unitData: unitData || null,
    pilotData: pilotData || null,
    slotFieldValue: slotFieldValue || null
  });

  OverlayStatUtils.applySlotTotalsVisibility(unitCard || null, pilotCard || null, {
    unitShowsTotals: overlayState.unitShowsTotals,
    pilotShowsTotals: overlayState.pilotShowsTotals,
    zone: zone || 'slot1'
  });

  OverlayStatUtils.finalizeSlotOverlayState(overlayState);
  return overlayState;
}
