/**
 * TypeScript class-based structure for player deck response data
 * Converts the mozDeckHelper.prepareDeckForPlayer response into a proper class
 */
export interface CardMapping {
    [uid: string]: string;
}
export declare class PlayerDeckDataResp {
    currentLeaderIdx: number;
    leader: string[];
    hand: string[];
    mainDeck: string[];
    leaderMapping: CardMapping;
    cardMapping: CardMapping;
    constructor(currentLeaderIdx?: number, leader?: string[], hand?: string[], mainDeck?: string[], leaderMapping?: CardMapping, cardMapping?: CardMapping);
    /**
     * Get current leader UID
     */
    getCurrentLeader(): string | null;
    /**
     * Get current leader card ID (mapped from UID)
     */
    getCurrentLeaderCardId(): string | null;
    /**
     * Draw a card from main deck to hand
     */
    drawCard(): string | null;
    /**
     * Play a card from hand (remove from hand)
     */
    playCardFromHand(cardUid: string): boolean;
    /**
     * Get hand size
     */
    getHandSize(): number;
    /**
     * Get deck size
     */
    getDeckSize(): number;
    /**
     * Advance to next leader
     */
    advanceToNextLeader(): boolean;
    /**
     * Get card ID from UID
     */
    getCardIdFromUid(cardUid: string): string | null;
    /**
     * Get leader card ID from UID
     */
    getLeaderCardIdFromUid(leaderUid: string): string | null;
    /**
     * Check if a card UID exists in hand
     */
    hasCardInHand(cardUid: string): boolean;
    /**
     * Get all cards in hand with their card IDs
     */
    getHandWithCardIds(): Array<{
        uid: string;
        cardId: string;
    }>;
    /**
     * Get all leaders with their card IDs
     */
    getLeaderListWithCardIds(): Array<{
        uid: string;
        cardId: string;
    }>;
    /**
     * Validate deck structure
     */
    validate(): {
        isValid: boolean;
        errors: string[];
    };
    /**
     * Get deck summary
     */
    getSummary(): any;
    /**
     * Clone the deck data
     */
    clone(): PlayerDeckDataResp;
    /**
     * Convert to JSON (legacy format for compatibility)
     */
    toJSON(): any;
    /**
     * Create from JSON (legacy format)
     */
    static fromJSON(data: any): PlayerDeckDataResp;
    /**
     * Create from mozDeckHelper response
     */
    static fromMozDeckHelperResponse(response: any): PlayerDeckDataResp;
    /**
     * Convert to string representation
     */
    toString(): string;
}
export declare function createPlayerDeckDataResp(currentLeaderIdx?: number, leader?: string[], hand?: string[], mainDeck?: string[], leaderMapping?: CardMapping, cardMapping?: CardMapping): PlayerDeckDataResp;
export declare function createPlayerDeckDataRespFromJSON(data: any): PlayerDeckDataResp;
export declare function createPlayerDeckDataRespFromMozHelper(response: any): PlayerDeckDataResp;
declare const _default: {
    PlayerDeckDataResp: typeof PlayerDeckDataResp;
    createPlayerDeckDataResp: typeof createPlayerDeckDataResp;
    createPlayerDeckDataRespFromJSON: typeof createPlayerDeckDataRespFromJSON;
    createPlayerDeckDataRespFromMozHelper: typeof createPlayerDeckDataRespFromMozHelper;
};
export default _default;
//# sourceMappingURL=PlayerDeckDataResp.d.ts.map