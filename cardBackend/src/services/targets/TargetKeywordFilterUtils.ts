import type { UnitZoneCard, PilotZoneCard } from '../../models/CardSystem';
import type { GameEnvironment } from '../../models/GameEnvironment';
import type { TargetFilters } from '../EventQueue/interfaces/GameEvent';
import { KeywordUtils } from '../../utils/KeywordUtils';
import { isBlockerRedirectRule } from '../../utils/BlockerRuleUtils';
import { EffectConditionEvaluator } from '../conditions/EffectConditionEvaluator';
import { EffectSourceConditionEvaluator } from '../conditions/EffectSourceConditionEvaluator';

type KeywordFilterResult = {
    ok: boolean;
    reason?: string;
};

export class TargetKeywordFilterUtils {
    private static hasActiveBlocker(
        card: UnitZoneCard | PilotZoneCard,
        gameEnv?: GameEnvironment,
        cardOwnerPlayerId?: string
    ): boolean {
        if (KeywordUtils.getKeywordValue(card, 'Blocker') !== undefined) {
            return true;
        }

        const rules = Array.isArray((card as any)?.cardData?.effects?.rules)
            ? ((card as any).cardData.effects.rules as unknown[])
            : [];
        const blockerRules = rules.filter((rule) => isBlockerRedirectRule(rule));
        if (blockerRules.length === 0) {
            return false;
        }

        if (!gameEnv || !cardOwnerPlayerId) {
            return KeywordUtils.hasBlocker(card);
        }

        return blockerRules.some((rule) => {
            const normalizedRule = rule as any;
            const sourceMet = EffectSourceConditionEvaluator.sourceConditionsMet(
                normalizedRule,
                card as any,
                gameEnv,
                cardOwnerPlayerId
            );
            if (!sourceMet) {
                return false;
            }
            return EffectConditionEvaluator.validateEffectConditions(
                normalizedRule,
                gameEnv,
                cardOwnerPlayerId,
                card as any
            );
        });
    }

    static validateKeywordFilters(
        card: UnitZoneCard | PilotZoneCard,
        filters: TargetFilters,
        context?: {
            gameEnv?: GameEnvironment;
            cardOwnerPlayerId?: string;
        }
    ): KeywordFilterResult {
        const keywords = Array.isArray(filters.keywords)
            ? filters.keywords.filter((kw): kw is string => typeof kw === 'string' && kw.length > 0)
            : [];

        if (keywords.length === 0) {
            return { ok: true };
        }

        for (const keyword of keywords) {
            if (keyword === 'Blocker') {
                if (!this.hasActiveBlocker(card, context?.gameEnv, context?.cardOwnerPlayerId)) {
                    return { ok: false, reason: `keywords: missing ${keyword}` };
                }
                continue;
            }

            return { ok: false, reason: `keywords: unsupported keyword ${keyword}` };
        }

        return { ok: true };
    }
}
