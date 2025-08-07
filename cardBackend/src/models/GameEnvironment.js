"use strict";
// src/models/GameEnvironment.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardInfoUtilsSingleton = exports.createGameEnvironmentFromJSON = exports.createGameEnvironment = exports.GameEnvironment = exports.PlaySequenceManager = exports.EventManager = exports.GameZones = exports.Player = exports.isLeaderZoneCardArray = exports.isZoneCardArray = exports.isLeaderZone = exports.convertLegacyToUnified = exports.ZoneCardUtils = exports.isUtilityZoneCard = exports.isLeaderZoneCard = exports.isCharacterZoneCard = exports.createZoneCard = exports.EventType = exports.ActionType = exports.ZoneType = exports.GamePhase = void 0;
/**
 * TypeScript class-based structure for GameEnvironment (gameEnv)
 * Converts the existing JSON-based gameEnv into a proper object-oriented structure
 */
// ============ IMPORTS ============
const PlayerDeckDataResp_1 = require("./PlayerDeckDataResp");
const path = __importStar(require("path"));
// ============ CARDINFUTILS SINGLETON ============
/**
 * CardInfoUtils singleton with proper path resolution
 * Handles both compiled (dist/) and source (src/) environments
 */
class CardInfoUtilsSingleton {
    static getInstance() {
        if (!CardInfoUtilsSingleton.instance) {
            try {
                const isCompiled = __dirname.includes('dist');
                const cardInfoUtilsPath = isCompiled
                    ? path.join(__dirname, '../../../src/services/CardInfoUtils.js')
                    : path.join(__dirname, '../services/CardInfoUtils.js');
                CardInfoUtilsSingleton.instance = require(cardInfoUtilsPath);
            }
            catch (error) {
                console.error('❌ Failed to load CardInfoUtils:', error);
                CardInfoUtilsSingleton.instance = null;
            }
        }
        return CardInfoUtilsSingleton.instance;
    }
    static reset() {
        CardInfoUtilsSingleton.instance = null;
    }
}
exports.CardInfoUtilsSingleton = CardInfoUtilsSingleton;
CardInfoUtilsSingleton.instance = null;
// ============ ENUMS ============
var GamePhase;
(function (GamePhase) {
    GamePhase["WAITING_FOR_PLAYERS"] = "WAITING_FOR_PLAYERS";
    GamePhase["BOTH_JOINED"] = "BOTH_JOINED";
    GamePhase["READY_PHASE"] = "READY_PHASE";
    GamePhase["REDRAW_PHASE"] = "REDRAW_PHASE";
    GamePhase["DRAW_PHASE"] = "DRAW_PHASE";
    GamePhase["MAIN_PHASE"] = "MAIN_PHASE";
    GamePhase["SP_PHASE"] = "SP_PHASE";
    GamePhase["BATTLE_PHASE"] = "BATTLE_PHASE";
    GamePhase["END_PHASE"] = "END_PHASE";
})(GamePhase || (exports.GamePhase = GamePhase = {}));
var ZoneType;
(function (ZoneType) {
    ZoneType["TOP"] = "top";
    ZoneType["LEFT"] = "left";
    ZoneType["RIGHT"] = "right";
    ZoneType["HELP"] = "help";
    ZoneType["SP"] = "sp";
    ZoneType["LEADER"] = "leader";
})(ZoneType || (exports.ZoneType = ZoneType = {}));
var ActionType;
(function (ActionType) {
    ActionType["PLAY_CARD"] = "PLAY_CARD";
    ActionType["PLAY_CARD_BACK"] = "PLAY_CARD_BACK";
    ActionType["PLAY_LEADER"] = "PLAY_LEADER";
    ActionType["APPLY_SET_POWER"] = "APPLY_SET_POWER";
    ActionType["APPLY_EFFECT"] = "APPLY_EFFECT";
})(ActionType || (exports.ActionType = ActionType = {}));
var EventType;
(function (EventType) {
    EventType["ROOM_CREATED"] = "ROOM_CREATED";
    EventType["GAME_STARTED"] = "GAME_STARTED";
    EventType["INITIAL_HAND_DEALT"] = "INITIAL_HAND_DEALT";
    EventType["PLAYER_JOINED"] = "PLAYER_JOINED";
    EventType["PLAYER_READY"] = "PLAYER_READY";
    EventType["HAND_REDRAWN"] = "HAND_REDRAWN";
    EventType["CARD_PLAYED"] = "CARD_PLAYED";
    EventType["ZONE_FILLED"] = "ZONE_FILLED";
    EventType["PHASE_CHANGE"] = "PHASE_CHANGE";
    EventType["TURN_SWITCH"] = "TURN_SWITCH";
    EventType["ERROR_OCCURRED"] = "ERROR_OCCURRED";
    EventType["BATTLE_CALCULATED"] = "BATTLE_CALCULATED";
    EventType["VICTORY_POINTS_AWARDED"] = "VICTORY_POINTS_AWARDED";
})(EventType || (exports.EventType = EventType = {}));
// ==============================================================================
// ZONE CARD UTILITY FUNCTIONS
// ==============================================================================
/**
 * Factory function to create appropriate ZoneCard implementation
 */
function createZoneCard(cardUid, cardId, cardData, isFaceDown = false, placedBy = '') {
    const baseCard = {
        cardUid,
        cardId,
        cardData,
        isFaceDown,
        placedAt: Date.now(),
        placedBy
    };
    switch (cardData.cardType) {
        case 'character':
            return Object.assign(Object.assign({}, baseCard), { cardData: cardData });
        case 'leader':
            return Object.assign(Object.assign({}, baseCard), { cardData: cardData, isFaceDown: false // Leaders are always face-up
             });
        case 'help':
        case 'sp':
            return Object.assign(Object.assign({}, baseCard), { cardData: cardData });
        default:
            throw new Error(`Unknown card type: ${cardData.cardType}`);
    }
}
exports.createZoneCard = createZoneCard;
/**
 * Type guard functions for zone card types
 */
function isCharacterZoneCard(card) {
    return card.cardData.cardType === 'character';
}
exports.isCharacterZoneCard = isCharacterZoneCard;
function isLeaderZoneCard(card) {
    return card.cardData.cardType === 'leader';
}
exports.isLeaderZoneCard = isLeaderZoneCard;
function isUtilityZoneCard(card) {
    return ['help', 'sp'].includes(card.cardData.cardType);
}
exports.isUtilityZoneCard = isUtilityZoneCard;
/**
 * Card property accessors that handle face-down mechanics
 */
class ZoneCardUtils {
    /**
     * Get effective power for a card (0 if face-down)
     */
    static getEffectivePower(card) {
        if (card.isFaceDown || !isCharacterZoneCard(card)) {
            return 0;
        }
        return card.cardData.power;
    }
    /**
     * Get game type for zone compatibility (empty if face-down)
     */
    static getEffectiveGameType(card) {
        if (card.isFaceDown) {
            return ''; // Face-down cards bypass all restrictions
        }
        if (isCharacterZoneCard(card) || isLeaderZoneCard(card)) {
            return card.cardData.gameType;
        }
        return '';
    }
    /**
     * Get traits for effect targeting (empty if face-down)
     */
    static getEffectiveTraits(card) {
        if (card.isFaceDown || !isCharacterZoneCard(card)) {
            return [];
        }
        return card.cardData.traits || [];
    }
    /**
     * Check if card can trigger effects (false if face-down)
     */
    static canTriggerEffects(card) {
        var _a, _b;
        return !card.isFaceDown && ((_b = (_a = card.cardData.effects) === null || _a === void 0 ? void 0 : _a.rules) === null || _b === void 0 ? void 0 : _b.length) > 0;
    }
    /**
     * Check if card can contribute to power calculation
     */
    static canContributeToCalculation(card) {
        return !card.isFaceDown;
    }
    /**
     * Get zone compatibility for leader cards
     */
    static getZoneCompatibility(leader) {
        return leader.cardData.zoneCompatibility;
    }
    /**
     * Check if character can be placed in zone under leader
     */
    static canCharacterBePlacedInZone(character, zone, leader) {
        // Face-down cards bypass all restrictions
        if (character.isFaceDown) {
            return true;
        }
        const zoneKey = zone.toLowerCase();
        const allowedTypes = leader.cardData.zoneCompatibility[zoneKey] || [];
        return allowedTypes.includes(character.cardData.gameType);
    }
    /**
     * Get display name (hidden if face-down)
     */
    static getDisplayName(card) {
        return card.isFaceDown ? 'Hidden Card' : card.cardData.name;
    }
    /**
     * Get card effects (empty if face-down)
     */
    static getActiveEffects(card) {
        var _a;
        if (card.isFaceDown) {
            return [];
        }
        return ((_a = card.cardData.effects) === null || _a === void 0 ? void 0 : _a.rules) || [];
    }
}
exports.ZoneCardUtils = ZoneCardUtils;
/**
 * Utility function to convert legacy zone card format to unified format
 */
function convertLegacyToUnified(legacyCard, cardInfoUtils // Optional - will use singleton if not provided
) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!legacyCard.card || legacyCard.card.length === 0) {
            return null;
        }
        const cardUid = legacyCard.card[0];
        const cardId = cardUid.split('_')[0];
        try {
            // Use provided cardInfoUtils or singleton
            const CardInfoUtils = cardInfoUtils || CardInfoUtilsSingleton.getInstance();
            if (!CardInfoUtils) {
                console.warn(`CardInfoUtils not available for legacy conversion: ${cardUid}`);
                return null;
            }
            let cardData;
            // Determine card type from ID prefix and look up data
            if (cardId.startsWith('s-')) {
                cardData = yield CardInfoUtils.getLeaderCards(cardId);
            }
            else {
                cardData = yield CardInfoUtils.getCardDetails(cardId);
            }
            if (!cardData) {
                console.warn(`Could not resolve card data for legacy card: ${cardUid}`);
                return null;
            }
            return createZoneCard(cardUid, cardId, cardData, false, '');
        }
        catch (error) {
            console.error(`Error converting legacy card ${cardUid}:`, error);
            return null;
        }
    });
}
exports.convertLegacyToUnified = convertLegacyToUnified;
// Type guard functions
const isLeaderZone = (zone) => {
    return zone === ZoneType.LEADER;
};
exports.isLeaderZone = isLeaderZone;
const isZoneCardArray = (content) => {
    return Array.isArray(content) && (content.length === 0 || 'card' in content[0]);
};
exports.isZoneCardArray = isZoneCardArray;
const isLeaderZoneCardArray = (content) => {
    return Array.isArray(content) && (content.length === 0 || ('id' in content[0] && !('card' in content[0])));
};
exports.isLeaderZoneCardArray = isLeaderZoneCardArray;
// ============ CLASSES ============
class Player {
    constructor(id, name = id) {
        this.id = id;
        this.name = name;
        this.redraw = 0;
        this.turnAction = [];
        this.playerPoint = 0;
        this.isReady = false;
        this.deck = new PlayerDeckDataResp_1.PlayerDeckDataResp();
    }
    // ============ DECK METHODS ============
    // Delegate to PlayerDeckDataResp class methods
    getCurrentLeader() {
        return this.deck.getCurrentLeader();
    }
    getCurrentLeaderCardId() {
        return this.deck.getCurrentLeaderCardId();
    }
    getCurrentLeaderCardUId() {
        return this.deck.getCurrentLeaderCardUId();
    }
    drawCard() {
        return this.deck.drawCard();
    }
    playCardFromHand(cardUid) {
        return this.deck.playCardFromHand(cardUid);
    }
    getHandSize() {
        return this.deck.getHandSize();
    }
    getDeckSize() {
        return this.deck.getDeckSize();
    }
    advanceToNextLeader() {
        return this.deck.advanceToNextLeader();
    }
    getCardIdFromUid(cardUid) {
        return this.deck.getCardIdFromUid(cardUid);
    }
    // ============ REDRAW METHODS ============
    /**
     * Handle player redraw request during initial game setup
     * @param isRedraw - Whether the player wants to redraw their hand
     * @returns Promise<boolean> - true if hand was reshuffled, false otherwise
     */
    requestRedraw(isRedraw) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if player has already used their redraw
            if (this.redraw !== 0) {
                return false; // Already used redraw
            }
            // Mark redraw as used (first-time execution guard)
            this.redraw = 1;
            if (isRedraw) {
                // Import mozDeckHelper with proper path resolution for compiled code
                const isCompiled = __dirname.includes('dist');
                const mozDeckHelperPath = isCompiled
                    ? path.join(__dirname, '../../../src/mozGame/mozDeckHelper.js')
                    : path.join(__dirname, '../mozGame/mozDeckHelper.js');
                const mozDeckHelper = require(mozDeckHelperPath);
                // Get reshuffled deck from mozDeckHelper
                const reshuffleResult = yield mozDeckHelper.reshuffleForPlayer(this.id);
                // CRITICAL FIX: Update player's hand, main deck AND cardMapping
                // This ensures the frontend can find all reshuffled cards using their new UIDs
                this.deck.hand = reshuffleResult.hand;
                this.deck.mainDeck = reshuffleResult.mainDeck;
                // Update cardMapping with new UID mappings from reshuffle
                if (reshuffleResult.cardMapping && Object.keys(reshuffleResult.cardMapping).length > 0) {
                    // Merge the new mappings with existing ones (preserving leaders and other cards)
                    this.deck.cardMapping = Object.assign(Object.assign({}, this.deck.cardMapping), reshuffleResult.cardMapping);
                    console.log("🔄 Updated cardMapping after reshuffle:", Object.keys(this.deck.cardMapping).length, "total cards");
                }
                else {
                    console.warn("⚠️  No cardMapping returned from reshuffleForPlayer - this may cause card lookup issues");
                }
                return true; // Hand was reshuffled
            }
            return false; // No reshuffle requested, but redraw is now marked as used
        });
    }
    // ============ PLAYER STATE INITIALIZATION ============
    /**
     * Initialize all player state for game start
     * Includes field effects, player stats, and game state
     */
    initializeForGameStart() {
        // Initialize field effects
        this.fieldEffects = {
            zoneRestrictions: {},
            activeEffects: [],
            specialEffects: {},
            calculatedPowers: {},
            disabledCards: [],
            victoryPointModifiers: 0
        };
        // Initialize player game state
        this.turnAction = [];
        this.playerPoint = 0;
        // NOTE: redraw and isReady are handled elsewhere:
        // - redraw is managed by requestRedraw() method and mozGamePlay.js
        // - isReady is managed by GameEnvironment.setPlayerReady() method
    }
    /**
     * Legacy method for backwards compatibility
     * @deprecated Use initializeForGameStart() instead
     */
    initializeFieldEffects() {
        this.fieldEffects = {
            zoneRestrictions: {},
            activeEffects: [],
            specialEffects: {},
            calculatedPowers: {},
            disabledCards: [],
            victoryPointModifiers: 0
        };
    }
    addFieldEffect(effect) {
        if (!this.fieldEffects)
            this.initializeFieldEffects();
        this.fieldEffects.activeEffects.push(effect);
    }
    clearFieldEffects() {
        this.initializeFieldEffects();
    }
    // ============ SERIALIZATION ============
    toJSON() {
        return Object.assign({ id: this.id, name: this.name, deck: this.deck.toJSON(), redraw: this.redraw, turnAction: this.turnAction, playerPoint: this.playerPoint, isReady: this.isReady }, (this.fieldEffects && { fieldEffects: this.fieldEffects }));
    }
    static fromJSON(data) {
        const player = new Player(data.id, data.name);
        // Convert deck data to PlayerDeckDataResp class
        if (data.deck) {
            player.deck = PlayerDeckDataResp_1.PlayerDeckDataResp.fromJSON(data.deck);
        }
        player.redraw = data.redraw || 0;
        player.turnAction = data.turnAction || [];
        player.playerPoint = data.playerPoint || 0;
        player.isReady = data.isReady || false;
        if (data.fieldEffects) {
            player.fieldEffects = data.fieldEffects;
        }
        return player;
    }
}
exports.Player = Player;
class GameZones {
    constructor() {
        this.zones = {};
    }
    /**
     * Initialize empty zones for a player
     */
    initializePlayerZones(playerId) {
        this.zones[playerId] = {
            leader: [],
            top: [],
            left: [],
            right: [],
            help: [],
            sp: []
        };
    }
    /**
     * Get the raw zones data structure
     */
    getZonesData() {
        return this.zones;
    }
    /**
     * Set the entire zones data structure (useful for deserialization)
     */
    setZonesData(zonesData) {
        this.zones = zonesData;
    }
    getPlayerZones(playerId) {
        //console.log("debug getPlayerZones", JSON.stringify(this.zones));
        if (!this.zones[playerId]) {
            this.initializePlayerZones(playerId);
        }
        return this.zones[playerId];
    }
    setCardInZone(playerId, zone, cardUid, cardData, isFaceDown = false) {
        const playerZones = this.getPlayerZones(playerId);
        // Extract cardId from cardUid (e.g., "c-43_player1_001" → "c-43")
        const cardId = cardUid.split("_")[0];
        // If no cardData provided, look up the card details using CardInfoUtils
        let resolvedCardData = cardData;
        if (!resolvedCardData) {
            try {
                const CardInfoUtils = CardInfoUtilsSingleton.getInstance();
                if (CardInfoUtils) {
                    if (zone === ZoneType.LEADER) {
                        // Look up leader card data
                        resolvedCardData = CardInfoUtils.getLeaderCards(cardId);
                    }
                    else {
                        // Look up character/utility card data
                        resolvedCardData = CardInfoUtils.getCardDetails(cardId);
                    }
                }
                if (!resolvedCardData) {
                    console.warn(`⚠️ Could not resolve card data for cardId ${cardId}, using basic fallback`);
                    resolvedCardData = {
                        id: cardId,
                        name: 'Unknown Card',
                        cardType: 'character',
                        gameType: 'unknown',
                        power: 0,
                        traits: [],
                        rarity: 'common',
                        effects: { description: '', rules: [] }
                    };
                }
            }
            catch (error) {
                console.warn(`⚠️ Error looking up card data for ${cardId}:`, error);
                resolvedCardData = {
                    id: cardId,
                    name: 'Unknown Card',
                    cardType: 'character',
                    gameType: 'unknown',
                    power: 0,
                    traits: [],
                    rarity: 'common',
                    effects: { description: '', rules: [] }
                };
            }
        }
        // Create unified ZoneCard using factory function
        const zoneCard = createZoneCard(cardUid, cardId, resolvedCardData, isFaceDown, playerId);
        console.log("test222 ", JSON.stringify(zoneCard));
        zoneCard.cardUid = cardUid;
        console.log("test333 ", JSON.stringify(zoneCard));
        // Place card in appropriate zone
        if (zone === ZoneType.LEADER) {
            if (!playerZones.leader)
                playerZones.leader = [];
            playerZones.leader.push(zoneCard);
        }
        else if (zone === ZoneType.TOP || zone === ZoneType.LEFT || zone === ZoneType.RIGHT) {
            // Character zones
            const targetZone = playerZones[zone];
            if (Array.isArray(targetZone)) {
                targetZone.push(zoneCard);
            }
        }
        else if (zone === ZoneType.HELP || zone === ZoneType.SP) {
            // Utility zones (help/sp cards)
            const targetZone = playerZones[zone];
            if (Array.isArray(targetZone)) {
                targetZone.push(zoneCard);
            }
        }
        console.log(`✅ Set card in zone: ${cardUid} (${cardId}) → ${zone} for player ${playerId}${isFaceDown ? ' (face-down)' : ''} with data: ${resolvedCardData.name || 'Unknown'}`);
    }
    /**
     * Enhanced method that accepts resolved card data for proper object creation
     * This should be used when full card data is available
     */
    setCardInZoneWithData(playerId, zone, cardUid, cardData, isFaceDown = false) {
        this.setCardInZone(playerId, zone, cardUid, cardData, isFaceDown);
    }
    setLeaderInZone(playerId, leaderData) {
        var _a;
        // Convert old-style leaderData to new unified ZoneCard structure
        const cardUid = leaderData.uid;
        const cardId = ((_a = leaderData.id) === null || _a === void 0 ? void 0 : _a.split("_")[0]) || leaderData.cardId || leaderData.id;
        // Ensure leaderData has proper structure for CardData
        const normalizedLeaderData = {
            id: cardId,
            name: leaderData.name || 'Unknown Leader',
            cardType: 'leader',
            gameType: leaderData.gameType || 'unknown',
            initialPoint: leaderData.initialPoint || 0,
            level: leaderData.level || 1,
            rarity: leaderData.rarity || 'common',
            zoneCompatibility: leaderData.zoneCompatibility || {
                top: [],
                left: [],
                right: []
            },
            effects: leaderData.effects || { description: '', rules: [] }
        };
        // Create unified LeaderZoneCard using factory function
        const leaderCard = createZoneCard(cardUid, cardId, normalizedLeaderData, false, playerId);
        const playerZones = this.getPlayerZones(playerId);
        if (!playerZones.leader)
            playerZones.leader = [];
        playerZones.leader.push(leaderCard);
        console.log(`✅ Set leader in zone: ${cardUid} (${cardId}) for player ${playerId} - ${normalizedLeaderData.name}`);
    }
    getLeaderInZone(playerId) {
        var _a;
        const playerZones = this.getPlayerZones(playerId);
        return ((_a = playerZones.leader) === null || _a === void 0 ? void 0 : _a[0]) || null;
    }
    getCardInZone(playerId, zone) {
        const playerZones = this.getPlayerZones(playerId);
        // All zones now use unified ZoneCard structure with cardUid property
        const targetZone = playerZones[zone];
        if (Array.isArray(targetZone) && targetZone.length > 0) {
            const zoneCard = targetZone[0];
            return zoneCard.cardUid || null;
        }
        return null;
    }
    /**
     * Get the full card object (with data) from a zone
     */
    getCardObjectInZone(playerId, zone) {
        const playerZones = this.getPlayerZones(playerId);
        const targetZone = playerZones[zone];
        if (Array.isArray(targetZone) && targetZone.length > 0) {
            return targetZone[0];
        }
        return null;
    }
    isZoneOccupied(playerId, zone) {
        return this.getCardInZone(playerId, zone) !== null;
    }
    clearZone(playerId, zone) {
        const playerZones = this.getPlayerZones(playerId);
        if (zone === ZoneType.LEADER) {
            if (playerZones.leader) {
                playerZones.leader.length = 0; // Clear the array
            }
        }
        else {
            const targetZone = playerZones[zone];
            if (Array.isArray(targetZone)) {
                targetZone.length = 0; // Clear the array
            }
        }
    }
    getAllPlayerIds() {
        return Object.keys(this.zones);
    }
    // ============ VALIDATION METHODS ============
    areAllCharacterZonesFilled(playerId) {
        return this.isZoneOccupied(playerId, ZoneType.TOP) &&
            this.isZoneOccupied(playerId, ZoneType.LEFT) &&
            this.isZoneOccupied(playerId, ZoneType.RIGHT);
    }
    isHelpZoneFilled(playerId) {
        return this.isZoneOccupied(playerId, ZoneType.HELP);
    }
    isSpZoneFilled(playerId) {
        return this.isZoneOccupied(playerId, ZoneType.SP);
    }
    // ============ SERIALIZATION ============
    toJSON() {
        return this.zones;
    }
    static fromJSON(data) {
        const gameZones = new GameZones();
        gameZones.setZonesData(data || {});
        return gameZones;
    }
}
exports.GameZones = GameZones;
class EventManager {
    constructor() {
        this.events = [];
        this.lastEventId = 0;
    }
    addEvent(type, data, requireFrontendAcknowledgment = false) {
        this.lastEventId++;
        const timestamp = Date.now();
        const event = {
            id: `event_${timestamp}_${this.lastEventId}`,
            type,
            data,
            timestamp,
            expiresAt: timestamp + 3000, // 3 seconds expiry
            frontendProcessed: false,
            requireFrontendAcknowledgment: requireFrontendAcknowledgment
        };
        this.events.push(event);
        this.cleanupExpiredEvents();
        return event;
    }
    getEvents() {
        this.cleanupExpiredEvents();
        return [...this.events];
    }
    getUnprocessedEvents() {
        return this.events.filter(event => !event.frontendProcessed);
    }
    acknowledgeEvents(eventIds) {
        this.events.forEach(event => {
            if (eventIds.includes(event.id)) {
                event.frontendProcessed = true;
            }
        });
        this.cleanupExpiredEvents();
    }
    cleanupExpiredEvents() {
        const now = Date.now();
        this.events = this.events.filter(event => event.expiresAt > now || !event.frontendProcessed);
    }
    getLastEventId() {
        return this.lastEventId;
    }
    // ============ SERIALIZATION ============
    toJSON() {
        return {
            gameEvents: this.events,
            lastEventId: this.lastEventId
        };
    }
    static fromJSON(data) {
        const manager = new EventManager();
        manager.events = data.gameEvents || [];
        manager.lastEventId = data.lastEventId || 0;
        return manager;
    }
}
exports.EventManager = EventManager;
class PlaySequenceManager {
    constructor() {
        this.sequence = {
            globalSequence: 0,
            plays: []
        };
    }
    addPlay(playerId, cardId, action, zone, isFaceDown = false, effectData) {
        this.sequence.globalSequence++;
        const play = Object.assign(Object.assign({ sequenceId: this.sequence.globalSequence, playerId,
            cardId,
            action,
            zone }, (isFaceDown && { isFaceDown })), (effectData && { effectData }));
        this.sequence.plays.push(play);
        return play;
    }
    getPlays() {
        return [...this.sequence.plays];
    }
    getGlobalSequence() {
        return this.sequence.globalSequence;
    }
    getNextSequenceId() {
        return this.sequence.globalSequence + 1;
    }
    recordAction(action) {
        this.sequence.globalSequence = action.sequenceId;
        this.sequence.plays.push(action);
    }
    clearSequence() {
        this.sequence = {
            globalSequence: 0,
            plays: []
        };
    }
    // ============ SERIALIZATION ============
    toJSON() {
        return this.sequence;
    }
    static fromJSON(data) {
        const manager = new PlaySequenceManager();
        manager.sequence = data || { globalSequence: 0, plays: [] };
        return manager;
    }
}
exports.PlaySequenceManager = PlaySequenceManager;
// ============ MAIN GAME ENVIRONMENT CLASS ============
class GameEnvironment {
    constructor() {
        this.phase = GamePhase.WAITING_FOR_PLAYERS;
        this.playerId_1 = null;
        this.playerId_2 = null;
        this.gameStarted = false;
        this.firstPlayer = 0;
        this.currentPlayer = null;
        this.currentTurn = 0;
        this.playersReady = {};
        this.players = {};
        this.zones = new GameZones();
        this.eventManager = new EventManager();
        this.playSequenceManager = new PlaySequenceManager();
        // REMOVED: validationState initialization - using fieldEffects as single source of truth
        this.fieldEffects = {};
        this.neutralizationHistory = [];
    }
    // ============ PLAYER MANAGEMENT ============
    addPlayer(playerId, playerName) {
        const player = new Player(playerId, playerName || playerId);
        this.players[playerId] = player;
        this.zones.initializePlayerZones(playerId);
        // Set player IDs based on order
        if (!this.playerId_1) {
            this.playerId_1 = playerId;
        }
        else if (!this.playerId_2) {
            this.playerId_2 = playerId;
        }
        return player;
    }
    getPlayer(playerId) {
        return this.players[playerId] || null;
    }
    getAllPlayers() {
        return Object.values(this.players);
    }
    getOpponentId(playerId) {
        if (playerId === this.playerId_1)
            return this.playerId_2;
        if (playerId === this.playerId_2)
            return this.playerId_1;
        return null;
    }
    // ============ GAME STATE METHODS ============
    updatePhase(newPhase) {
        const oldPhase = this.phase;
        this.phase = newPhase;
        this.eventManager.addEvent(EventType.PHASE_CHANGE, {
            oldPhase,
            newPhase,
            timestamp: Date.now()
        });
    }
    isGameReady() {
        return this.playerId_1 !== null && this.playerId_2 !== null;
    }
    canStartGame() {
        return this.isGameReady() && this.phase === GamePhase.READY_PHASE;
    }
    // ============ PLAYERS READY MANAGEMENT ============
    setPlayerReady(playerId, isReady = true) {
        this.playersReady[playerId] = isReady;
    }
    isPlayerReady(playerId) {
        return this.playersReady[playerId] || false;
    }
    areAllPlayersReady() {
        const playerIds = [this.playerId_1, this.playerId_2].filter(id => id !== null);
        return playerIds.length === 2 && playerIds.every(id => id && this.playersReady[id] === true);
    }
    getPlayersReadyStatus() {
        return Object.assign({}, this.playersReady);
    }
    // ============ PLAYER REDRAW OPERATIONS ============
    /**
     * Process player redraw request during initial game setup
     * Handles the complete redraw workflow including events and deck reshuffling
     * @param playerId - ID of the player requesting redraw
     * @param isRedraw - Whether the player wants to redraw their hand
     * @returns Promise<void>
     * @throws Error if player not found
     */
    processPlayerRedraw(playerId, isRedraw) {
        return __awaiter(this, void 0, void 0, function* () {
            const player = this.getPlayer(playerId);
            if (!player) {
                throw new Error(`Player ${playerId} not found`);
            }
            // Delegate to player's requestRedraw method which handles the core logic
            const reshuffled = yield player.requestRedraw(isRedraw);
            // Add PLAYER_READY event through EventManager
            this.eventManager.addEvent(EventType.PLAYER_READY, {
                playerId: playerId,
                redrawRequested: isRedraw
            });
            // Add HAND_REDRAWN event if reshuffling occurred
            if (reshuffled) {
                this.eventManager.addEvent(EventType.HAND_REDRAWN, {
                    playerId: playerId,
                    newHandSize: player.getHandSize()
                });
            }
        });
    }
    // ============ ZONE OPERATIONS ============
    isZoneOccupied(playerId, zone) {
        return this.zones.isZoneOccupied(playerId, zone);
    }
    placeCardInZone(playerId, zone, cardId, isFaceDown = false) {
        this.zones.setCardInZone(playerId, zone, cardId);
        return true;
    }
    playCard(playerId, cardUid, zone, isFaceDown = false) {
        const player = this.getPlayer(playerId);
        if (!player)
            return false;
        // Remove card from hand
        if (!player.playCardFromHand(cardUid))
            return false;
        // Place card in zone
        this.zones.setCardInZone(playerId, zone, cardUid);
        // Record in play sequence
        const action = isFaceDown ? ActionType.PLAY_CARD_BACK : ActionType.PLAY_CARD;
        this.playSequenceManager.addPlay(playerId, cardUid, action, zone, isFaceDown);
        // Add event
        this.eventManager.addEvent(EventType.CARD_PLAYED, {
            playerId,
            cardUid,
            zone,
            isFaceDown
        });
        return true;
    }
    setLeader(playerId, leaderUid) {
        const player = this.getPlayer(playerId);
        if (!player)
            return false;
        this.zones.setCardInZone(playerId, ZoneType.LEADER, leaderUid);
        this.playSequenceManager.addPlay(playerId, leaderUid, ActionType.PLAY_LEADER, ZoneType.LEADER);
        return true;
    }
    // ============ VALIDATION METHODS ============
    areAllMainZonesFilled() {
        const playerIds = this.zones.getAllPlayerIds();
        return playerIds.every(playerId => this.zones.areAllCharacterZonesFilled(playerId) &&
            this.zones.isHelpZoneFilled(playerId));
    }
    areAllSpZonesFilled() {
        const playerIds = this.zones.getAllPlayerIds();
        return playerIds.every(playerId => this.zones.isSpZoneFilled(playerId));
    }
    // ============ NEUTRALIZATION TRACKING ============
    addNeutralizationAction(playerId, targetCardId, neutralizedBy, reason) {
        this.neutralizationHistory.push({
            timestamp: Date.now(),
            playerId,
            targetCardId,
            neutralizedBy,
            reason
        });
    }
    // ============ SERIALIZATION ============
    toJSON() {
        // Convert to legacy format for compatibility
        const legacy = Object.assign(Object.assign({ phase: this.phase, playerId_1: this.playerId_1, playerId_2: this.playerId_2, gameStarted: this.gameStarted, firstPlayer: this.firstPlayer, currentPlayer: this.currentPlayer, currentTurn: this.currentTurn, playersReady: this.playersReady, 
            // Convert players to legacy format
            players: {}, zones: this.zones.toJSON(), fieldEffects: this.fieldEffects, neutralizationHistory: this.neutralizationHistory }, this.eventManager.toJSON()), { 
            // Play sequence
            playSequence: this.playSequenceManager.toJSON() });
        // Convert players
        for (const [playerId, player] of Object.entries(this.players)) {
            legacy.players[playerId] = player.toJSON();
        }
        return legacy;
    }
    static fromJSON(data) {
        const gameEnv = new GameEnvironment();
        // Basic properties
        gameEnv.phase = data.phase || GamePhase.WAITING_FOR_PLAYERS;
        gameEnv.playerId_1 = data.playerId_1 || null;
        gameEnv.playerId_2 = data.playerId_2 || null;
        gameEnv.gameStarted = data.gameStarted || false;
        gameEnv.firstPlayer = data.firstPlayer || 0;
        gameEnv.currentPlayer = data.currentPlayer || null;
        gameEnv.currentTurn = data.currentTurn || 0;
        gameEnv.playersReady = data.playersReady || {};
        // Players
        if (data.players) {
            for (const [playerId, playerData] of Object.entries(data.players)) {
                gameEnv.players[playerId] = Player.fromJSON(playerData);
            }
        }
        // Zones
        gameEnv.zones = GameZones.fromJSON(data.zones);
        // Event system
        gameEnv.eventManager = EventManager.fromJSON(data);
        // Play sequence
        gameEnv.playSequenceManager = PlaySequenceManager.fromJSON(data.playSequence);
        // Legacy compatibility
        gameEnv.fieldEffects = data.fieldEffects || {};
        gameEnv.neutralizationHistory = data.neutralizationHistory || [];
        // REMOVED: validationState deserialization - using fieldEffects as single source of truth
        return gameEnv;
    }
    // ============ UTILITY METHODS ============
    clone() {
        return GameEnvironment.fromJSON(this.toJSON());
    }
    toString() {
        return JSON.stringify(this.toJSON(), null, 2);
    }
}
exports.GameEnvironment = GameEnvironment;
// ============ FACTORY FUNCTIONS ============
function createGameEnvironment() {
    return new GameEnvironment();
}
exports.createGameEnvironment = createGameEnvironment;
function createGameEnvironmentFromJSON(data) {
    return GameEnvironment.fromJSON(data);
}
exports.createGameEnvironmentFromJSON = createGameEnvironmentFromJSON;
// ============ EXPORTS ============
exports.default = {
    GameEnvironment,
    Player,
    GameZones,
    EventManager,
    PlaySequenceManager,
    GamePhase,
    ZoneType,
    ActionType,
    EventType,
    createGameEnvironment,
    createGameEnvironmentFromJSON,
    CardInfoUtilsSingleton
};
