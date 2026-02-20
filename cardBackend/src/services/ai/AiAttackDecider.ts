import type { AiDecision } from './AiTypes';
import { SLOT_NAMES } from './AiTypes';
import { canAttackActiveTarget, isShieldAttackRestricted } from './AiTargetUtils';
import { getSlotAttackPower, getSlotRemainingHp } from './AiSlotHealthUtils';
import { AttackPreparationManager } from '../AttackPreparationManager';
import type { AiGameEnvView, AiPlayerView, AiSlotView, AiUnitView } from './AiViewTypes';
import type { UnitZoneCard } from '../../models/CardSystem';

type AttackCandidate = { slotName: string; slot: AiSlotView };

export function findWinningShieldAttack(gameEnvView: AiGameEnvView, aiPlayerId: string, opponentId: string): AiDecision | null {
    const players = gameEnvView?.players || {};
    const opponent = players[opponentId];
    const opponentShieldCount = Number(opponent?.zones?.shieldCount || 0);
    if (opponentShieldCount > 0) {
        return null;
    }

    const attackers = getAttackers(gameEnvView, aiPlayerId)
        .filter((entry) => !isShieldAttackRestricted(entry.slot?.unit));
    const best = attackers
        .filter((entry) => getSlotAttackPower(entry.slot) > 0)
        .sort((a, b) => getSlotAttackPower(b.slot) - getSlotAttackPower(a.slot))[0];
    if (!best?.slot?.unit?.carduid) {
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

export function findBestUnitAttack(gameEnvView: AiGameEnvView, aiPlayerId: string, opponentId: string): AiDecision | null {
    const attackers = getAttackers(gameEnvView, aiPlayerId);
    const defender = gameEnvView?.players?.[opponentId];
    const defenderTargets = getDefenderUnits(defender);

    if (attackers.length === 0 || defenderTargets.length === 0) {
        return null;
    }

    let bestScore = Number.NEGATIVE_INFINITY;
    let bestAction: AiDecision | null = null;

    for (const attacker of attackers) {
        const attackerUnit = attacker.slot?.unit;
        if (!attackerUnit?.carduid) {
            continue;
        }
        const attackerAP = getSlotAttackPower(attacker.slot);
        const attackerHP = getSlotRemainingHp(attacker.slot);
        for (const target of defenderTargets) {
            const targetUnit = target.slot?.unit;
            if (!targetUnit?.carduid) {
                continue;
            }
            if (targetUnit.isRested !== true && !canAttackActiveTarget(gameEnvView, attackerUnit, targetUnit)) {
                continue;
            }
            const targetHP = getSlotRemainingHp(target.slot);
            const targetAP = getSlotAttackPower(target.slot);
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
                        attackerCarduid: attackerUnit.carduid,
                        targetPlayerId: opponentId,
                        targetUnitUid: targetUnit.carduid
                    }
                };
            }
        }
    }

    return bestScore > 8 ? bestAction : null;
}

export function findSafeShieldAttack(gameEnvView: AiGameEnvView, aiPlayerId: string): AiDecision | null {
    const attackers = getAttackers(gameEnvView, aiPlayerId)
        .filter((entry) => !isShieldAttackRestricted(entry.slot?.unit));
    if (attackers.length === 0) {
        return null;
    }

    const best = attackers
        .sort((a, b) => getSlotAttackPower(b.slot) - getSlotAttackPower(a.slot))[0];
    if (!best?.slot?.unit?.carduid) {
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

function getAttackers(gameEnvView: AiGameEnvView, aiPlayerId: string): AttackCandidate[] {
    const self = gameEnvView?.players?.[aiPlayerId];
    const zones = self?.zones || {};
    return SLOT_NAMES
        .map((slotName) => ({ slotName, slot: zones?.[slotName] as AiSlotView | undefined }))
        .filter((entry): entry is AttackCandidate =>
            Boolean(
                entry?.slot?.unit
                && canAttack(entry.slot.unit)
                && !AttackPreparationManager.unitHasAttackRestriction(
                    entry.slot.unit as unknown as UnitZoneCard,
                    'cannot_attack'
                )
            )
        );
}

function getDefenderUnits(playerView: AiPlayerView | undefined): AttackCandidate[] {
    const zones = playerView?.zones || {};
    return SLOT_NAMES
        .map((slotName) => ({ slotName, slot: zones?.[slotName] as AiSlotView | undefined }))
        .filter((entry): entry is AttackCandidate => Boolean(entry?.slot?.unit));
}

function canAttack(unit: AiUnitView | undefined): boolean {
    if (!unit) return false;
    if (typeof unit.canAttackThisTurn === 'boolean') return unit.canAttackThisTurn;
    const isRested = Boolean(unit.isRested);
    const playedThisTurn = Boolean(unit.playedThisTurn);
    const canAttackOnPlayTurn = Boolean(unit.canAttackOnPlayTurn);
    return !isRested && (!playedThisTurn || canAttackOnPlayTurn);
}
