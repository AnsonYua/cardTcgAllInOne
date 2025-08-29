// src/models/GameEnvironment.ts
// Main GameEnvironment class for custom trading card game

import { GamePhase, ZoneType, EventType, ActionType } from './GameEnums';
import { Player, PlayerFieldEffects, PlayerZones, SlotZone } from './Player';
import { PlaySequenceManager, PlaySequenceAction } from './PlaySequence';
import { BaseZoneCard } from './CardSystem';

// ============ GAME EVENT INTERFACE ============

export interface GameEvent {
    id: string;
    type: string;
    data: any;
    timestamp: number;
    expiresAt: number;
    frontendProcessed: boolean;
}

// ============ GAME INTERFACES ============


export interface GameResult {
    success: boolean;
    error?: string;
    gameState?: any;
    requiresCardSelection?: boolean;
    selectionData?: any;
    processingTime?: number;
}

export interface ValidationResult {
    isValid: boolean;
    error?: string;
    warnings?: string[];
}


// ============ MAIN GAME ENVIRONMENT CLASS ============

export class GameEnvironment {
    // Core game state
    public phase: GamePhase;
    public playerId_1: string | null;
    public playerId_2: string | null;
    public gameStarted: boolean;
    public firstPlayer: number;
    public currentPlayer: string | null;
    public currentTurn: number;
    public playersReady: { [playerId: string]: boolean };
    
    // Object-oriented components
    public players: { [playerId: string]: Player };
    public playSequenceManager: PlaySequenceManager;
    
    // Legacy compatibility
    public fieldEffects: { [playerId: string]: PlayerFieldEffects };
    
    // Event system
    public gameEvents?: any[];
    public lastEventId?: number;
    
    // Card selection system
    public pendingCardSelections?: { [selectionId: string]: any };
    
    // Incremental effect processing
    public lastProcessedSequence: number;

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
        this.playSequenceManager = new PlaySequenceManager(this);
        
        this.fieldEffects = {};
        this.pendingCardSelections = {};
        this.lastProcessedSequence = 0;
    }

    // ============ PLAYER MANAGEMENT ============

    public addPlayer(playerId: string, playerName?: string): Player {
        const player = new Player(playerId, playerName || playerId);
        this.players[playerId] = player;
        
        if (playerId == "playerId_1") {
            this.playerId_1 = playerId;
        } else if (playerId == "playerId_2") {
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
        this.phase = newPhase;
        console.log(`📋 Phase changed to: ${newPhase}`);
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
        return playerIds.length === 2 && playerIds.every(id => id && this.playersReady[id] === true);
    }

    public getPlayersReadyStatus(): { [playerId: string]: boolean } {
        return { ...this.playersReady };
    }

    // ============ ZONE OPERATIONS ============

    public isZoneOccupied(playerId: string, zone: ZoneType): boolean {
        const player = this.getPlayer(playerId);
        return player ? player.isZoneOccupied(zone) : false;
    }

    public placeCardInZone(playerId: string, zone: ZoneType, cardUID: string): boolean {
        console.log(`🔍 placeCardInZone called: playerId=${playerId}, zone=${zone}, cardUID=${cardUID}`);
        
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        player.setCardInZone(zone, cardUID, undefined);
        
        const zoneName = zone.toLowerCase() as keyof PlayerZones;
        console.log(`🔍 After setCardInZone: ${zone} zone contains:`, player.zones[zoneName]);
        
        return true;
    }

    public getZonesData(): { [playerId: string]: PlayerZones } {
        const zonesData: { [playerId: string]: PlayerZones } = {};
        Object.keys(this.players).forEach(playerId => {
            zonesData[playerId] = this.players[playerId].zones;
        });
        return zonesData;
    }

    public playCard(playerId: string, cardUid: string, zone: ZoneType): boolean {
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        // Remove card from hand
        if (!player.playCardFromHand(cardUid)) return false;
        
        // Place in zone
        return this.placeCardInZone(playerId, zone, cardUid);
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        return {
            phase: this.phase,
            playerId_1: this.playerId_1,
            playerId_2: this.playerId_2,
            gameStarted: this.gameStarted,
            firstPlayer: this.firstPlayer,
            currentPlayer: this.currentPlayer,
            currentTurn: this.currentTurn,
            playersReady: this.playersReady,
            
            players: Object.fromEntries(
                Object.entries(this.players).map(([id, player]) => [id, player.toJSON()])
            ),
            
            zones: this.getZonesData(),
            fieldEffects: this.fieldEffects,
            pendingCardSelections: this.pendingCardSelections,
            lastProcessedSequence: this.lastProcessedSequence,
            
            playSequence: this.playSequenceManager.toJSON()
        };
    }

    public static fromJSON(data: any): GameEnvironment {
        const gameEnv = new GameEnvironment();
        
        gameEnv.phase = data.phase || GamePhase.WAITING_FOR_PLAYERS;
        gameEnv.playerId_1 = data.playerId_1 || null;
        gameEnv.playerId_2 = data.playerId_2 || null;
        gameEnv.gameStarted = data.gameStarted || false;
        gameEnv.firstPlayer = data.firstPlayer || 0;
        gameEnv.currentPlayer = data.currentPlayer || null;
        gameEnv.currentTurn = data.currentTurn || 0;
        gameEnv.playersReady = data.playersReady || {};
        
        // Reconstruct players
        if (data.players) {
            gameEnv.players = Object.fromEntries(
                Object.entries(data.players).map(([id, playerData]) => [id, Player.fromJSON(playerData)])
            );
        }
        
        // Zones are now managed within individual players
        // No separate zones object needed
        
        // Reconstruct managers
        if (data.playSequence) {
            gameEnv.playSequenceManager = PlaySequenceManager.fromJSON(data.playSequence);
        }
        
        gameEnv.fieldEffects = data.fieldEffects || {};
        gameEnv.pendingCardSelections = data.pendingCardSelections || {};
        gameEnv.lastProcessedSequence = data.lastProcessedSequence || 0;
        
        return gameEnv;
    }
}