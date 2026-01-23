import type { TargetFilters } from '../EventQueue/interfaces/GameEvent';

type FilterResult = {
    ok: boolean;
    reason?: string;
};

export class TargetFilterUtils {
    static validateTraitFilters(
        cardTraits: string[],
        filters: TargetFilters
    ): FilterResult {
        const normalizedTraits = Array.isArray(cardTraits) ? cardTraits : [];

        if (Array.isArray(filters.traits) && filters.traits.length > 0) {
            const matches = filters.traits.some(requiredTrait => normalizedTraits.includes(requiredTrait));
            if (!matches) {
                return {
                    ok: false,
                    reason: `traits: required ${filters.traits}, has ${normalizedTraits}`
                };
            }
        }

        if (Array.isArray(filters.traitsAny) && filters.traitsAny.length > 0) {
            const matches = filters.traitsAny.some(requiredTrait => normalizedTraits.includes(requiredTrait));
            if (!matches) {
                return {
                    ok: false,
                    reason: `traitsAny: required any of ${filters.traitsAny}, has ${normalizedTraits}`
                };
            }
        }

        if (Array.isArray(filters.traitsAll) && filters.traitsAll.length > 0) {
            const matches = filters.traitsAll.every(requiredTrait => normalizedTraits.includes(requiredTrait));
            if (!matches) {
                return {
                    ok: false,
                    reason: `traitsAll: required all of ${filters.traitsAll}, has ${normalizedTraits}`
                };
            }
        }

        return { ok: true };
    }

    static validateColorFilter(
        cardColor: string | undefined,
        filters: TargetFilters
    ): FilterResult {
        const normalizedCardColor = typeof cardColor === 'string' ? cardColor.toLowerCase() : '';
        const colorFilter = filters.color;

        if (typeof colorFilter === 'string' && colorFilter.length > 0) {
            const desired = colorFilter.toLowerCase();
            if (normalizedCardColor !== desired) {
                return { ok: false, reason: `color: expected ${colorFilter}, got ${cardColor || 'none'}` };
            }
            return { ok: true };
        }

        if (Array.isArray(colorFilter) && colorFilter.length > 0) {
            const desiredColors = colorFilter
                .filter((c: unknown): c is string => typeof c === 'string' && c.length > 0)
                .map(c => c.toLowerCase());
            if (!normalizedCardColor || !desiredColors.includes(normalizedCardColor)) {
                return { ok: false, reason: `color: expected one of ${desiredColors}, got ${cardColor || 'none'}` };
            }
            return { ok: true };
        }

        return { ok: true };
    }
}
