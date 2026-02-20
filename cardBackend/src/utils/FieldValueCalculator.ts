import { UnitZoneCard, PilotZoneCard, BaseCard, FieldCardValue, TemporaryEffect } from '../models/CardSystem';
import { SlotZone } from '../models/Player';
import { SlotHealthStorage } from '../services/health/SlotHealthStorage';
import { resolveRemainingHp, resolveSlotEffectiveMaxHp } from '../services/health/SlotHealthMath';

interface CardStatBreakdown {
    originalAP: number;
    originalHP: number;
    continueAP: number;
    continueHP: number;
    tempAP: number;
    tempHP: number;
    damage: number;
    totalAP: number;
    totalHP: number;
}

const DEFAULT_BREAKDOWN: CardStatBreakdown = {
    originalAP: 0,
    originalHP: 0,
    continueAP: 0,
    continueHP: 0,
    tempAP: 0,
    tempHP: 0,
    damage: 0,
    totalAP: 0,
    totalHP: 0
};

const ZERO_FIELD_VALUE: FieldCardValue = {
    totalOriginalAP: 0,
    totalOriginalHP: 0,
    totalTempModifyAP: 0,
    totalTempModifyHP: 0,
    totalContinueModifyAP: 0,
    totalContinueModifyHP: 0,
    totalDamageReceived: 0,
    totalAP: 0,
    totalHP: 0,
};

function resolveBaseStat(value?: number, fallback?: number): number {
    if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
    }
    if (typeof fallback === 'number' && !Number.isNaN(fallback)) {
        return fallback;
    }
    return 0;
}

function sumTemporaryModifiers(
    effects: TemporaryEffect[] | undefined,
    legacyAP?: number,
    legacyHP?: number
): { ap: number; hp: number } {
    const resolvedLegacyAP = typeof legacyAP === 'number' && !Number.isNaN(legacyAP) ? legacyAP : undefined;
    const resolvedLegacyHP = typeof legacyHP === 'number' && !Number.isNaN(legacyHP) ? legacyHP : undefined;

    let effectAP = 0;
    let effectHP = 0;
    if (Array.isArray(effects) && effects.length > 0) {
        for (const effect of effects) {
            if (typeof effect.modifyAP === 'number' && !Number.isNaN(effect.modifyAP)) {
                effectAP += effect.modifyAP;
            }
            if (typeof effect.modifyHP === 'number' && !Number.isNaN(effect.modifyHP)) {
                effectHP += effect.modifyHP;
            }
        }
    }

    return {
        ap: resolvedLegacyAP ?? effectAP,
        hp: resolvedLegacyHP ?? effectHP
    };
}

function calculateCardBreakdown(card: UnitZoneCard | PilotZoneCard | BaseCard | undefined): CardStatBreakdown {
    if (!card) {
        return DEFAULT_BREAKDOWN;
    }

    const originalAP = resolveBaseStat(
        'originalAP' in card ? (card as UnitZoneCard | PilotZoneCard).originalAP : undefined,
        card.cardData?.ap
    );

    const originalHP = resolveBaseStat(
        'originalHP' in card ? (card as UnitZoneCard | PilotZoneCard | BaseCard).originalHP : undefined,
        card.cardData?.hp
    );

    const continueAP = resolveBaseStat(
        'continueModifyAP' in card ? (card as UnitZoneCard | PilotZoneCard).continueModifyAP : undefined,
        0
    );

    const continueHP = resolveBaseStat(
        'continueModifyHP' in card ? (card as UnitZoneCard | PilotZoneCard).continueModifyHP : undefined,
        0
    );

    const effects = 'temporaryEffects' in card ? (card as UnitZoneCard | PilotZoneCard).temporaryEffects : undefined;
    const { ap: tempAP, hp: tempHP } = sumTemporaryModifiers(
        effects,
        'modifyAP' in card ? (card as any).modifyAP : undefined,
        'modifyHP' in card ? (card as any).modifyHP : undefined
    );

    const damageReceived = resolveBaseStat('damageReceived' in card ? (card as any).damageReceived : undefined, 0);

    const totalAP = Math.max(0, originalAP + continueAP + tempAP);
    const totalHP = Math.max(0, originalHP + continueHP + tempHP - damageReceived);

    return {
        originalAP,
        originalHP,
        continueAP,
        continueHP,
        tempAP,
        tempHP,
        damage: damageReceived,
        totalAP,
        totalHP
    };
}

export function calculateSlotFieldValue(slot: SlotZone | undefined): FieldCardValue {
    if (!slot) {
        return { ...ZERO_FIELD_VALUE };
    }

    const unitBreakdown = calculateCardBreakdown(slot.unit as UnitZoneCard | undefined);
    const pilotBreakdown = calculateCardBreakdown(slot.pilot as PilotZoneCard | undefined);
    const sharedDamage = SlotHealthStorage.getSharedDamage(slot);
    const slotMaxHp = resolveSlotEffectiveMaxHp(slot);

    return {
        totalOriginalAP: unitBreakdown.originalAP + pilotBreakdown.originalAP,
        totalOriginalHP: unitBreakdown.originalHP + pilotBreakdown.originalHP,
        totalTempModifyAP: unitBreakdown.tempAP + pilotBreakdown.tempAP,
        totalTempModifyHP: unitBreakdown.tempHP + pilotBreakdown.tempHP,
        totalContinueModifyAP: unitBreakdown.continueAP + pilotBreakdown.continueAP,
        totalContinueModifyHP: unitBreakdown.continueHP + pilotBreakdown.continueHP,
        totalDamageReceived: sharedDamage,
        totalAP: unitBreakdown.totalAP + pilotBreakdown.totalAP,
        totalHP: resolveRemainingHp(slotMaxHp, sharedDamage),
    };
}

export function calculateBaseFieldValue(card: BaseCard | undefined): FieldCardValue {
    const breakdown = calculateCardBreakdown(card);
    return {
        totalOriginalAP: breakdown.originalAP,
        totalOriginalHP: breakdown.originalHP,
        totalTempModifyAP: breakdown.tempAP,
        totalTempModifyHP: breakdown.tempHP,
        totalContinueModifyAP: breakdown.continueAP,
        totalContinueModifyHP: breakdown.continueHP,
        totalDamageReceived: breakdown.damage,
        totalAP: breakdown.totalAP,
        totalHP: breakdown.totalHP
    };
}

export function getSlotTotals(slot: SlotZone | undefined): { totalAP: number; totalHP: number } {
    const fieldValue = calculateSlotFieldValue(slot);
    return {
        totalAP: fieldValue.totalAP || 0,
        totalHP: fieldValue.totalHP || 0
    };
}

export function getCardTotals(card: UnitZoneCard | PilotZoneCard | BaseCard | undefined): { totalAP: number; totalHP: number } {
    const breakdown = calculateCardBreakdown(card);
    return {
        totalAP: breakdown.totalAP,
        totalHP: breakdown.totalHP
    };
}
