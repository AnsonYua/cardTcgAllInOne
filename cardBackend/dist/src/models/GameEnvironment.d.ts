/**
 * TypeScript class-based structure for GameEnvironment (gameEnv)
 * Converts the existing JSON-based gameEnv into a proper object-oriented structure
 */
import { PlayerDeckDataResp } from './PlayerDeckDataResp';
export declare enum GamePhase {
    WAITING_FOR_PLAYERS = "WAITING_FOR_PLAYERS",
    BOTH_JOINED = "BOTH_JOINED",
    READY_PHASE = "READY_PHASE",
    REDRAW_PHASE = "REDRAW_PHASE",
    DRAW_PHASE = "DRAW_PHASE",
    MAIN_PHASE = "MAIN_PHASE",
    SP_PHASE = "SP_PHASE",
    BATTLE_PHASE = "BATTLE_PHASE",
    END_PHASE = "END_PHASE"
}
export declare enum ZoneType {
    TOP = "top",
    LEFT = "left",
    RIGHT = "right",
    HELP = "help",
    SP = "sp",
    LEADER = "leader"
}
export declare enum ActionType {
    PLAY_CARD = "PLAY_CARD",
    PLAY_CARD_BACK = "PLAY_CARD_BACK",
    PLAY_LEADER = "PLAY_LEADER",
    APPLY_SET_POWER = "APPLY_SET_POWER",
    APPLY_EFFECT = "APPLY_EFFECT"
}
export declare enum EventType {
    ROOM_CREATED = "ROOM_CREATED",
    GAME_STARTED = "GAME_STARTED",
    INITIAL_HAND_DEALT = "INITIAL_HAND_DEALT",
    PLAYER_JOINED = "PLAYER_JOINED",
    PLAYER_READY = "PLAYER_READY",
    HAND_REDRAWN = "HAND_REDRAWN",
    CARD_PLAYED = "CARD_PLAYED",
    ZONE_FILLED = "ZONE_FILLED",
    PHASE_CHANGE = "PHASE_CHANGE",
    TURN_SWITCH = "TURN_SWITCH",
    ERROR_OCCURRED = "ERROR_OCCURRED",
    BATTLE_CALCULATED = "BATTLE_CALCULATED",
    VICTORY_POINTS_AWARDED = "VICTORY_POINTS_AWARDED"
}
export interface CardMapping {
    [uid: string]: string;
}
export interface PlayerDeckData {
    currentLeaderIdx: number;
    leader: string[];
    hand: string[];
    mainDeck: string[];
    leaderMapping: CardMapping;
    cardMapping: CardMapping;
}
export interface ZoneCard {
    card: string[];
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
export type ZoneContent = ZoneCard[] | LeaderZoneCard[] | undefined;
export type NonLeaderZoneType = Exclude<ZoneType, ZoneType.LEADER>;
export declare const isLeaderZone: (zone: ZoneType) => zone is ZoneType.LEADER;
export declare const isZoneCardArray: (content: ZoneContent) => content is ZoneCard[];
export declare const isLeaderZoneCardArray: (content: ZoneContent) => content is LeaderZoneCard[];
export interface GameEvent {
    id: string;
    type: EventType;
    data: any;
    timestamp: number;
    expiresAt: number;
    frontendProcessed: boolean;
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
    type: string;
    target: {
        scope: 'SELF' | 'OPPONENT' | 'ALL';
        zones?: ZoneType[] | 'ALL';
        gameTypes?: string[];
        traits?: string[];
    };
    value: number | boolean;
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
    calculatedPowers?: {
        [cardId: string]: number;
    };
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
export declare class Player {
    id: string;
    name: string;
    deck: PlayerDeckDataResp;
    redraw: number;
    fieldEffects?: PlayerFieldEffects;
    constructor(id: string, name?: string);
    getCurrentLeader(): string | null;
    getCurrentLeaderCardId(): string | null;
    drawCard(): string | null;
    playCardFromHand(cardUid: string): boolean;
    getHandSize(): number;
    getDeckSize(): number;
    advanceToNextLeader(): boolean;
    getCardIdFromUid(cardUid: string): string | null;
    /**
     * Handle player redraw request during initial game setup
     * @param isRedraw - Whether the player wants to redraw their hand
     * @returns Promise<boolean> - true if hand was reshuffled, false otherwise
     */
    requestRedraw(isRedraw: boolean): Promise<boolean>;
    initializeFieldEffects(): void;
    addFieldEffect(effect: FieldEffect): void;
    clearFieldEffects(): void;
    toJSON(): any;
    static fromJSON(data: any): Player;
}
export declare class GameZones {
    private zones;
    /**
     * Initialize empty zones for a player
     */
    initializePlayerZones(playerId: string): void;
    /**
     * Get the raw zones data structure
     */
    getZonesData(): GameZonesData;
    /**
     * Set the entire zones data structure (useful for deserialization)
     */
    setZonesData(zonesData: GameZonesData): void;
    getPlayerZones(playerId: string): PlayerZones;
    setCardInZone(playerId: string, zone: ZoneType, cardUid: string): void;
    setLeaderInZone(playerId: string, leaderData: LeaderZoneCard): void;
    getLeaderInZone(playerId: string): LeaderZoneCard | null;
    getCardInZone(playerId: string, zone: ZoneType): string | null;
    isZoneOccupied(playerId: string, zone: ZoneType): boolean;
    clearZone(playerId: string, zone: ZoneType): void;
    getAllPlayerIds(): string[];
    areAllCharacterZonesFilled(playerId: string): boolean;
    isHelpZoneFilled(playerId: string): boolean;
    isSpZoneFilled(playerId: string): boolean;
    toJSON(): GameZonesData;
    static fromJSON(data: GameZonesData | any): GameZones;
}
export declare class EventManager {
    private events;
    private lastEventId;
    addEvent(type: EventType, data: any): GameEvent;
    getEvents(): GameEvent[];
    getUnprocessedEvents(): GameEvent[];
    acknowledgeEvents(eventIds: string[]): void;
    private cleanupExpiredEvents;
    getLastEventId(): number;
    toJSON(): any;
    static fromJSON(data: any): EventManager;
}
export declare class PlaySequenceManager {
    private sequence;
    constructor();
    addPlay(playerId: string, cardId: string, action: ActionType, zone: ZoneType, isFaceDown?: boolean, effectData?: any): PlaySequenceAction;
    getPlays(): PlaySequenceAction[];
    getGlobalSequence(): number;
    clearSequence(): void;
    toJSON(): any;
    static fromJSON(data: any): PlaySequenceManager;
}
export declare class GameEnvironment {
    phase: GamePhase;
    playerId_1: string | null;
    playerId_2: string | null;
    gameStarted: boolean;
    firstPlayer: number;
    playersReady: {
        [playerId: string]: boolean;
    };
    players: {
        [playerId: string]: Player;
    };
    zones: GameZones;
    eventManager: EventManager;
    playSequenceManager: PlaySequenceManager;
    fieldEffects: {
        [playerId: string]: PlayerFieldEffects;
    };
    neutralizationHistory: NeutralizationAction[];
    constructor();
    addPlayer(playerId: string, playerName?: string): Player;
    getPlayer(playerId: string): Player | null;
    getAllPlayers(): Player[];
    getOpponentId(playerId: string): string | null;
    updatePhase(newPhase: GamePhase): void;
    isGameReady(): boolean;
    canStartGame(): boolean;
    setPlayerReady(playerId: string, isReady?: boolean): void;
    isPlayerReady(playerId: string): boolean;
    areAllPlayersReady(): boolean;
    getPlayersReadyStatus(): {
        [playerId: string]: boolean;
    };
    /**
     * Process player redraw request during initial game setup
     * Handles the complete redraw workflow including events and deck reshuffling
     * @param playerId - ID of the player requesting redraw
     * @param isRedraw - Whether the player wants to redraw their hand
     * @returns Promise<void>
     * @throws Error if player not found
     */
    processPlayerRedraw(playerId: string, isRedraw: boolean): Promise<void>;
    playCard(playerId: string, cardUid: string, zone: ZoneType, isFaceDown?: boolean): boolean;
    setLeader(playerId: string, leaderUid: string): boolean;
    areAllMainZonesFilled(): boolean;
    areAllSpZonesFilled(): boolean;
    addNeutralizationAction(playerId: string, targetCardId: string, neutralizedBy: string, reason: string): void;
    toJSON(): any;
    static fromJSON(data: any): GameEnvironment;
    clone(): GameEnvironment;
    toString(): string;
}
export declare function createGameEnvironment(): GameEnvironment;
export declare function createGameEnvironmentFromJSON(data: any): GameEnvironment;
declare const _default: {
    GameEnvironment: typeof GameEnvironment;
    Player: typeof Player;
    GameZones: typeof GameZones;
    EventManager: typeof EventManager;
    PlaySequenceManager: typeof PlaySequenceManager;
    GamePhase: typeof GamePhase;
    ZoneType: typeof ZoneType;
    ActionType: typeof ActionType;
    EventType: typeof EventType;
    createGameEnvironment: typeof createGameEnvironment;
    createGameEnvironmentFromJSON: typeof createGameEnvironmentFromJSON;
};
export default _default;
//# sourceMappingURL=GameEnvironment.d.ts.map