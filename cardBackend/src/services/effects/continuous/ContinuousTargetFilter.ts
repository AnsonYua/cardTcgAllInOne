import { KeywordUtils } from '../../../utils/KeywordUtils';

export class ContinuousTargetFilter {
    static apply(targets: any[], targetConfig: any, sourceCarduid?: string): any[] {
        if (!Array.isArray(targets) || targets.length === 0) {
            return [];
        }

        const filters = targetConfig?.filters && typeof targetConfig.filters === 'object' ? targetConfig.filters : null;
        if (!filters) {
            return targets;
        }

        return targets.filter(card => {
            if (filters.excludeSelf === true && sourceCarduid && card?.carduid === sourceCarduid) {
                return false;
            }

            const cardData = card?.cardData || {};
            const traits = Array.isArray(cardData?.traits) ? cardData.traits : [];

            const cardTypeFilter = typeof filters.cardType === 'string' ? filters.cardType.toLowerCase() : '';
            if (cardTypeFilter) {
                const actualType = typeof cardData?.cardType === 'string' ? String(cardData.cardType).toLowerCase() : '';
                if (actualType !== cardTypeFilter) {
                    return false;
                }
            }

            if (typeof filters.color === 'string') {
                const expectedColor = String(filters.color).toLowerCase();
                const actualColor = typeof cardData?.color === 'string' ? String(cardData.color).toLowerCase() : '';
                if (actualColor !== expectedColor) {
                    return false;
                }
            }

            if (typeof filters.colorNot === 'string') {
                const blockedColor = String(filters.colorNot).toLowerCase();
                const actualColor = typeof cardData?.color === 'string' ? String(cardData.color).toLowerCase() : '';
                if (actualColor === blockedColor) {
                    return false;
                }
            }

            if (typeof filters.status === 'string') {
                const expectedStatus = String(filters.status).toLowerCase();
                const actualStatus = card?.isRested ? 'rested' : 'active';
                if (actualStatus !== expectedStatus) {
                    return false;
                }
            }

            if (typeof (filters as any).isRested === 'boolean') {
                if ((card?.isRested === true) !== ((filters as any).isRested === true)) {
                    return false;
                }
            }

            const traitsFilter = Array.isArray(filters.traits)
                ? filters.traits.filter((t: unknown) => typeof t === 'string')
                : [];
            if (traitsFilter.length > 0 && !traitsFilter.every((trait: string) => traits.includes(trait))) {
                return false;
            }

            const traitsAll = Array.isArray((filters as any).traitsAll)
                ? (filters as any).traitsAll.filter((t: unknown) => typeof t === 'string')
                : [];
            if (traitsAll.length > 0 && !traitsAll.every((trait: string) => traits.includes(trait))) {
                return false;
            }

            const traitsAny = Array.isArray((filters as any).traitsAny)
                ? (filters as any).traitsAny.filter((t: unknown) => typeof t === 'string')
                : [];
            if (traitsAny.length > 0 && !traitsAny.some((trait: string) => traits.includes(trait))) {
                return false;
            }

            const keywords = Array.isArray((filters as any).keywords)
                ? (filters as any).keywords.filter((k: unknown) => typeof k === 'string' && k.length > 0)
                : [];
            if (keywords.length > 0) {
                for (const keyword of keywords) {
                    if (!KeywordUtils.hasKeyword(card as any, keyword)) {
                        return false;
                    }
                }
            }

            return true;
        });
    }
}
