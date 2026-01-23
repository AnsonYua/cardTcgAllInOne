// src/services/restrictions/UnitRestrictionUtils.ts
// Lightweight helpers for "cannot X" style card rules sourced from cardData.effects.rules.

import type { ZoneCard } from '../../models/CardSystem';
import type { EffectDefinition } from '../EventQueue/interfaces/GameEvent';

function getRules(card: ZoneCard | null | undefined): EffectDefinition[] {
    const rules = (card as any)?.cardData?.effects?.rules;
    return Array.isArray(rules) ? (rules as EffectDefinition[]) : [];
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

