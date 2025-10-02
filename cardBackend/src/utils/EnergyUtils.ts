// src/utils/EnergyUtils.ts
// Shared helpers for card energy requirements and categorisation

export interface EnergyRequirement {
    level: number;
    cost: number;
}

export function normalizeNumericValue(value: unknown): number {
    if (typeof value === 'number' && !isNaN(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Number(value);
        return isNaN(parsed) ? 0 : parsed;
    }

    return 0;
}

export function getEnergyRequirement(cardData: any): EnergyRequirement {
    if (!cardData) {
        return { level: 0, cost: 0 };
    }

    return {
        level: normalizeNumericValue(cardData.level),
        cost: normalizeNumericValue(cardData.cost)
    };
}

export function isEnergyCard(cardData: any): boolean {
    const cardType = typeof cardData?.cardType === 'string' ? cardData.cardType.toLowerCase() : '';
    return cardType === 'energy';
}

