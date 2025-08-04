"use strict";
// src/models/GameEnvironment.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEnvironment = exports.PlaySequenceManager = exports.EventManager = exports.GameZones = exports.Player = exports.isLeaderZoneCardArray = exports.isZoneCardArray = exports.isLeaderZone = exports.EventType = exports.ActionType = exports.ZoneType = exports.GamePhase = void 0;
exports.createGameEnvironment = createGameEnvironment;
exports.createGameEnvironmentFromJSON = createGameEnvironmentFromJSON;
/**
 * TypeScript class-based structure for GameEnvironment (gameEnv)
 * Converts the existing JSON-based gameEnv into a proper object-oriented structure
 */
// ============ IMPORTS ============
const PlayerDeckDataResp_1 = require("./PlayerDeckDataResp");
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
    async requestRedraw(isRedraw) {
        // Check if player has already used their redraw
        if (this.redraw !== 0) {
            return false; // Already used redraw
        }
        // Mark redraw as used (first-time execution guard)
        this.redraw = 1;
        if (isRedraw) {
            // Import mozDeckHelper with proper path resolution for compiled code
            const path = require('path');
            const isCompiled = __dirname.includes('dist');
            const mozDeckHelperPath = isCompiled
                ? path.join(__dirname, '../../../src/mozGame/mozDeckHelper.js')
                : path.join(__dirname, '../mozGame/mozDeckHelper.js');
            const mozDeckHelper = require(mozDeckHelperPath);
            // Get reshuffled deck from mozDeckHelper
            const reshuffleResult = await mozDeckHelper.reshuffleForPlayer(this.id);
            // Update player's hand and main deck with reshuffled cards
            this.deck.hand = reshuffleResult.hand;
            this.deck.mainDeck = reshuffleResult.mainDeck;
            return true; // Hand was reshuffled
        }
        return false; // No reshuffle requested, but redraw is now marked as used
    }
    // ============ FIELD EFFECTS METHODS ============
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
        return {
            id: this.id,
            name: this.name,
            deck: this.deck.toJSON(), // Convert PlayerDeckDataResp to JSON
            redraw: this.redraw,
            ...(this.fieldEffects && { fieldEffects: this.fieldEffects })
        };
    }
    static fromJSON(data) {
        const player = new Player(data.id, data.name);
        // Convert deck data to PlayerDeckDataResp class
        if (data.deck) {
            player.deck = PlayerDeckDataResp_1.PlayerDeckDataResp.fromJSON(data.deck);
        }
        player.redraw = data.redraw || 0;
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
    setCardInZone(playerId, zone, cardUid) {
        const playerZones = this.getPlayerZones(playerId);
        if (zone === ZoneType.LEADER) {
            // For leader zone, we need to create a basic LeaderZoneCard with just the id
            const leaderCard = { id: cardUid };
            if (!playerZones.leader)
                playerZones.leader = [];
            playerZones.leader.push(leaderCard);
        }
        else {
            // For other zones, create a ZoneCard
            const zoneCard = { card: [cardUid] };
            const targetZone = playerZones[zone];
            if (Array.isArray(targetZone)) {
                targetZone.push(zoneCard);
            }
        }
    }
    setLeaderInZone(playerId, leaderData) {
        const playerZones = this.getPlayerZones(playerId);
        if (!playerZones.leader)
            playerZones.leader = [];
        playerZones.leader.push(leaderData);
    }
    getLeaderInZone(playerId) {
        const playerZones = this.getPlayerZones(playerId);
        return playerZones.leader?.[0] || null;
    }
    getCardInZone(playerId, zone) {
        const playerZones = this.getPlayerZones(playerId);
        if (zone === ZoneType.LEADER) {
            const leaderZone = playerZones.leader;
            return leaderZone && leaderZone.length > 0 ? leaderZone[0].id : null;
        }
        else {
            const targetZone = playerZones[zone];
            if (Array.isArray(targetZone) && targetZone.length > 0) {
                const zoneCard = targetZone[0];
                return zoneCard.card && zoneCard.card.length > 0 ? zoneCard.card[0] : null;
            }
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
    addEvent(type, data) {
        this.lastEventId++;
        const timestamp = Date.now();
        const event = {
            id: `event_${timestamp}_${this.lastEventId}`,
            type,
            data,
            timestamp,
            expiresAt: timestamp + 3000, // 3 seconds expiry
            frontendProcessed: false
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
        const play = {
            sequenceId: this.sequence.globalSequence,
            playerId,
            cardId,
            action,
            zone,
            ...(isFaceDown && { isFaceDown }),
            ...(effectData && { effectData })
        };
        this.sequence.plays.push(play);
        return play;
    }
    getPlays() {
        return [...this.sequence.plays];
    }
    getGlobalSequence() {
        return this.sequence.globalSequence;
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
        this.players = {};
        this.zones = new GameZones();
        this.eventManager = new EventManager();
        this.playSequenceManager = new PlaySequenceManager();
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
    // ============ PLAYER REDRAW OPERATIONS ============
    /**
     * Process player redraw request during initial game setup
     * Handles the complete redraw workflow including events and deck reshuffling
     * @param playerId - ID of the player requesting redraw
     * @param isRedraw - Whether the player wants to redraw their hand
     * @returns Promise<void>
     * @throws Error if player not found
     */
    async processPlayerRedraw(playerId, isRedraw) {
        const player = this.getPlayer(playerId);
        if (!player) {
            throw new Error(`Player ${playerId} not found`);
        }
        // Delegate to player's requestRedraw method which handles the core logic
        const reshuffled = await player.requestRedraw(isRedraw);
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
    }
    // ============ ZONE OPERATIONS ============
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
        const legacy = {
            phase: this.phase,
            playerId_1: this.playerId_1,
            playerId_2: this.playerId_2,
            gameStarted: this.gameStarted,
            firstPlayer: this.firstPlayer,
            // Convert players to legacy format
            players: {},
            zones: this.zones.toJSON(),
            fieldEffects: this.fieldEffects,
            neutralizationHistory: this.neutralizationHistory,
            // Event system
            ...this.eventManager.toJSON(),
            // Play sequence
            playSequence: this.playSequenceManager.toJSON()
        };
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
function createGameEnvironmentFromJSON(data) {
    return GameEnvironment.fromJSON(data);
}
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
    createGameEnvironmentFromJSON
};
//# sourceMappingURL=GameEnvironment.js.map