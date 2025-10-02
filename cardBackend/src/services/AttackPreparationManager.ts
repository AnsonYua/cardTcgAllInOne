// src/services/AttackPreparationManager.ts
// Centralized validation logic for attack actions

import { GameEnvironment } from '../models/GameEnvironment';
import { Player } from '../models/Player';
import { UnitZoneCard } from '../models/CardSystem';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';

export interface AttackPreparationFailure {
    success: false;
    error: string;
}

export interface UnitAttackPreparationSuccess {
    success: true;
    attacker: Player;
    defender: Player;
    attackerSlot: string;
    attackingUnit: UnitZoneCard;
    targetSlotName: string;
    targetUnit: UnitZoneCard;
}

export interface BaseAttackPreparationSuccess {
    success: true;
    attacker: Player;
    defender: Player;
    attackerSlot: string;
    attackingUnit: UnitZoneCard;
}

export type UnitAttackPreparationResult = UnitAttackPreparationSuccess | AttackPreparationFailure;
export type BaseAttackPreparationResult = BaseAttackPreparationSuccess | AttackPreparationFailure;

export class AttackPreparationManager {

    static prepareUnitAttack(
        gameEnv: GameEnvironment,
        playerId: string,
        attackerCarduid: string,
        targetPlayerId: string,
        targetUnitUid: string
    ): UnitAttackPreparationResult {

        const attacker = gameEnv.getPlayer(playerId);
        if (!attacker) {
            return {
                success: false,
                error: `Player ${playerId} not found`
            };
        }

        const defender = gameEnv.getPlayer(targetPlayerId);
        if (!defender) {
            return {
                success: false,
                error: `Player ${targetPlayerId} not found`
            };
        }

        const targetSlotResult = SlotZoneUtils.findSlotNameByUnitUid(gameEnv, targetUnitUid);
        if (!targetSlotResult.found || !targetSlotResult.slotName) {
            return {
                success: false,
                error: targetSlotResult.error || `Target unit ${targetUnitUid} not found`
            };
        }

        const defenderSlotName = targetSlotResult.slotName;
        const defenderSlot = (defender.zones as any)[defenderSlotName];
        const targetUnit = defenderSlot?.unit as UnitZoneCard;

        if (!targetUnit || targetUnit.carduid !== targetUnitUid) {
            return {
                success: false,
                error: `Target unit ${targetUnitUid} not found in slot ${defenderSlotName}`
            };
        }

        const attackerSlotResult = SlotZoneUtils.findSlotNameByUnitUidForPlayer(gameEnv, playerId, attackerCarduid);
        if (!attackerSlotResult.found || !attackerSlotResult.slotName || !attackerSlotResult.unit) {
            return {
                success: false,
                error: attackerSlotResult.error || `Attacking unit ${attackerCarduid} not found`
            };
        }

        return {
            success: true,
            attacker,
            defender,
            attackerSlot: attackerSlotResult.slotName,
            attackingUnit: attackerSlotResult.unit as UnitZoneCard,
            targetSlotName: defenderSlotName,
            targetUnit
        };
    }

    static prepareBaseAttack(
        gameEnv: GameEnvironment,
        playerId: string,
        attackerCarduid: string
    ): BaseAttackPreparationResult {

        const attacker = gameEnv.getPlayer(playerId);
        if (!attacker) {
            return {
                success: false,
                error: `Player ${playerId} not found`
            };
        }

        const defenderId = gameEnv.getOpponentId(playerId);
        if (!defenderId) {
            return {
                success: false,
                error: `Opponent for ${playerId} not found`
            };
        }

        const defender = gameEnv.getPlayer(defenderId);
        if (!defender) {
            return {
                success: false,
                error: `Player ${defenderId} not found`
            };
        }

        const attackerSlotResult = SlotZoneUtils.findSlotNameByUnitUidForPlayer(gameEnv, playerId, attackerCarduid);
        if (!attackerSlotResult.found || !attackerSlotResult.slotName || !attackerSlotResult.unit) {
            return {
                success: false,
                error: attackerSlotResult.error || `Attacking unit ${attackerCarduid} not found`
            };
        }

        return {
            success: true,
            attacker,
            defender,
            attackerSlot: attackerSlotResult.slotName,
            attackingUnit: attackerSlotResult.unit as UnitZoneCard
        };
    }

    static unitHasAttackRestriction(unit: UnitZoneCard | null, restriction: string): boolean {
        if (!unit) {
            return false;
        }

        const matchesRestriction = (value: any): boolean => {
            if (!value) {
                return false;
            }

            if (typeof value === 'string') {
                return value === restriction;
            }

            if (Array.isArray(value)) {
                return value.some(item => matchesRestriction(item));
            }

            if (typeof value === 'object') {
                if (value.restriction || value.restrictions) {
                    return matchesRestriction(value.restriction || value.restrictions);
                }

                if (value.type) {
                    return matchesRestriction(value.type);
                }

                return Object.values(value).some(item => matchesRestriction(item));
            }

            return false;
        };

        if (matchesRestriction((unit as any).attackRestrictions)) {
            return true;
        }

        if (matchesRestriction((unit as any).activeRestrictions)) {
            return true;
        }

        const cardRules = unit.cardData?.effects?.rules || [];
        return cardRules.some(rule => {
            if (rule?.action !== 'restrict_attack') {
                return false;
            }

            const parameters = rule.parameters || {};
            return matchesRestriction(parameters.restriction || parameters.restrictions);
        });
    }
}

