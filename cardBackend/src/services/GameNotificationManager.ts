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
        frontendProcessed: boolean;
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
        requiresAcknowledgment: boolean = false,
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
                requiresAcknowledgment,
                frontendProcessed: false,
                priority
            },
            payload
        };
        
        this.gameEnv.notificationQueue!.push(notificationEvent);
        
        console.log(`📨 Added notification event: ${type} (${eventId}) - Priority: ${priority}, Ack: ${requiresAcknowledgment}`);
        return eventId;
    }
    
     /**
     * Notify frontend about card draw (requires acknowledgment)
     */
    notifyRedrawEvent(playerId: string): string {
        return this.addNotificationEvent(
            'PLAYER_REDRAW', 
            {
                playerId
            },
            true, // requiresAcknowledgment
            'normal' // priority
        );
    }
    
    /**
     * Notify frontend about card draw (requires acknowledgment)
     */
    notifyCardDrawn(playerId: string, drawnCardUids: string[], newHandSize: number): string {
        return this.addNotificationEvent(
            'CARD_DRAWN', 
            {
                playerId,
                drawnCards: drawnCardUids,
                cardsDrawn: drawnCardUids.length,
                newHandSize
            },
            true, // requiresAcknowledgment
            'normal' // priority
        );
    }
    
    
    /**
     * Notify frontend about gameplay beginning
     */
    notifyGameplayBegins(firstPlayerId: string, secondPlayerId: string, currentPhase: string): string {
        return this.addNotificationEvent(
            'GAMEPLAY_BEGINS', 
            {
                firstPlayerId,
                secondPlayerId,
                currentPhase,
                currentPlayer: firstPlayerId,
                resourcesAllocated: true
            },
            false, // requiresAcknowledgment
            'high' // priority
        );
    }
    
    /**
     * Notify frontend about error occurrence
     */
    notifyError(errorType: string, errorReason: string, playerId?: string, originalEventType?: string): string {
        return this.addNotificationEvent(
            'ERROR_OCCURRED', 
            {
                errorType,
                errorReason,
                playerId,
                originalEventType
            },
            false, // requiresAcknowledgment
            'critical' // priority
        );
    }
    
    // ============ EVENT MANAGEMENT ============
    
    /**
     * Mark specific events as processed by frontend
     */
    acknowledgeEvents(eventIds: string[]): number {
        if (!this.gameEnv.notificationQueue) return 0;
        
        let acknowledgedCount = 0;
        
        this.gameEnv.notificationQueue.forEach(event => {
            if (eventIds.includes(event.id) && !event.metadata.frontendProcessed) {
                event.metadata.frontendProcessed = true;
                acknowledgedCount++;
                console.log(`✅ Acknowledged event: ${event.type} (${event.id})`);
            }
        });
        
        // Clean up only the acknowledged events immediately
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
            const isProcessed = event.metadata.frontendProcessed;
            
            if (isExpired || isProcessed) {
                console.log(`🧹 Cleaned up event: ${event.type} (${event.id}) - ${isExpired ? 'expired' : 'processed'}`);
                return false;
            }
            return true;
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
            const isSpecificAcknowledged = eventIds.includes(event.id) && event.metadata.frontendProcessed;
            
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
            !event.metadata.frontendProcessed && 
            (event.payload.playerId === playerId || !event.payload.playerId) // Include global events
        );
    }
    
    /**
     * Get all unprocessed events (for debugging)
     */
    getAllUnprocessedEvents(): GameNotificationEvent[] {
        if (!this.gameEnv.notificationQueue) return [];
        
        this.cleanupProcessedEvents(); // Clean first
        
        return this.gameEnv.notificationQueue.filter(event => !event.metadata.frontendProcessed);
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
        const unprocessed = this.gameEnv.notificationQueue.filter(e => !e.metadata.frontendProcessed).length;
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
        if (!this.gameEnv.notificationQueue) return false;
        
        this.cleanupProcessedEvents();
        
        return this.gameEnv.notificationQueue.some(event => 
            !event.metadata.frontendProcessed && 
            event.metadata.requiresAcknowledgment === true
        );
    }
}