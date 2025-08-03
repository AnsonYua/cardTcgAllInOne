import { DecksCollection, DecksCollectionStats } from '../models/DecksCollection';
import { PlayerDeck, PlayerDeckData } from '../models/PlayerDeck';
import { ValidationResult } from '../models/Deck';
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
    deckUIDMapping: Record<string, string>;
}
declare class DeckManager {
    private readonly cardsPath;
    private readonly leaderCardPath;
    private readonly decksPath;
    private readonly spCardPath;
    private decksCollection;
    private cards;
    private leaderCards;
    private decks;
    constructor();
    private initializeSync;
    getPlayerDecks(playerId: string): Promise<PlayerDeckWithUIDs>;
    getLeaderCards(cardId: string): any;
    saveDecks(): Promise<void>;
    getCardDetails(cardId: string): any;
    drawCards(playerId: string, count?: number): Promise<any[]>;
    /**
     * Get DecksCollection instance for object-oriented access
     * @returns The decks collection instance
     */
    getDecksCollection(): DecksCollection;
    /**
     * Get a specific player's deck collection
     * @param playerId - Player ID
     * @returns Player deck collection or null
     */
    getPlayerDeckCollection(playerId: string): PlayerDeck | null;
    /**
     * Get collection statistics
     * @returns Statistics about decks and players
     */
    getDecksStats(): DecksCollectionStats;
    /**
     * Validate entire deck collection
     * @returns Validation result with isValid boolean and errors array
     */
    validateDecksCollection(): ValidationResult;
    /**
     * Check if DeckManager is properly initialized
     * @returns True if initialized, false otherwise
     */
    isInitialized(): boolean;
    /**
     * Get initialization status for debugging
     * @returns Status object with details
     */
    getInitializationStatus(): InitializationStatus;
}
declare const _default: DeckManager;
export default _default;
//# sourceMappingURL=DeckManager.d.ts.map