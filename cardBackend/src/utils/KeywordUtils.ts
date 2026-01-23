// src/utils/KeywordUtils.ts

import type { UnitZoneCard, PilotZoneCard } from '../models/CardSystem';
import { resolveEffectActionFromRule } from './EffectNormalizationUtils';

export class KeywordUtils {
    static hasKeyword(card: UnitZoneCard | PilotZoneCard, keyword: string): boolean {
        const effects = (card as any).temporaryEffects;
        if (!Array.isArray(effects) || effects.length === 0) {
            return false;
        }

        return effects.some((effect: any) => {
            const keywords = Array.isArray(effect.grantedKeywords) ? effect.grantedKeywords : [];
            if (keywords.includes(keyword)) {
                return true;
            }
            const values = effect.keywordValues && typeof effect.keywordValues === 'object' ? effect.keywordValues : null;
            return Boolean(values && typeof values[keyword] === 'number');
        });
    }

    static getKeywordValue(card: UnitZoneCard | PilotZoneCard, keyword: string): number | undefined {
        const effects = (card as any).temporaryEffects;
        if (!Array.isArray(effects) || effects.length === 0) {
            return undefined;
        }

        let found: number | undefined;

        for (const effect of effects) {
            const values = effect?.keywordValues && typeof effect.keywordValues === 'object' ? effect.keywordValues : null;
            const value = values && typeof values[keyword] === 'number' ? values[keyword] : undefined;
            if (typeof value === 'number') {
                found = typeof found === 'number' ? Math.max(found, value) : value;
                continue;
            }

            const keywords = Array.isArray(effect?.grantedKeywords) ? effect.grantedKeywords : [];
            if (keywords.includes(keyword)) {
                found = typeof found === 'number' ? Math.max(found, 1) : 1;
            }
        }

        return found;
    }

    static hasBlocker(card: UnitZoneCard | PilotZoneCard): boolean {
        if (this.hasKeyword(card, 'Blocker')) {
            return true;
        }

        const rules = (card as any)?.cardData?.effects?.rules;
        if (!Array.isArray(rules) || rules.length === 0) {
            return false;
        }

        return rules.some(rule =>
            rule?.trigger === 'ATTACK_REDIRECT' &&
            resolveEffectActionFromRule(rule) === 'redirect_attack'
        );
    }

    static isUnblockable(card: UnitZoneCard | PilotZoneCard): boolean {
        return this.hasKeyword(card, 'High-Maneuver');
    }
}
