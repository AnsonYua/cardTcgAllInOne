# TESTING_PATTERNS.md - Essential Game Testing Patterns

**CRITICAL REFERENCE**: Always follow these patterns when creating test scenarios or testing game flow.

## ⚠️ Event Acknowledgment Pattern (MANDATORY)

### The Core Problem
Every card play in the game triggers an automatic turn switch that puts the next player in `DRAW_PHASE`. This phase **will not progress** to `MAIN_PHASE` until the `DRAW_PHASE_COMPLETE` event is acknowledged.

### The Required Pattern

**For EVERY card play in test scenarios:**
```
Step N: Player plays card
  ↓ (automatic)
Game switches to next player in DRAW_PHASE
  ↓ (REQUIRED)
Step N.5: Acknowledge DRAW_PHASE_COMPLETE event  
  ↓ (automatic)
Game transitions to MAIN_PHASE
  ↓ (now possible)
Step N+1: Next player can play cards
```

### Test Scenario JSON Structure

```json
{
  "gameplaySteps": [
    {
      "step": 1,
      "description": "Player 1 plays card",
      "playerId": "playerId_1",
      "action": {
        "type": "PlayCard",
        "card_idx": 0,
        "field_idx": 1
      },
      "expectedResult": {
        "turnSwitches": true,
        "newCurrentPlayer": "playerId_2",
        "newPhase": "DRAW_PHASE"
      },
      "validation": {
        "checkGameState": {
          "phase": "DRAW_PHASE",
          "currentPlayer": "playerId_2"
        },
        "checkEvents": {
          "hasDrawPhaseCompleteEvent": true
        }
      }
    },
    {
      "step": 1.5,
      "description": "Acknowledge DRAW_PHASE_COMPLETE event",
      "playerId": "playerId_2",
      "action": {
        "type": "AcknowledgeEvents",
        "eventTypes": ["DRAW_PHASE_COMPLETE"]
      },
      "expectedResult": {
        "success": true,
        "eventsAcknowledged": 1,
        "newPhase": "MAIN_PHASE"
      },
      "validation": {
        "checkGameState": {
          "phase": "MAIN_PHASE",
          "currentPlayer": "playerId_2"
        },
        "checkEvents": {
          "noDrawPhaseCompleteEvents": true
        }
      }
    },
    {
      "step": 2,
      "description": "Player 2 can now play card",
      "playerId": "playerId_2",
      // ... continue pattern
    }
  ]
}
```

### Backend Test Helper Usage

```javascript
// Available helper functions in testHelper.js:

// Execute player action
const result = await testHelper.executePlayerAction(playerId, gameId, action);

// Acknowledge events by type (recommended)
const ackResult = await testHelper.acknowledgeEventsByType(gameId, playerId, ['DRAW_PHASE_COMPLETE']);

// Acknowledge specific event IDs
const ackResult = await testHelper.acknowledgeEvents(gameId, ['event_123', 'event_124']);

// Complete card selection (for cards requiring selection)
const selectionResult = await testHelper.completeCardSelection(gameId, playerId, selectionId, ['cardId']);
```

### Complete Example Flow

```javascript
// Test a 3-step card interaction with proper acknowledgments
async function testCardInteraction() {
    // Step 1: Player 1 plays character card
    const step1 = await testHelper.executePlayerAction('playerId_1', gameId, {
        type: 'PlayCard', card_idx: 0, field_idx: 1
    });
    // Result: Turn switches to Player 2, phase = DRAW_PHASE
    
    // Step 1.5: Acknowledge to proceed
    await testHelper.acknowledgeEventsByType(gameId, 'playerId_2', ['DRAW_PHASE_COMPLETE']);
    // Result: Phase = MAIN_PHASE, Player 2 can act
    
    // Step 2: Player 2 plays help card with selection
    const step2 = await testHelper.executePlayerAction('playerId_2', gameId, {
        type: 'PlayCard', card_idx: 0, field_idx: 3
    });
    // Result: Requires card selection
    
    // Step 2a: Complete card selection
    const selectionId = Object.keys(step2.gameEnv.pendingCardSelections)[0];
    await testHelper.completeCardSelection(gameId, 'playerId_2', selectionId, ['c-1']);
    // Result: Turn switches to Player 1, phase = DRAW_PHASE
    
    // Step 2.5: Acknowledge to proceed
    await testHelper.acknowledgeEventsByType(gameId, 'playerId_1', ['DRAW_PHASE_COMPLETE']);
    // Result: Phase = MAIN_PHASE, Player 1 can act
    
    // Step 3: Player 1 plays response card
    const step3 = await testHelper.executePlayerAction('playerId_1', gameId, {
        type: 'PlayCard', card_idx: 1, field_idx: 3
    });
    // Continue pattern...
}
```

## Common Mistakes to Avoid

### ❌ Wrong: Skipping Acknowledgment
```javascript
// This will fail - Player 2 stuck in DRAW_PHASE
await testHelper.executePlayerAction('playerId_1', gameId, action1);
await testHelper.executePlayerAction('playerId_2', gameId, action2); // ERROR!
```

### ✅ Correct: Including Acknowledgment
```javascript
await testHelper.executePlayerAction('playerId_1', gameId, action1);
await testHelper.acknowledgeEventsByType(gameId, 'playerId_2', ['DRAW_PHASE_COMPLETE']);
await testHelper.executePlayerAction('playerId_2', gameId, action2);
```

### ❌ Wrong: Wrong Player Acknowledging
```javascript
await testHelper.executePlayerAction('playerId_1', gameId, action);
// Turn switched to playerId_2, but playerId_1 tries to acknowledge
await testHelper.acknowledgeEventsByType(gameId, 'playerId_1', ['DRAW_PHASE_COMPLETE']); // ERROR!
```

### ✅ Correct: Current Player Acknowledges
```javascript
await testHelper.executePlayerAction('playerId_1', gameId, action);
// Turn switched to playerId_2, so playerId_2 acknowledges
await testHelper.acknowledgeEventsByType(gameId, 'playerId_2', ['DRAW_PHASE_COMPLETE']);
```

## Validation Patterns

### Phase Transition Validation
Always validate these state changes:
```javascript
// After card play
expect(gameState.phase).toBe('DRAW_PHASE');
expect(gameState.currentPlayer).toBe('expectedNextPlayer');
expect(gameState.gameEvents.some(e => e.type === 'DRAW_PHASE_COMPLETE')).toBe(true);

// After acknowledgment
expect(gameState.phase).toBe('MAIN_PHASE'); 
expect(gameState.currentPlayer).toBe('expectedCurrentPlayer');
expect(gameState.gameEvents.filter(e => e.type === 'DRAW_PHASE_COMPLETE')).toHaveLength(0);
```

### Event Lifecycle Validation
```javascript
// Validate complete event lifecycle
const beforeEvents = gameState.gameEvents.length;
await testHelper.executePlayerAction(playerId, gameId, action);
const afterPlayEvents = gameState.gameEvents.length;
expect(afterPlayEvents).toBe(beforeEvents + 1); // New event added

await testHelper.acknowledgeEventsByType(gameId, nextPlayerId, ['DRAW_PHASE_COMPLETE']);
const afterAckEvents = gameState.gameEvents.length;
expect(afterAckEvents).toBe(beforeEvents); // Event removed
```

## Integration with Frontend

### Frontend Implementation
```javascript
// Frontend polling should handle acknowledgment automatically
const gameState = await fetch(`/api/game/player/${playerId}?gameId=${gameId}`);

// Check for DRAW_PHASE_COMPLETE events
const drawEvents = gameState.gameEvents.filter(e => e.type === 'DRAW_PHASE_COMPLETE');
if (drawEvents.length > 0) {
    // Show draw animation/notification
    await showDrawPhaseNotification();
    
    // Acknowledge to proceed
    const eventIds = drawEvents.map(e => e.id);
    await fetch('/api/game/player/acknowledgeEvents', {
        method: 'POST',
        body: JSON.stringify({ gameId, eventIds })
    });
}
```

## Summary Checklist

When creating test scenarios or implementing game flow:

- [ ] Every card play followed by acknowledgment step
- [ ] Correct player (next player) acknowledges the event
- [ ] Validate phase transitions (DRAW_PHASE → MAIN_PHASE)
- [ ] Validate event lifecycle (created → acknowledged → removed)
- [ ] Include acknowledgment validation in test assertions
- [ ] Use `testHelper.acknowledgeEventsByType()` for convenience
- [ ] Number acknowledgment steps as X.5 (e.g., 1.5, 2.5)

**Remember: This pattern applies to EVERY card play in the game. No exceptions!**