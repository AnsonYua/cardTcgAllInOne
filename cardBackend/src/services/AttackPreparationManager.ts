// src/services/AttackPreparationManager.ts
// Centralized validation logic for attack actions

import { GameEnvironment } from '../models/GameEnvironment';
import { Player } from '../models/Player';
import { UnitZoneCard } from '../models/CardSystem';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { AllowAttackTargetPermissionResolver } from './attack/AllowAttackTargetPermissionResolver';

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

export interface ShieldAttackAttackerValidationSuccess {
    success: true;
    attacker: Player;
    attackerSlot: string;
    attackingUnit: UnitZoneCard;
}

export type UnitAttackPreparationResult = UnitAttackPreparationSuccess | AttackPreparationFailure;
export type BaseAttackPreparationResult = BaseAttackPreparationSuccess | AttackPreparationFailure;
export type ShieldAttackAttackerValidationResult = ShieldAttackAttackerValidationSuccess | AttackPreparationFailure;

export class AttackPreparationManager {

    static validateShieldAttackAttacker(
        gameEnv: GameEnvironment,
        playerId: string,
        attackerCarduid: string
    ): ShieldAttackAttackerValidationResult {
        const attacker = gameEnv.getPlayer(playerId);
        if (!attacker) {
            return {
                success: false,
                error: `Player ${playerId} not found`
            };
        }

        const attackerSlotResult = SlotZoneUtils.findSlotNameByUnitUidForPlayer(gameEnv, playerId, attackerCarduid);
        if (!attackerSlotResult.found || !attackerSlotResult.slotName || !attackerSlotResult.unit) {
            return {
                success: false,
                error: attackerSlotResult.error || `Attacking unit ${attackerCarduid} not found`
            };
        }

        if (this.unitHasAttackRestriction(attackerSlotResult.unit as UnitZoneCard, 'cannot_attack')) {
            const attackingUnit = attackerSlotResult.unit as UnitZoneCard;
            const cardName = attackingUnit.cardData?.name || attackingUnit.cardId || 'Attacking unit';
            return {
                success: false,
                error: `${cardName} cannot attack during this turn due to a restriction`
            };
        }

        if (this.unitHasAttackRestriction(attackerSlotResult.unit as UnitZoneCard, 'cannot_attack_player')) {
            const attackingUnit = attackerSlotResult.unit as UnitZoneCard;
            const cardName = attackingUnit.cardData?.name || attackingUnit.cardId || 'Attacking unit';
            return {
                success: false,
                error: `${cardName} cannot attack the player due to a restriction`
            };
        }

        return {
            success: true,
            attacker,
            attackerSlot: attackerSlotResult.slotName,
            attackingUnit: attackerSlotResult.unit as UnitZoneCard
        };
    }

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

        const attackingUnit = attackerSlotResult.unit as UnitZoneCard;
        if (this.unitHasAttackRestriction(attackingUnit, 'cannot_attack')) {
            const cardName = attackingUnit.cardData?.name || attackingUnit.cardId || 'Attacking unit';
            return {
                success: false,
                error: `${cardName} cannot attack during this turn due to a restriction`
            };
        }
        if (!targetUnit.isRested && !this.canAttackActiveTarget(gameEnv, attackingUnit, targetUnit)) {
            return {
                success: false,
                error: 'Target unit must be rested unless attacker can target active units'
            };
        }

        return {
            success: true,
            attacker,
            defender,
            attackerSlot: attackerSlotResult.slotName,
            attackingUnit,
            targetSlotName: defenderSlotName,
            targetUnit
        };
    }

    static prepareBaseAttack(
        gameEnv: GameEnvironment,
        playerId: string,
        attackerCarduid: string
    ): BaseAttackPreparationResult {

        const defenderId = gameEnv.getOpponentId(playerId);
        if (!defenderId) {
            return {
                success: false,
                error: `Opponent for ${playerId} not found`
            };
        }

        const attackerValidation = this.validateShieldAttackAttacker(gameEnv, playerId, attackerCarduid);
        if (!attackerValidation.success) {
            return attackerValidation;
        }

        const { attacker, attackerSlot, attackingUnit } = attackerValidation;

        const defender = gameEnv.getPlayer(defenderId);
        if (!defender) {
            return {
                success: false,
                error: `Player ${defenderId} not found`
            };
        }

        return {
            success: true,
            attacker,
            defender,
            attackerSlot,
            attackingUnit
        };
    }

    private static canAttackActiveTarget(
        gameEnv: GameEnvironment,
        attacker: UnitZoneCard,
        target: UnitZoneCard
    ): boolean {
        return AllowAttackTargetPermissionResolver.canTargetActiveUnit(gameEnv, attacker, target);
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
