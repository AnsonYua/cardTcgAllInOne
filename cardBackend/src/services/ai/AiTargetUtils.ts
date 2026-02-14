import { AllowAttackTargetPermissionResolver } from '../attack/AllowAttackTargetPermissionResolver';
import { AttackPreparationManager } from '../AttackPreparationManager';
import { SLOT_NAMES } from './AiTypes';

export function isShieldAttackRestricted(unit: any): boolean {
    return AttackPreparationManager.unitHasAttackRestriction(unit, 'cannot_attack_player');
}

export function canAttackActiveTarget(gameEnvView: any, attacker: any, target: any): boolean {
    try {
        return AllowAttackTargetPermissionResolver.canTargetActiveUnit(gameEnvView as any, attacker, target);
    } catch {
        return false;
    }
}

export function extractTargetCount(rawCount: unknown): number {
    if (typeof rawCount === 'number' && rawCount > 0) {
        return rawCount;
    }
    if (rawCount && typeof rawCount === 'object') {
        const max = Number((rawCount as any).max || 1);
        return max > 0 ? max : 1;
    }
    return 1;
}

export function scoreTargetForAction(
    gameEnvView: any,
    target: any,
    rule: any,
    scope: any
): number {
    const action = typeof rule?.action === 'string' ? rule.action : '';
    const isOpponent = isOpponentScope(scope);
    const snapshot = getUnitSnapshot(gameEnvView, target.carduid);
    const ap = snapshot?.ap ?? Number(target?.cardData?.ap || 0);
    const hp = snapshot?.hp ?? Number(target?.cardData?.hp || 0);
    const remainingHp = snapshot?.remainingHp ?? hp;
    const damage = snapshot?.damage ?? 0;

    switch (action) {
        case 'damage':
        case 'destroy':
        case 'returnToHand':
        case 'rest':
            return (isOpponent ? 50 : 5) + ap * 3 + remainingHp * 2;
        case 'heal':
        case 'repair':
        case 'modifyHP':
            return (isOpponent ? 5 : 50) + damage * 5 + (hp - remainingHp) * 2;
        case 'modifyAP':
            return (isOpponent ? 40 : 30) + ap * 4;
        default:
            return isOpponent ? 10 : 8;
    }
}

export function buildViewAdapter(gameEnvView: any): any {
    const players = gameEnvView?.players || {};
    const wrappedPlayers: Record<string, any> = {};

    for (const [playerId, player] of Object.entries(players)) {
        const playerObj = (player as any) || {};
        const zones = playerObj?.zones || {};
        wrappedPlayers[playerId] = {
            ...playerObj,
            zones,
            getShieldCards: () => (Array.isArray(zones?.shieldArea) ? zones.shieldArea : [])
        };
    }

    return {
        ...gameEnvView,
        players: wrappedPlayers,
        getPlayer: (playerId: string) => wrappedPlayers[playerId] || null,
        getOpponentId: (playerId: string) => {
            if (gameEnvView?.playerId_1 === playerId) return gameEnvView?.playerId_2 || null;
            if (gameEnvView?.playerId_2 === playerId) return gameEnvView?.playerId_1 || null;
            const ids = Object.keys(wrappedPlayers);
            return ids.find((id) => id !== playerId) || null;
        }
    };
}

function isOpponentScope(scope: any): boolean {
    const scopeValue = typeof scope === 'string' ? scope.toLowerCase() : '';
    return scopeValue.includes('opponent') || scopeValue.includes('enemy');
}

function getUnitSnapshot(gameEnvView: any, carduid: string): {
    ap: number;
    hp: number;
    remainingHp: number;
    damage: number;
    isRested: boolean;
} | null {
    const players = gameEnvView?.players || {};
    for (const player of Object.values(players)) {
        const zones = (player as any)?.zones || {};
        for (const slotName of SLOT_NAMES) {
            const slot = zones?.[slotName];
            const unit = slot?.unit;
            if (!unit || unit.carduid !== carduid) {
                continue;
            }
            const totals = slot?.fieldCardValue || {};
            const ap = typeof totals.totalAP === 'number' ? totals.totalAP : Number(unit?.cardData?.ap || 0);
            const hp = typeof totals.totalHP === 'number' ? totals.totalHP : Number(unit?.cardData?.hp || 0);
            const damage = Number(unit?.damageReceived || 0);
            const remainingHp = Math.max(0, hp - damage);
            return {
                ap,
                hp,
                remainingHp,
                damage,
                isRested: Boolean(unit?.isRested)
            };
        }
    }
    return null;
}
