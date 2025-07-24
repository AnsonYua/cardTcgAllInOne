// =======================================================================================
// 🎯 EVENT MANAGER - Clean Class Implementation for Real-Time Event System
// =======================================================================================
//
// This class handles ALL real-time event management with clear switch-case routing.
// Extracted from the massive mozGamePlay.js for better maintainability.
//
// Key Features:
// - Comprehensive event creation and management system
// - Automatic event expiration and cleanup (3 seconds)
// - Frontend acknowledgment system for processed events
// - Event categorization for different game actions
// - Error event specialization with detailed error context
// - Memory management through automatic cleanup
//
// Event Lifecycle:
// 1. addGameEvent() creates event with timestamp and expiration
// 2. Event persists for 3 seconds or until acknowledged
// 3. cleanExpiredEvents() removes old/processed events
// 4. markEventProcessed() marks events as handled by frontend
//
// Event Categories:
// - Setup Events: GAME_STARTED, INITIAL_HAND_DEALT, PLAYER_READY
// - Turn Events: TURN_SWITCH, PHASE_CHANGE, DRAW_PHASE_COMPLETE
// - Card Events: CARD_PLAYED, CARD_EFFECT_TRIGGERED, ZONE_FILLED
// - Battle Events: ALL_SP_ZONES_FILLED, BATTLE_CALCULATED, VICTORY_POINTS_AWARDED
// - Selection Events: CARD_SELECTION_REQUIRED, CARD_SELECTION_COMPLETED
// - Error Events: All validation failures and game blocking conditions
//
// =======================================================================================

/**
 * EventManager - Manages real-time events for frontend integration
 * 
 * Responsibilities:
 * - Event creation with proper structure and expiration
 * - Event cleanup and memory management
 * - Error event specialization with context
 * - Frontend acknowledgment tracking
 * - Event categorization and routing
 */
class EventManager {
    constructor() {
        // Event configuration
        this.EVENT_EXPIRATION_MS = 3000; // 3 seconds
        this.EVENT_TYPES = {
            // Setup Events
            GAME_STARTED: 'GAME_STARTED',
            INITIAL_HAND_DEALT: 'INITIAL_HAND_DEALT',
            PLAYER_READY: 'PLAYER_READY',
            HAND_REDRAWN: 'HAND_REDRAWN',
            GAME_PHASE_START: 'GAME_PHASE_START',
            
            // Turn & Phase Events
            TURN_SWITCH: 'TURN_SWITCH',
            PHASE_CHANGE: 'PHASE_CHANGE',
            DRAW_PHASE_COMPLETE: 'DRAW_PHASE_COMPLETE',
            ALL_MAIN_ZONES_FILLED: 'ALL_MAIN_ZONES_FILLED',
            ALL_SP_ZONES_FILLED: 'ALL_SP_ZONES_FILLED',
            
            // Card Action Events
            CARD_PLAYED: 'CARD_PLAYED',
            ZONE_FILLED: 'ZONE_FILLED',
            CARD_EFFECT_TRIGGERED: 'CARD_EFFECT_TRIGGERED',
            CARD_SELECTION_REQUIRED: 'CARD_SELECTION_REQUIRED',
            CARD_SELECTION_COMPLETED: 'CARD_SELECTION_COMPLETED',
            CARD_DISCARDED: 'CARD_DISCARDED',
            
            // Battle Events
            SP_CARDS_REVEALED: 'SP_CARDS_REVEALED',
            SP_EFFECTS_EXECUTED: 'SP_EFFECTS_EXECUTED',
            BATTLE_CALCULATED: 'BATTLE_CALCULATED',
            VICTORY_POINTS_AWARDED: 'VICTORY_POINTS_AWARDED',
            NEXT_ROUND_START: 'NEXT_ROUND_START',
            
            // Error Events
            ERROR_OCCURRED: 'ERROR_OCCURRED',
            CARD_SELECTION_PENDING: 'CARD_SELECTION_PENDING',
            WAITING_FOR_PLAYER: 'WAITING_FOR_PLAYER',
            ZONE_COMPATIBILITY_ERROR: 'ZONE_COMPATIBILITY_ERROR',
            PHASE_RESTRICTION_ERROR: 'PHASE_RESTRICTION_ERROR',
            ZONE_OCCUPIED_ERROR: 'ZONE_OCCUPIED_ERROR',
            FIELD_EFFECT_RESTRICTION: 'FIELD_EFFECT_RESTRICTION',
            INVALID_ACTION_TYPE: 'INVALID_ACTION_TYPE',
            INVALID_POSITION: 'INVALID_POSITION',
            INVALID_CARD_INDEX: 'INVALID_CARD_INDEX',
            CARD_NOT_FOUND: 'CARD_NOT_FOUND',
            CARD_TYPE_ZONE_ERROR: 'CARD_TYPE_ZONE_ERROR',
            UNSUPPORTED_ACTION: 'UNSUPPORTED_ACTION',
            GAME_BLOCKED: 'GAME_BLOCKED'
        };
    }

    // =======================================================================================
    // 🎯 Core Event Management - Event System Initialization and Structure
    // =======================================================================================

    /**
     * Initialize event system in game environment
     * Creates event array and tracking fields if not present
     */
    initializeEventSystem(gameEnv) {
        console.log('🎯 EventManager: Initializing event system');
        
        if (!gameEnv.gameEvents) {
            gameEnv.gameEvents = [];
            console.log('🎯 Created new gameEvents array');
        }
        
        if (!gameEnv.lastEventId) {
            gameEnv.lastEventId = 0;
            console.log('🎯 Initialized lastEventId counter');
        }
        
        return gameEnv;
    }

    /**
     * Add a new game event with automatic expiration and ID generation
     * Core method for all event creation throughout the game
     */
    addGameEvent(gameEnv, eventType, eventData = {}) {
        console.log(`🎯 EventManager: Adding event ${eventType}`, eventData);
        
        // Ensure event system is initialized
        this.initializeEventSystem(gameEnv);
        
        // Generate unique event ID and timestamps
        const timestamp = Date.now();
        const eventId = `event_${timestamp}_${gameEnv.lastEventId + 1}`;
        
        // Create event structure with expiration
        const event = {
            id: eventId,
            type: eventType,
            data: eventData,
            timestamp: timestamp,
            expiresAt: timestamp + this.EVENT_EXPIRATION_MS,
            frontendProcessed: false
        };
        
        // Add to game events and increment counter
        gameEnv.gameEvents.push(event);
        gameEnv.lastEventId = gameEnv.lastEventId + 1;
        
        console.log(`🎯 Event created: ${eventId} (expires in ${this.EVENT_EXPIRATION_MS}ms)`);
        
        // Clean expired events after adding new one
        this.cleanExpiredEvents(gameEnv);
        
        return event;
    }

    // =======================================================================================
    // 🎯 Event Lifecycle Management - Cleanup and Processing
    // =======================================================================================

    /**
     * Remove expired and processed events to prevent memory growth
     * Called automatically after each event addition
     */
    cleanExpiredEvents(gameEnv) {
        if (!gameEnv || !gameEnv.gameEvents) return;
        
        const now = Date.now();
        const originalCount = gameEnv.gameEvents.length;
        
        // Keep events that are not expired OR not yet processed by frontend
        gameEnv.gameEvents = gameEnv.gameEvents.filter(event => 
            event.expiresAt > now || !event.frontendProcessed
        );
        
        const cleanedCount = originalCount - gameEnv.gameEvents.length;
        if (cleanedCount > 0) {
            console.log(`🎯 EventManager: Cleaned ${cleanedCount} expired/processed events`);
        }
    }

    /**
     * Mark an event as processed by frontend
     * Prevents event from being reprocessed but allows cleanup after expiration
     */
    markEventProcessed(gameEnv, eventId) {
        console.log(`🎯 EventManager: Marking event ${eventId} as processed`);
        
        if (!gameEnv.gameEvents) return false;
        
        const event = gameEnv.gameEvents.find(e => e.id === eventId);
        if (event) {
            event.frontendProcessed = true;
            console.log(`🎯 Event ${eventId} marked as processed`);
            return true;
        }
        
        console.log(`⚠️ Event ${eventId} not found for processing`);
        return false;
    }

    // =======================================================================================
    // 🎯 Specialized Event Creation - Error Events and Common Patterns
    // =======================================================================================

    /**
     * Add error event with standardized error structure
     * Specialized method for all validation failures and blocking conditions
     */
    addErrorEvent(gameEnv, errorType, errorMessage, playerId = null) {
        console.log(`🎯 EventManager: Adding error event ${errorType} for player ${playerId}: ${errorMessage}`);
        
        return this.addGameEvent(gameEnv, this.EVENT_TYPES.ERROR_OCCURRED, {
            errorType: errorType,
            message: errorMessage,
            playerId: playerId,
            timestamp: Date.now()
        });
    }

    /**
     * Add card played event with full card and placement details
     * Standard event for successful card placements
     */
    addCardPlayedEvent(gameEnv, playerId, cardDetails, zone, isFaceDown = false) {
        console.log(`🎯 EventManager: Card played - ${cardDetails.name} in ${zone} (faceDown: ${isFaceDown})`);
        
        return this.addGameEvent(gameEnv, this.EVENT_TYPES.CARD_PLAYED, {
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
     * Add zone filled event for UI updates
     * Triggers frontend zone status updates
     */
    addZoneFilledEvent(gameEnv, playerId, zone, cardDetails) {
        console.log(`🎯 EventManager: Zone ${zone} filled for player ${playerId}`);
        
        return this.addGameEvent(gameEnv, this.EVENT_TYPES.ZONE_FILLED, {
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
     * Add turn switch event with player transition details
     * Critical event for turn-based gameplay synchronization
     */
    addTurnSwitchEvent(gameEnv, oldPlayer, newPlayer, turn) {
        console.log(`🎯 EventManager: Turn switch from ${oldPlayer} to ${newPlayer} (turn ${turn})`);
        
        return this.addGameEvent(gameEnv, this.EVENT_TYPES.TURN_SWITCH, {
            oldPlayer: oldPlayer,
            newPlayer: newPlayer,
            turn: turn,
            timestamp: Date.now()
        });
    }

    /**
     * Add phase change event with transition details
     * Important for frontend phase synchronization
     */
    addPhaseChangeEvent(gameEnv, oldPhase, newPhase, reason = null) {
        console.log(`🎯 EventManager: Phase change from ${oldPhase} to ${newPhase}${reason ? ` (${reason})` : ''}`);
        
        return this.addGameEvent(gameEnv, this.EVENT_TYPES.PHASE_CHANGE, {
            oldPhase: oldPhase,
            newPhase: newPhase,
            reason: reason,
            timestamp: Date.now()
        });
    }

    /**
     * Add card selection required event for search effects
     * Blocks game progression until player makes selection
     */
    addCardSelectionRequiredEvent(gameEnv, playerId, selectionId, selectionData) {
        console.log(`🎯 EventManager: Card selection required for ${playerId} (${selectionId})`);
        
        return this.addGameEvent(gameEnv, this.EVENT_TYPES.CARD_SELECTION_REQUIRED, {
            playerId: playerId,
            selectionId: selectionId,
            selectCount: selectionData.selectCount,
            availableCards: selectionData.availableCards,
            effectDescription: selectionData.effectDescription,
            timestamp: Date.now()
        });
    }

    /**
     * Add card selection completed event
     * Resumes game flow after player selection
     */
    addCardSelectionCompletedEvent(gameEnv, playerId, selectionId, selectedCards) {
        console.log(`🎯 EventManager: Card selection completed for ${playerId} - selected ${selectedCards.length} cards`);
        
        return this.addGameEvent(gameEnv, this.EVENT_TYPES.CARD_SELECTION_COMPLETED, {
            playerId: playerId,
            selectionId: selectionId,
            selectedCards: selectedCards,
            timestamp: Date.now()
        });
    }

    // =======================================================================================
    // 🎯 Batch Event Operations - Multi-Event Management
    // =======================================================================================

    /**
     * Add initial game started events for all players
     * Creates comprehensive game initialization events
     */
    addGameStartedEvents(gameEnv, playerList, firstPlayer) {
        console.log(`🎯 EventManager: Adding game started events for ${playerList.length} players`);
        
        // Main game started event
        this.addGameEvent(gameEnv, this.EVENT_TYPES.GAME_STARTED, {
            players: playerList,
            firstPlayer: playerList[firstPlayer],
            gameId: gameEnv.gameId,
            timestamp: Date.now()
        });
        
        // Initial hand dealt events for each player
        for (let playerId of playerList) {
            const handSize = gameEnv.players[playerId]?.hand?.length || 0;
            this.addGameEvent(gameEnv, this.EVENT_TYPES.INITIAL_HAND_DEALT, {
                playerId: playerId,
                handSize: handSize,
                timestamp: Date.now()
            });
        }
        
        console.log(`🎯 Generated ${playerList.length + 1} game startup events`);
    }

    /**
     * Get unprocessed events for a specific player
     * Used by API endpoints to return relevant events to frontend
     */
    getUnprocessedEventsForPlayer(gameEnv, playerId = null) {
        if (!gameEnv.gameEvents) return [];
        
        // Clean expired events first
        this.cleanExpiredEvents(gameEnv);
        
        // Return all unprocessed events (player-specific filtering done in frontend)
        const unprocessedEvents = gameEnv.gameEvents.filter(event => !event.frontendProcessed);
        
        console.log(`🎯 EventManager: Found ${unprocessedEvents.length} unprocessed events${playerId ? ` for player ${playerId}` : ''}`);
        
        return unprocessedEvents;
    }

    /**
     * Mark multiple events as processed
     * Batch operation for frontend acknowledgment
     */
    markEventsProcessed(gameEnv, eventIds) {
        console.log(`🎯 EventManager: Marking ${eventIds.length} events as processed`);
        
        let processedCount = 0;
        for (const eventId of eventIds) {
            if (this.markEventProcessed(gameEnv, eventId)) {
                processedCount++;
            }
        }
        
        console.log(`🎯 Successfully processed ${processedCount}/${eventIds.length} events`);
        return processedCount;
    }
}

module.exports = EventManager;