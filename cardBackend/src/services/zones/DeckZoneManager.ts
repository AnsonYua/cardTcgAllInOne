// src/services/zones/DeckZoneManager.ts
// Centralized helpers for deck (mainDeck) mutations.

export type DeckBottomOrder = 'preserve' | 'random';

function shuffleInPlace<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
}

export class DeckZoneManager {
    static peekTop(deck: string[], count: number): string[] {
        if (!Array.isArray(deck) || count <= 0) {
            return [];
        }
        return deck.slice(0, Math.min(count, deck.length));
    }

    static extractSpecific(deck: string[], carduids: string[]): string[] {
        if (!Array.isArray(deck) || !Array.isArray(carduids) || carduids.length === 0) {
            return [];
        }

        const extracted: string[] = [];
        for (const uid of carduids) {
            const index = deck.indexOf(uid);
            if (index >= 0) {
                const [removed] = deck.splice(index, 1);
                if (removed) {
                    extracted.push(removed);
                }
            }
        }

        return extracted;
    }

    static moveToBottom(deck: string[], carduids: string[], order: DeckBottomOrder = 'preserve'): string[] {
        const extracted = this.extractSpecific(deck, carduids);
        if (order === 'random') {
            shuffleInPlace(extracted);
        }
        deck.push(...extracted);
        return extracted;
    }

    static shuffle(deck: string[]): void {
        if (!Array.isArray(deck) || deck.length <= 1) {
            return;
        }
        shuffleInPlace(deck);
    }
}
