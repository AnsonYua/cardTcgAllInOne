const SLOT_NAMES = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6'];

function collectMissingSlotCardFields(card) {
  const missing = [];
  if (!card || typeof card !== 'object') {
    return ['card_object'];
  }

  if (!card.carduid) missing.push('carduid');
  if (!card.cardData || typeof card.cardData !== 'object') {
    missing.push('cardData');
  } else {
    if (typeof card.cardData.cardType !== 'string') missing.push('cardData.cardType');
    if (typeof card.cardData.ap !== 'number') missing.push('cardData.ap');
    if (typeof card.cardData.hp !== 'number') missing.push('cardData.hp');
  }
  if (typeof card.originalAP !== 'number') missing.push('originalAP');
  if (typeof card.originalHP !== 'number') missing.push('originalHP');

  return missing;
}

function validatePlayerSlotFixtures(gameEnv, playerId) {
  const player = gameEnv?.players?.[playerId];
  if (!player?.zones) {
    throw new Error(`Fixture validation failed: player ${playerId} not found or missing zones`);
  }

  for (const slotName of SLOT_NAMES) {
    const slot = player.zones[slotName];
    if (!slot) continue;

    for (const role of ['unit', 'pilot']) {
      if (!slot[role]) continue;
      const missing = collectMissingSlotCardFields(slot[role]);
      if (missing.length > 0) {
        const carduid = slot[role]?.carduid || 'unknown_carduid';
        throw new Error(
          `Fixture validation failed for ${playerId}:${slotName}.${role} (${carduid}). Missing fields: ${missing.join(', ')}`
        );
      }
    }
  }
}

module.exports = {
  validatePlayerSlotFixtures,
};
