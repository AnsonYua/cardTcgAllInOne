// src/models/PlayerDeckDataResp.ts

/**
 * TypeScript class-based structure for player deck response data
 * Converts the mozDeckHelper.prepareDeckForPlayer response into a proper class
 */

import DeckManager from '../services/DeckManager';
import mozDeckHelperInstance from '../mozGame/mozDeckHelper';

export interface CardMapping {
    [uid: string]: string; // UID to cardId mapping
}

export class PlayerDeckDataResp {
    public currentLeaderIdx: number;
    public leader: string[]; // Array of leader UIDs
    public hand: string[]; // Array of card UIDs in hand
    public mainDeck: string[]; // Array of card UIDs in deck
    public leaderMapping: CardMapping; // UID to cardId mapping for leaders
    public cardMapping: CardMapping; // UID to cardId mapping for cards
    public handDetails: any[]; // Array of detailed card objects for hand cards

    constructor(
        currentLeaderIdx: number = 0,
        leader: string[] = [],
        hand: string[] = [],
        mainDeck: string[] = [],
        leaderMapping: CardMapping = {},
        cardMapping: CardMapping = {},
        handDetails: any[] = []
    ) {
        this.currentLeaderIdx = currentLeaderIdx;
        this.leader = leader;
        this.hand = hand;
        this.mainDeck = mainDeck;
        this.leaderMapping = leaderMapping;
        this.cardMapping = cardMapping;
        this.handDetails = handDetails;
    }

    // ============ DECK METHODS ============

    /**
     * Get current leader UID
     */
    public getCurrentLeader(): string | null {
        if (this.leader.length > this.currentLeaderIdx) {
            return this.leader[this.currentLeaderIdx];
        }
        return null;
    }

    /**
     * Get current leader card ID (mapped from UID)
     */
    public getCurrentLeaderCardId(): string | null {
        const leaderUid = this.getCurrentLeader();
        if (leaderUid && this.leaderMapping[leaderUid]) {
            return this.leaderMapping[leaderUid];
        }
        return null;
    }

        /**
     * Get current leader card ID (mapped from UID)
     */
    public getCurrentLeaderCardUId(): string | null {
        const leaderUid = this.getCurrentLeader();
        return leaderUid;
    }

    /**
     * Draw a card from main deck to hand
     */
    public drawCard(): string | null {
        if (this.mainDeck.length > 0) {
            const cardUid = this.mainDeck.shift()!;
            this.hand.push(cardUid);
            // Auto-populate handDetails after hand changes
            this.populateHandDetails();
            return cardUid;
        }
        return null;
    }

    /**
     * Draw multiple cards from main deck to hand
     * @param count - Number of cards to draw (default: 1)
     * @returns Array of drawn card UIDs
     */
    public drawCards(count: number = 1): string[] {
        const drawnCards: string[] = [];
        
        if (count > this.mainDeck.length) {
            throw new Error(`Cannot draw ${count} cards. Only ${this.mainDeck.length} cards remaining.`);
        }
        
        for (let i = 0; i < count && this.mainDeck.length > 0; i++) {
            const cardUid = this.mainDeck.shift()!;
            this.hand.push(cardUid);
            drawnCards.push(cardUid);
        }
        
        // Auto-populate handDetails after hand changes
        this.populateHandDetails();
        
        return drawnCards;
    }

    /**
     * Draw multiple cards from main deck without adding to hand (utility method)
     * Used for initial deck setup where hand is managed separately
     * @param count - Number of cards to draw (default: 1)
     * @returns Object with drawn cards and remaining main deck
     */
    public drawCardsFromDeck(count: number = 1): { drawnCards: string[], mainDeck: string[] } {
        if (count > this.mainDeck.length) {
            throw new Error(`Cannot draw ${count} cards. Only ${this.mainDeck.length} cards remaining.`);
        }
        
        const drawnCards = this.mainDeck.splice(0, count);
        return {
            drawnCards,
            mainDeck: [...this.mainDeck] // Return a copy to avoid mutation
        };
    }

    /**
     * Play a card from hand (remove from hand)
     */
    public playCardFromHand(cardUid: string): boolean {
        const index = this.hand.indexOf(cardUid);
        if (index !== -1) {
            this.hand.splice(index, 1);
            // Also remove from handDetails
            this.removeCardFromHandDetails(cardUid);
            return true;
        }
        return false;
    }

    /**
     * Get hand size
     */
    public getHandSize(): number {
        return this.hand.length;
    }

    /**
     * Get deck size
     */
    public getDeckSize(): number {
        return this.mainDeck.length;
    }

    /**
     * Advance to next leader
     */
    public advanceToNextLeader(): boolean {
        if (this.currentLeaderIdx + 1 < this.leader.length) {
            this.currentLeaderIdx++;
            return true;
        }
        return false;
    }

    /**
     * Get card ID from UID
     */
    public getCardIdFromUid(cardUid: string): string | null {
        return this.cardMapping[cardUid] || null;
    }

    /**
     * Get leader card ID from UID
     */
    public getLeaderCardIdFromUid(leaderUid: string): string | null {
        return this.leaderMapping[leaderUid] || null;
    }

    /**
     * Check if a card UID exists in hand
     */
    public hasCardInHand(cardUid: string): boolean {
        return this.hand.includes(cardUid);
    }

    /**
     * Get all cards in hand with their card IDs
     */
    public getHandWithCardIds(): Array<{uid: string, cardId: string}> {
        return this.hand.map(uid => ({
            uid,
            cardId: this.getCardIdFromUid(uid) || uid
        }));
    }

    /**
     * Get all leaders with their card IDs
     */
    public getLeaderListWithCardIds(): Array<{uid: string, cardId: string}> {
        return this.leader.map(uid => ({
            uid,
            cardId: this.getLeaderCardIdFromUid(uid) || uid
        }));
    }

    /**
     * Get hand details array
     */
    public getHandDetails(): any[] {
        return this.handDetails;
    }

    /**
     * Set hand details array
     */
    public setHandDetails(handDetails: any[]): void {
        this.handDetails = handDetails;
    }

    /**
     * Add card details to hand details
     */
    public addCardToHandDetails(cardDetails: any): void {
        this.handDetails.push(cardDetails);
    }

    /**
     * Remove card details from hand details by UID
     */
    public removeCardFromHandDetails(cardUid: string): boolean {
        const index = this.handDetails.findIndex(card => card.uid === cardUid || card.id === cardUid);
        if (index !== -1) {
            this.handDetails.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Update hand details to match hand array
     */
    public syncHandDetails(cardDataLookup: (uid: string) => any): void {
        this.handDetails = this.hand.map(uid => {
            const cardData = cardDataLookup(uid);
            return cardData ? { uid, ...cardData } : { uid };
        });
    }

    /**
     * Auto-populate handDetails using DeckManager
     * Extracts cardId from UID and looks up full card data
     */
    public populateHandDetails(): void {
        
        this.handDetails = this.hand.map(uid => {
            try {
                // Extract cardId from UID (assuming format like "cardId" or "cardId_suffix")
                let cardId = uid;
                if (uid.includes('_')) {
                    cardId = uid.split('_')[0];
                } else if (uid.includes('-')) {
                    // Keep the full cardId including "-" (like "c-1", "h-2", "s-3")
                    cardId = uid;
                }
                
                // Get card data from DeckManager
                let cardData = DeckManager.getCardDetails(cardId);
                
                // If not found in regular cards, try leader cards
                if (!cardData) {
                    cardData = DeckManager.getLeaderCards(cardId);
                }
                
                if (cardData) {
                    return {
                        uid: uid,
                        id: cardData.id,
                        name: cardData.name,
                        cardType: cardData.cardType,
                        gameType: cardData.gameType,
                        power: cardData.power || 0,
                        traits: cardData.traits || [],
                        description: cardData.effects?.description || '',
                        rarity: cardData.rarity,
                        effects: cardData.effects
                    };
                } else {
                    console.warn(`Card data not found for UID: ${uid}, cardId: ${cardId}`);
                    return {
                        uid: uid,
                        id: cardId,
                        name: `Unknown Card (${cardId})`,
                        cardType: 'unknown',
                        power: 0
                    };
                }
            } catch (error) {
                console.error(`Error populating handDetails for UID: ${uid}`, error);
                return {
                    uid: uid,
                    id: uid,
                    name: `Error Card (${uid})`,
                    cardType: 'error',
                    power: 0
                };
            }
        });
    }

    /**
     * Add a card to hand with full details
     */
    public addCardToHand(cardUid: string, cardDetails?: any): void {
        this.hand.push(cardUid);
        // Auto-populate handDetails after hand changes
        this.populateHandDetails();
    }

    /**
     * Handle player redraw request during initial game setup
     * @param playerId - ID of the player requesting redraw 
     * @param isRedraw - Whether the player wants to redraw their hand
     * @returns Promise<boolean> - true if hand was reshuffled, false otherwise
     */
    public async requestRedraw(playerId: string, isRedraw: boolean, redrawState: { redraw: number }): Promise<boolean> {
        // Check if player has already used their redraw
        if (redrawState.redraw !== 0) {
            return false; // Already used redraw
        }
        
        // Mark redraw as used (first-time execution guard)
        redrawState.redraw = 1;
        
        if (isRedraw) {
            // Get reshuffled deck from mozDeckHelper
            const reshuffleResult = await mozDeckHelperInstance.reshuffleForPlayer(playerId);
            
            // CRITICAL FIX: Update player's hand, main deck AND cardMapping
            // This ensures the frontend can find all reshuffled cards using their new UIDs
            this.hand = reshuffleResult.hand;
            this.mainDeck = reshuffleResult.mainDeck;
            
            // Update cardMapping with new UID mappings from reshuffle
            if (reshuffleResult.cardMapping && Object.keys(reshuffleResult.cardMapping).length > 0) {
                // Merge the new mappings with existing ones (preserving leaders and other cards)
                this.cardMapping = {
                    ...this.cardMapping,
                    ...reshuffleResult.cardMapping
                };
                console.log("🔄 Updated cardMapping after reshuffle:", Object.keys(this.cardMapping).length, "total cards");
            } else {
                console.warn("⚠️  No cardMapping returned from reshuffleForPlayer - this may cause card lookup issues");
            }
            
            // FIXED: Populate handDetails after hand changes (this was missing in the original)
            this.populateHandDetails();
            
            return true; // Hand was reshuffled
        }
        
        return false; // No reshuffle requested, but redraw is now marked as used
    }

    // ============ VALIDATION METHODS ============

    /**
     * Validate deck structure
     */
    public validate(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (this.currentLeaderIdx < 0 || this.currentLeaderIdx >= this.leader.length) {
            errors.push('Invalid currentLeaderIdx');
        }

        if (this.leader.length === 0) {
            errors.push('No leaders in deck');
        }

        if (this.hand.length === 0 && this.mainDeck.length === 0) {
            errors.push('No cards available');
        }

        // Validate mappings
        for (const uid of this.leader) {
            if (!this.leaderMapping[uid]) {
                errors.push(`Missing leader mapping for UID: ${uid}`);
            }
        }

        for (const uid of [...this.hand, ...this.mainDeck]) {
            if (!this.cardMapping[uid]) {
                errors.push(`Missing card mapping for UID: ${uid}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // ============ UTILITY METHODS ============

    /**
     * Get deck summary
     */
    public getSummary(): any {
        return {
            currentLeader: this.getCurrentLeaderCardId(),
            handSize: this.getHandSize(),
            deckSize: this.getDeckSize(),
            totalLeaders: this.leader.length,
            leaderProgress: `${this.currentLeaderIdx + 1}/${this.leader.length}`
        };
    }

    /**
     * Clone the deck data
     */
    public clone(): PlayerDeckDataResp {
        return new PlayerDeckDataResp(
            this.currentLeaderIdx,
            [...this.leader],
            [...this.hand],
            [...this.mainDeck],
            { ...this.leaderMapping },
            { ...this.cardMapping },
            [...this.handDetails]
        );
    }

    // ============ SERIALIZATION ============

    /**
     * Convert to JSON (legacy format for compatibility)
     */
    public toJSON(): any {
        return {
            currentLeaderIdx: this.currentLeaderIdx,
            leader: this.leader,
            hand: this.hand,
            mainDeck: this.mainDeck,
            leaderMapping: this.leaderMapping,
            cardMapping: this.cardMapping,
            handDetails: this.handDetails
        };
    }

    /**
     * Create from JSON (legacy format)
     */
    public static fromJSON(data: any): PlayerDeckDataResp {
        const instance = new PlayerDeckDataResp(
            data.currentLeaderIdx || 0,
            data.leader || [],
            data.hand || [],
            data.mainDeck || [],
            data.leaderMapping || {},
            data.cardMapping || {},
            data.handDetails || []
        );
        
        // Auto-populate handDetails if not provided or empty
        if (!data.handDetails || data.handDetails.length === 0) {
            instance.populateHandDetails();
        }
        
        return instance;
    }

    /**
     * Create from mozDeckHelper response
     */
    public static fromMozDeckHelperResponse(response: any): PlayerDeckDataResp {
        const instance = new PlayerDeckDataResp(
            response.currentLeaderIdx || 0,
            response.leader || [],
            response.hand || [],
            response.mainDeck || [],
            response.leaderMapping || {},
            response.cardMapping || {},
            response.handDetails || []
        );
        
        // Auto-populate handDetails if not provided or empty
        if (!response.handDetails || response.handDetails.length === 0) {
            instance.populateHandDetails();
        }
        
        return instance;
    }

    /**
     * Convert to string representation
     */
    public toString(): string {
        return JSON.stringify(this.toJSON(), null, 2);
    }
}

// ============ FACTORY FUNCTIONS ============

export function createPlayerDeckDataResp(
    currentLeaderIdx: number = 0,
    leader: string[] = [],
    hand: string[] = [],
    mainDeck: string[] = [],
    leaderMapping: CardMapping = {},
    cardMapping: CardMapping = {},
    handDetails: any[] = []
): PlayerDeckDataResp {
    return new PlayerDeckDataResp(currentLeaderIdx, leader, hand, mainDeck, leaderMapping, cardMapping, handDetails);
}

export function createPlayerDeckDataRespFromJSON(data: any): PlayerDeckDataResp {
    return PlayerDeckDataResp.fromJSON(data);
}

export function createPlayerDeckDataRespFromMozHelper(response: any): PlayerDeckDataResp {
    return PlayerDeckDataResp.fromMozDeckHelperResponse(response);
}

// ============ EXPORTS ============

export default {
    PlayerDeckDataResp,
    createPlayerDeckDataResp,
    createPlayerDeckDataRespFromJSON,
    createPlayerDeckDataRespFromMozHelper
};