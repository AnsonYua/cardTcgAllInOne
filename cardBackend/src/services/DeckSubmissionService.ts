import * as fs from 'fs';
import { GCG_DECKS_PATH } from '../config/dataPaths';
import { CardDatabaseManager } from '../models/CardSystem';

export type DeckEntry = {
    id: string;
    qty: number;
    setId?: string;
    name?: string;
};

type CombinedCardIdsResult = {
    cardIds: Set<string>;
    folderHints: Map<string, string>;
    missingPlayers: string[];
};

class DeckSubmissionService {
    private readonly deckSubmissionsByGameId: Map<string, Map<string, DeckEntry[]>> = new Map();

    normalizeDeckEntries(rawDeck: any): DeckEntry[] {
        if (!Array.isArray(rawDeck)) return [];
        const entries: DeckEntry[] = [];
        for (const entry of rawDeck) {
            if (!entry || typeof entry !== 'object') continue;
            const rawId = typeof entry.id === 'string' ? entry.id.trim() : '';
            if (!rawId) continue;
            const qty = Number(entry.qty);
            if (!Number.isFinite(qty) || qty <= 0) continue;
            const setId = typeof entry.setId === 'string' && entry.setId.trim().length > 0 ? entry.setId.trim().toLowerCase() : undefined;
            const name = typeof entry.name === 'string' && entry.name.trim().length > 0 ? entry.name.trim() : undefined;
            entries.push({ id: rawId.toUpperCase(), qty, setId, name });
        }
        return entries;
    }

    submitDeck(gameId: string, playerId: string, entries: DeckEntry[]): void {
        let gameMap = this.deckSubmissionsByGameId.get(gameId);
        if (!gameMap) {
            gameMap = new Map<string, DeckEntry[]>();
            this.deckSubmissionsByGameId.set(gameId, gameMap);
        }
        gameMap.set(playerId, entries);
    }

    getPlayerDeckEntries(gameId: string, playerId: string): DeckEntry[] {
        return this.deckSubmissionsByGameId.get(gameId)?.get(playerId) ?? [];
    }

    getMissingPlayers(gameId: string, playerIds: string[]): string[] {
        const gameMap = this.deckSubmissionsByGameId.get(gameId);
        if (!gameMap) return [...playerIds];
        return playerIds.filter((playerId) => {
            const entries = gameMap.get(playerId);
            return !entries || entries.length === 0;
        });
    }

    getCombinedSubmissionCardIds(gameId: string, playerIds: string[]): CombinedCardIdsResult {
        const cardIds = new Set<string>();
        const folderHints = new Map<string, string>();
        const missingPlayers: string[] = [];
        const gameMap = this.deckSubmissionsByGameId.get(gameId);

        for (const playerId of playerIds) {
            const entries = gameMap?.get(playerId);
            if (!entries || entries.length === 0) {
                missingPlayers.push(playerId);
                continue;
            }
            for (const entry of entries) {
                const cardId = entry.id.trim().toUpperCase();
                if (!cardId) continue;
                cardIds.add(cardId);
                if (entry.setId && /^T-\d+$/i.test(cardId)) {
                    folderHints.set(cardId, entry.setId.toLowerCase());
                }
            }
        }

        return { cardIds, folderHints, missingPlayers };
    }

    getPlayerDeckResourcePaths(gameId: string, playerId: string): string[] {
        const entries = this.getPlayerDeckEntries(gameId, playerId);
        return this.toResourcePaths(entries);
    }

    getDefaultDeckResourcePaths(): string[] {
        try {
            if (!fs.existsSync(GCG_DECKS_PATH)) return [];
            const raw = fs.readFileSync(GCG_DECKS_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed?.decks?.deck001?.cards) ? parsed.decks.deck001.cards : [];
        } catch {
            return [];
        }
    }

    private toSetFolderFromCardId(cardId: string): string | null {
        if (typeof cardId !== 'string' || cardId.length === 0) return null;
        const match = cardId.match(/^(ST|GD)(\d{2})-/i);
        if (!match) return null;
        return `${match[1].toLowerCase()}${match[2]}`;
    }

    private toCardResourcePath(cardId: string, folderHint?: string): string | null {
        if (typeof cardId !== 'string' || cardId.length === 0) return null;

        const setFolder = this.toSetFolderFromCardId(cardId);
        if (setFolder) {
            return `${setFolder}/${cardId}`;
        }

        if (/^T-\d+$/i.test(cardId)) {
            const hinted = typeof folderHint === 'string' && folderHint.length > 0 ? folderHint : undefined;
            const inferred = hinted ?? CardDatabaseManager.getSetFolderForCardId(cardId) ?? undefined;
            if (!inferred) return null;
            return `${inferred}/${cardId}`;
        }

        return null;
    }

    private toResourcePaths(entries: DeckEntry[]): string[] {
        const resourcePaths: string[] = [];
        for (const entry of entries) {
            const cardId = entry.id.trim().toUpperCase();
            if (!cardId) continue;
            const qty = Math.max(1, Math.floor(Number(entry.qty) || 0));
            const resourcePath = this.toCardResourcePath(cardId, entry.setId);
            if (!resourcePath) continue;
            for (let i = 0; i < qty; i += 1) {
                resourcePaths.push(resourcePath);
            }
        }
        return resourcePaths;
    }
}

export const deckSubmissionService = new DeckSubmissionService();
