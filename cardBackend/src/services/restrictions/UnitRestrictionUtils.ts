// src/services/restrictions/UnitRestrictionUtils.ts
// Lightweight helpers for "cannot X" style card rules sourced from card data rules.

import { CardDatabaseManager, type ZoneCard } from '../../models/CardSystem';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';

function getRulesFromValue(value: any): EffectDefinition[] {
    const rules = value?.effects?.rules;
    return Array.isArray(rules) ? (rules as EffectDefinition[]) : [];
}

function getRules(card: ZoneCard | null | undefined): EffectDefinition[] {
    if (!card) {
        return [];
    }

    // Primary source: the card's persisted runtime cardData.
    const runtimeRules = getRulesFromValue((card as any).cardData);
    if (runtimeRules.length > 0) {
        return runtimeRules;
    }

    // Some legacy saves/objects may have effects flattened onto the card itself.
    const flattenedRules = getRulesFromValue(card as any);
    if (flattenedRules.length > 0) {
        return flattenedRules;
    }

    // Fallback: re-hydrate from the canonical card database by cardId.
    const cardId = typeof (card as any).cardId === 'string'
        ? (card as any).cardId
        : typeof (card as any)?.cardData?.id === 'string'
            ? (card as any).cardData.id
            : null;
    if (!cardId) {
        return [];
    }

    const dbCardData = CardDatabaseManager.getCardDetails(cardId);
    return getRulesFromValue(dbCardData);
}

function hasDisallowRule(card: ZoneCard | null | undefined, action: string): boolean {
    const rules = getRules(card);
    for (const rule of rules) {
        if (!rule || typeof (rule as any).action !== 'string') {
            continue;
        }
        if ((rule as any).action !== action) {
            continue;
        }
        const disallow = (rule as any).parameters?.disallow === true;
        if (disallow) {
            return true;
        }
    }
    return false;
}

export class UnitRestrictionUtils {
    static cannotBeSetActive(card: ZoneCard | null | undefined): boolean {
        return hasDisallowRule(card, 'restrict_set_active');
    }

    static cannotBePairedWithPilot(card: ZoneCard | null | undefined): boolean {
        return hasDisallowRule(card, 'restrict_pairing');
    }
}
