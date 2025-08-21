/**
 * UnifiedEventManager.ts - Single Source of Truth for Event Management
 * 
 * Eliminates duplication between GameEnvironment.EventManager and services/EventManager.js
 * Combines the best features of both implementations:
 * - TypeScript type safety from GameEnvironment.EventManager
 * - Rich specialized methods from services/EventManager.js
 * - Consistent API that works as both instance and static service
 * 
 * Usage Patterns:
 * 1. Instance-based (embedded in GameEnvironment): gameEnv.eventManager.addEvent(type, data)
 * 2. Static service (external operations): UnifiedEventManager.addEvent(gameEnv, type, data)
 */

import { EventType } from '../models/GameEnvironment';

export interface GameEvent {
    id: string;
    type: EventType;
    data: any;
    timestamp: number;
    expiresAt: number;
    frontendProcessed: boolean;
    requireFrontendAcknowledgment: boolean;
}

export interface CardDetails {
    cardId: string;
    name: string;
    power?: number;
    cardType?: string;
    gameType?: string;
}

export interface SelectionData {
    selectCount: number;
    availableCards: any[];
    effectDescription?: string;
}

/**
 * UnifiedEventManager - Single implementation for all event management
 * 
 * Features:
 * - TypeScript type safety with EventType enum
 * - Rich specialized methods for different event types
 * - Both instance-based and static usage patterns
 * - Automatic cleanup and memory management
 * - Frontend acknowledgment system
 * - 3-second event expiration
 */
export class UnifiedEventManager {
    private events: GameEvent[] = [];
    private lastEventId: number = 0;
    
    // Event configuration constants
    private static readonly EVENT_EXPIRATION_MS = 3000; // 3 seconds

    // ============ INSTANCE METHODS (for GameEnvironment integration) ============

    /**
     * Add event to this manager instance (instance-based usage)
     */
    public addEvent(type: EventType, data: any, requireFrontendAcknowledgment: boolean = false): GameEvent {
        this.lastEventId++;
        const timestamp = Date.now();
        
        const event: GameEvent = {
            id: `event_${timestamp}_${this.lastEventId}`,
            type,
            data,
            timestamp,
            expiresAt: timestamp + UnifiedEventManager.EVENT_EXPIRATION_MS,
            frontendProcessed: false,
            requireFrontendAcknowledgment: requireFrontendAcknowledgment
        };
        
        this.events.push(event);
        this.cleanupExpiredEvents();
        
        console.log(`🎯 UnifiedEventManager: Event created ${event.id} (type: ${type})`);
        return event;
    }

    /**
     * Get all events from this manager instance
     */
    public getEvents(): GameEvent[] {
        this.cleanupExpiredEvents();
        return [...this.events];
    }

    /**
     * Get unprocessed events from this manager instance
     */
    public getUnprocessedEvents(): GameEvent[] {
        this.cleanupExpiredEvents();
        return this.events.filter(event => !event.frontendProcessed);
    }

    /**
     * Acknowledge events by IDs in this manager instance
     */
    public acknowledgeEvents(eventIds: string[]): void {
        console.log(`🎯 UnifiedEventManager: Acknowledging ${eventIds.length} events`);
        
        let acknowledgedCount = 0;
        this.events.forEach(event => {
            if (eventIds.includes(event.id)) {
                event.frontendProcessed = true;
                event.requireFrontendAcknowledgment = false;
                acknowledgedCount++;
            }
        });
        
        console.log(`✅ Acknowledged ${acknowledgedCount}/${eventIds.length} events`);
    }

    /**
     * Clean expired events from this manager instance
     */
    private cleanupExpiredEvents(): void {
        const now = Date.now();
        const originalCount = this.events.length;
        
        this.events = this.events.filter(event => 
            event.expiresAt > now || !event.frontendProcessed
        );
        
        const cleanedCount = originalCount - this.events.length;
        if (cleanedCount > 0) {
            console.log(`🧹 UnifiedEventManager: Cleaned ${cleanedCount} expired events`);
        }
    }

    /**
     * Get last event ID for serialization
     */
    public getLastEventId(): number {
        return this.lastEventId;
    }

    // ============ SERIALIZATION SUPPORT ============

    /**
     * Serialize to JSON for GameEnvironment persistence
     */
    public toJSON(): any {
        return {
            gameEvents: this.events,
            lastEventId: this.lastEventId
        };
    }

    /**
     * Deserialize from JSON for GameEnvironment loading
     */
    public static fromJSON(data: any): UnifiedEventManager {
        const manager = new UnifiedEventManager();
        manager.events = data.gameEvents || [];
        manager.lastEventId = data.lastEventId || 0;
        return manager;
    }

    // ============ STATIC METHODS (for external service usage) ============

    /**
     * Add event to external gameEnv object (static service usage)
     * Maintains compatibility with existing EventManager.js usage pattern
     */
    public static addGameEvent(
        gameEnv: any, 
        eventType: EventType, 
        eventData: any = {}, 
        requireFrontendAcknowledgment: boolean = false
    ): GameEvent {
        // Initialize event manager if not present
        if (!gameEnv.eventManager) {
            gameEnv.eventManager = new UnifiedEventManager();
        }

        // Ensure eventManager is UnifiedEventManager instance
        if (!(gameEnv.eventManager instanceof UnifiedEventManager)) {
            // Convert old EventManager to UnifiedEventManager
            const newManager = new UnifiedEventManager();
            if (gameEnv.eventManager.toJSON) {
                const data = gameEnv.eventManager.toJSON();
                newManager.events = data.gameEvents || [];
                newManager.lastEventId = data.lastEventId || 0;
            }
            gameEnv.eventManager = newManager;
        }

        return gameEnv.eventManager.addEvent(eventType, eventData, requireFrontendAcknowledgment);
    }

    /**
     * Clean expired events in external gameEnv object
     */
    public static cleanExpiredEvents(gameEnv: any): void {
        if (gameEnv.eventManager && gameEnv.eventManager instanceof UnifiedEventManager) {
            gameEnv.eventManager.cleanupExpiredEvents();
        }
    }

    /**
     * Get unprocessed events from external gameEnv object
     */
    public static getUnprocessedEvents(gameEnv: any): GameEvent[] {
        if (gameEnv.eventManager && gameEnv.eventManager instanceof UnifiedEventManager) {
            return gameEnv.eventManager.getUnprocessedEvents();
        }
        return [];
    }

    /**
     * Acknowledge events in external gameEnv object
     */
    public static acknowledgeEvents(gameEnv: any, eventIds: string[]): void {
        if (gameEnv.eventManager && gameEnv.eventManager instanceof UnifiedEventManager) {
            gameEnv.eventManager.acknowledgeEvents(eventIds);
        }
    }

    // ============ SPECIALIZED EVENT CREATION METHODS ============

    /**
     * Add error event with standardized structure
     */
    public static addErrorEvent(
        gameEnv: any, 
        errorType: string, 
        errorMessage: string, 
        playerId: string | null = null
    ): GameEvent {
        console.log(`❌ UnifiedEventManager: Error ${errorType} for player ${playerId}: ${errorMessage}`);
        
        return UnifiedEventManager.addGameEvent(gameEnv, EventType.ERROR_OCCURRED, {
            errorType: errorType,
            message: errorMessage,
            playerId: playerId,
            timestamp: Date.now()
        });
    }

    /**
     * Add card played event with full details
     */
    public static addCardPlayedEvent(
        gameEnv: any, 
        playerId: string, 
        cardDetails: CardDetails, 
        zone: string, 
        isFaceDown: boolean = false
    ): GameEvent {
        console.log(`🎴 UnifiedEventManager: Card played - ${cardDetails.name} in ${zone} (faceDown: ${isFaceDown})`);
        
        return UnifiedEventManager.addGameEvent(gameEnv, EventType.CARD_PLAYED, {
            playerId: playerId,
            card: {
                cardId: cardDetails.cardId,
                name: cardDetails.name,
                power: cardDetails.power,
                cardType: cardDetails.cardType,
                gameType: cardDetails.gameType
            },
            zone: zone,
            isFaceDown: isFaceDown,
            timestamp: Date.now()
        });
    }

    /**
     * Add zone filled event
     */
    public static addZoneFilledEvent(
        gameEnv: any, 
        playerId: string, 
        zone: string, 
        cardDetails?: CardDetails
    ): GameEvent {
        console.log(`🏟️ UnifiedEventManager: Zone ${zone} filled for player ${playerId}`);
        
        return UnifiedEventManager.addGameEvent(gameEnv, EventType.ZONE_FILLED, {
            playerId: playerId,
            zone: zone,
            card: cardDetails ? {
                cardId: cardDetails.cardId,
                name: cardDetails.name
            } : null,
            timestamp: Date.now()
        });
    }

    /**
     * Add turn switch event
     */
    public static addTurnSwitchEvent(
        gameEnv: any, 
        oldPlayer: string, 
        newPlayer: string, 
        turn: number
    ): GameEvent {
        console.log(`🔄 UnifiedEventManager: Turn switch from ${oldPlayer} to ${newPlayer} (turn ${turn})`);
        
        return UnifiedEventManager.addGameEvent(gameEnv, EventType.TURN_SWITCH, {
            oldPlayer: oldPlayer,
            newPlayer: newPlayer,
            turn: turn,
            timestamp: Date.now()
        });
    }

    /**
     * Add phase change event
     */
    public static addPhaseChangeEvent(
        gameEnv: any, 
        oldPhase: string, 
        newPhase: string, 
        reason?: string
    ): GameEvent {
        console.log(`📋 UnifiedEventManager: Phase change from ${oldPhase} to ${newPhase}${reason ? ` (${reason})` : ''}`);
        
        return UnifiedEventManager.addGameEvent(gameEnv, EventType.PHASE_CHANGE, {
            oldPhase: oldPhase,
            newPhase: newPhase,
            reason: reason,
            timestamp: Date.now()
        });
    }

    /**
     * Add draw phase complete event
     */
    public static addDrawPhaseCompleteEvent(
        gameEnv: any, 
        playerId: string, 
        cardCount: number, 
        newHandSize: number
    ): GameEvent {
        console.log(`🎴 UnifiedEventManager: Draw phase complete for ${playerId} - drew ${cardCount} cards`);
        
        return UnifiedEventManager.addGameEvent(gameEnv, EventType.DRAW_PHASE_COMPLETE, {
            playerId: playerId,
            cardCount: cardCount,
            newHandSize: newHandSize,
            timestamp: Date.now()
        }, true); // Requires acknowledgment
    }

    /**
     * Add card selection required event
     */
    public static addCardSelectionRequiredEvent(
        gameEnv: any, 
        playerId: string, 
        selectionId: string, 
        selectionData: SelectionData
    ): GameEvent {
        console.log(`🎯 UnifiedEventManager: Card selection required for ${playerId} (${selectionId})`);
        
        return UnifiedEventManager.addGameEvent(gameEnv, EventType.CARD_SELECTION_REQUIRED, {
            playerId: playerId,
            selectionId: selectionId,
            selectCount: selectionData.selectCount,
            availableCards: selectionData.availableCards,
            effectDescription: selectionData.effectDescription,
            timestamp: Date.now()
        });
    }

    /**
     * Add battle result event
     */
    public static addBattleResultEvent(
        gameEnv: any, 
        winner: string, 
        scores: any, 
        victoryPoints: any
    ): GameEvent {
        console.log(`⚔️ UnifiedEventManager: Battle completed - winner: ${winner}`);
        
        return UnifiedEventManager.addGameEvent(gameEnv, EventType.BATTLE_RESULT, {
            winner: winner,
            scores: scores,
            victoryPoints: victoryPoints,
            timestamp: Date.now()
        });
    }

    // ============ BATCH OPERATIONS ============

    /**
     * Add multiple game startup events
     */
    public static addGameStartedEvents(gameEnv: any, playerList: string[], firstPlayer: number): void {
        console.log(`🎮 UnifiedEventManager: Adding game started events for ${playerList.length} players`);
        
        // Main game started event
        UnifiedEventManager.addGameEvent(gameEnv, EventType.GAME_STARTED, {
            players: playerList,
            firstPlayer: playerList[firstPlayer],
            timestamp: Date.now()
        });
        
        // Initial hand dealt events for each player
        for (let playerId of playerList) {
            const handSize = gameEnv.players[playerId]?.deck?.hand?.length || 0;
            UnifiedEventManager.addGameEvent(gameEnv, EventType.INITIAL_HAND_DEALT, {
                playerId: playerId,
                handSize: handSize,
                timestamp: Date.now()
            });
        }
        
        console.log(`✅ Generated ${playerList.length + 1} game startup events`);
    }
}

export default UnifiedEventManager;