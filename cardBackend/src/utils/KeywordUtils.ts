// src/utils/KeywordUtils.ts

import type { UnitZoneCard, PilotZoneCard } from '../models/CardSystem';

export class KeywordUtils {
    static hasKeyword(card: UnitZoneCard | PilotZoneCard, keyword: string): boolean {
        const effects = (card as any).temporaryEffects;
        if (!Array.isArray(effects) || effects.length === 0) {
            return false;
        }

        return effects.some((effect: any) =>
            Array.isArray(effect.grantedKeywords) && effect.grantedKeywords.includes(keyword)
        );
    }
}

