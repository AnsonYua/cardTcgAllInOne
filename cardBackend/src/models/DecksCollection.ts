// src/models/DecksCollection.ts

import { Deck, DeckData, ValidationResult } from './Deck';
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
export class DecksCollection {
    public readonly metadata: DecksCollectionMetadata;
    
    // Player deck collections with proper TypeScript typing
    public playerDecks: Record<string, PlayerDeck>;

    constructor(data: DecksCollectionData = {}) {
        this.metadata = data.metadata || {
            version: '1.1',
            lastUpdated: new Date().toISOString().split('T')[0],
            description: 'Player deck configurations'
        };
        
        // Player deck collections (TypeScript typed)
        this.playerDecks = {};
        
        // Initialize from data
        this.initializeFromData(data);
    }

    /**
     * Initialize collection from JSON data
     * @param data - Raw JSON data
     */
    private initializeFromData(data: DecksCollectionData): void {
        // Load player decks
        if (data.playerDecks && typeof data.playerDecks === 'object') {
            Object.entries(data.playerDecks).forEach(([playerId, playerData]) => {
                this.playerDecks[playerId] = PlayerDeck.fromJSON(playerId, playerData);
            });
        }
    }

    /**
     * Get player deck collection
     * @param playerId - Player ID
     * @returns Player deck collection or null
     */
    getPlayerDecks(playerId: string): PlayerDeck | null {
        return this.playerDecks[playerId] || null;
    }

    /**
     * Create or update player deck collection
     * @param playerId - Player ID
     * @param playerDeck - Player deck collection
     */
    setPlayerDecks(playerId: string, playerDeck: PlayerDeck): void {
        if (!(playerDeck instanceof PlayerDeck)) {
            throw new Error('Expected PlayerDeck instance');
        }
        
        this.playerDecks[playerId] = playerDeck;
    }

    /**
     * Get all player IDs
     * @returns Array of player IDs
     */
    getAllPlayerIds(): string[] {
        return Object.keys(this.playerDecks);
    }

    /**
     * Check if player exists
     * @param playerId - Player ID to check
     * @returns True if player exists
     */
    hasPlayer(playerId: string): boolean {
        return !!this.playerDecks[playerId];
    }

    /**
     * Remove player and their decks
     * @param playerId - Player ID to remove
     * @returns True if player was removed
     */
    removePlayer(playerId: string): boolean {
        if (!this.playerDecks[playerId]) {
            return false;
        }
        
        delete this.playerDecks[playerId];
        return true;
    }

    /**
     * Get collection statistics
     * @returns Statistics about the entire collection
     */
    getStats(): DecksCollectionStats {
        return {
            metadata: this.metadata,
            playerDecks: {
                count: Object.keys(this.playerDecks).length,
                players: Object.values(this.playerDecks).map(playerDeck => playerDeck.getStats())
            }
        };
    }

    /**
     * Validate entire collection
     * @returns Validation result with isValid boolean and errors array
     */
    validate(): ValidationResult {
        const errors: string[] = [];
        
        // Validate player decks
        Object.entries(this.playerDecks).forEach(([playerId, playerDeck]) => {
            const playerValidation = playerDeck.validate();
            if (!playerValidation.isValid) {
                errors.push(`Player ${playerId}: ${playerValidation.errors.join(', ')}`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Convert to JSON format for storage (compatible with existing format)
     * @returns Plain object representation
     */
    toJSON(): DecksCollectionData {
        const playerDecksObj: Record<string, PlayerDeckData> = {};
        Object.entries(this.playerDecks).forEach(([playerId, playerDeck]) => {
            playerDecksObj[playerId] = playerDeck.toJSON();
        });
        
        return {
            metadata: this.metadata,
            playerDecks: playerDecksObj
        };
    }

    /**
     * Create DecksCollection instance from JSON data
     * @param jsonData - Plain object data
     * @returns New DecksCollection instance
     */
    static fromJSON(jsonData: DecksCollectionData): DecksCollection {
        return new DecksCollection(jsonData);
    }
}

export default DecksCollection;