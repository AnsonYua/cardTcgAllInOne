// src/models/GameEnvironment.ts
// Main GameEnvironment class for custom trading card game

import { GamePhase, ZoneType, EventType } from './GameEnums';
import { Player, PlayerZones } from './Player';
// EventManager removed - using direct event processing
import { GameEvent, EventStatus, EventPriority, BurstEffectChoiceEvent, TargetChoiceEvent, BlockerChoiceEvent } from '../services/EventQueue/interfaces/GameEvent';
import { ProcessingResult } from './EventInterfaces';
import { BattleContext, ActionStepTargetSummary } from './BattleContext';
import { EffectScannerUtils } from '../utils/EffectScannerUtils';

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
    public firstPlayerChooser: string | null;
    public firstPlayerDecision: string | null;
    public hasChosenFirstPlayer: boolean;
    public currentPlayer: string | null;
    public currentTurn: number;
    public playersReady: { [playerId: string]: boolean };
    
    // Object-oriented components
    public players: { [playerId: string]: Player };
    public currentBattle?: BattleContext;
    public version: number;
    private battlePhaseReturnPoint?: GamePhase;
    
    
    // Unified event system - renamed for clarity
    public processingQueue: GameEvent[] = [];
    public processingEnabled: boolean = true;
    public maxEventsPerCycle: number = 50;
    
    // Frontend notification system (for frontend polling)
    public notificationQueue?: any[];
    public lastEventId?: number;

    // Phase transition guard to avoid duplicate SBA enqueues
    public pendingPhaseTransition: EventType | null;
    
    // Card selection system - REMOVED: pendingCardSelections no longer needed
    // Deploy effects now process automatically with smart target selection
    
    // Legacy compatibility (removed - no longer using EventManager)

    constructor() {
        this.phase = GamePhase.WAITING_FOR_PLAYERS;
        this.playerId_1 = null;
        this.playerId_2 = null;
        this.gameStarted = false;
        this.firstPlayer = 0;
        this.firstPlayerChooser = null;
        this.firstPlayerDecision = null;
        this.hasChosenFirstPlayer = false;
        this.currentPlayer = null;
        this.currentTurn = 0;
        this.playersReady = {};
        
        this.players = {};
        this.currentBattle = undefined;
        this.version = 0;
        this.battlePhaseReturnPoint = undefined;
        
        // Initialize event systems
        this.processingQueue = [];
        this.processingEnabled = true;
        this.maxEventsPerCycle = 50;
        
        // Initialize frontend notification system
        this.notificationQueue = [];
        this.lastEventId = 0;

        this.pendingPhaseTransition = null;
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

    // ============ BATTLE CONTEXT HELPERS ============

    public setCurrentBattle(context: BattleContext): void {
        const confirmations: Record<string, boolean> = {};
        if (context.attackingPlayerId) {
            confirmations[context.attackingPlayerId] = false;
        }
        if (context.defendingPlayerId) {
            confirmations[context.defendingPlayerId] = false;
        }

        this.currentBattle = {
            ...context,
            confirmations
        };
        this.enterActionStepPhase();
        this.refreshBattleActionTargets();
        console.log(`⚔️ Battle context initialized for ${context.actionType} between ${context.attackingPlayerId} and ${context.defendingPlayerId}`);
    }

    public clearCurrentBattle(): void {
        if (this.currentBattle) {
            console.log('🛑 Clearing battle context');
        }
        this.currentBattle = undefined;
        this.resetBattlePhaseState();
    }

    public hasActiveBattle(): boolean {
        return !!this.currentBattle && this.currentBattle.status === 'ACTION_STEP';
    }

    public confirmBattleResolution(playerId: string): { success: boolean; error?: string } {
        const battle = this.currentBattle;
        if (!battle) {
            return { success: false, error: 'No active battle to confirm' };
        }

        if (playerId !== battle.attackingPlayerId && playerId !== battle.defendingPlayerId) {
            return { success: false, error: 'Player not involved in current battle' };
        }

        if (!battle.confirmations) {
            battle.confirmations = {};
        }

        battle.confirmations[playerId] = true;
        console.log(`🤝 Battle confirmation recorded for ${playerId}`);
        return { success: true };
    }

    public haveBothPlayersConfirmedBattle(): boolean {
        const battle = this.currentBattle;
        if (!battle) {
            return false;
        }

        const { confirmations, attackingPlayerId, defendingPlayerId } = battle;
        if (!confirmations) {
            return false;
        }

        const attackerConfirmed = attackingPlayerId ? confirmations[attackingPlayerId] === true : false;
        const defenderConfirmed = defendingPlayerId ? confirmations[defendingPlayerId] === true : false;

        return attackerConfirmed && defenderConfirmed;
    }

    public enterBlockerPhase(): void {
        this.enterBattleSubPhase(GamePhase.BLOCKER_PHASE);
    }

    public enterActionStepPhase(): void {
        this.enterBattleSubPhase(GamePhase.ACTION_STEP_PHASE);
    }

    private enterBattleSubPhase(phase: GamePhase.BLOCKER_PHASE | GamePhase.ACTION_STEP_PHASE): void {
        if (!this.battlePhaseReturnPoint && this.phase !== phase) {
            this.battlePhaseReturnPoint = this.phase;
        }
        this.updatePhase(phase);
    }

    public resetBattlePhaseState(): void {
        if (this.battlePhaseReturnPoint) {
            this.updatePhase(this.battlePhaseReturnPoint);
            this.battlePhaseReturnPoint = undefined;
            return;
        }

        if (this.phase === GamePhase.BLOCKER_PHASE || this.phase === GamePhase.ACTION_STEP_PHASE) {
            this.updatePhase(GamePhase.MAIN_PHASE);
        }
    }

    public refreshBattleActionTargets(): void {
        if (!this.currentBattle) {
            return;
        }

        if (this.currentBattle.status !== 'ACTION_STEP') {
            delete this.currentBattle.actionTargets;
            return;
        }

        const { attackingPlayerId, defendingPlayerId } = this.currentBattle;
        const actionTargets: Record<string, ActionStepTargetSummary[]> = {};

        if (attackingPlayerId) {
            actionTargets[attackingPlayerId] = EffectScannerUtils.collectActionStepTargets(
                this,
                attackingPlayerId
            );
        }

        if (defendingPlayerId) {
            actionTargets[defendingPlayerId] = EffectScannerUtils.collectActionStepTargets(
                this,
                defendingPlayerId
            );
        }

        this.currentBattle.actionTargets = actionTargets;

        if (!this.currentBattle.confirmations) {
            this.currentBattle.confirmations = {};
        }

        const participants = [attackingPlayerId, defendingPlayerId].filter((id): id is string => typeof id === 'string');
        for (const playerId of participants) {
            const targets = actionTargets[playerId] || [];
            if (targets.length === 0) {
                this.currentBattle.confirmations[playerId] = true;
            } else if (this.currentBattle.confirmations[playerId] === undefined) {
                this.currentBattle.confirmations[playerId] = false;
            }
        }
    }
    
    
    // ============ NOTIFICATION QUEUE METHODS ============
    
    /**
     * Add notification event to frontend notification queue
     */
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
        // Check if first event in queue requires user confirmation
        const nextEvent = this.processingQueue[0];
        
        console.log("processs Queue  ", JSON.stringify(this.processingQueue))
        console.log("processs Queue next ", JSON.stringify(nextEvent))
        if (nextEvent?.status === EventStatus.DECLARED) {
            console.log("processs Queue next 111")
            // For burst choice events, check if user has already provided input
            if (nextEvent.type === EventType.BURST_EFFECT_CHOICE) {
                const burstChoice = nextEvent as BurstEffectChoiceEvent;
                return !burstChoice.data.userDecisionMade;
            }
            console.log("processs Queue next 222")
            // For target choice events, check if user has already provided input
            if (nextEvent.type === EventType.TARGET_CHOICE) {
                const targetChoice = nextEvent as TargetChoiceEvent;
                return !targetChoice.data.userDecisionMade;
            }
            console.log("processs Queue next 333")
            // For blocker choice events, check if user has already provided input
            if (nextEvent.type === EventType.BLOCKER_CHOICE) {
                const blockerChoice = nextEvent as BlockerChoiceEvent;
                return !blockerChoice.data.userDecisionMade;
            }
            console.log("processs Queue next 444")
        }
        return false;
    }
    
    /**
     * Get all events requiring user confirmation (for frontend polling)
     */
    public getEventsRequiringConfirmation(): GameEvent[] {
        return this.processingQueue.filter(event => 
            event.status === EventStatus.DECLARED && 
            (event.type === EventType.BURST_EFFECT_CHOICE ||
             event.type === EventType.TARGET_CHOICE ||
             event.type === EventType.BLOCKER_CHOICE)
        );
    }
    
    /**
     * Get current pending player choice (backward compatibility)
     */
    public getCurrentPlayerChoice(): GameEvent | null {
        const nextEvent = this.processingQueue[0];
        if (nextEvent?.status === EventStatus.DECLARED) {
            if (nextEvent.type === EventType.BURST_EFFECT_CHOICE ||
                nextEvent.type === EventType.TARGET_CHOICE ||
                nextEvent.type === EventType.BLOCKER_CHOICE) {
                return nextEvent;
            }
        }
        return null;
    }
    
    /**
     * Find event by ID in processing queue
     */
    public findEventById(eventId: string): GameEvent | null {
        return this.processingQueue.find(event => event.id === eventId) || null;
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
            const priorityA = typeof a.priority === 'number' ? a.priority : EventPriority.NORMAL;
            const priorityB = typeof b.priority === 'number' ? b.priority : EventPriority.NORMAL;

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            const timestampA = typeof a.timestamp === 'number' ? a.timestamp : 0;
            const timestampB = typeof b.timestamp === 'number' ? b.timestamp : 0;
            if (timestampA !== timestampB) {
                return timestampA - timestampB;
            }

            return a.id.localeCompare(b.id);
        });
    }
    
    // ============ LEGACY EVENT SYSTEM (Removed) ============
    // EventManager functionality has been moved to direct GameEnvironment methods
    // Use processEvents() instead of eventManager.processEvent()
    // Use enqueueForProcessing() for internal game logic events

    // ============ GAME STATE METHODS ============

    public updatePhase(newPhase: GamePhase, playerId?: string | null): void {
        const previousPhase = this.phase;
        if (previousPhase === newPhase) {
            return;
        }

        this.phase = newPhase;
        console.log(`📋 Phase changed to: ${newPhase}`);

        try {
            const { GameNotificationManager } = require('../services/GameNotificationManager');
            if (GameNotificationManager?.emitPhaseChange) {
                GameNotificationManager.emitPhaseChange(this, previousPhase, newPhase, playerId);
            }
        } catch (error) {
            console.error('❌ Failed to emit phase change notification:', error);
        }
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

    public placeCardInZone(playerId: string, zone: ZoneType, carduid: string): boolean {
        console.log(`🔍 placeCardInZone called: playerId=${playerId}, zone=${zone}, carduid=${carduid}`);
        
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        player.setCardInZone(zone, carduid, undefined);
        
        const zoneName = zone.toLowerCase() as keyof PlayerZones;
        console.log(`🔍 After setCardInZone: ${zone} zone contains:`, player.zones[zoneName]);
        
        return true;
    }


    public playCard(playerId: string, carduid: string, zone: ZoneType): boolean {
        const player = this.getPlayer(playerId);
        if (!player) return false;
        
        // Remove card from hand
        if (!player.playCardFromHand(carduid)) return false;
        
        // Place in zone
        return this.placeCardInZone(playerId, zone, carduid);
    }

    // ============ SERIALIZATION ============

    public toJSON(): any {
        if (this.currentBattle) {
            this.refreshBattleActionTargets();
        }
        return {
            version: this.version,
            phase: this.phase,
            playerId_1: this.playerId_1,
            playerId_2: this.playerId_2,
            gameStarted: this.gameStarted,
            firstPlayer: this.firstPlayer,
            firstPlayerChooser: this.firstPlayerChooser,
            firstPlayerDecision: this.firstPlayerDecision,
            hasChosenFirstPlayer: this.hasChosenFirstPlayer,
            currentPlayer: this.currentPlayer,
            currentTurn: this.currentTurn,
            playersReady: this.playersReady,
            currentBattle: this.currentBattle ? { ...this.currentBattle } : null,
            
            players: Object.fromEntries(
                Object.entries(this.players).map(([id, player]) => [id, player.toJSON()])
            ),
            
            // Internal processing event system
            processingQueue: this.processingQueue,
            processingEnabled: this.processingEnabled,
            maxEventsPerCycle: this.maxEventsPerCycle,
            
            // Frontend notification system
            notificationQueue: this.notificationQueue,
            lastEventId: this.lastEventId,
            battlePhaseReturnPoint: this.battlePhaseReturnPoint,
            pendingPhaseTransition: this.pendingPhaseTransition,
            
        };
    }

    public static fromJSON(data: any): GameEnvironment {
        const gameEnv = new GameEnvironment();
        
        gameEnv.phase = data.phase || GamePhase.WAITING_FOR_PLAYERS;
        gameEnv.playerId_1 = data.playerId_1 || null;
        gameEnv.playerId_2 = data.playerId_2 || null;
        gameEnv.gameStarted = data.gameStarted || false;
        gameEnv.firstPlayer = data.firstPlayer || 0;
        gameEnv.firstPlayerChooser = data.firstPlayerChooser || null;
        gameEnv.firstPlayerDecision = data.firstPlayerDecision || null;
        gameEnv.hasChosenFirstPlayer = data.hasChosenFirstPlayer || false;
        gameEnv.currentPlayer = data.currentPlayer || null;
        gameEnv.currentTurn = data.currentTurn || 0;
        gameEnv.playersReady = data.playersReady || {};
        gameEnv.version = typeof data.version === 'number' ? data.version : 0;
        gameEnv.currentBattle = data.currentBattle
            ? (data.currentBattle as BattleContext)
            : undefined;
        if (gameEnv.currentBattle) {
            const confirmations: Record<string, boolean> = gameEnv.currentBattle.confirmations || {};
            if (gameEnv.currentBattle.attackingPlayerId && confirmations[gameEnv.currentBattle.attackingPlayerId] === undefined) {
                confirmations[gameEnv.currentBattle.attackingPlayerId] = false;
            }
            if (gameEnv.currentBattle.defendingPlayerId && confirmations[gameEnv.currentBattle.defendingPlayerId] === undefined) {
                confirmations[gameEnv.currentBattle.defendingPlayerId] = false;
            }
            gameEnv.currentBattle.confirmations = confirmations;
        }
        
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
        gameEnv.notificationQueue = data.notificationQueue || [];
        gameEnv.lastEventId = data.lastEventId || 0;
        gameEnv.battlePhaseReturnPoint = data.battlePhaseReturnPoint;
        gameEnv.pendingPhaseTransition = data.pendingPhaseTransition || null;
        
        return gameEnv;
    }
}
