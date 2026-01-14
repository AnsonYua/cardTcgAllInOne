// src/utils/UnitAttackUtils.ts
// Centralized unit attack eligibility helpers

import { UnitZoneCard } from '../models/CardSystem';

export const canUnitAttackThisTurn = (unit?: UnitZoneCard): boolean => {
    if (!unit) {
        return false;
    }

    const playedThisTurn = Boolean(unit.playedThisTurn);
    const canAttackOnPlayTurn = Boolean(unit.canAttackOnPlayTurn);
    const isRested = Boolean(unit.isRested);

    return !isRested && (!playedThisTurn || canAttackOnPlayTurn);
};
