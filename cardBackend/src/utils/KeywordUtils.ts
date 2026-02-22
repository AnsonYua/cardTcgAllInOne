// src/utils/KeywordUtils.ts

import type { UnitZoneCard, PilotZoneCard } from '../models/CardSystem';
import { isBlockerRedirectRule } from './BlockerRuleUtils';

export class KeywordUtils {
    static hasKeyword(card: UnitZoneCard | PilotZoneCard, keyword: string): boolean {
        const normalized = typeof keyword === 'string' ? keyword.trim() : '';
        if (!normalized) {
            return false;
        }

        if (this.hasKeywordFromTemporary(card, normalized)) {
            return true;
        }

        if (normalized === 'Blocker') {
            return this.hasBlockerRule(card);
        }

        if (normalized === 'Repair') {
            return this.hasRepairRule(card);
        }

        if (normalized === 'Breach') {
            return this.hasBreachRule(card);
        }

        return false;
    }

    static getKeywordValue(card: UnitZoneCard | PilotZoneCard, keyword: string): number | undefined {
        const effects = (card as any).temporaryEffects;
        const normalized = typeof keyword === 'string' ? keyword.trim() : '';
        if (!normalized) return undefined;

        let found: number | undefined;

        if (Array.isArray(effects) && effects.length > 0) {
            for (const effect of effects) {
                if (normalized === 'Breach' && typeof effect?.breachValue === 'number' && effect.breachValue > 0) {
                    found = typeof found === 'number' ? Math.max(found, effect.breachValue) : effect.breachValue;
                }

                const values = effect?.keywordValues && typeof effect.keywordValues === 'object' ? effect.keywordValues : null;
                const value = values && typeof values[normalized] === 'number' ? values[normalized] : undefined;
                if (typeof value === 'number') {
                    found = typeof found === 'number' ? Math.max(found, value) : value;
                    continue;
                }

                const keywords = Array.isArray(effect?.grantedKeywords) ? effect.grantedKeywords : [];
                if (keywords.includes(normalized)) {
                    found = typeof found === 'number' ? Math.max(found, 1) : 1;
                }
            }
        }

        return found;
    }

    static hasBlocker(card: UnitZoneCard | PilotZoneCard): boolean {
        if (this.hasKeywordFromTemporary(card, 'Blocker')) {
            return true;
        }

        return this.hasBlockerRule(card);
    }

    static isUnblockable(card: UnitZoneCard | PilotZoneCard): boolean {
        return this.hasKeyword(card, 'High-Maneuver');
    }

    private static hasKeywordFromTemporary(card: UnitZoneCard | PilotZoneCard, keyword: string): boolean {
        const effects = (card as any).temporaryEffects;
        if (!Array.isArray(effects) || effects.length === 0) {
            return false;
        }

        return effects.some((effect: any) => {
            if (keyword === 'Breach' && typeof effect?.breachValue === 'number' && effect.breachValue > 0) {
                return true;
            }
            const keywords = Array.isArray(effect?.grantedKeywords) ? effect.grantedKeywords : [];
            if (keywords.includes(keyword)) {
                return true;
            }
            const values = effect?.keywordValues && typeof effect.keywordValues === 'object' ? effect.keywordValues : null;
            return Boolean(values && typeof values[keyword] === 'number' && values[keyword] > 0);
        });
    }

    private static hasBlockerRule(card: UnitZoneCard | PilotZoneCard): boolean {
        const rules = (card as any)?.cardData?.effects?.rules;
        if (!Array.isArray(rules) || rules.length === 0) {
            return false;
        }

        return rules.some(rule => isBlockerRedirectRule(rule));
    }

    private static hasRepairRule(card: UnitZoneCard | PilotZoneCard): boolean {
        const rules = (card as any)?.cardData?.effects?.rules;
        if (!Array.isArray(rules) || rules.length === 0) {
            return false;
        }

        return rules.some((rule: any) => {
            const trigger = typeof rule?.trigger === 'string' ? rule.trigger : '';
            const action = typeof rule?.action === 'string' ? rule.action : '';
            const value = typeof rule?.parameters?.value === 'number' ? rule.parameters.value : 0;
            const conditions = Array.isArray(rule?.conditions) ? rule.conditions : [];
            return trigger === 'END_OF_TURN' && action === 'heal' && value > 0 && conditions.length === 0;
        });
    }

    private static hasBreachRule(card: UnitZoneCard | PilotZoneCard): boolean {
        const rules = (card as any)?.cardData?.effects?.rules;
        if (!Array.isArray(rules) || rules.length === 0) {
            return false;
        }

        return rules.some((rule: any) => {
            const trigger = typeof rule?.trigger === 'string' ? rule.trigger : '';
            const action = typeof rule?.action === 'string' ? rule.action : '';
            const value = typeof rule?.parameters?.value === 'number' ? rule.parameters.value : 0;
            const conditions = Array.isArray(rule?.conditions) ? rule.conditions : [];
            return trigger === 'BATTLE_DESTROY' && action === 'damageShield' && value > 0 && conditions.length === 0;
        });
    }
}
