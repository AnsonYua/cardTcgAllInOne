export interface DeckData {
    id?: string | null;
    name?: string;
    cards?: string[];
    leader?: string[];
    maxCards?: number;
    minCards?: number;
}
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}
export interface DeckStats {
    id: string | null;
    name: string;
    totalCards: number;
    totalLeaders: number;
    cardTypes: Record<string, number>;
}
/**
 * Represents a single deck configuration with clear field mapping
 */
export declare class Deck {
    readonly id: string | null;
    readonly name: string;
    readonly cards: string[];
    readonly leader: string[];
    readonly maxCards: number;
    readonly minCards: number;
    cardUID: string[];
    leaderUID: string[];
    constructor(data?: DeckData);
    /**
     * Validate deck structure and requirements
     * @returns Validation result with isValid boolean and errors array
     */
    validate(): ValidationResult;
    /**
     * Find duplicate items in array
     * @param items - Array of items to check
     * @returns Array of duplicate items
     */
    private findDuplicates;
    /**
     * Get deck statistics
     * @returns Statistics object with counts and breakdowns
     */
    getStats(): DeckStats;
    /**
     * Create a deep copy of this deck
     * @returns New Deck instance with copied data
     */
    clone(): Deck;
    /**
     * Convert to JSON format for storage
     * @returns Plain object representation
     */
    toJSON(): DeckData;
    /**
     * Create Deck instance from JSON data
     * @param jsonData - Plain object data
     * @returns New Deck instance
     */
    static fromJSON(jsonData: DeckData): Deck;
}
export default Deck;
//# sourceMappingURL=Deck.d.ts.map