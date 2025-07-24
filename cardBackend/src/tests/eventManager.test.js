// =======================================================================================
// 🎯 EVENT MANAGER INTEGRATION TESTS
// =======================================================================================
//
// This test suite validates the EventManager class integration with mozGamePlay.js
// following the established pattern from CardSelectionHandler, BattleCalculator, and TurnManager.
//
// Test Categories:
// 1. EventManager Class Integration - Proper instantiation and delegation
// 2. Core Event Management - Event creation, cleanup, and processing
// 3. Specialized Event Methods - Error events, card events, turn events
// 4. Event Lifecycle - Expiration, acknowledgment, and memory management
//
// =======================================================================================

const mozGamePlay = require('../mozGame/mozGamePlay');
const EventManager = require('../services/EventManager');

describe('EventManager Integration Tests', () => {
    // mozGamePlay is a singleton instance, not a class
    const gamePlayInstance = mozGamePlay;

    describe('EventManager Class Integration', () => {
        test('should properly instantiate EventManager in mozGamePlay', () => {
            expect(gamePlayInstance.eventManager).toBeInstanceOf(EventManager);
            expect(gamePlayInstance.eventManager).toBeDefined();
            expect(typeof gamePlayInstance.eventManager.addGameEvent).toBe('function');
            expect(typeof gamePlayInstance.eventManager.cleanExpiredEvents).toBe('function');
            expect(typeof gamePlayInstance.eventManager.markEventProcessed).toBe('function');
        });

        test('should delegate initializeEventSystem to EventManager', () => {
            const mockGameEnv = {};

            // Mock the EventManager method to track if it was called
            const originalMethod = gamePlayInstance.eventManager.initializeEventSystem;
            let eventManagerCalled = false;
            
            gamePlayInstance.eventManager.initializeEventSystem = function(gameEnv) {
                eventManagerCalled = true;
                expect(gameEnv).toEqual(mockGameEnv);
                return originalMethod.call(this, gameEnv);
            };

            const result = gamePlayInstance.initializeEventSystem(mockGameEnv);
            
            expect(eventManagerCalled).toBe(true);
            expect(result.gameEvents).toEqual([]);
            expect(result.lastEventId).toBe(0);
            
            // Restore original method
            gamePlayInstance.eventManager.initializeEventSystem = originalMethod;
        });

        test('should delegate addGameEvent to EventManager', () => {
            const mockGameEnv = { gameEvents: [], lastEventId: 0 };
            const eventType = 'TEST_EVENT';
            const eventData = { testData: 'value' };

            // Mock the EventManager method to track if it was called
            const originalMethod = gamePlayInstance.eventManager.addGameEvent;
            let eventManagerCalled = false;
            
            gamePlayInstance.eventManager.addGameEvent = function(gameEnv, type, data) {
                eventManagerCalled = true;
                expect(gameEnv).toEqual(mockGameEnv);
                expect(type).toBe(eventType);
                expect(data).toBe(eventData);
                return originalMethod.call(this, gameEnv, type, data);
            };

            const result = gamePlayInstance.addGameEvent(mockGameEnv, eventType, eventData);
            
            expect(eventManagerCalled).toBe(true);
            expect(result.type).toBe(eventType);
            expect(result.data).toBe(eventData);
            
            // Restore original method
            gamePlayInstance.eventManager.addGameEvent = originalMethod;
        });

        test('should delegate cleanExpiredEvents to EventManager', () => {
            const mockGameEnv = { gameEvents: [], lastEventId: 0 };

            // Mock the EventManager method to track if it was called
            const originalMethod = gamePlayInstance.eventManager.cleanExpiredEvents;
            let eventManagerCalled = false;
            
            gamePlayInstance.eventManager.cleanExpiredEvents = function(gameEnv) {
                eventManagerCalled = true;
                expect(gameEnv).toEqual(mockGameEnv);
                return originalMethod.call(this, gameEnv);
            };

            gamePlayInstance.cleanExpiredEvents(mockGameEnv);
            expect(eventManagerCalled).toBe(true);
            
            // Restore original method
            gamePlayInstance.eventManager.cleanExpiredEvents = originalMethod;
        });

        test('should delegate markEventProcessed to EventManager', () => {
            const mockGameEnv = { gameEvents: [], lastEventId: 0 };
            const eventId = 'test_event_123';

            // Mock the EventManager method to track if it was called
            const originalMethod = gamePlayInstance.eventManager.markEventProcessed;
            let eventManagerCalled = false;
            
            gamePlayInstance.eventManager.markEventProcessed = function(gameEnv, id) {
                eventManagerCalled = true;
                expect(gameEnv).toEqual(mockGameEnv);
                expect(id).toBe(eventId);
                return originalMethod.call(this, gameEnv, id);
            };

            const result = gamePlayInstance.markEventProcessed(mockGameEnv, eventId);
            
            expect(eventManagerCalled).toBe(true);
            expect(result).toBe(false); // Event doesn't exist, so should return false
            
            // Restore original method
            gamePlayInstance.eventManager.markEventProcessed = originalMethod;
        });

        test('should delegate addErrorEvent to EventManager', () => {
            const mockGameEnv = { gameEvents: [], lastEventId: 0 };
            const errorType = 'TEST_ERROR';
            const errorMessage = 'Test error message';
            const playerId = 'testPlayer';

            // Mock the EventManager method to track if it was called
            const originalMethod = gamePlayInstance.eventManager.addErrorEvent;
            let eventManagerCalled = false;
            
            gamePlayInstance.eventManager.addErrorEvent = function(gameEnv, type, message, player) {
                eventManagerCalled = true;
                expect(gameEnv).toEqual(mockGameEnv);
                expect(type).toBe(errorType);
                expect(message).toBe(errorMessage);
                expect(player).toBe(playerId);
                return originalMethod.call(this, gameEnv, type, message, player);
            };

            const result = gamePlayInstance.addErrorEvent(mockGameEnv, errorType, errorMessage, playerId);
            
            expect(eventManagerCalled).toBe(true);
            expect(result.type).toBe('ERROR_OCCURRED');
            expect(result.data.errorType).toBe(errorType);
            expect(result.data.message).toBe(errorMessage);
            expect(result.data.playerId).toBe(playerId);
            
            // Restore original method
            gamePlayInstance.eventManager.addErrorEvent = originalMethod;
        });
    });

    describe('Event Management Logic', () => {
        test('should handle event system initialization', () => {
            const gameEnv = {};
            
            const result = gamePlayInstance.initializeEventSystem(gameEnv);
            
            expect(result.gameEvents).toEqual([]);
            expect(result.lastEventId).toBe(0);
            expect(gameEnv.gameEvents).toEqual([]);
            expect(gameEnv.lastEventId).toBe(0);
        });

        test('should create and manage events properly', () => {
            const gameEnv = { gameEvents: [], lastEventId: 0 };
            
            // Add a test event
            const event1 = gamePlayInstance.addGameEvent(gameEnv, 'TEST_EVENT_1', { data: 'test1' });
            expect(event1.type).toBe('TEST_EVENT_1');
            expect(event1.data.data).toBe('test1');
            expect(event1.frontendProcessed).toBe(false);
            expect(event1.id).toContain('event_');
            expect(gameEnv.gameEvents.length).toBe(1);
            expect(gameEnv.lastEventId).toBe(1);
            
            // Add another event
            const event2 = gamePlayInstance.addGameEvent(gameEnv, 'TEST_EVENT_2', { data: 'test2' });
            expect(event2.type).toBe('TEST_EVENT_2');
            expect(gameEnv.gameEvents.length).toBe(2);
            expect(gameEnv.lastEventId).toBe(2);
            
            // Mark first event as processed
            const marked = gamePlayInstance.markEventProcessed(gameEnv, event1.id);
            expect(marked).toBe(true);
            expect(gameEnv.gameEvents.find(e => e.id === event1.id).frontendProcessed).toBe(true);
        });

        test('should handle event expiration and cleanup', (done) => {
            const gameEnv = { gameEvents: [], lastEventId: 0 };
            
            // Create an event
            const event = gamePlayInstance.addGameEvent(gameEnv, 'TEST_EVENT', { data: 'test' });
            expect(gameEnv.gameEvents.length).toBe(1);
            
            // Mock the event as expired by setting expiresAt to past time
            event.expiresAt = Date.now() - 1000;
            event.frontendProcessed = true;
            
            // Clean expired events
            gamePlayInstance.cleanExpiredEvents(gameEnv);
            
            // Event should be cleaned up since it's expired and processed
            expect(gameEnv.gameEvents.length).toBe(0);
            done();
        });

        test('should handle error events with proper structure', () => {
            const gameEnv = { gameEvents: [], lastEventId: 0 };
            
            const errorEvent = gamePlayInstance.addErrorEvent(
                gameEnv, 
                'ZONE_OCCUPIED_ERROR', 
                'Zone already occupied',
                'testPlayer'
            );
            
            expect(errorEvent.type).toBe('ERROR_OCCURRED');
            expect(errorEvent.data.errorType).toBe('ZONE_OCCUPIED_ERROR');
            expect(errorEvent.data.message).toBe('Zone already occupied');
            expect(errorEvent.data.playerId).toBe('testPlayer');
            expect(errorEvent.data.timestamp).toBeDefined();
            expect(gameEnv.gameEvents.length).toBe(1);
        });

        test('should handle missing gameEnv gracefully', () => {
            const gameEnv = null;
            
            // Should not throw error when gameEnv is null
            expect(() => {
                gamePlayInstance.cleanExpiredEvents(gameEnv);
            }).not.toThrow();
            
            // Should return false for missing events
            const result = gamePlayInstance.markEventProcessed({}, 'nonexistent_event');
            expect(result).toBe(false);
        });
    });

    describe('Event Manager Integration Validation', () => {
        test('should maintain consistent delegation pattern with other managers', () => {
            // EventManager should follow same pattern as CardSelectionHandler, BattleCalculator, TurnManager
            expect(gamePlayInstance.eventManager).toBeInstanceOf(EventManager);
            expect(gamePlayInstance.cardSelectionHandler).toBeDefined();
            expect(gamePlayInstance.battleCalculator).toBeDefined();
            expect(gamePlayInstance.turnManager).toBeDefined();
            
            // All managers should be properly initialized
            expect(typeof gamePlayInstance.eventManager.addGameEvent).toBe('function');
            expect(typeof gamePlayInstance.cardSelectionHandler.handleSelectCardAction).toBe('function');
            expect(typeof gamePlayInstance.battleCalculator.calculateTotalPower).toBe('function');
            expect(typeof gamePlayInstance.turnManager.shouldUpdateTurn).toBe('function');
        });

        test('should provide all required event management methods', () => {
            const requiredMethods = [
                'initializeEventSystem',
                'addGameEvent',
                'cleanExpiredEvents',
                'markEventProcessed',
                'addErrorEvent'
            ];
            
            for (const method of requiredMethods) {
                expect(typeof gamePlayInstance[method]).toBe('function');
                expect(typeof gamePlayInstance.eventManager[method]).toBe('function');
            }
        });
    });
});