// src/models/Deck.ts

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
export class Deck {
    public readonly id: string | null;
    public readonly name: string;
    public readonly cards: string[];
    public readonly leader: string[];
    public readonly maxCards: number;
    public readonly minCards: number;
    
    // Runtime properties for gameplay
    public cardUID: string[];
    public leaderUID: string[];

    constructor(data: DeckData = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.cards = Array.isArray(data.cards) ? [...data.cards] : [];
        this.leader = Array.isArray(data.leader) ? [...data.leader] : [];
        this.maxCards = data.maxCards || 30;
        this.minCards = data.minCards || 20;
        
        // Runtime properties for gameplay
        this.cardUID = [];
        this.leaderUID = [];
    }

    /**
     * Validate deck structure and requirements
     * @returns Validation result with isValid boolean and errors array
     */
    validate(): ValidationResult {
        const errors: string[] = [];
        
        if (!this.id) {
            errors.push('Deck ID is required');
        }
        
        if (!this.name) {
            errors.push('Deck name is required');
        }
        
        if (this.cards.length < this.minCards) {
            errors.push(`Deck must have at least ${this.minCards} cards, has ${this.cards.length}`);
        }
        
        if (this.cards.length > this.maxCards) {
            errors.push(`Deck cannot have more than ${this.maxCards} cards, has ${this.cards.length}`);
        }
        
        if (this.leader.length === 0) {
            errors.push('Deck must have at least one leader card');
        }
        
        // Check for duplicate card IDs
        const duplicateCards = this.findDuplicates(this.cards);
        if (duplicateCards.length > 0) {
            errors.push(`Duplicate cards found: ${duplicateCards.join(', ')}`);
        }
        
        const duplicateLeaders = this.findDuplicates(this.leader);
        if (duplicateLeaders.length > 0) {
            errors.push(`Duplicate leaders found: ${duplicateLeaders.join(', ')}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Find duplicate items in array
     * @param items - Array of items to check
     * @returns Array of duplicate items
     */
    private findDuplicates(items: string[]): string[] {
        const seen = new Set<string>();
        const duplicates = new Set<string>();
        
        for (const item of items) {
            if (seen.has(item)) {
                duplicates.add(item);
            } else {
                seen.add(item);
            }
        }
        
        return Array.from(duplicates);
    }

    /**
     * Get deck statistics
     * @returns Statistics object with counts and breakdowns
     */
    getStats(): DeckStats {
        // Simple card type categorization based on ID patterns
        const cardTypes: Record<string, number> = {
            character: 0,
            help: 0,
            special: 0
        };
        
        this.cards.forEach(cardId => {
            if (cardId.startsWith('c-')) {
                cardTypes.character++;
            } else if (cardId.startsWith('h-')) {
                cardTypes.help++;
            } else if (cardId.startsWith('sp-')) {
                cardTypes.special++;
            }
        });
        
        return {
            id: this.id,
            name: this.name,
            totalCards: this.cards.length,
            totalLeaders: this.leader.length,
            cardTypes
        };
    }

    /**
     * Create a deep copy of this deck
     * @returns New Deck instance with copied data
     */
    clone(): Deck {
        return new Deck({
            id: this.id,
            name: this.name,
            cards: [...this.cards],
            leader: [...this.leader],
            maxCards: this.maxCards,
            minCards: this.minCards
        });
    }

    /**
     * Convert to JSON format for storage
     * @returns Plain object representation
     */
    toJSON(): DeckData {
        return {
            id: this.id,
            name: this.name,
            cards: [...this.cards],
            leader: [...this.leader],
            maxCards: this.maxCards,
            minCards: this.minCards
        };
    }

    /**
     * Create Deck instance from JSON data
     * @param jsonData - Plain object data
     * @returns New Deck instance
     */
    static fromJSON(jsonData: DeckData): Deck {
        return new Deck(jsonData);
    }
}

export default Deck;