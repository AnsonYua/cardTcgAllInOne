import { ValidationResult } from './Deck';
import { PlayerDeck, PlayerDeckData } from './PlayerDeck';
export interface DecksCollectionMetadata {
    version: string;
    lastUpdated: string;
    description: string;
}
export interface DecksCollectionData {
    metadata?: DecksCollectionMetadata;
    playerDecks?: Record<string, PlayerDeckData>;
}
export interface DecksCollectionStats {
    metadata: DecksCollectionMetadata;
    playerDecks: {
        count: number;
        players: Array<{
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
        }>;
    };
}
/**
 * Represents the player deck collection with TypeScript type safety
 */
export declare class DecksCollection {
    readonly metadata: DecksCollectionMetadata;
    playerDecks: Record<string, PlayerDeck>;
    constructor(data?: DecksCollectionData);
    /**
     * Initialize collection from JSON data
     * @param data - Raw JSON data
     */
    private initializeFromData;
    /**
     * Get player deck collection
     * @param playerId - Player ID
     * @returns Player deck collection or null
     */
    getPlayerDecks(playerId: string): PlayerDeck | null;
    /**
     * Create or update player deck collection
     * @param playerId - Player ID
     * @param playerDeck - Player deck collection
     */
    setPlayerDecks(playerId: string, playerDeck: PlayerDeck): void;
    /**
     * Get all player IDs
     * @returns Array of player IDs
     */
    getAllPlayerIds(): string[];
    /**
     * Check if player exists
     * @param playerId - Player ID to check
     * @returns True if player exists
     */
    hasPlayer(playerId: string): boolean;
    /**
     * Remove player and their decks
     * @param playerId - Player ID to remove
     * @returns True if player was removed
     */
    removePlayer(playerId: string): boolean;
    /**
     * Get collection statistics
     * @returns Statistics about the entire collection
     */
    getStats(): DecksCollectionStats;
    /**
     * Validate entire collection
     * @returns Validation result with isValid boolean and errors array
     */
    validate(): ValidationResult;
    /**
     * Convert to JSON format for storage (compatible with existing format)
     * @returns Plain object representation
     */
    toJSON(): DecksCollectionData;
    /**
     * Create DecksCollection instance from JSON data
     * @param jsonData - Plain object data
     * @returns New DecksCollection instance
     */
    static fromJSON(jsonData: DecksCollectionData): DecksCollection;
}
export default DecksCollection;
//# sourceMappingURL=DecksCollection.d.ts.map