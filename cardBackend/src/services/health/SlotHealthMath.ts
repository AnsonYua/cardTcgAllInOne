import type { PilotZoneCard, TemporaryEffect, UnitZoneCard } from '../../models/CardSystem';

export type SlotHealthCard = UnitZoneCard | PilotZoneCard | undefined;

export type SlotHealthLike = {
    unit?: UnitZoneCard;
    pilot?: PilotZoneCard;
};

function toNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function sumTemporaryHp(
    effects: TemporaryEffect[] | undefined,
    legacyModifyHp?: unknown
): number {
    if (typeof legacyModifyHp === 'number' && Number.isFinite(legacyModifyHp)) {
        return legacyModifyHp;
    }
    if (!Array.isArray(effects) || effects.length === 0) {
        return 0;
    }

    return effects.reduce((total, effect) => {
        if (!effect || typeof effect !== 'object') {
            return total;
        }
        const value = toNumber((effect as TemporaryEffect).modifyHP, 0);
        return total + value;
    }, 0);
}

export function resolveCardBaseHp(card: SlotHealthCard): number {
    if (!card) {
        return 0;
    }
    const originalHp = toNumber((card as UnitZoneCard | PilotZoneCard).originalHP, NaN);
    if (Number.isFinite(originalHp)) {
        return originalHp;
    }
    return toNumber(card.cardData?.hp, 0);
}

export function resolveCardEffectiveMaxHp(card: SlotHealthCard): number {
    if (!card) {
        return 0;
    }

    const baseHp = resolveCardBaseHp(card);
    const continueHp = toNumber((card as UnitZoneCard | PilotZoneCard).continueModifyHP, 0);
    const tempHp = sumTemporaryHp(
        (card as UnitZoneCard | PilotZoneCard).temporaryEffects,
        (card as any).modifyHP
    );

    return Math.max(0, baseHp + continueHp + tempHp);
}

export function resolveSlotEffectiveMaxHp(slot: SlotHealthLike | undefined): number {
    if (!slot) {
        return 0;
    }
    return Math.max(0, resolveCardEffectiveMaxHp(slot.unit) + resolveCardEffectiveMaxHp(slot.pilot));
}

export function normalizeSharedDamage(damage: unknown): number {
    return Math.max(0, toNumber(damage, 0));
}

export function resolveRemainingHp(maxHp: number, sharedDamage: number): number {
    return Math.max(0, Math.max(0, maxHp) - normalizeSharedDamage(sharedDamage));
}

export function applyDamage(currentDamage: number, value: number): number {
    return normalizeSharedDamage(currentDamage) + Math.max(0, toNumber(value, 0));
}

export function applyHeal(currentDamage: number, value: number): number {
    return Math.max(0, normalizeSharedDamage(currentDamage) - Math.max(0, toNumber(value, 0)));
}
