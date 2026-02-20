import type { AiGameEnvView, AiSlotView, AiUnitView } from './AiViewTypes';
import { SLOT_NAMES } from './AiTypes';

export type AiUnitSnapshot = {
    ap: number;
    hp: number;
    remainingHp: number;
    damage: number;
    isRested: boolean;
};

export function toAiNumber(value: unknown, fallback = 0): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function getSlotAttackPower(slot: AiSlotView | undefined): number {
    const totalAp = slot?.fieldCardValue?.totalAP;
    if (typeof totalAp === 'number') {
        return totalAp;
    }

    const baseAp = toAiNumber(slot?.unit?.cardData?.ap, 0);
    const continuousAp = toAiNumber(slot?.unit?.continueModifyAP, 0);
    return Math.max(0, baseAp + continuousAp);
}

export function getSlotTotalHp(slot: AiSlotView | undefined): number {
    const totalHp = slot?.fieldCardValue?.totalHP;
    if (typeof totalHp === 'number') {
        return Math.max(0, totalHp);
    }

    const baseHp = toAiNumber(slot?.unit?.cardData?.hp, 0);
    const continuousHp = toAiNumber(slot?.unit?.continueModifyHP, 0);
    return Math.max(0, baseHp + continuousHp);
}

export function getSlotDamage(slot: AiSlotView | undefined): number {
    const totalDamage = slot?.fieldCardValue?.totalDamageReceived;
    if (typeof totalDamage === 'number') {
        return Math.max(0, totalDamage);
    }

    return Math.max(0, toAiNumber(slot?.unit?.damageReceived, 0));
}

export function getSlotRemainingHp(slot: AiSlotView | undefined): number {
    const totalHp = getSlotTotalHp(slot);
    const totalDamage = getSlotDamage(slot);

    if (typeof slot?.fieldCardValue?.totalHP === 'number') {
        return totalHp;
    }

    return Math.max(0, totalHp - totalDamage);
}

export function getSlotUnitSnapshot(slot: AiSlotView | undefined): AiUnitSnapshot | null {
    const unit = slot?.unit;
    if (!unit) {
        return null;
    }

    return {
        ap: getSlotAttackPower(slot),
        hp: getSlotTotalHp(slot),
        remainingHp: getSlotRemainingHp(slot),
        damage: getSlotDamage(slot),
        isRested: Boolean(unit.isRested)
    };
}

export function findUnitSnapshotByCarduid(
    gameEnvView: AiGameEnvView,
    carduid: string
): AiUnitSnapshot | null {
    const players = gameEnvView?.players || {};
    for (const player of Object.values(players)) {
        const zones = player?.zones || {};
        for (const slotName of SLOT_NAMES) {
            const slot = zones?.[slotName] as AiSlotView | undefined;
            const unit = slot?.unit as AiUnitView | undefined;
            if (!unit || unit.carduid !== carduid) {
                continue;
            }
            return getSlotUnitSnapshot(slot);
        }
    }
    return null;
}
