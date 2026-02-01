// src/services/GameNotificationManager.ts
// Frontend notification event management for gameEnv.notificationQueue
// NOTE: This is separate from EventQueue system - handles frontend polling notifications

import { GameEnvironment } from '../models/GameEnvironment';

// ============ NOTIFICATION EVENT INTERFACES ============

export interface GameNotificationEvent {
    id: string;
    type: string;
    metadata: {
        timestamp: number;
        expiresAt: number;
        requiresAcknowledgment: boolean;
        priority: 'low' | 'normal' | 'high' | 'critical';
    };
    payload: NotificationEventData;
}

export interface NotificationEventData {
    playerId?: string;
    gameId?: string;
    [key: string]: any;
}

// ============ GAME NOTIFICATION MANAGER ============

export class GameNotificationManager {
    private gameEnv: GameEnvironment;
    private readonly EVENT_EXPIRY_MS = 3000; // 3 seconds
    
    constructor(gameEnv: GameEnvironment) {
        this.gameEnv = gameEnv;
        this.initializeGameEvents();
    }
    
    // ============ INITIALIZATION ============
    
    private initializeGameEvents(): void {
        if (!this.gameEnv.notificationQueue) {
            this.gameEnv.notificationQueue = [];
            console.log('📨 GameNotificationManager: Initialized notificationQueue array');
        }
    }
    
    // ============ EVENT CREATION ============
    
    /**
     * Add a notification event to gameEnv.notificationQueue for frontend consumption
     */
    addNotificationEvent(
        type: string, 
        payload: NotificationEventData, 
        priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
    ): string {
        this.initializeGameEvents();
        
        const eventId = `${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const timestamp = Date.now();
        
        const notificationEvent: GameNotificationEvent = {
            id: eventId,
            type,
            metadata: {
                timestamp,
                expiresAt: timestamp + this.EVENT_EXPIRY_MS,
                requiresAcknowledgment: false,
                priority
            },
            payload
        };
        
        this.gameEnv.notificationQueue!.push(notificationEvent);
        
        console.log(`📨 Added notification event: ${type} (${eventId}) - Priority: ${priority}, Ack: false`);
        return eventId;
    }

    /**
     * Add a notification event with a caller-supplied ID (for alignment with processingQueue events).
     */
    addNotificationEventWithId(
        eventId: string,
        type: string,
        payload: NotificationEventData,
        priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
    ): string {
        this.initializeGameEvents();

        const timestamp = Date.now();
        const notificationEvent: GameNotificationEvent = {
            id: eventId,
            type,
            metadata: {
                timestamp,
                expiresAt: timestamp + this.EVENT_EXPIRY_MS,
                requiresAcknowledgment: false,
                priority
            },
            payload
        };

        this.gameEnv.notificationQueue!.push(notificationEvent);
        console.log(`📨 Added notification event: ${type} (${eventId}) - Priority: ${priority}, Ack: false`);
        return eventId;
    }

    /**
     * Emit a phase change notification (no acknowledgment required).
     */
    static emitPhaseChange(
        gameEnv: GameEnvironment,
        previousPhase: string,
        nextPhase: string,
        playerId?: string | null
    ): string {
        const notificationManager = new GameNotificationManager(gameEnv);
        return notificationManager.addNotificationEvent(
            'PHASE_CHANGED',
            {
                playerId: playerId ?? gameEnv.currentPlayer ?? undefined,
                previousPhase,
                nextPhase,
                currentTurn: gameEnv.currentTurn
            },
            'normal'
        );
    }

    /**
     * Update an existing notification payload / metadata (e.g. for completion flags)
     */
    updateNotificationEvent(
        eventId: string,
        payloadUpdates: Partial<NotificationEventData> = {},
        metadataUpdates: Partial<GameNotificationEvent['metadata']> = {}
    ): boolean {
        if (!this.gameEnv.notificationQueue) {
            return false;
        }

        const event = this.gameEnv.notificationQueue.find(evt => evt.id === eventId);
        if (!event) {
            return false;
        }

        event.payload = {
            ...event.payload,
            ...payloadUpdates
        };

        event.metadata = {
            ...event.metadata,
            ...metadataUpdates
        };

        if (payloadUpdates.isCompleted === true && event.type === 'CARD_PLAYED') {
            event.type = 'CARD_PLAYED_COMPLETED';
        }

        console.log(`🔄 Updated notification event: ${event.type} (${event.id})`);
        return true;
    }

    /**
     * Make a notification persist until explicitly acknowledged by the frontend.
     * Uses a far-future expiresAt so cleanupProcessedEvents() does not remove it.
     */
    makePersistent(eventId: string): boolean {
        return this.updateNotificationEvent(
            eventId,
            {},
            {
                expiresAt: Number.MAX_SAFE_INTEGER,
                requiresAcknowledgment: true
            }
        );
    }
    
     /**
     * Notify frontend about card draw (requires acknowledgment)
     */
    // ============ EVENT MANAGEMENT ============
    
    /**
     * Mark specific events as processed by frontend
     */
    acknowledgeEvents(eventIds: string[]): number {
        if (!this.gameEnv.notificationQueue) return 0;
        
        let acknowledgedCount = 0;
        
        this.gameEnv.notificationQueue.forEach(event => {
            if (eventIds.includes(event.id)) {
                acknowledgedCount++;
                console.log(`✅ Acknowledged event: ${event.type} (${event.id})`);
            }
        });
        
        this.cleanupSpecificEvents(eventIds);
        
        return acknowledgedCount;
    }
    
    
    /**
     * Clean up expired and processed events
     */
    cleanupProcessedEvents(): number {
        if (!this.gameEnv.notificationQueue) return 0;
        
        const initialCount = this.gameEnv.notificationQueue.length;
        const now = Date.now();
        
        this.gameEnv.notificationQueue = this.gameEnv.notificationQueue.filter(event => {
            const isExpired = now > event.metadata.expiresAt;
            
            if (isExpired) {
                console.log(`🧹 Cleaned up event: ${event.type} (${event.id}) - expired`);
            }
            return !isExpired;
        });
        
        const cleanedCount = initialCount - this.gameEnv.notificationQueue.length;
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} events, ${this.gameEnv.notificationQueue.length} remaining`);
        }
        
        return cleanedCount;
    }
    
    /**
     * Clean up only specific acknowledged events
     */
    cleanupSpecificEvents(eventIds: string[]): number {
        if (!this.gameEnv.notificationQueue || !eventIds.length) return 0;
        
        const initialCount = this.gameEnv.notificationQueue.length;
        
        this.gameEnv.notificationQueue = this.gameEnv.notificationQueue.filter(event => {
            const isSpecificAcknowledged = eventIds.includes(event.id);
            
            if (isSpecificAcknowledged) {
                return false;
            }
            return true;
        });
        
        const cleanedCount = initialCount - this.gameEnv.notificationQueue.length;
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} specific events, ${this.gameEnv.notificationQueue.length} remaining`);
        }
        
        return cleanedCount;
    }
    
    /**
     * Get all unprocessed events for a specific player
     */
    getUnprocessedEventsForPlayer(playerId: string): GameNotificationEvent[] {
        if (!this.gameEnv.notificationQueue) return [];
        
        this.cleanupProcessedEvents(); // Clean first
        
        return this.gameEnv.notificationQueue.filter(event => 
            (event.payload.playerId === playerId || !event.payload.playerId) // Include global events
        );
    }
    
    /**
     * Get all unprocessed events (for debugging)
     */
    getAllUnprocessedEvents(): GameNotificationEvent[] {
        if (!this.gameEnv.notificationQueue) return [];
        
        this.cleanupProcessedEvents(); // Clean first
        
        return [...this.gameEnv.notificationQueue];
    }
    
    // ============ UTILITY METHODS ============
    
    /**
     * Get event statistics
     */
    getEventStats(): { total: number; unprocessed: number; expired: number } {
        if (!this.gameEnv.notificationQueue) {
            return { total: 0, unprocessed: 0, expired: 0 };
        }
        
        const now = Date.now();
        const total = this.gameEnv.notificationQueue.length;
        const unprocessed = this.gameEnv.notificationQueue.length;
        const expired = this.gameEnv.notificationQueue.filter(e => now > e.metadata.expiresAt).length;
        
        return { total, unprocessed, expired };
    }
    
    /**
     * Force cleanup all events (for testing)
     */
    clearAllEvents(): number {
        if (!this.gameEnv.notificationQueue) return 0;
        
        const count = this.gameEnv.notificationQueue.length;
        this.gameEnv.notificationQueue = [];
        
        console.log(`🧹 Force cleared ${count} events`);
        return count;
    }
    
    /**
     * Check if there are pending events that require acknowledgment
     */
    hasPendingAcknowledgments(): boolean {
        return false;
    }
}
