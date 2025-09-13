// src/models/GameEnvironment.ts
// Main GameEnvironment class for custom trading card game

import { GamePhase, ZoneType, EventType } from './GameEnums';
import { Player, PlayerZones, SlotZone } from './Player';
import { ZoneCard } from './CardSystem';
// EventManager removed - using direct event processing
import { GameEvent, EventStatus, EventPriority, EventFactory } from '../services/EventQueue/interfaces/GameEvent';
import { ProcessingResult, ValidationResult } from './EventInterfaces';

// Forward declaration to avoid circular dependency
declare class StaticEventProcessor {
    static processQueue(gameEnv: GameEnvironment): ProcessingResult;
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

// GameEvent, ProcessingResult, and ValidationResult moved to separate files to avoid conflicts


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
    
    
    // Unified event system - renamed for clarity
    public processingQueue: GameEvent[] = [];
    public processingEnabled: boolean = true;
    public maxEventsPerCycle: number = 50;
    
    // Frontend notification system (for frontend polling)
    public notificationQueue?: any[];
    public lastEventId?: number;
    
    // Card selection system
    public pendingCardSelections?: { [selectionId: string]: any };
    
    // Legacy compatibility (removed - no longer using EventManager)

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
        
        // Initialize event systems
        this.processingQueue = [];
        this.processingEnabled = true;
        this.maxEventsPerCycle = 50;
        
        // Initialize frontend notification system
        this.pendingCardSelections = {};
        this.notificationQueue = [];
        this.lastEventId = 0;
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

    // ============ SIMPLIFIED EVENT SYSTEM ============
    
    /**
     * Add event to processing queue with automatic priority sorting
     */
    public enqueueForProcessing(event: GameEvent): void {
        this.processingQueue.push(event);
        this.sortEventsByPriority();
        console.log(`📋 Event queued for processing: ${event.type} (priority: ${event.priority})`);
    }
    
    /**
     * Legacy method for backward compatibility
     */
    public enqueueEvent(event: GameEvent): void {
        this.enqueueForProcessing(event);
    }
    
    // ============ NOTIFICATION QUEUE METHODS ============
    
    /**
     * Add notification event to frontend notification queue
     */
    public enqueueNotification(notification: any): void {
        if (!this.notificationQueue) {
            this.notificationQueue = [];
        }
        this.notificationQueue.push(notification);
        console.log(`📨 Notification enqueued: ${notification.type}`);
    }
    
    /**
     * Remove specific event from processing queue (safer than shift())
     * @param event - The specific event to remove
     * @returns true if event was found and removed, false otherwise
     */
    public dequeueFromProcessing(event: GameEvent): boolean {
        const eventIndex = this.processingQueue.findIndex(e => e.id === event.id);
        if (eventIndex !== -1) {
            const removedEvent = this.processingQueue.splice(eventIndex, 1)[0];
            console.log(`📤 Event dequeued from processing: ${removedEvent.type} (was at index ${eventIndex})`);
            return true;
        } else {
            console.warn(`⚠️ Event not found in processing queue for removal: ${event.type} (${event.id})`);
            return false;
        }
    }
    
    /**
     * Legacy method for backward compatibility
     */
    public dequeueEvent(event: GameEvent): boolean {
        return this.dequeueFromProcessing(event);
    }
    
    /**
     * Remove event by ID from processing queue (alternative method)
     * @param eventId - The ID of the event to remove
     * @returns true if event was found and removed, false otherwise
     */
    public dequeueEventById(eventId: string): boolean {
        const eventIndex = this.processingQueue.findIndex(e => e.id === eventId);
        if (eventIndex !== -1) {
            const removedEvent = this.processingQueue.splice(eventIndex, 1)[0];
            console.log(`📤 Event dequeued by ID from processing: ${removedEvent.type} (was at index ${eventIndex})`);
            return true;
        } else {
            console.warn(`⚠️ Event not found in processing queue for removal by ID: ${eventId}`);
            return false;
        }
    }
    
    /**
     * Process events until blocked or queue empty
     */
    public processEvents(): ProcessingResult {
        console.log(`🎮 Processing events - queue size: ${this.processingQueue.length}`);
        console.log("processing queue:", JSON.stringify(this.processingQueue))
        // Dynamic import to avoid circular dependency
        const { StaticEventProcessor } = require('../services/StaticEventProcessor');
        return StaticEventProcessor.processQueue(this);
    }
    
    /**
     * Check if processing needs player input
     */
    public needsPlayerInput(): boolean {
        const nextEvent = this.processingQueue[0];
        return nextEvent?.type === EventType.PLAYER_CHOICE_REQUIRED && 
               nextEvent?.status === EventStatus.DECLARED;
    }
    
    /**
     * Get current pending player choice
     */
    public getCurrentPlayerChoice(): GameEvent | null {
        const nextEvent = this.processingQueue[0];
        if (nextEvent?.type === EventType.PLAYER_CHOICE_REQUIRED && 
            nextEvent?.status === EventStatus.DECLARED) {
            return nextEvent;
        }
        return null;
    }
    
    /**
     * Get processing queue size
     */
    public getProcessingQueueSize(): number {
        return this.processingQueue.length;
    }
    
    /**
     * Legacy method for backward compatibility
     */
    public getEventQueueSize(): number {
        return this.getProcessingQueueSize();
    }
    
    /**
     * Check if processing queue is empty
     */
    public isProcessingQueueEmpty(): boolean {
        return this.processingQueue.length === 0;
    }
    
    /**
     * Legacy method for backward compatibility
     */
    public isEventQueueEmpty(): boolean {
        return this.isProcessingQueueEmpty();
    }
    
    /**
     * Clear processing queue (for cleanup)
     */
    public clearProcessingQueue(): void {
        this.processingQueue = [];
        console.log('🧹 Processing queue cleared');
    }
    
    /**
     * Legacy method for backward compatibility
     */
    public clearEventQueue(): void {
        this.clearProcessingQueue();
    }
    
    /**
     * Sort events by priority and timestamp
     */
    private sortEventsByPriority(): void {
        this.processingQueue.sort((a, b) => {
            // Higher priority (lower number) goes first
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            // Earlier timestamp goes first within same priority
            return a.timestamp - b.timestamp;
        });
    }
    
    // ============ LEGACY EVENT SYSTEM (Removed) ============
    // EventManager functionality has been moved to direct GameEnvironment methods
    // Use processEvents() instead of eventManager.processEvent()
    // Use enqueueEvent() instead of eventManager.enqueue()

    // ============ GAME STATE METHODS ============

    public updatePhase(newPhase: GamePhase): void {
        this.phase = newPhase;
        console.log(`📋 Phase changed to: ${newPhase}`);
    }

    public isGameReady(): boolean {
        return this.playerId_1 !== null && this.playerId_2 !== null;
    }

    public canStartGame(): boolean {
        return this.isGameReady() && this.phase === GamePhase.REDRAW_PHASE;
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
            
            // Internal processing event system
            processingQueue: this.processingQueue,
            processingEnabled: this.processingEnabled,
            maxEventsPerCycle: this.maxEventsPerCycle,
            
            // Frontend notification system
            pendingCardSelections: this.pendingCardSelections,
            notificationQueue: this.notificationQueue,
            lastEventId: this.lastEventId,
            
            // Legacy compatibility - keep old field names for backward compatibility
            events: this.processingQueue,
            gameEvents: this.notificationQueue
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
        
        // Restore event systems - handle both new and legacy formats
        gameEnv.processingQueue = data.processingQueue || data.events || [];
        gameEnv.processingEnabled = data.processingEnabled !== false;
        gameEnv.maxEventsPerCycle = data.maxEventsPerCycle || 50;
        
        // Frontend notification system
        gameEnv.pendingCardSelections = data.pendingCardSelections || {};
        gameEnv.notificationQueue = data.notificationQueue || data.gameEvents || [];
        gameEnv.lastEventId = data.lastEventId || 0;
        
        return gameEnv;
    }
}