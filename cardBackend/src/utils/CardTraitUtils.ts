// src/utils/CardTraitUtils.ts
// Small helper to avoid duplicating trait matching logic across condition evaluators.

export class CardTraitUtils {
    static hasTrait(cardData: any, trait: string): boolean {
        if (!cardData || typeof trait !== 'string' || trait.length === 0) {
            return false;
        }

        const traits = Array.isArray(cardData.traits) ? cardData.traits : [];
        return traits.includes(trait);
    }

    static hasAnyTrait(cardData: any, traitsAny: string[]): boolean {
        if (!cardData || !Array.isArray(traitsAny) || traitsAny.length === 0) {
            return false;
        }

        const traits = Array.isArray(cardData.traits) ? cardData.traits : [];
        return traitsAny.some(trait => typeof trait === 'string' && traits.includes(trait));
    }
}

