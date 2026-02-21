import * as fs from 'fs';
import { resolveDataPath } from '../config/dataPaths';

export type TopDeckEntry = {
    id: string;
    qty: number;
};

export type TopDeckItem = {
    id: string;
    name: string;
    entries: TopDeckEntry[];
    cardCount: number;
};

const TOP_DECK_ENTRY_PATTERN = /^(\d+)x([A-Z]{2}\d{2}-\d{3})$/i;
const DEFAULT_TOP_DECK_PATH = resolveDataPath('topDeck.md');

const toDeckSlug = (name: string): string => {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
};

const toUniqueDeckId = (name: string, used: Set<string>, index: number): string => {
    const base = toDeckSlug(name) || `top-deck-${index}`;
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }
    used.add(candidate);
    return candidate;
};

export function parseTopDeckMarkdown(markdown: string): TopDeckItem[] {
    const lines = String(markdown || '').split(/\r?\n/);
    const decks: TopDeckItem[] = [];
    const usedDeckIds = new Set<string>();

    let currentName: string | null = null;
    let currentEntries = new Map<string, number>();

    const flush = () => {
        if (!currentName || currentEntries.size === 0) return;

        const entries: TopDeckEntry[] = [...currentEntries.entries()].map(([id, qty]) => ({ id, qty }));
        const cardCount = entries.reduce((sum, entry) => sum + entry.qty, 0);
        const id = toUniqueDeckId(currentName, usedDeckIds, decks.length + 1);

        decks.push({
            id,
            name: currentName,
            entries,
            cardCount,
        });
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line) {
            flush();
            currentName = null;
            currentEntries = new Map<string, number>();
            continue;
        }

        const entryMatch = line.match(TOP_DECK_ENTRY_PATTERN);
        if (entryMatch) {
            if (!currentName) continue;
            const qty = Number(entryMatch[1]);
            if (!Number.isFinite(qty) || qty <= 0) continue;
            const cardId = String(entryMatch[2]).toUpperCase();
            currentEntries.set(cardId, (currentEntries.get(cardId) || 0) + qty);
            continue;
        }

        if (!currentName) {
            currentName = line;
            currentEntries = new Map<string, number>();
            continue;
        }
        // Malformed line inside a deck block: ignore and keep collecting valid entries.
    }

    flush();
    return decks;
}

export async function loadTopDecksFromFile(filePath = DEFAULT_TOP_DECK_PATH): Promise<TopDeckItem[]> {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return parseTopDeckMarkdown(raw);
}
