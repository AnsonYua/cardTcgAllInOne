/**
 * TypeScript version of CardInfoUtils with proper type safety
 * Provides utilities for retrieving card information and leader data
 */
export interface GameEnvPlayers {
    [playerId: string]: PlayerData;
}
export interface PlayerData {
    id: string;
    name?: string;
    deck: PlayerDeckData;
    [key: string]: any;
}
export interface PlayerDeckData {
    currentLeaderIdx: number;
    leader: string[];
    hand: string[];
    mainDeck: string[];
    leaderMapping: Record<string, string>;
    cardMapping: Record<string, string>;
}
export interface GameEnvironment {
    players: GameEnvPlayers;
    [key: string]: any;
}
export interface CardData {
    id: string;
    name: string;
    cardType: string;
    gameType?: string;
    power?: number;
    traits?: string[];
    rarity?: string;
    effects?: CardEffects;
    [key: string]: any;
}
export interface LeaderCardData extends CardData {
    initialPoint: number;
    level: number;
    zoneCompatibility: ZoneCompatibility;
}
export interface ZoneCompatibility {
    top: string[];
    left: string[];
    right: string[];
}
export interface CardEffects {
    description?: string;
    rules?: EffectRule[];
}
export interface EffectRule {
    id: string;
    type: string;
    trigger: EffectTrigger;
    target: EffectTarget;
    effect: Effect;
}
export interface EffectTrigger {
    event: string;
    conditions?: any[];
}
export interface EffectTarget {
    owner: string;
    zones: string[] | string;
    filters?: EffectFilter[];
}
export interface EffectFilter {
    type: string;
    value?: string;
    values?: string[];
}
export interface Effect {
    type: string;
    value: number;
}
export interface DeckManagerInterface {
    getLeaderCards(cardId: string): LeaderCardData | null;
    getCardDetails(cardId: string): CardData | null;
}
declare class CardInfoUtils {
    private deckManager;
    constructor();
    /**
     * Get current leader card for a player
     * @param gameEnv - Game environment with unified structure
     * @param playerId - Player ID to get leader for
     * @returns Leader card data or throws error
     */
    getCurrentLeader(gameEnv: GameEnvironment, playerId: string): LeaderCardData;
    /**
     * Get card details by card ID
     * @param cardId - Card ID to retrieve
     * @returns Card data or null if not found
     */
    getCardDetails(cardId: string): CardData | null;
    /**
     * Get leader card details by card ID
     * @param cardId - Leader card ID to retrieve
     * @returns Leader card data or null if not found
     */
    getLeaderCards(cardId: string): LeaderCardData | null;
    /**
     * Validate that a card exists
     * @param cardId - Card ID to validate
     * @returns True if card exists, false otherwise
     */
    cardExists(cardId: string): boolean;
    /**
     * Validate that a leader card exists
     * @param cardId - Leader card ID to validate
     * @returns True if leader card exists, false otherwise
     */
    leaderCardExists(cardId: string): boolean;
    /**
     * Get card power value
     * @param cardId - Card ID to get power for
     * @returns Card power or 0 if not found or no power
     */
    getCardPower(cardId: string): number;
    /**
     * Get card game type
     * @param cardId - Card ID to get game type for
     * @returns Card game type or empty string if not found
     */
    getCardGameType(cardId: string): string;
    /**
     * Get card traits
     * @param cardId - Card ID to get traits for
     * @returns Card traits array or empty array if not found
     */
    getCardTraits(cardId: string): string[];
    /**
     * Check if card has specific trait
     * @param cardId - Card ID to check
     * @param trait - Trait to check for
     * @returns True if card has the trait, false otherwise
     */
    hasCardTrait(cardId: string, trait: string): boolean;
    /**
     * Get leader zone compatibility
     * @param leaderId - Leader card ID
     * @param zone - Zone to check compatibility for
     * @returns Array of compatible game types or empty array
     */
    getLeaderZoneCompatibility(leaderId: string, zone: string): string[];
    /**
     * Check if card is compatible with leader's zone
     * @param cardId - Character card ID
     * @param leaderId - Leader card ID
     * @param zone - Zone to check compatibility for
     * @returns True if compatible, false otherwise
     */
    isCardCompatibleWithZone(cardId: string, leaderId: string, zone: string): boolean;
    /**
     * Get leader initial points
     * @param leaderId - Leader card ID
     * @returns Leader initial points or 0 if not found
     */
    getLeaderInitialPoints(leaderId: string): number;
}
declare const cardInfoUtilsInstance: CardInfoUtils;
export default cardInfoUtilsInstance;
export { CardInfoUtils };
//# sourceMappingURL=CardInfoUtils.d.ts.map