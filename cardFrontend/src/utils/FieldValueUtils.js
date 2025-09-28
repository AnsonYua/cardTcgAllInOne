export function normalizeFieldCardValue(fieldValue) {
  if (!fieldValue) {
    return null;
  }
  return {
    totalOriginalAP: fieldValue.totalOriginalAP ?? fieldValue.totalOriginalAp ?? fieldValue.totalOriginalap ?? 0,
    totalOriginalHP: fieldValue.totalOriginalHP ?? fieldValue.totalOriginalHp ?? fieldValue.totalOriginalhp ?? 0,
    totalTempModifyAP: fieldValue.totalTempModifyAP ?? fieldValue.totalTempModifyAp ?? 0,
    totalTempModifyHP: fieldValue.totalTempModifyHP ?? fieldValue.totalTempModifyHp ?? 0,
    totalContinueModifyAP: fieldValue.totalContinueModifyAP ?? fieldValue.totalContinueModifyAp ?? 0,
    totalContinueModifyHP: fieldValue.totalContinueModifyHP ?? fieldValue.totalContinueModifyHp ?? 0,
    totalDamageReceived: fieldValue.totalDamageReceived ?? 0,
    totalAP: fieldValue.totalAP ?? fieldValue.totalAp ?? 0,
    totalHP: fieldValue.totalHP ?? fieldValue.totalHp ?? 0,
    isRested: fieldValue.isRested === undefined ? null : !!fieldValue.isRested
  };
}

export function resolveFieldCardTotals({ slotFieldValue, existingFieldValue, fullCardData, cardData }) {
  const resolvedCard = cardData || fullCardData?.cardData || fullCardData || {};

  const prioritizedFieldValue = slotFieldValue
    || existingFieldValue
    || fullCardData?.fieldCardValue
    || resolvedCard?.fieldCardValue;

  const normalizedFieldValue = normalizeFieldCardValue(prioritizedFieldValue);

  const originalAP = fullCardData?.originalAP
    ?? resolvedCard?.originalAP
    ?? resolvedCard?.ap
    ?? 0;

  const originalHP = fullCardData?.originalHP
    ?? resolvedCard?.originalHP
    ?? resolvedCard?.hp
    ?? 0;

  const totalAP = normalizedFieldValue?.totalAP
    ?? resolvedCard?.totalAP
    ?? resolvedCard?.ap
    ?? originalAP;

  const totalHP = normalizedFieldValue?.totalHP
    ?? resolvedCard?.totalHP
    ?? resolvedCard?.hp
    ?? originalHP;

  return {
    fieldCardValue: normalizedFieldValue,
    totalAP,
    totalHP,
    originalAP,
    originalHP
  };
}

export function assignFieldCardValue(target, fieldCardValue) {
  if (!target) {
    return;
  }
  if (fieldCardValue) {
    target.fieldCardValue = normalizeFieldCardValue(fieldCardValue);
  } else if (target.fieldCardValue) {
    delete target.fieldCardValue;
  }
}
