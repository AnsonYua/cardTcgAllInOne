import { AllowAttackTargetPermissionResolver } from '../attack/AllowAttackTargetPermissionResolver';
import { AttackPreparationManager } from '../AttackPreparationManager';
import { SLOT_NAMES } from './AiTypes';
import type {
    AiCardData,
    AiGameEnvView,
    AiPlayerView,
    AiSlotView,
    AiUnitView
} from './AiViewTypes';
import type { GameEnvironment } from '../../models/GameEnvironment';
import type { UnitZoneCard } from '../../models/CardSystem';

type TargetLike = {
    carduid?: string;
    cardData?: AiCardData;
};

type RuleLike = {
    action?: string;
};

export function isShieldAttackRestricted(unit: AiUnitView | undefined): boolean {
    return AttackPreparationManager.unitHasAttackRestriction(unit as unknown as UnitZoneCard | null, 'cannot_attack_player');
}

export function canAttackActiveTarget(
    gameEnvView: AiGameEnvView,
    attacker: AiUnitView | undefined,
    target: AiUnitView | undefined
): boolean {
    try {
        return AllowAttackTargetPermissionResolver.canTargetActiveUnit(
            gameEnvView as unknown as GameEnvironment,
            attacker as unknown as UnitZoneCard,
            target as unknown as UnitZoneCard
        );
    } catch {
        return false;
    }
}

export function extractTargetCount(rawCount: unknown): number {
    if (typeof rawCount === 'number' && rawCount > 0) {
        return rawCount;
    }
    if (rawCount && typeof rawCount === 'object') {
        const max = Number((rawCount as { max?: unknown }).max || 1);
        return max > 0 ? max : 1;
    }
    return 1;
}

export function scoreTargetForAction(
    gameEnvView: AiGameEnvView,
    target: TargetLike,
    rule: RuleLike,
    scope: unknown
): number {
    const action = typeof rule?.action === 'string' ? rule.action : '';
    const isOpponent = isOpponentScope(scope);
    const carduid = typeof target.carduid === 'string' ? target.carduid : '';
    const snapshot = carduid ? getUnitSnapshot(gameEnvView, carduid) : null;
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

export function buildViewAdapter(gameEnvView: AiGameEnvView): AiGameEnvView & {
    getPlayer: (playerId: string) => (AiPlayerView & { getShieldCards: () => Record<string, unknown>[] }) | null;
    getOpponentId: (playerId: string) => string | null;
} {
    const players = gameEnvView?.players || {};
    const wrappedPlayers: Record<string, AiPlayerView & { getShieldCards: () => Record<string, unknown>[] }> = {};

    for (const [playerId, player] of Object.entries(players)) {
        const playerObj = player || {};
        const zones = playerObj?.zones || {};
        wrappedPlayers[playerId] = {
            ...playerObj,
            zones,
            getShieldCards: () => (Array.isArray(zones?.shieldArea) ? zones.shieldArea as Record<string, unknown>[] : [])
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

function isOpponentScope(scope: unknown): boolean {
    const scopeValue = typeof scope === 'string' ? scope.toLowerCase() : '';
    return scopeValue.includes('opponent') || scopeValue.includes('enemy');
}

function getUnitSnapshot(gameEnvView: AiGameEnvView, carduid: string): {
    ap: number;
    hp: number;
    remainingHp: number;
    damage: number;
    isRested: boolean;
} | null {
    const players = gameEnvView?.players || {};
    for (const player of Object.values(players)) {
        const zones = player?.zones || {};
        for (const slotName of SLOT_NAMES) {
            const slot = zones?.[slotName] as AiSlotView | undefined;
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
