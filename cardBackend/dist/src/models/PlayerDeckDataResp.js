"use strict";
// src/models/PlayerDeckDataResp.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerDeckDataResp = void 0;
exports.createPlayerDeckDataResp = createPlayerDeckDataResp;
exports.createPlayerDeckDataRespFromJSON = createPlayerDeckDataRespFromJSON;
exports.createPlayerDeckDataRespFromMozHelper = createPlayerDeckDataRespFromMozHelper;
class PlayerDeckDataResp {
    constructor(currentLeaderIdx = 0, leader = [], hand = [], mainDeck = [], leaderMapping = {}, cardMapping = {}) {
        this.currentLeaderIdx = currentLeaderIdx;
        this.leader = leader;
        this.hand = hand;
        this.mainDeck = mainDeck;
        this.leaderMapping = leaderMapping;
        this.cardMapping = cardMapping;
    }
    // ============ DECK METHODS ============
    /**
     * Get current leader UID
     */
    getCurrentLeader() {
        if (this.leader.length > this.currentLeaderIdx) {
            return this.leader[this.currentLeaderIdx];
        }
        return null;
    }
    /**
     * Get current leader card ID (mapped from UID)
     */
    getCurrentLeaderCardId() {
        const leaderUid = this.getCurrentLeader();
        if (leaderUid && this.leaderMapping[leaderUid]) {
            return this.leaderMapping[leaderUid];
        }
        return null;
    }
    /**
     * Draw a card from main deck to hand
     */
    drawCard() {
        if (this.mainDeck.length > 0) {
            const cardUid = this.mainDeck.shift();
            this.hand.push(cardUid);
            return cardUid;
        }
        return null;
    }
    /**
     * Play a card from hand (remove from hand)
     */
    playCardFromHand(cardUid) {
        const index = this.hand.indexOf(cardUid);
        if (index !== -1) {
            this.hand.splice(index, 1);
            return true;
        }
        return false;
    }
    /**
     * Get hand size
     */
    getHandSize() {
        return this.hand.length;
    }
    /**
     * Get deck size
     */
    getDeckSize() {
        return this.mainDeck.length;
    }
    /**
     * Advance to next leader
     */
    advanceToNextLeader() {
        if (this.currentLeaderIdx + 1 < this.leader.length) {
            this.currentLeaderIdx++;
            return true;
        }
        return false;
    }
    /**
     * Get card ID from UID
     */
    getCardIdFromUid(cardUid) {
        return this.cardMapping[cardUid] || null;
    }
    /**
     * Get leader card ID from UID
     */
    getLeaderCardIdFromUid(leaderUid) {
        return this.leaderMapping[leaderUid] || null;
    }
    /**
     * Check if a card UID exists in hand
     */
    hasCardInHand(cardUid) {
        return this.hand.includes(cardUid);
    }
    /**
     * Get all cards in hand with their card IDs
     */
    getHandWithCardIds() {
        return this.hand.map(uid => ({
            uid,
            cardId: this.getCardIdFromUid(uid) || uid
        }));
    }
    /**
     * Get all leaders with their card IDs
     */
    getLeaderListWithCardIds() {
        return this.leader.map(uid => ({
            uid,
            cardId: this.getLeaderCardIdFromUid(uid) || uid
        }));
    }
    // ============ VALIDATION METHODS ============
    /**
     * Validate deck structure
     */
    validate() {
        const errors = [];
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
    getSummary() {
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
    clone() {
        return new PlayerDeckDataResp(this.currentLeaderIdx, [...this.leader], [...this.hand], [...this.mainDeck], { ...this.leaderMapping }, { ...this.cardMapping });
    }
    // ============ SERIALIZATION ============
    /**
     * Convert to JSON (legacy format for compatibility)
     */
    toJSON() {
        return {
            currentLeaderIdx: this.currentLeaderIdx,
            leader: this.leader,
            hand: this.hand,
            mainDeck: this.mainDeck,
            leaderMapping: this.leaderMapping,
            cardMapping: this.cardMapping
        };
    }
    /**
     * Create from JSON (legacy format)
     */
    static fromJSON(data) {
        return new PlayerDeckDataResp(data.currentLeaderIdx || 0, data.leader || [], data.hand || [], data.mainDeck || [], data.leaderMapping || {}, data.cardMapping || {});
    }
    /**
     * Create from mozDeckHelper response
     */
    static fromMozDeckHelperResponse(response) {
        return new PlayerDeckDataResp(response.currentLeaderIdx || 0, response.leader || [], response.hand || [], response.mainDeck || [], response.leaderMapping || {}, response.cardMapping || {});
    }
    /**
     * Convert to string representation
     */
    toString() {
        return JSON.stringify(this.toJSON(), null, 2);
    }
}
exports.PlayerDeckDataResp = PlayerDeckDataResp;
// ============ FACTORY FUNCTIONS ============
function createPlayerDeckDataResp(currentLeaderIdx = 0, leader = [], hand = [], mainDeck = [], leaderMapping = {}, cardMapping = {}) {
    return new PlayerDeckDataResp(currentLeaderIdx, leader, hand, mainDeck, leaderMapping, cardMapping);
}
function createPlayerDeckDataRespFromJSON(data) {
    return PlayerDeckDataResp.fromJSON(data);
}
function createPlayerDeckDataRespFromMozHelper(response) {
    return PlayerDeckDataResp.fromMozDeckHelperResponse(response);
}
// ============ EXPORTS ============
exports.default = {
    PlayerDeckDataResp,
    createPlayerDeckDataResp,
    createPlayerDeckDataRespFromJSON,
    createPlayerDeckDataRespFromMozHelper
};
//# sourceMappingURL=PlayerDeckDataResp.js.map