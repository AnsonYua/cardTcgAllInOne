import { CardDatabaseManager } from '../models/CardSystem';
import { deckSubmissionService } from './DeckSubmissionService';
import { collectTokenCardIdsFromCardData } from './cards/TokenCardDiscovery';

type BuildCombinedDeckResourcesParams = {
    gameId: string;
    playerIds: string[];
    aiPlayerIds?: string[];
    toCardResourcePath: (cardId: string, folderHint?: string) => string | null;
};

type BuildCombinedDeckResourcesResult = {
    resources: string[];
    pending: boolean;
    missingPlayers: string[];
};

class DeckResourceService {
    buildCombinedDeckResources(params: BuildCombinedDeckResourcesParams): BuildCombinedDeckResourcesResult {
        const { gameId, playerIds, aiPlayerIds = [], toCardResourcePath } = params;
        const normalizedPlayerIds = playerIds.filter((id) => typeof id === 'string' && id.length > 0);
        if (normalizedPlayerIds.length === 0) {
            return {
                resources: [],
                pending: true,
                missingPlayers: [],
            };
        }

        const { cardIds: combinedCardIds, folderHints, missingPlayers } =
            deckSubmissionService.getCombinedSubmissionCardIds(gameId, normalizedPlayerIds);

        if (missingPlayers.length > 0) {
            const nonAiMissing = missingPlayers.filter((playerId) => !aiPlayerIds.includes(playerId));
            if (nonAiMissing.length > 0) {
                return {
                    resources: [],
                    pending: true,
                    missingPlayers: nonAiMissing,
                };
            }

            const fallbackResources = deckSubmissionService.getDefaultDeckResourcePaths();
            for (const resourcePath of fallbackResources) {
                if (typeof resourcePath !== 'string') continue;
                const [folder, cardId] = resourcePath.split('/');
                if (!folder || !cardId) continue;
                combinedCardIds.add(cardId.toUpperCase());
                if (/^T-\d+$/i.test(cardId)) {
                    folderHints.set(cardId.toUpperCase(), folder.toLowerCase());
                }
            }
        }

        const tokenIds = new Set<string>();
        for (const cardId of combinedCardIds) {
            if (/^T-\d+$/i.test(cardId)) continue;
            const cardData = CardDatabaseManager.getCardDetails(cardId);
            if (!cardData) continue;
            const tokens = collectTokenCardIdsFromCardData(cardData);
            for (const tokenId of tokens) tokenIds.add(tokenId);
        }

        const resources = new Set<string>();
        for (const cardId of combinedCardIds) {
            const isToken = /^T-\d+$/i.test(cardId);
            const folderHint = isToken ? folderHints.get(cardId) ?? CardDatabaseManager.getSetFolderForCardId(cardId) ?? undefined : undefined;
            const resourcePath = toCardResourcePath(cardId, folderHint);
            if (resourcePath) resources.add(resourcePath);
        }

        for (const tokenId of tokenIds) {
            const folderHint = folderHints.get(tokenId) ?? CardDatabaseManager.getSetFolderForCardId(tokenId) ?? undefined;
            const resourcePath = toCardResourcePath(tokenId, folderHint);
            if (resourcePath) resources.add(resourcePath);
        }

        return {
            resources: Array.from(resources),
            pending: false,
            missingPlayers: [],
        };
    }
}

export const deckResourceService = new DeckResourceService();
