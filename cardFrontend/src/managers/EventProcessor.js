/**
 * EventProcessor - Generic processing queue event handler
 * 
 * Centralized event processing system for handling all processing queue events.
 * Provides a scalable pattern for adding new event types and their handlers.
 */
export default class EventProcessor {
  constructor(scene) {
    this.scene = scene;
    this.gameStateManager = scene.gameStateManager;
    
    // Event type registry with their configurations
    this.eventTypes = new Map([
      ['BURST_EFFECT_CHOICE', {
        handler: this.handleBurstEffectChoice.bind(this),
        requiresPlayerMatch: true,
        allowMultiple: false,
        description: 'Burst effect target selection events'
      }],
      ['DEPLOY_TARGET_CHOICE', {
        handler: this.handleDeployTargetChoice.bind(this),
        requiresPlayerMatch: true,
        allowMultiple: false,
        description: 'Deploy effect target selection events'
      }]
      // Future event types can be added here:
      // ['CARD_SELECTION_CHOICE', { ... }],
      // ['ABILITY_TARGET_CHOICE', { ... }],
      // ['ZONE_SELECTION_CHOICE', { ... }]
    ]);
    
    console.log(`[EventProcessor] Initialized with ${this.eventTypes.size} event types`);
  }

  /**
   * Process all events in the processing queue
   * Returns true if any blocking event was processed (UI should return early)
   */
  processAllEvents() {
    console.log('[EventProcessor] Processing all events in queue');
    
    // Process each registered event type in priority order
    for (const [eventType, config] of this.eventTypes) {
      const events = this.getEventsOfType(eventType, config.requiresPlayerMatch);
      
      if (events.length > 0) {
        console.log(`[EventProcessor] Found ${events.length} ${eventType} events`);
        
        if (config.allowMultiple || events.length === 1) {
          // Handle the event(s)
          const processed = config.handler(events);
          if (processed) {
            console.log(`[EventProcessor] Successfully processed ${eventType} event(s)`);
            return true; // Blocking event processed, caller should return early
          }
        } else if (events.length > 1) {
          console.warn(`[EventProcessor] Multiple ${eventType} events found (${events.length}), handling first one`);
          const processed = config.handler([events[0]]);
          if (processed) {
            console.log(`[EventProcessor] Successfully processed first ${eventType} event`);
            return true; // Blocking event processed, caller should return early
          }
        }
      }
    }
    
    return false; // No blocking events processed
  }

  /**
   * Get events of a specific type from the processing queue
   * @param {string} eventType - The event type to filter for
   * @param {boolean} requiresPlayerMatch - Whether to filter by current player
   * @returns {Array} Array of matching events
   */
  getEventsOfType(eventType, requiresPlayerMatch = true) {
    const processingQueue = this.gameStateManager.gameState.gameEnv.processingQueue || [];
    
    let events = processingQueue.filter(event => 
      event.type === eventType && 
      event.status === 'DECLARED'
    );
    
    // Filter by player if required
    if (requiresPlayerMatch) {
      const currentPlayerId = this.gameStateManager.gameState.playerId;
      events = events.filter(event => event.data?.playerId === currentPlayerId);
    }
    
    console.log(`[EventProcessor] Found ${events.length} ${eventType} events (playerMatch: ${requiresPlayerMatch})`);
    return events;
  }

  /**
   * Handle BURST_EFFECT_CHOICE events
   * @param {Array} events - Array of burst effect choice events
   * @returns {boolean} Whether the event was successfully processed
   */
  handleBurstEffectChoice(events) {
    if (events.length === 0) return false;
    
    try {
      console.log('[EventProcessor] Handling BURST_EFFECT_CHOICE event');
      this.scene.showBurstEffectDialog(events[0]);
      return true;
    } catch (error) {
      console.error('[EventProcessor] Error handling BURST_EFFECT_CHOICE:', error);
      return false;
    }
  }

  /**
   * Handle DEPLOY_TARGET_CHOICE events
   * @param {Array} events - Array of deploy target choice events
   * @returns {boolean} Whether the event was successfully processed
   */
  handleDeployTargetChoice(events) {
    if (events.length === 0) return false;
    
    try {
      console.log('[EventProcessor] Handling DEPLOY_TARGET_CHOICE event');
      if (!this.scene.deployEffectHandler) {
        console.error('[EventProcessor] DeployEffectHandler not available');
        return false;
      }
      
      this.scene.deployEffectHandler.showDeployTargetDialog(events[0]);
      return true;
    } catch (error) {
      console.error('[EventProcessor] Error handling DEPLOY_TARGET_CHOICE:', error);
      return false;
    }
  }

  /**
   * Register a new event type and its handler
   * @param {string} eventType - The event type name
   * @param {Object} config - Event configuration
   * @param {Function} config.handler - The handler function
   * @param {boolean} config.requiresPlayerMatch - Whether to filter by current player
   * @param {boolean} config.allowMultiple - Whether multiple events are allowed
   * @param {string} config.description - Description of the event type
   */
  registerEventType(eventType, config) {
    console.log(`[EventProcessor] Registering new event type: ${eventType}`);
    this.eventTypes.set(eventType, {
      handler: config.handler.bind(this),
      requiresPlayerMatch: config.requiresPlayerMatch ?? true,
      allowMultiple: config.allowMultiple ?? false,
      description: config.description || `${eventType} events`
    });
  }

  /**
   * Unregister an event type
   * @param {string} eventType - The event type to remove
   */
  unregisterEventType(eventType) {
    if (this.eventTypes.has(eventType)) {
      console.log(`[EventProcessor] Unregistering event type: ${eventType}`);
      this.eventTypes.delete(eventType);
      return true;
    }
    return false;
  }

  /**
   * Get information about all registered event types
   * @returns {Object} Map of event types and their configurations
   */
  getRegisteredEventTypes() {
    const eventInfo = {};
    for (const [eventType, config] of this.eventTypes) {
      eventInfo[eventType] = {
        description: config.description,
        requiresPlayerMatch: config.requiresPlayerMatch,
        allowMultiple: config.allowMultiple
      };
    }
    return eventInfo;
  }

  /**
   * Check if a specific event type is currently available in the queue
   * @param {string} eventType - The event type to check
   * @returns {boolean} Whether events of this type are available
   */
  hasEventsOfType(eventType) {
    const config = this.eventTypes.get(eventType);
    if (!config) return false;
    
    const events = this.getEventsOfType(eventType, config.requiresPlayerMatch);
    return events.length > 0;
  }

  /**
   * Get statistics about current events in the queue
   * @returns {Object} Event statistics
   */
  getEventStatistics() {
    const stats = {
      totalEvents: 0,
      eventsByType: {},
      registeredTypes: this.eventTypes.size
    };
    
    for (const [eventType, config] of this.eventTypes) {
      const events = this.getEventsOfType(eventType, config.requiresPlayerMatch);
      stats.eventsByType[eventType] = events.length;
      stats.totalEvents += events.length;
    }
    
    return stats;
  }
}