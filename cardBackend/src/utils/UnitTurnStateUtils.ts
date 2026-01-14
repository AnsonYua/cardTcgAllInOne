// src/utils/UnitTurnStateUtils.ts
// Centralized unit turn-state helpers

import { UnitZoneCard } from '../models/CardSystem';

export const initializeUnitTurnState = (unit: UnitZoneCard): void => {
    unit.playedThisTurn = true;
    unit.canAttackOnPlayTurn = false;
};

export const resetUnitTurnState = (unit: UnitZoneCard): void => {
    unit.damageReceived = 0;
    unit.playedThisTurn = false;
    unit.canAttackOnPlayTurn = false;
};

export const ensureUnitTurnStateDefaults = (unit: UnitZoneCard): void => {
    if (typeof unit.playedThisTurn !== 'boolean') {
        unit.playedThisTurn = false;
    }

    if (typeof unit.canAttackOnPlayTurn !== 'boolean') {
        unit.canAttackOnPlayTurn = false;
    }
};
