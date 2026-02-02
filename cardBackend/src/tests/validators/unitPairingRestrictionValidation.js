require('ts-node/register/transpile-only');

const { CardDatabaseManager } = require('../../models/CardSystem');
const { UnitRestrictionUtils } = require('../../services/restrictions/UnitRestrictionUtils');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildUnitZoneCard(cardId, cardDataOverride) {
  const cardData =
    cardDataOverride || CardDatabaseManager.getCardDetails(cardId) || { id: cardId, cardType: 'unit' };

  return {
    carduid: `${cardId}_unit_test_0001`,
    cardId,
    cardData,
    placedAt: Date.now(),
    placedBy: 'test',
    isRested: false,
    effectUsage: {}
  };
}

function validateUnitPairingRestrictions() {
  const t014Full = buildUnitZoneCard('T-014');
  assert(
    UnitRestrictionUtils.cannotBePairedWithPilot(t014Full) === true,
    'Expected T-014 to be blocked from pilot pairing (full cardData)'
  );

  // Simulate legacy/incomplete save where the runtime cardData is missing rules.
  const t014WithoutRules = buildUnitZoneCard('T-014', { id: 'T-014', cardType: 'unit', effects: { description: [], rules: [] } });
  assert(
    UnitRestrictionUtils.cannotBePairedWithPilot(t014WithoutRules) === true,
    'Expected T-014 to be blocked from pilot pairing even when runtime cardData is missing rules'
  );

  const t022WithoutRules = buildUnitZoneCard('T-022', { id: 'T-022', cardType: 'unit', effects: { description: [], rules: [] } });
  assert(
    UnitRestrictionUtils.cannotBePairedWithPilot(t022WithoutRules) === false,
    'Expected T-022 to allow pilot pairing when no restriction rule exists'
  );
}

module.exports = {
  validateUnitPairingRestrictions
};
