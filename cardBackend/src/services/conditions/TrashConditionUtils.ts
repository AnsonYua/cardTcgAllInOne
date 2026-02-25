import { CardDatabaseManager } from '../../models/CardSystem';
import type { GameEnvironment } from '../../models/GameEnvironment';
import { validateComparisonFilter } from '../../utils/EffectNormalizationUtils';
import { getEffectiveCardNames, hasNameIncludes } from '../../utils/CardNameMatcher';

export interface TrashCountOptions {
    traitsAny?: string[];
    cardType?: string;
    cardTypes?: string[];
    nameIncludes?: string;
    excludeCarduid?: string;
    uniqueNames?: boolean;
}

export class TrashConditionUtils {
    static countMatching(
        gameEnv: GameEnvironment,
        playerId: string,
        options: TrashCountOptions
    ): number | null {
        const player = gameEnv.getPlayer(playerId) || gameEnv.players[playerId];
        const trash = player?.zones?.trashArea;
        if (!Array.isArray(trash)) {
            return null;
        }

        const traitsAny = Array.isArray(options.traitsAny)
            ? options.traitsAny.filter((t): t is string => typeof t === 'string')
            : [];
        const cardType = typeof options.cardType === 'string' ? options.cardType : '';
        const cardTypes = Array.isArray(options.cardTypes)
            ? options.cardTypes.filter((t): t is string => typeof t === 'string' && t.length > 0)
            : [];
        const nameIncludes = typeof options.nameIncludes === 'string'
            ? options.nameIncludes.toLowerCase()
            : '';
        const excludeCarduid = typeof options.excludeCarduid === 'string' ? options.excludeCarduid : '';
        const uniqueNames = options.uniqueNames === true;
        const uniqueSet = new Set<string>();

        return trash.reduce((total: number, card: any) => {
            if (excludeCarduid && card?.carduid === excludeCarduid) {
                return total;
            }

            const cardData = card?.cardData
                || (typeof card?.cardId === 'string' ? CardDatabaseManager.getCardDetails(card.cardId) : null);
            if (!cardData) {
                return total;
            }

            if (cardType) {
                const actualType = typeof cardData.cardType === 'string' ? cardData.cardType : '';
                if (actualType !== cardType) {
                    return total;
                }
            }
            if (cardTypes.length > 0) {
                const actualType = typeof cardData.cardType === 'string' ? cardData.cardType : '';
                if (!cardTypes.includes(actualType)) {
                    return total;
                }
            }

            if (traitsAny.length > 0) {
                const traits = Array.isArray(cardData.traits) ? cardData.traits : [];
                if (!traitsAny.some((trait: string) => traits.includes(trait))) {
                    return total;
                }
            }

            if (nameIncludes) {
                if (!hasNameIncludes({
                    cardData,
                    name: card?.name,
                    nameAliases: card?.nameAliases
                }, nameIncludes)) {
                    return total;
                }
            }

            if (uniqueNames) {
                const primaryName = getEffectiveCardNames({
                    cardData,
                    name: card?.name,
                    nameAliases: card?.nameAliases
                })[0] || '';
                const name = primaryName.trim().toLowerCase();
                if (!name || uniqueSet.has(name)) {
                    return total;
                }
                uniqueSet.add(name);
            }

            return total + 1;
        }, 0);
    }

    static evaluateCount(count: number, value: unknown): boolean {
        if (typeof value === 'number') {
            return count === value;
        }
        if (typeof value === 'string') {
            return validateComparisonFilter(count, value);
        }
        return true;
    }
}
