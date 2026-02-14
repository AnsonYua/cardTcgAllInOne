import type { AiDecision } from './AiTypes';
import { SLOT_NAMES } from './AiTypes';
import { canAttackActiveTarget, isShieldAttackRestricted } from './AiTargetUtils';
import { AttackPreparationManager } from '../AttackPreparationManager';

export function findWinningShieldAttack(gameEnvView: any, aiPlayerId: string, opponentId: string): AiDecision | null {
    const players = gameEnvView?.players || {};
    const opponent = players[opponentId];
    const opponentShieldCount = Number(opponent?.zones?.shieldCount || 0);
    if (opponentShieldCount > 0) {
        return null;
    }

    const attackers = getAttackers(gameEnvView, aiPlayerId)
        .filter((entry) => !isShieldAttackRestricted(entry.slot?.unit));
    const best = attackers
        .filter((entry) => getUnitAttackPower(entry.slot) > 0)
        .sort((a, b) => getUnitAttackPower(b.slot) - getUnitAttackPower(a.slot))[0];
    if (!best) {
        return null;
    }

    return {
        kind: 'playerAction',
        reason: 'lethal_shield_attack',
        payload: {
            actionType: 'attackShieldArea',
            attackerCarduid: best.slot.unit.carduid
        }
    };
}

export function findBestUnitAttack(gameEnvView: any, aiPlayerId: string, opponentId: string): AiDecision | null {
    const attackers = getAttackers(gameEnvView, aiPlayerId);
    const defender = gameEnvView?.players?.[opponentId];
    const defenderTargets = getDefenderUnits(defender);

    if (attackers.length === 0 || defenderTargets.length === 0) {
        return null;
    }

    let bestScore = Number.NEGATIVE_INFINITY;
    let bestAction: AiDecision | null = null;

    for (const attacker of attackers) {
        const attackerAP = getUnitAttackPower(attacker.slot);
        const attackerHP = getUnitRemainingHp(attacker.slot);
        for (const target of defenderTargets) {
            const targetUnit = target.slot?.unit;
            if (!targetUnit) {
                continue;
            }
            if (targetUnit.isRested !== true && !canAttackActiveTarget(gameEnvView, attacker.slot.unit, targetUnit)) {
                continue;
            }
            const targetHP = getUnitRemainingHp(target.slot);
            const targetAP = getUnitAttackPower(target.slot);
            const killBonus = attackerAP >= targetHP ? 30 : 0;
            const tradeRisk = targetAP >= attackerHP ? 18 : 0;
            const score = killBonus + targetAP + targetHP - tradeRisk;
            if (score > bestScore) {
                bestScore = score;
                bestAction = {
                    kind: 'playerAction',
                    reason: 'best_unit_trade',
                    payload: {
                        actionType: 'attackUnit',
                        attackerCarduid: attacker.slot.unit.carduid,
                        targetPlayerId: opponentId,
                        targetUnitUid: target.slot.unit.carduid
                    }
                };
            }
        }
    }

    return bestScore > 8 ? bestAction : null;
}

export function findSafeShieldAttack(gameEnvView: any, aiPlayerId: string): AiDecision | null {
    const attackers = getAttackers(gameEnvView, aiPlayerId)
        .filter((entry) => !isShieldAttackRestricted(entry.slot?.unit));
    if (attackers.length === 0) {
        return null;
    }

    const best = attackers
        .sort((a, b) => getUnitAttackPower(b.slot) - getUnitAttackPower(a.slot))[0];
    if (!best) {
        return null;
    }

    return {
        kind: 'playerAction',
        reason: 'pressure_shields',
        payload: {
            actionType: 'attackShieldArea',
            attackerCarduid: best.slot.unit.carduid
        }
    };
}

function getAttackers(gameEnvView: any, aiPlayerId: string): Array<{ slotName: string; slot: any }> {
    const self = gameEnvView?.players?.[aiPlayerId];
    const zones = self?.zones || {};
    return SLOT_NAMES
        .map((slotName) => ({ slotName, slot: zones?.[slotName] }))
        .filter((entry) =>
            entry?.slot?.unit
            && canAttack(entry.slot.unit)
            && !AttackPreparationManager.unitHasAttackRestriction(entry.slot.unit, 'cannot_attack')
        );
}

function getDefenderUnits(playerView: any): Array<{ slotName: string; slot: any }> {
    const zones = playerView?.zones || {};
    return SLOT_NAMES
        .map((slotName) => ({ slotName, slot: zones?.[slotName] }))
        .filter((entry) => entry?.slot?.unit);
}

function canAttack(unit: any): boolean {
    if (!unit) return false;
    if (typeof unit.canAttackThisTurn === 'boolean') return unit.canAttackThisTurn;
    const isRested = Boolean(unit.isRested);
    const playedThisTurn = Boolean(unit.playedThisTurn);
    const canAttackOnPlayTurn = Boolean(unit.canAttackOnPlayTurn);
    return !isRested && (!playedThisTurn || canAttackOnPlayTurn);
}

function getUnitAttackPower(slot: any): number {
    const fieldValue = slot?.fieldCardValue?.totalAP;
    if (typeof fieldValue === 'number') {
        return fieldValue;
    }
    const baseAp = Number(slot?.unit?.cardData?.ap || 0);
    const continuousAp = Number(slot?.unit?.continueModifyAP || 0);
    return Math.max(0, baseAp + continuousAp);
}

function getUnitRemainingHp(slot: any): number {
    const totalHp = typeof slot?.fieldCardValue?.totalHP === 'number'
        ? slot.fieldCardValue.totalHP
        : Number(slot?.unit?.cardData?.hp || 0) + Number(slot?.unit?.continueModifyHP || 0);
    const damage = Number(slot?.unit?.damageReceived || 0);
    return Math.max(0, totalHp - damage);
}
