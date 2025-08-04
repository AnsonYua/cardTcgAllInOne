/**
 * TypeScript version of mozDeckHelper with proper type safety
 * Handles deck preparation, shuffling, and card drawing operations
 */
import { PlayerDeckDataResp } from '../models/PlayerDeckDataResp';
export interface DeckManagerInterface {
    getPlayerDecks(playerId: string): Promise<PlayerDeckWithUIDs>;
    getCardDetails(cardId: string): any;
}
export interface PlayerDeckWithUIDs {
    playerId: string;
    activeDeck: string;
    decks: Record<string, DeckData>;
    leaderUIDMapping: Record<string, string>;
    deckUIDMapping: Record<string, string>;
}
export interface DeckData {
    cardUID: string[];
    leaderUID: string[];
}
export interface DrawResult {
    drawnCards: string[];
    mainDeck: string[];
}
export interface DrawToHandResult {
    hand: string[];
    mainDeck: string[];
}
export interface CardData {
    cardType?: string;
    traits?: string[];
    [key: string]: any;
}
export interface LeaderData {
    zoneCompatibility?: Record<string, string[]>;
    [key: string]: any;
}
export interface FieldArea {
    cardDetails: CardData[];
    [key: string]: any;
}
declare class MozDeckLogic {
    private deckManager;
    private cardInfoUtils;
    constructor();
    /**
     * Prepare deck for a player with shuffled cards and initial hand
     * @param playerId - Player ID to prepare deck for
     * @returns PlayerDeckDataResp instance with prepared deck data
     */
    prepareDeckForPlayer(playerId: string): Promise<PlayerDeckDataResp>;
    /**
     * Reshuffle deck for a player and draw new hand
     * @param playerId - Player ID to reshuffle for
     * @returns PlayerDeckDataResp instance with new hand and shuffled deck
     */
    reshuffleForPlayer(playerId: string): Promise<PlayerDeckDataResp>;
    /**
     * Draw cards to hand from main deck
     * @param hand - Current hand (will be modified)
     * @param mainDeckOriginal - Main deck to draw from (will be modified)
     * @param count - Number of cards to draw (default: 1)
     * @returns Object with updated hand and main deck
     */
    drawToHand(hand: string[], mainDeckOriginal: string[], count?: number): DrawToHandResult;
    /**
     * Draw cards from main deck
     * @param mainDeck - Main deck array (will be modified)
     * @param count - Number of cards to draw (default: 1)
     * @returns Object with drawn cards and updated main deck
     */
    drawCards(mainDeck: string[], count?: number): DrawResult;
    /**
     * Shuffle main deck cards
     * @param decks - Deck data containing cardUID array
     * @returns Shuffled array of card UIDs
     */
    shuffleMainDeck(decks: DeckData): string[];
    /**
     * Shuffle leader deck cards and take first 5
     * @param decks - Deck data containing leaderUID array
     * @returns Shuffled array of first 5 leader UIDs
     */
    shuffleLeaderDeck(decks: DeckData): string[];
    /**
     * Enhanced Fisher-Yates shuffle algorithm with cryptographic randomness
     * Performs multiple shuffle passes with cryptographically secure random numbers
     * @param array - Array to shuffle (will be modified)
     * @returns Shuffled array
     */
    shuffle<T>(array: T[]): T[];
    /**
     * Get card details by card ID
     * @param cardId - Card ID to get details for
     * @returns Card details or null if not found
     */
    getDeckCardDetails(cardId: string): any;
    /**
     * Check if there are any character cards in the field area
     * @param fieldArea - Array of field area objects
     * @returns True if any character cards found, false otherwise
     */
    monsterInField(fieldArea: FieldArea[]): boolean;
    /**
     * Get field index by field name
     * @param field - Field name (top, left, right, help, sp)
     * @returns Field index or -1 if not found
     */
    getFieldIdx(field: string): number;
    /**
     * Check if card is eligible for a specific field based on leader compatibility
     * @param card - Card data to check
     * @param leader - Leader data with zone compatibility
     * @param area - Area/zone to check eligibility for
     * @returns True if card is eligible for the field, false otherwise
     */
    isCardEligibleForField(card: CardData, leader: LeaderData, area: string): boolean;
}
declare const mozDeckLogicInstance: MozDeckLogic;
export default mozDeckLogicInstance;
export { MozDeckLogic };
//# sourceMappingURL=mozDeckHelper.d.ts.map