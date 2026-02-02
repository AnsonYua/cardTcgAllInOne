// src/services/AttackPreparationManager.ts
// Centralized validation logic for attack actions

import { GameEnvironment } from '../models/GameEnvironment';
import { Player } from '../models/Player';
import { UnitZoneCard } from '../models/CardSystem';
import { SlotZoneUtils } from '../utils/SlotZoneUtils';
import { validateComparisonFilter } from '../utils/EffectNormalizationUtils';
import { getSlotTotals } from '../utils/FieldValueCalculator';
import { AllowAttackTargetRuleEvaluator } from './attack/AllowAttackTargetRuleEvaluator';

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

        if (this.unitHasAttackRestriction(attackerSlotResult.unit as UnitZoneCard, 'cannot_attack')) {
            const attackingUnit = attackerSlotResult.unit as UnitZoneCard;
            const cardName = attackingUnit.cardData?.name || attackingUnit.cardId || 'Attacking unit';
            return {
                success: false,
                error: `${cardName} cannot attack during this turn due to a restriction`
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

    private static canAttackActiveTarget(
        gameEnv: GameEnvironment,
        attacker: UnitZoneCard,
        target: UnitZoneCard
    ): boolean {
        const effectSources: Array<UnitZoneCard | any> = [attacker];

        const lookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, attacker.carduid);
        const attackerSlot = (lookup.found && lookup.playerId && lookup.slotName)
            ? (gameEnv.players[lookup.playerId]?.zones as any)?.[lookup.slotName]
            : undefined;
        const attackerSlotTotals = getSlotTotals(attackerSlot);

        const slotLookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, attacker.carduid);
        if (slotLookup.found && slotLookup.playerId && slotLookup.slotName) {
            const player = gameEnv.getPlayer(slotLookup.playerId);
            if (player?.zones) {
                const slotResult = SlotZoneUtils.getSlotZone(player.zones, slotLookup.slotName);
                if (slotResult.isValid && slotResult.slot?.pilot) {
                    effectSources.push(slotResult.slot.pilot);
                }
            }
        }

        const ruleAllowsTarget = (rule: any): boolean => {
            if (!rule) {
                return false;
            }

            if (!AllowAttackTargetRuleEvaluator.conditionsSatisfied(rule.conditions, attackerSlotTotals)) {
                return false;
            }

            const parameters = rule.parameters || {};
            const status = typeof parameters.status === 'string' ? parameters.status.toLowerCase() : '';
            if (status && status !== 'active') {
                return false;
            }

            if (parameters.level) {
                const targetLevel = target.cardData?.level || 0;
                if (!validateComparisonFilter(targetLevel, parameters.level)) {
                    return false;
                }
            }

            if (parameters.ap) {
                const targetLookup = SlotZoneUtils.findCardByUidAcrossPlayers(gameEnv, target.carduid);
                const targetSlot = (targetLookup.found && targetLookup.playerId && targetLookup.slotName)
                    ? (gameEnv.players[targetLookup.playerId]?.zones as any)?.[targetLookup.slotName]
                    : undefined;
                const targetTotals = getSlotTotals(targetSlot);
                const targetTotalAp = targetTotals.totalAP;

                if (typeof parameters.ap === 'number') {
                    if (targetTotalAp !== parameters.ap) {
                        return false;
                    }
                } else if (typeof parameters.ap === 'string') {
                    if (!validateComparisonFilter(targetTotalAp, parameters.ap)) {
                        return false;
                    }
                } else {
                    return false;
                }
            }

            if (typeof parameters.damaged === 'boolean') {
                const damageReceived = typeof target.damageReceived === 'number' ? target.damageReceived : 0;
                const isDamaged = damageReceived > 0;
                if (parameters.damaged !== isDamaged) {
                    return false;
                }
            }

            return true;
        };

        for (const source of effectSources) {
            const effects = source.cardData?.effects?.rules || [];
            for (const rule of effects) {
                if (!rule || rule.action !== 'allow_attack_target') {
                    continue;
                }

                if (ruleAllowsTarget(rule)) {
                    return true;
                }
            }

            const tempEffects = (source as any)?.temporaryEffects;
            if (!Array.isArray(tempEffects) || tempEffects.length === 0) {
                continue;
            }

            for (const tempEffect of tempEffects) {
                const allow = tempEffect?.allowAttackTarget;
                if (!allow || typeof allow !== 'object') {
                    continue;
                }

                const synthesizedRule = {
                    action: 'allow_attack_target',
                    conditions: [],
                    parameters: allow
                };

                if (ruleAllowsTarget(synthesizedRule)) {
                    return true;
                }
            }
        }

        return false;
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
