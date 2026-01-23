// src/services/effects/CardDataResolver.ts
// Centralized helpers for resolving full card data (including effects rules) when game state stores minimized cardData.

import { CardDatabaseManager } from '../../models/CardSystem';

export class CardDataResolver {
    static resolveWithEffectRules(cardData: any): any {
        if (!cardData || typeof cardData !== 'object') {
            return cardData;
        }

        const hasRules = Array.isArray((cardData as any).effects?.rules) && (cardData as any).effects.rules.length > 0;
        if (hasRules) {
            return cardData;
        }

        const cardId = typeof (cardData as any).id === 'string' ? ((cardData as any).id as string) : null;
        if (!cardId) {
            return cardData;
        }

        return CardDatabaseManager.getCardDetails(cardId) || cardData;
    }
}

