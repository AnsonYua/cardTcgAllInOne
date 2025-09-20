# FrontEventProcessor Usage Examples

This file demonstrates how to add new event types to the FrontEventProcessor system.

## Adding a New Event Type

### Example 1: Card Selection Choice Event

```javascript
// In GameScene.js init() method or wherever appropriate:
this.frontEventProcessor.registerEventType('CARD_SELECTION_CHOICE', {
  handler: this.handleCardSelectionChoice.bind(this),
  requiresPlayerMatch: true,
  allowMultiple: false,
  description: 'Card selection events for special abilities'
});

// Handler method in GameScene:
handleCardSelectionChoice(events) {
  if (events.length === 0) return false;
  
  try {
    console.log('[GameScene] Handling CARD_SELECTION_CHOICE event');
    this.showCardSelectionDialog(events[0]);
    return true;
  } catch (error) {
    console.error('[GameScene] Error handling CARD_SELECTION_CHOICE:', error);
    return false;
  }
}
```

### Example 2: Zone Selection Choice Event

```javascript
// Register zone selection event
this.frontEventProcessor.registerEventType('ZONE_SELECTION_CHOICE', {
  handler: this.handleZoneSelectionChoice.bind(this),
  requiresPlayerMatch: true,
  allowMultiple: true, // Allow multiple zone selections
  description: 'Zone selection events for placement abilities'
});

// Handler method:
handleZoneSelectionChoice(events) {
  if (events.length === 0) return false;
  
  try {
    console.log(`[GameScene] Handling ${events.length} ZONE_SELECTION_CHOICE events`);
    this.showZoneSelectionDialog(events);
    return true;
  } catch (error) {
    console.error('[GameScene] Error handling ZONE_SELECTION_CHOICE:', error);
    return false;
  }
}
```

### Example 3: Ability Target Choice Event

```javascript
// Register ability target event
this.frontEventProcessor.registerEventType('ABILITY_TARGET_CHOICE', {
  handler: this.handleAbilityTargetChoice.bind(this),
  requiresPlayerMatch: true,
  allowMultiple: false,
  description: 'Target selection for special card abilities'
});

// Handler method:
handleAbilityTargetChoice(events) {
  if (events.length === 0) return false;
  
  try {
    const event = events[0];
    console.log('[GameScene] Handling ABILITY_TARGET_CHOICE event');
    
    // Check if we have a specialized handler for this ability type
    if (this.abilityHandler) {
      this.abilityHandler.showTargetSelectionDialog(event);
    } else {
      // Fallback to generic target selection
      this.showGenericTargetDialog(event);
    }
    return true;
  } catch (error) {
    console.error('[GameScene] Error handling ABILITY_TARGET_CHOICE:', error);
    return false;
  }
}
```

## Runtime Event Registration

You can also register events dynamically based on game state:

```javascript
// In GameScene during runtime:
if (gameState.gameEnv.phase === 'SPECIAL_PHASE') {
  this.frontEventProcessor.registerEventType('SPECIAL_PHASE_CHOICE', {
    handler: this.handleSpecialPhaseChoice.bind(this),
    requiresPlayerMatch: true,
    allowMultiple: false,
    description: 'Special phase interaction events'
  });
}
```

## Event Type Configuration Options

```javascript
{
  handler: Function,              // Required: Function to handle the events
  requiresPlayerMatch: boolean,   // Optional: Filter by current player (default: true)
  allowMultiple: boolean,         // Optional: Allow multiple events (default: false)
  description: string            // Optional: Human-readable description
}
```

## Event Processing Priority

Events are processed in the order they are registered. To control priority:

```javascript
// High priority events should be registered first
this.frontEventProcessor.registerEventType('CRITICAL_CHOICE', { ... });
this.frontEventProcessor.registerEventType('NORMAL_CHOICE', { ... });
this.frontEventProcessor.registerEventType('LOW_PRIORITY_CHOICE', { ... });
```

## Checking for Specific Events

```javascript
// Check if specific event types are available
if (this.frontEventProcessor.hasEventsOfType('DEPLOY_TARGET_CHOICE')) {
  console.log('Deploy target events are available');
}

// Get event statistics
const stats = this.frontEventProcessor.getEventStatistics();
console.log('Event stats:', stats);
// Output: { totalEvents: 3, eventsByType: { 'DEPLOY_TARGET_CHOICE': 1, 'BURST_EFFECT_CHOICE': 2 }, registeredTypes: 5 }
```

## Removing Event Types

```javascript
// Remove an event type (useful for cleanup or phase transitions)
this.frontEventProcessor.unregisterEventType('SPECIAL_PHASE_CHOICE');
```

## Error Handling Best Practices

```javascript
handleCustomEvent(events) {
  if (events.length === 0) return false;
  
  try {
    // Validate event data
    const event = events[0];
    if (!event.data || !event.data.requiredField) {
      console.warn('[GameScene] Invalid event data for CUSTOM_EVENT');
      return false;
    }
    
    // Process the event
    this.showCustomDialog(event);
    return true;
    
  } catch (error) {
    console.error('[GameScene] Error handling CUSTOM_EVENT:', error);
    
    // Optional: Show error to user
    if (this.uiMessageManager) {
      this.uiMessageManager.showErrorMessage('Failed to process game event');
    }
    
    return false;
  }
}
```

## Integration with Existing Handlers

```javascript
// Use with existing handler classes
handleSomeEvent(events) {
  if (events.length === 0) return false;
  
  try {
    // Delegate to specialized handler
    if (this.someSpecializedHandler) {
      this.someSpecializedHandler.handleEvent(events[0]);
    }
    return true;
  } catch (error) {
    console.error('[GameScene] Error in specialized handler:', error);
    return false;
  }
}
```