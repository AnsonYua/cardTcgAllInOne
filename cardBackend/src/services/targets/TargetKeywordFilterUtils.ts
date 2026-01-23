import type { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import type { TargetFilters } from '../EventQueue/interfaces/GameEvent';
import { KeywordUtils } from '../../utils/KeywordUtils';

type KeywordFilterResult = {
    ok: boolean;
    reason?: string;
};

export class TargetKeywordFilterUtils {
    static validateKeywordFilters(
        card: UnitZoneCard | PilotZoneCard,
        filters: TargetFilters
    ): KeywordFilterResult {
        const keywords = Array.isArray(filters.keywords)
            ? filters.keywords.filter((kw): kw is string => typeof kw === 'string' && kw.length > 0)
            : [];

        if (keywords.length === 0) {
            return { ok: true };
        }

        for (const keyword of keywords) {
            if (keyword === 'Blocker') {
                if (!KeywordUtils.hasBlocker(card)) {
                    return { ok: false, reason: `keywords: missing ${keyword}` };
                }
                continue;
            }

            return { ok: false, reason: `keywords: unsupported keyword ${keyword}` };
        }

        return { ok: true };
    }
}
