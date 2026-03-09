import { type CardData } from '../../../models/CardSystem';
import { getEffectiveCardNames } from '../../../utils/CardNameMatcher';
import { validateComparisonFilter } from '../../../utils/EffectNormalizationUtils';

export type TopDeckSelectionFilter = {
    cardType?: string;
    cardTypeAny?: string[];
    color?: string;
    traitsAny?: string[];
    nameContainsAny?: string[];
    level?: string;
};

export function matchesTopDeckSelectionFilter(
    cardData: CardData | null,
    filters: TopDeckSelectionFilter,
    nameAliases?: string[]
): boolean {
    if (!cardData) {
        return false;
    }

    const actualCardType = typeof cardData.cardType === 'string' ? cardData.cardType : '';
    const actualColor = typeof cardData.color === 'string' ? cardData.color : '';
    const actualTraits = Array.isArray(cardData.traits) ? cardData.traits : [];
    const actualLevel = typeof cardData.level === 'number' ? cardData.level : 0;
    const effectiveNames = getEffectiveCardNames({ cardData, nameAliases }).map((name) => name.toLowerCase());

    const traitsAny = Array.isArray(filters.traitsAny)
        ? filters.traitsAny.filter((entry): entry is string => typeof entry === 'string')
        : [];
    const cardTypeAny = Array.isArray(filters.cardTypeAny)
        ? filters.cardTypeAny.filter((entry): entry is string => typeof entry === 'string')
        : [];
    const nameContainsAny = Array.isArray(filters.nameContainsAny)
        ? filters.nameContainsAny.filter((entry): entry is string => typeof entry === 'string')
        : [];

    const matchesTraits = traitsAny.length === 0 ? true : traitsAny.some((trait) => actualTraits.includes(trait));
    const matchesCardType = !filters.cardType || actualCardType === filters.cardType;
    const matchesCardTypeAny = cardTypeAny.length === 0 ? true : cardTypeAny.includes(actualCardType);
    const matchesColor = !filters.color || actualColor === filters.color;
    const matchesLevel = !filters.level || validateComparisonFilter(actualLevel, filters.level);
    const matchesNameContains = nameContainsAny.length === 0
        ? true
        : nameContainsAny.some((fragment) => {
            const needle = fragment.toLowerCase();
            return effectiveNames.some((name) => name.includes(needle));
        });

    return matchesTraits && matchesCardType && matchesCardTypeAny && matchesColor && matchesLevel && matchesNameContains;
}
