import { Deck, DeckData, ValidationResult } from './Deck';
export interface PlayerDeckData {
    activeDeck?: string | null;
    decks?: Record<string, DeckData>;
}
export interface PlayerDeckStats {
    playerId: string;
    activeDeck: string | null;
    totalDecks: number;
    deckList: Array<{
        id: string | null;
        name: string;
        totalCards: number;
        totalLeaders: number;
        cardTypes: Record<string, number>;
    }>;
}
export interface UIDMapping {
    cardUID: string[];
    leaderUID: string[];
}
/**
 * Represents a player's deck collection with Java-like clear field declarations
 */
export declare class PlayerDeck {
    readonly playerId: string;
    activeDeck: string | null;
    decks: Record<string, Deck>;
    deckUIDMapping: Record<string, string[]>;
    leaderUIMapping: Record<string, string[]>;
    constructor(playerId: string, data?: PlayerDeckData);
    /**
     * Get the currently active deck
     * @returns Active deck instance or null if not found
     */
    getActiveDeck(): Deck | null;
    /**
     * Set the active deck by ID
     * @param deckId - Deck ID to activate
     * @returns True if deck was found and activated
     */
    setActiveDeck(deckId: string): boolean;
    /**
     * Add a new deck to the collection
     * @param deck - Deck instance to add
     */
    addDeck(deck: Deck): void;
    /**
     * Remove a deck from the collection
     * @param deckId - Deck ID to remove
     * @returns True if deck was found and removed
     */
    removeDeck(deckId: string): boolean;
    /**
     * Get all deck IDs
     * @returns Array of deck IDs
     */
    getDeckIds(): string[];
    /**
     * Get all deck instances
     * @returns Array of Deck instances
     */
    getAllDecks(): Deck[];
    /**
     * Check if deck exists
     * @param deckId - Deck ID to check
     * @returns True if deck exists
     */
    hasDeck(deckId: string): boolean;
    /**
     * Generate UIDs for active deck cards (for gameplay compatibility)
     * @returns UID mapping with card and leader UIDs
     */
    generateActiveDecksUIDs(): UIDMapping;
    /**
     * Get player deck statistics
     * @returns Statistics about player's deck collection
     */
    getStats(): PlayerDeckStats;
    /**
     * Validate all decks in the collection
     * @returns Validation result with isValid boolean and errors array
     */
    validate(): ValidationResult;
    /**
     * Convert to JSON format for storage (compatible with existing format)
     * @returns Plain object representation
     */
    toJSON(): PlayerDeckData & {
        playerId: string;
    };
    /**
     * Create PlayerDeck instance from JSON data
     * @param playerId - Player ID
     * @param jsonData - Plain object data
     * @returns New PlayerDeck instance
     */
    static fromJSON(playerId: string, jsonData: PlayerDeckData): PlayerDeck;
}
export default PlayerDeck;
//# sourceMappingURL=PlayerDeck.d.ts.map