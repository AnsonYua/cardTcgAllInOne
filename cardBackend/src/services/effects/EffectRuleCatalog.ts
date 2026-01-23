// src/services/effects/EffectRuleCatalog.ts
// Centralized helper for discovering and normalizing effect definitions on card data

import { EffectDefinition } from '../EventQueue/interfaces/GameEvent';
import { CardDataResolver } from './CardDataResolver';
import { normalizeEffectRule } from '../../utils/EffectNormalizationUtils';

export interface EffectCollectionOptions {
    /** Trigger name to match against card effect rules */
    trigger: string;
    /** Fallback effect identifier when a rule omits effectId */
    fallbackEffectId: string;
    /** Whether an action field must be present on the rule */
    requireAction?: boolean;
    /** Override expected trigger list when a rule can map to multiple strings */
    expectedTriggers?: string[];
    /** Default scope/type/count overrides passed into normalizeEffectRule */
    defaultTargetScope?: string;
    defaultTargetType?: string;
    defaultTargetCount?: number;
    /** Additional normalizeEffectRule options */
    includePairedMetadata?: {
        pairedSlot: string;
        sourceCarduid: string;
    };
    /** Optional predicate executed before normalization */
    preFilter?: (rawRule: Record<string, unknown>) => boolean;
}

export class EffectRuleCatalog {
    /**
     * Collect and normalize effect rules for a specific trigger from the supplied card data.
     * Returns an empty array when no matching rules are found or normalization fails.
     */
    static collectEffects(cardData: any, options: EffectCollectionOptions): EffectDefinition[] {
        const resolvedCardData = CardDataResolver.resolveWithEffectRules(cardData);

        const rules = Array.isArray(resolvedCardData?.effects?.rules)
            ? (resolvedCardData.effects.rules as unknown[])
            : [];

        if (rules.length === 0) {
            return [];
        }

        const {
            trigger,
            fallbackEffectId,
            expectedTriggers,
            requireAction,
            defaultTargetScope,
            defaultTargetType,
            defaultTargetCount,
            includePairedMetadata,
            preFilter
        } = options;

        const matchTriggers = expectedTriggers && expectedTriggers.length > 0
            ? expectedTriggers
            : [trigger];

        const normalizedEffects: EffectDefinition[] = [];

        for (const rule of rules) {
            if (!rule || typeof rule !== 'object') {
                continue;
            }

            const castRule = rule as Record<string, unknown>;
            if (preFilter && !preFilter(castRule)) {
                continue;
            }

            const normalized = normalizeEffectRule(castRule, {
                fallbackEffectId,
                expectedTriggers: matchTriggers,
                defaultTrigger: trigger,
                requireAction,
                defaultTargetScope,
                defaultTargetType,
                defaultTargetCount,
                includePairedMetadata
            });

            if (normalized) {
                normalizedEffects.push(normalized);
            }
        }

        return normalizedEffects;
    }
}
