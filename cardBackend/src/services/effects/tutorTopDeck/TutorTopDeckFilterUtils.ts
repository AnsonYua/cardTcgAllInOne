import { type CardData } from '../../../models/CardSystem';

export type TutorCardFilter = {
    cardType?: string;
    cardTypeAny?: string[];
    color?: string;
    traitsAny?: string[];
    nameContainsAny?: string[];
};

export function matchesSingleTutorFilter(cardData: CardData | null, filters: TutorCardFilter): boolean {
    if (!cardData) {
        return false;
    }

    const actualCardType = typeof cardData.cardType === 'string' ? cardData.cardType : '';
    const actualColor = typeof cardData.color === 'string' ? cardData.color : '';
    const actualTraits = Array.isArray(cardData.traits) ? cardData.traits : [];
    const actualName = typeof cardData.name === 'string' ? cardData.name.toLowerCase() : '';

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
    const matchesNameContains = nameContainsAny.length === 0
        ? true
        : nameContainsAny.some((fragment) => actualName.includes(fragment.toLowerCase()));

    return matchesTraits && matchesCardType && matchesCardTypeAny && matchesColor && matchesNameContains;
}
