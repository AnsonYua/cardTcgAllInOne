// src/models/GameEnvironment.ts

/**
 * TypeScript class-based structure for GameEnvironment (gameEnv)
 * Converts the existing JSON-based gameEnv into a proper object-oriented structure
 */

// ============ IMPORTS ============

import { PlayerDeckDataResp } from './PlayerDeckDataResp';

// ============ ENUMS ============

export enum GamePhase {
    WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
    BOTH_JOINED = 'BOTH_JOINED',
    READY_PHASE = 'READY_PHASE',
    REDRAW_PHASE = 'REDRAW_PHASE',
    DRAW_PHASE = 'DRAW_PHASE',
    MAIN_PHASE = 'MAIN_PHASE',
    SP_PHASE = 'SP_PHASE',
    BATTLE_PHASE = 'BATTLE_PHASE',
    END_PHASE = 'END_PHASE'
}

export enum ZoneType {
    TOP = 'top',
    LEFT = 'left',
    RIGHT = 'right',
    HELP = 'help',
    SP = 'sp',
    LEADER = 'leader'
}

export enum ActionType {
    PLAY_CARD = 'PLAY_CARD',
    PLAY_CARD_BACK = 'PLAY_CARD_BACK',
    PLAY_LEADER = 'PLAY_LEADER',
    APPLY_SET_POWER = 'APPLY_SET_POWER',
    APPLY_EFFECT = 'APPLY_EFFECT'
}

export enum EventType {
    ROOM_CREATED = 'ROOM_CREATED',
    GAME_STARTED = 'GAME_STARTED',
    INITIAL_HAND_DEALT = 'INITIAL_HAND_DEALT',
    PLAYER_JOINED = 'PLAYER_JOINED',
    PLAYER_READY = 'PLAYER_READY',
    HAND_REDRAWN = 'HAND_REDRAWN',
    CARD_PLAYED = 'CARD_PLAYED',
    ZONE_FILLED = 'ZONE_FILLED',
    PHASE_CHANGE = 'PHASE_CHANGE',
    TURN_SWITCH = 'TURN_SWITCH',
    ERROR_OCCURRED = 'ERROR_OCCURRED',
    BATTLE_CALCULATED = 'BATTLE_CALCULATED',
    VICTORY_POINTS_AWARDED = 'VICTORY_POINTS_AWARDED'
}

// ============ INTERFACES ============

export interface CardMapping {
    [uid: string]: string; // UID to cardId mapping
}

export interface PlayerDeckData {
    currentLeaderIdx: number;
    leader: string[]; // Array of leader UIDs
    hand: string[]; // Array of card UIDs in hand
    mainDeck: string[]; // Array of card UIDs in deck
    leaderMapping: CardMapping;
    cardMapping: CardMapping;
}

export interface ZoneCard {
    card: string[]; // Array containing single card UID
}

export interface LeaderZoneCard {
    id: string;
    name?: string;
    cardType?: string;
    gameType?: string;
    initialPoint?: number;
    level?: number;
    rarity?: string;
    zoneCompatibility?: {
        top: string[];
        left: string[];
        right: string[];
    };
    effects?: {
        description?: string;
        rules?: any[];
    };
}

export interface PlayerZones {
    leader?: LeaderZoneCard[];
    top?: ZoneCard[];
    left?: ZoneCard[];
    right?: ZoneCard[];
    help?: ZoneCard[];
    sp?: ZoneCard[];
}

export interface GameZonesData {
    [playerId: string]: PlayerZones;
}

// Utility types for zone operations
export type ZoneContent = ZoneCard[] | LeaderZoneCard[] | undefined;
export type NonLeaderZoneType = Exclude<ZoneType, ZoneType.LEADER>;

// Type guard functions
export const isLeaderZone = (zone: ZoneType): zone is ZoneType.LEADER => {
    return zone === ZoneType.LEADER;
};

export const isZoneCardArray = (content: ZoneContent): content is ZoneCard[] => {
    return Array.isArray(content) && (content.length === 0 || 'card' in content[0]);
};

export const isLeaderZoneCardArray = (content: ZoneContent): content is LeaderZoneCard[] => {
    return Array.isArray(content) && (content.length === 0 || ('id' in content[0] && !('card' in content[0])));
};

export interface GameEvent {
    id: string;
    type: EventType;
    data: any;
    timestamp: number;
    expiresAt: number;
    frontendProcessed: boolean;
    requireFrontendAcknowledgment: boolean;
}

export interface PlaySequenceAction {
    sequenceId: number;
    playerId: string;
    cardId: string;
    action: ActionType;
    zone: ZoneType;
    isFaceDown?: boolean;
    effectData?: any;
}

export interface PlaySequence {
    globalSequence: number;
    plays: PlaySequenceAction[];
}

export interface FieldEffect {
    effectId: string;
    source: string;
    sourcePlayerId?: string;
    type: string;
    target: {
        scope: 'SELF' | 'OPPONENT' | 'ALL';
        zones?: ZoneType[] | 'ALL';
        gameTypes?: string[];
        traits?: string[];
        playerId?: string;
    };
    value: number | boolean;
    priority?: number;
    unremovable?: boolean;
    isEnabled?: boolean;
    createdAt?: number;
    effectData?: any;
}

export interface PlayerFieldEffects {
    zoneRestrictions: {
        [zone in ZoneType]?: string[] | 'ALL';
    };
    activeEffects: FieldEffect[];
    specialEffects?: {
        zonePlacementFreedom?: boolean;
        immuneToNeutralization?: boolean;
    };
    calculatedPowers?: { [cardId: string]: number };
    disabledCards?: string[];
    victoryPointModifiers?: number;
}

export interface NeutralizationAction {
    timestamp: number;
    playerId: string;
    targetCardId: string;
    neutralizedBy: string;
    reason: string;
}

// ============ CLASSES ============

export class Player {
    public id: string;
    public name: string;
    public deck: PlayerDeckDataResp;
    public redraw: number;
    public turnAction: any[];
    public playerPoint: number;
    public isReady: boolean;
    public fieldEffects?: PlayerFieldEffects;

    constructor(id: string, name: string = id) {
        this.id = id;
        this.name = name;
        this.redraw = 0;
        this.turnAction = [];
        this.playerPoint = 0;
        this.isReady = false;
        this.deck = new PlayerDeckDataResp();
    }

    // ============ DECK METHODS ============
    // Delegate to PlayerDeckDataResp class methods

    public getCurrentLeader(): string | null {
        return this.deck.getCurrentLeader();
    }

    public getCurrentLeaderCardId(): string | null {
        return this.deck.getCurrentLeaderCardId();
    }

    public drawCard(): string | null {
        return this.deck.drawCard();
    }

    public playCardFromHand(cardUid: string): boolean {
        return this.deck.playCardFromHand(cardUid);
    }

    public getHandSize(): number {
        return this.deck.getHandSize();
    }

    public getDeckSize(): number {
        return this.deck.getDeckSize();
    }

    public advanceToNextLeader(): boolean {
        return this.deck.advanceToNextLeader();
    }

    public getCardIdFromUid(cardUid: string): string | null {
        return this.deck.getCardIdFromUid(cardUid);
    }

    // ============ REDRAW METHODS ============

    /**
     * Handle player redraw request during initial game setup
     * @param isRedraw - Whether the player wants to redraw their hand
     * @returns Promise<boolean> - true if hand was reshuffled, false otherwise
     */
    public async requestRedraw(isRedraw: boolean): Promise<boolean> {
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

    // ============ PLAYER STATE INITIALIZATION ============

    /**
     * Initialize all player state for game start
     * Includes field effects, player stats, and game state
     */
    public initializeForGameStart(): void {
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
    public initializeFieldEffects(): void {
        this.fieldEffects = {
            zoneRestrictions: {},
            activeEffects: [],
            specialEffects: {},
            calculatedPowers: {},
            disabledCards: [],
            victoryPointModifiers: 0
        };
    }

    public addFieldEffect(effect: FieldEffect): void {
        if (!this.fieldEffects) this.initializeFieldEffects();
        this.fieldEffects!.activeEffects.push(effect);
    }

    public clearFieldEffects(): void {
        this.initializeFieldEffects();
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        return {
            id: this.id,
            name: this.name,
            deck: this.deck.toJSON(), // Convert PlayerDeckDataResp to JSON
            redraw: this.redraw,
            turnAction: this.turnAction,
            playerPoint: this.playerPoint,
            isReady: this.isReady,
            ...(this.fieldEffects && { fieldEffects: this.fieldEffects })
        };
    }

    public static fromJSON(data: any): Player {
        const player = new Player(data.id, data.name);
        // Convert deck data to PlayerDeckDataResp class
        if (data.deck) {
            player.deck = PlayerDeckDataResp.fromJSON(data.deck);
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

export class GameZones {
    private zones: GameZonesData = {};

    /**
     * Initialize empty zones for a player
     */
    public initializePlayerZones(playerId: string): void {
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
    public getZonesData(): GameZonesData {
        return this.zones;
    }

    /**
     * Set the entire zones data structure (useful for deserialization)
     */
    public setZonesData(zonesData: GameZonesData): void {
        this.zones = zonesData;
    }

    public getPlayerZones(playerId: string): PlayerZones {
        //console.log("debug getPlayerZones", JSON.stringify(this.zones));
        if (!this.zones[playerId]) {
            this.initializePlayerZones(playerId);
        }
        return this.zones[playerId];
    }

    public setCardInZone(playerId: string, zone: ZoneType, cardUid: string): void {
        const playerZones = this.getPlayerZones(playerId);
        
        if (zone === ZoneType.LEADER) {
            // For leader zone, we need to create a basic LeaderZoneCard with just the id
            const leaderCard: LeaderZoneCard = { id: cardUid };
            if (!playerZones.leader) playerZones.leader = [];
            playerZones.leader.push(leaderCard);
        } else {
            // For other zones, create a ZoneCard
            const zoneCard: ZoneCard = { card: [cardUid] };
            const targetZone = playerZones[zone];
            if (Array.isArray(targetZone)) {
                targetZone.push(zoneCard);
            }
        }
    }

    public setLeaderInZone(playerId: string, leaderData: LeaderZoneCard): void {
        const playerZones = this.getPlayerZones(playerId);
        if (!playerZones.leader) playerZones.leader = [];
        playerZones.leader.push(leaderData);
    }

    public getLeaderInZone(playerId: string): LeaderZoneCard | null {
        const playerZones = this.getPlayerZones(playerId);
        return playerZones.leader?.[0] || null;
    }

    public getCardInZone(playerId: string, zone: ZoneType): string | null {
        const playerZones = this.getPlayerZones(playerId);
        
        if (zone === ZoneType.LEADER) {
            const leaderZone = playerZones.leader;
            return leaderZone && leaderZone.length > 0 ? leaderZone[0].id : null;
        } else {
            const targetZone = playerZones[zone];
            if (Array.isArray(targetZone) && targetZone.length > 0) {
                const zoneCard = targetZone[0];
                return zoneCard.card && zoneCard.card.length > 0 ? zoneCard.card[0] : null;
            }
        }
        
        return null;
    }

    public isZoneOccupied(playerId: string, zone: ZoneType): boolean {
        return this.getCardInZone(playerId, zone) !== null;
    }

    public clearZone(playerId: string, zone: ZoneType): void {
        const playerZones = this.getPlayerZones(playerId);
        
        if (zone === ZoneType.LEADER) {
            if (playerZones.leader) {
                playerZones.leader.length = 0; // Clear the array
            }
        } else {
            const targetZone = playerZones[zone];
            if (Array.isArray(targetZone)) {
                targetZone.length = 0; // Clear the array
            }
        }
    }

    public getAllPlayerIds(): string[] {
        return Object.keys(this.zones);
    }

    // ============ VALIDATION METHODS ============

    public areAllCharacterZonesFilled(playerId: string): boolean {
        return this.isZoneOccupied(playerId, ZoneType.TOP) &&
               this.isZoneOccupied(playerId, ZoneType.LEFT) &&
               this.isZoneOccupied(playerId, ZoneType.RIGHT);
    }

    public isHelpZoneFilled(playerId: string): boolean {
        return this.isZoneOccupied(playerId, ZoneType.HELP);
    }

    public isSpZoneFilled(playerId: string): boolean {
        return this.isZoneOccupied(playerId, ZoneType.SP);
    }

    // ============ SERIALIZATION ============

    public toJSON(): GameZonesData {
        return this.zones;
    }

    public static fromJSON(data: GameZonesData | any): GameZones {
        const gameZones = new GameZones();
        gameZones.setZonesData(data || {});
        return gameZones;
    }
}

export class EventManager {
    private events: GameEvent[] = [];
    private lastEventId: number = 0;

    public addEvent(type: EventType, data: any, requireFrontendAcknowledgment: boolean = false): GameEvent {
        this.lastEventId++;
        const timestamp = Date.now();
        
        const event: GameEvent = {
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

    public getEvents(): GameEvent[] {
        this.cleanupExpiredEvents();
        return [...this.events];
    }

    public getUnprocessedEvents(): GameEvent[] {
        return this.events.filter(event => !event.frontendProcessed);
    }

    public acknowledgeEvents(eventIds: string[]): void {
        this.events.forEach(event => {
            if (eventIds.includes(event.id)) {
                event.frontendProcessed = true;
            }
        });
        this.cleanupExpiredEvents();
    }

    private cleanupExpiredEvents(): void {
        const now = Date.now();
        this.events = this.events.filter(event => 
            event.expiresAt > now || !event.frontendProcessed
        );
    }

    public getLastEventId(): number {
        return this.lastEventId;
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        return {
            gameEvents: this.events,
            lastEventId: this.lastEventId
        };
    }

    public static fromJSON(data: any): EventManager {
        const manager = new EventManager();
        manager.events = data.gameEvents || [];
        manager.lastEventId = data.lastEventId || 0;
        return manager;
    }
}

export class PlaySequenceManager {
    private sequence: PlaySequence;

    constructor() {
        this.sequence = {
            globalSequence: 0,
            plays: []
        };
    }

    public addPlay(playerId: string, cardId: string, action: ActionType, zone: ZoneType, isFaceDown: boolean = false, effectData?: any): PlaySequenceAction {
        this.sequence.globalSequence++;
        
        const play: PlaySequenceAction = {
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

    public getPlays(): PlaySequenceAction[] {
        return [...this.sequence.plays];
    }

    public getGlobalSequence(): number {
        return this.sequence.globalSequence;
    }

    public clearSequence(): void {
        this.sequence = {
            globalSequence: 0,
            plays: []
        };
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        return this.sequence;
    }

    public static fromJSON(data: any): PlaySequenceManager {
        const manager = new PlaySequenceManager();
        manager.sequence = data || { globalSequence: 0, plays: [] };
        return manager;
    }
}

// ============ MAIN GAME ENVIRONMENT CLASS ============

export class GameEnvironment {
    // Core game state
    public phase: GamePhase;
    public playerId_1: string | null;
    public playerId_2: string | null;
    public gameStarted: boolean;
    public firstPlayer: number;
    public playersReady: { [playerId: string]: boolean };
    
    // Object-oriented components
    public players: { [playerId: string]: Player };
    public zones: GameZones;
    public eventManager: EventManager;
    public playSequenceManager: PlaySequenceManager;
    
    // Legacy compatibility
    public fieldEffects: { [playerId: string]: PlayerFieldEffects };
    public neutralizationHistory: NeutralizationAction[];

    constructor() {
        this.phase = GamePhase.WAITING_FOR_PLAYERS;
        this.playerId_1 = null;
        this.playerId_2 = null;
        this.gameStarted = false;
        this.firstPlayer = 0;
        this.playersReady = {};
        
        this.players = {};
        this.zones = new GameZones();
        this.eventManager = new EventManager();
        this.playSequenceManager = new PlaySequenceManager();
        
        this.fieldEffects = {};
        this.neutralizationHistory = [];
    }

    // ============ PLAYER MANAGEMENT ============

    public addPlayer(playerId: string, playerName?: string): Player {
        const player = new Player(playerId, playerName || playerId);
        this.players[playerId] = player;
        this.zones.initializePlayerZones(playerId);
        
        // Set player IDs based on order
        if (!this.playerId_1) {
            this.playerId_1 = playerId;
        } else if (!this.playerId_2) {
            this.playerId_2 = playerId;
        }
        
        return player;
    }

    public getPlayer(playerId: string): Player | null {
        return this.players[playerId] || null;
    }

    public getAllPlayers(): Player[] {
        return Object.values(this.players);
    }

    public getOpponentId(playerId: string): string | null {
        if (playerId === this.playerId_1) return this.playerId_2;
        if (playerId === this.playerId_2) return this.playerId_1;
        return null;
    }

    // ============ GAME STATE METHODS ============

    public updatePhase(newPhase: GamePhase): void {
        const oldPhase = this.phase;
        this.phase = newPhase;
        
        this.eventManager.addEvent(EventType.PHASE_CHANGE, {
            oldPhase,
            newPhase,
            timestamp: Date.now()
        });
    }

    public isGameReady(): boolean {
        return this.playerId_1 !== null && this.playerId_2 !== null;
    }

    public canStartGame(): boolean {
        return this.isGameReady() && this.phase === GamePhase.READY_PHASE;
    }

    // ============ PLAYERS READY MANAGEMENT ============

    public setPlayerReady(playerId: string, isReady: boolean = true): void {
        this.playersReady[playerId] = isReady;
    }

    public isPlayerReady(playerId: string): boolean {
        return this.playersReady[playerId] || false;
    }

    public areAllPlayersReady(): boolean {
        const playerIds = [this.playerId_1, this.playerId_2].filter(id => id !== null);
        return playerIds.length === 2 && playerIds.every(id => this.playersReady[id] === true);
    }

    public getPlayersReadyStatus(): { [playerId: string]: boolean } {
        return { ...this.playersReady };
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
    public async processPlayerRedraw(playerId: string, isRedraw: boolean): Promise<void> {
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

    public playCard(playerId: string, cardUid: string, zone: ZoneType, isFaceDown: boolean = false): boolean {
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        // Remove card from hand
        if (!player.playCardFromHand(cardUid)) return false;
        
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

    public setLeader(playerId: string, leaderUid: string): boolean {
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        this.zones.setCardInZone(playerId, ZoneType.LEADER, leaderUid);
        this.playSequenceManager.addPlay(playerId, leaderUid, ActionType.PLAY_LEADER, ZoneType.LEADER);
        
        return true;
    }

    // ============ VALIDATION METHODS ============

    public areAllMainZonesFilled(): boolean {
        const playerIds = this.zones.getAllPlayerIds();
        return playerIds.every(playerId => 
            this.zones.areAllCharacterZonesFilled(playerId) && 
            this.zones.isHelpZoneFilled(playerId)
        );
    }

    public areAllSpZonesFilled(): boolean {
        const playerIds = this.zones.getAllPlayerIds();
        return playerIds.every(playerId => this.zones.isSpZoneFilled(playerId));
    }

    // ============ NEUTRALIZATION TRACKING ============

    public addNeutralizationAction(playerId: string, targetCardId: string, neutralizedBy: string, reason: string): void {
        this.neutralizationHistory.push({
            timestamp: Date.now(),
            playerId,
            targetCardId,
            neutralizedBy,
            reason
        });
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        // Convert to legacy format for compatibility
        const legacy = {
            phase: this.phase,
            playerId_1: this.playerId_1,
            playerId_2: this.playerId_2,
            gameStarted: this.gameStarted,
            firstPlayer: this.firstPlayer,
            playersReady: this.playersReady,
            
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

    public static fromJSON(data: any): GameEnvironment {
        const gameEnv = new GameEnvironment();
        
        // Basic properties
        gameEnv.phase = data.phase || GamePhase.WAITING_FOR_PLAYERS;
        gameEnv.playerId_1 = data.playerId_1 || null;
        gameEnv.playerId_2 = data.playerId_2 || null;
        gameEnv.gameStarted = data.gameStarted || false;
        gameEnv.firstPlayer = data.firstPlayer || 0;
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
        
        return gameEnv;
    }

    // ============ UTILITY METHODS ============

    public clone(): GameEnvironment {
        return GameEnvironment.fromJSON(this.toJSON());
    }

    public toString(): string {
        return JSON.stringify(this.toJSON(), null, 2);
    }
}

// ============ FACTORY FUNCTIONS ============

export function createGameEnvironment(): GameEnvironment {
    return new GameEnvironment();
}

export function createGameEnvironmentFromJSON(data: any): GameEnvironment {
    return GameEnvironment.fromJSON(data);
}

// ============ EXPORTS ============

export default {
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