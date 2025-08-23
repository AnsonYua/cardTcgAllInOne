// src/services/DeckManager.ts

import * as fs from 'fs';
import * as path from 'path';
import { DecksCollection, DecksCollectionData, DecksCollectionStats } from '../models/DecksCollection';
import { PlayerDeck, PlayerDeckData } from '../models/PlayerDeck';
import { Deck, ValidationResult } from '../models/Deck';

export interface CardData {
    [cardId: string]: any;
}

export interface CardsCollection {
    cards: CardData;
    combos?: any;
}

export interface LeaderCardsCollection {
    leaders: CardData;
}

export interface InitializationStatus {
    initialized: boolean;
    cardsLoaded: boolean;
    cardsCount: number;
    leaderCardsLoaded: boolean;
    decksLoaded: boolean;
    decksCollectionLoaded: boolean;
    playersCount: number;
}

export interface PlayerDeckWithUIDs extends PlayerDeckData {
    playerId: string;
    decks: Record<string, any>;
    leaderUIDMapping: Record<string, string>;
    deckUIDMapping:  Record<string, string>;
}

class DeckManager {
    private readonly cardsPath: string;
    private readonly leaderCardPath: string;
    private readonly decksPath: string;
    private readonly spCardPath: string;
    
    // TypeScript typed collections
    private decksCollection!: DecksCollection;
    private cards!: CardsCollection;
    private leaderCards!: LeaderCardsCollection;
    private decks!: DecksCollectionData; // Backward compatibility

    constructor() {
        // Paths that work both in development (ts-node) and production (compiled)
        const isCompiled = __dirname.includes('dist');
        const basePath = isCompiled ? path.join(__dirname, '../../../src/data') : path.join(__dirname, '../data');
        
        this.cardsPath = path.join(basePath, 'characterCards.json');
        this.leaderCardPath = path.join(basePath, 'leaderCards.json');
        this.decksPath = path.join(basePath, 'decks.json');
        this.spCardPath = path.join(basePath, 'utilityCards.json');
        
        // Initialize synchronously in constructor
        this.initializeSync();
    }

    private initializeSync(): void {
        try {
            console.log('Loading DeckManager synchronously...');
            
            // Read all files synchronously
            const cardsData = fs.readFileSync(this.cardsPath, 'utf8');
            const leaderCardsData = fs.readFileSync(this.leaderCardPath, 'utf8');
            const decksData = fs.readFileSync(this.decksPath, 'utf8');
            const utilityCardsData = fs.readFileSync(this.spCardPath, 'utf8');

            // Parse all JSON data with type safety
            const characterCards: any = JSON.parse(cardsData);
            const leaderCards: any = JSON.parse(leaderCardsData);
            const utilityCards: any = JSON.parse(utilityCardsData);
            const decksRawData: DecksCollectionData = JSON.parse(decksData);
            
            // Create DecksCollection instance (object-oriented approach)
            this.decksCollection = DecksCollection.fromJSON(decksRawData);
            
            // Maintain backward compatibility with old this.decks access
            this.decks = decksRawData;
            
            // Store separate collections for specific access
            this.leaderCards = leaderCards;
            
            // Initialize combined cards collection
            this.cards = { cards: {} };
            
            // Merge all card types into unified collection
            if (characterCards && characterCards.cards) {
                this.cards.cards = { ...this.cards.cards, ...characterCards.cards };
            }
            
            if (leaderCards && leaderCards.leaders) {
                this.cards.cards = { ...this.cards.cards, ...leaderCards.leaders };
            }
            
            if (utilityCards && utilityCards.cards) {
                this.cards.cards = { ...this.cards.cards, ...utilityCards.cards };
            }
            
            // Add metadata if available
            if (characterCards.combos) {
                this.cards.combos = characterCards.combos;
            }
            
            console.log(`DeckManager initialized synchronously with ${Object.keys(this.cards.cards).length} total cards`);
            console.log(`DecksCollection loaded with ${this.decksCollection.getAllPlayerIds().length} players`);
            
        } catch (error) {
            console.error('Error initializing DeckManager synchronously:', error);
            // Initialize with empty structure to prevent null errors
            this.cards = { cards: {} };
            this.leaderCards = { leaders: {} };
            this.decks = { playerDecks: {} };
            this.decksCollection = new DecksCollection();
            throw error;
        }
    }

    public async getPlayerDecks(playerId: string): Promise<PlayerDeckWithUIDs> {
        // Use object-oriented approach
        const playerDeckCollection = this.decksCollection.getPlayerDecks(playerId);
        if (!playerDeckCollection) {
            throw new Error('Player Deck not found');
        }

        // Generate UIDs for active deck (for gameplay compatibility)
        const uidMappings = playerDeckCollection.generateActiveDecksUIDs();
        // Return data in format compatible with existing API
        const playerData = playerDeckCollection.toJSON() as PlayerDeckWithUIDs;
        
        // Add the generated UIDs to the active deck for compatibility
        const activeDeck = playerDeckCollection.getActiveDeck();
        if (activeDeck && playerData.decks[playerData.activeDeck!]) {
            playerData.decks[playerData.activeDeck!].cardUID = Object.keys(uidMappings.cardUID);
            playerData.decks[playerData.activeDeck!].leaderUID = Object.keys(uidMappings.leaderUID);
        }
        
        // Add compatibility fields that mozDeckHelper expects (properly typed)
        // Convert dictionaries to arrays for existing code compatibility
        playerData.leaderUIDMapping = uidMappings.leaderUID;
        playerData.deckUIDMapping = uidMappings.cardUID;
        console.log("debug playerData222", JSON.stringify(playerData.deckUIDMapping));
        
        return playerData;
    }

    public getLeaderCards(cardId: string): any {
        const leaderCards = this.leaderCards.leaders[cardId];
        return leaderCards;
    }

    public async saveDecks(): Promise<void> {
        const fsPromises = fs.promises;
        
        // Use object-oriented approach - save from DecksCollection
        const dataToSave = this.decksCollection.toJSON();
        await fsPromises.writeFile(this.decksPath, JSON.stringify(dataToSave, null, 2));
        
        // Update backward compatibility reference
        this.decks = dataToSave;
    }

    public getCardDetails(cardId: string): any {
        const cardDetails = this.cards.cards[cardId];
        if (!cardDetails) {
            console.warn(`Card not found: ${cardId}. Available cards:`, Object.keys(this.cards.cards).slice(0, 10));
        }
        
        return cardDetails;
    }

    public async drawCards(playerId: string, count: number = 1): Promise<any[]> {
        const playerData = await this.getPlayerDecks(playerId);
        const activeDeck = playerData.decks[playerData.activeDeck!];
        
        if (!activeDeck) {
            throw new Error('No active deck found');
        }

        // Simulate drawing cards
        const drawnCards: any[] = [];
        const remainingCards = [...activeDeck.cards];
        
        for (let i = 0; i < count && remainingCards.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * remainingCards.length);
            const cardId = remainingCards.splice(randomIndex, 1)[0];
            drawnCards.push(this.getCardDetails(cardId));
        }

        return drawnCards;
    }

    // ============ NEW OBJECT-ORIENTED METHODS ============
    
    /**
     * Update decks collection from a new JSON file path
     * @param newDecksPath - Path to the new decks.json file
     * @param options - Configuration options
     * @param options.validateOnly - If true, only validates without updating (default: false)
     * @param options.skipValidation - If true, skips full validation for faster updates (default: false)
     * @param options.throwOnValidationError - If true, throws error on validation failure (default: true when updating)
     * @returns Validation result if validateOnly is true, otherwise void
     * @throws Error if file cannot be read, parsed, or validation fails (when throwOnValidationError is true)
     */
    public updateDecksFromPath(
        newDecksPath: string, 
        options: {
            validateOnly?: boolean;
            skipValidation?: boolean;
            throwOnValidationError?: boolean;
        } = {}
    ): ValidationResult | void {
        const {
            validateOnly = false,
            skipValidation = false,
            throwOnValidationError = !validateOnly
        } = options;

        try {
            console.log(`${validateOnly ? 'Validating' : 'Updating'} decks from new path: ${newDecksPath}`);
            
            // Validate that the file exists and is readable
            if (!fs.existsSync(newDecksPath)) {
                throw new Error(`Decks file does not exist: ${newDecksPath}`);
            }
            
            // Read and parse the new decks data
            const newDecksData = fs.readFileSync(newDecksPath, 'utf8');
            const parsedDecksData: DecksCollectionData = JSON.parse(newDecksData);
            
            // Validate the structure (basic check)
            if (!parsedDecksData.playerDecks || typeof parsedDecksData.playerDecks !== 'object') {
                throw new Error('Invalid decks file structure: missing or invalid playerDecks');
            }
            
            // Create temporary DecksCollection for validation
            const tempDecksCollection = DecksCollection.fromJSON(parsedDecksData);
            let validationResult: ValidationResult | null = null;
            
            // Perform validation unless explicitly skipped
            if (!skipValidation) {
                validationResult = tempDecksCollection.validate();
                
                if (validateOnly) {
                    console.log(`📋 Validation result for ${newDecksPath}:`, validationResult);
                    return validationResult;
                }
                
                // Check validation result before updating (if throwOnValidationError is true)
                if (!validationResult.isValid && throwOnValidationError) {
                    throw new Error(`Decks validation failed: ${validationResult.errors.join(', ')}`);
                }
            }
            
            // Only proceed with update if not in validateOnly mode
            if (!validateOnly) {
                // Update the DecksCollection instance
                this.decksCollection = tempDecksCollection;
                
                // Update backward compatibility reference
                this.decks = parsedDecksData;
                
                console.log(`✅ Successfully updated decks from ${newDecksPath}`);
                console.log(`📊 New collection stats: ${this.decksCollection.getAllPlayerIds().length} players loaded`);
                
                if (validationResult) {
                    console.log(`🔍 Validation: ${validationResult.isValid ? 'PASSED' : 'WARNING - FAILED'}`);
                } else if (skipValidation) {
                    console.log(`⚠️ Validation was skipped for faster update`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Error ${validateOnly ? 'validating' : 'updating'} decks from path ${newDecksPath}:`, error);
            throw new Error(`Failed to ${validateOnly ? 'validate' : 'update'} decks from ${newDecksPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Get the current decks file path
     * @returns Current decks.json file path
     */
    public getCurrentDecksPath(): string {
        return this.decksPath;
    }
    
    /**
     * Get DecksCollection instance for object-oriented access
     * @returns The decks collection instance
     */
    public getDecksCollection(): DecksCollection {
        return this.decksCollection;
    }

    /**
     * Get a specific player's deck collection
     * @param playerId - Player ID
     * @returns Player deck collection or null
     */
    public getPlayerDeckCollection(playerId: string): PlayerDeck | null {
        return this.decksCollection.getPlayerDecks(playerId);
    }

    /**
     * Get collection statistics
     * @returns Statistics about decks and players
     */
    public getDecksStats(): DecksCollectionStats {
        return this.decksCollection.getStats();
    }

    /**
     * Validate entire deck collection
     * @returns Validation result with isValid boolean and errors array
     */
    public validateDecksCollection(): ValidationResult {
        return this.decksCollection.validate();
    }

    // ============ LEGACY COMPATIBILITY METHODS ============

    /**
     * Check if DeckManager is properly initialized
     * @returns True if initialized, false otherwise
     */
    public isInitialized(): boolean {
        return !!(this.cards && this.cards.cards && this.leaderCards && this.decks && this.decksCollection);
    }

    /**
     * Get initialization status for debugging
     * @returns Status object with details
     */
    public getInitializationStatus(): InitializationStatus {
        return {
            initialized: this.isInitialized(),
            cardsLoaded: !!(this.cards && this.cards.cards),
            cardsCount: this.cards?.cards ? Object.keys(this.cards.cards).length : 0,
            leaderCardsLoaded: !!this.leaderCards,
            decksLoaded: !!this.decks,
            decksCollectionLoaded: !!this.decksCollection,
            playersCount: this.decksCollection ? this.decksCollection.getAllPlayerIds().length : 0
        };
    }
}

// Export singleton instance
export default new DeckManager();