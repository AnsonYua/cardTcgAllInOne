# GameEnvironment Class System

A TypeScript class-based object-oriented replacement for the legacy JSON-based `gameEnv` structure in the card game backend.

## Overview

The GameEnvironment class system transforms the existing flat JSON structure into a proper object-oriented design with:

- **Type Safety**: Full TypeScript support with compile-time error checking
- **Encapsulation**: Methods grouped with related data
- **Validation**: Built-in validation and error checking
- **Maintainability**: Clear, self-documenting code structure
- **Backward Compatibility**: Seamless integration with existing code

## Architecture

### Core Classes

#### `GameEnvironment` (Main Class)
The primary game state container that manages all game components:

```typescript
const gameEnv = new GameEnvironment();
gameEnv.addPlayer('player_1', 'Alice');
gameEnv.updatePhase(GamePhase.MAIN_PHASE);
gameEnv.playCard('player_1', 'c-1_uid', ZoneType.TOP);
```

#### `Player` 
Individual player state management:

```typescript
const player = gameEnv.getPlayer('player_1');
player.drawCard();
console.log(player.getHandSize());
console.log(player.getCurrentLeaderCardId());
```

#### `GameZones`
Zone management and card placement:

```typescript
gameEnv.zones.setCardInZone('player_1', ZoneType.TOP, 'c-1_uid');
const occupied = gameEnv.zones.isZoneOccupied('player_1', ZoneType.LEFT);
const allFilled = gameEnv.zones.areAllCharacterZonesFilled('player_1');
```

#### `EventManager`
Game event tracking and management:

```typescript
gameEnv.eventManager.addEvent(EventType.CARD_PLAYED, { 
    playerId: 'player_1', 
    cardUid: 'c-1_uid' 
});
const events = gameEnv.eventManager.getUnprocessedEvents();
gameEnv.eventManager.acknowledgeEvents(['event_id_1', 'event_id_2']);
```

#### `PlaySequenceManager`
Action sequence tracking:

```typescript
// addPlay method signature: (playerId, cardUid, action, zone, isFaceDown?, effectData?)
// Note: Second parameter is cardUid (unique instance), not cardId (base card ID)
gameEnv.playSequenceManager.addPlay(
    'player_1', 
    'c-1_randomTimestamp_001',  // cardUid: unique instance identifier
    ActionType.PLAY_CARD, 
    ZoneType.TOP
);
const plays = gameEnv.playSequenceManager.getPlays();
// Each play entry has: { sequenceId, playerId, cardUid, action, zone, ... }
```

## Integration with Existing Code

### Migration Strategy

The system is designed for **gradual migration** from legacy JSON to class-based approach:

#### Phase 1: Parallel Implementation
```typescript
// Existing code continues to work
const legacyGameEnv = { phase: 'MAIN_PHASE', players: {}, zones: {} };

// New class-based approach available
const gameEnvClass = GameEnvironmentAdapter.fromLegacyJSON(legacyGameEnv);
```

#### Phase 2: Method-by-Method Replacement
```typescript
// Old way: Direct JSON manipulation
legacyGameEnv.players[playerId].deck.hand.push(cardUid);

// New way: Type-safe method calls
const player = gameEnvClass.getPlayer(playerId);
player.drawCard();
```

#### Phase 3: Full Class Usage
```typescript
// Pure class-based approach
const gameEnv = new GameEnvironment();
gameEnv.addPlayer('player_1');
gameEnv.playCard('player_1', 'c-1_uid', ZoneType.TOP);
```

### Adapter Utilities

#### `GameEnvironmentAdapter`
Converts between legacy JSON and class instances:

```typescript
// JSON to Class
const gameEnvClass = GameEnvironmentAdapter.fromLegacyJSON(legacyGameEnv);

// Class to JSON (for backward compatibility)
const legacyGameEnv = GameEnvironmentAdapter.toLegacyJSON(gameEnvClass);

// Create new game
const newGame = GameEnvironmentAdapter.createNewGame('player_1');
```

#### `GameEnvironmentValidator`
Validates game state consistency:

```typescript
const validation = GameEnvironmentValidator.validate(gameEnvClass);
if (!validation.isValid) {
    console.error('Validation errors:', validation.errors);
}
```

#### `GameEnvironmentHelper`
Utility functions for common operations:

```typescript
const summary = GameEnvironmentHelper.getGameSummary(gameEnvClass);
const isPlayable = GameEnvironmentHelper.isGamePlayable(gameEnvClass);
const clone = GameEnvironmentHelper.deepClone(gameEnvClass);
```

## Usage Examples

### Example 1: Creating a New Game

```typescript
import { GameEnvironment, GamePhase } from './models/GameEnvironment';

const gameEnv = new GameEnvironment();

// Add players
gameEnv.addPlayer('alice', 'Alice');
gameEnv.addPlayer('bob', 'Bob');

// Set up game
gameEnv.updatePhase(GamePhase.READY_PHASE);
gameEnv.setLeader('alice', 's-1_uid');
gameEnv.setLeader('bob', 's-2_uid');

console.log('Game ready:', gameEnv.canStartGame());
```

### Example 2: Processing Player Actions

```typescript
// Play a card
const success = gameEnv.playCard('alice', 'c-1_uid', ZoneType.TOP);
if (success) {
    console.log('Card played successfully');
}

// Check zone status
const topOccupied = gameEnv.zones.isZoneOccupied('alice', ZoneType.TOP);
const allCharacterZonesFilled = gameEnv.zones.areAllCharacterZonesFilled('alice');
```

### Example 3: Event Management

```typescript
// Add custom event
gameEnv.eventManager.addEvent(EventType.CARD_PLAYED, {
    playerId: 'alice',
    cardUid: 'c-1_uid',
    zone: ZoneType.TOP
});

// Get unprocessed events for frontend
const events = gameEnv.eventManager.getUnprocessedEvents();

// Acknowledge processed events
gameEnv.eventManager.acknowledgeEvents(['event_123', 'event_124']);
```

### Example 4: Legacy Compatibility

```typescript
import { GameEnvironmentAdapter } from './utils/GameEnvironmentAdapter';

// Load existing game from file (legacy JSON format)
const legacyGameData = await loadGameFromFile(gameId);

// Convert to class for manipulation
const gameEnvClass = GameEnvironmentAdapter.fromLegacyJSON(legacyGameData.gameEnv);

// Use class methods
gameEnvClass.playCard('player_1', 'c-1_uid', ZoneType.LEFT);
gameEnvClass.updatePhase(GamePhase.SP_PHASE);

// Convert back to legacy format for saving
const updatedLegacyData = GameEnvironmentAdapter.toLegacyJSON(gameEnvClass);
await saveGameToFile(gameId, updatedLegacyData);
```

## Benefits

### Type Safety
```typescript
// Compile-time error checking
gameEnv.updatePhase(GamePhase.INVALID_PHASE); // ❌ TypeScript error
gameEnv.updatePhase(GamePhase.MAIN_PHASE);    // ✅ Valid

// IntelliSense support
gameEnv.zones.isZoneOccupied('player_1', ZoneType.); // Shows available zones
```

### Validation
```typescript
// Built-in validation
const validation = GameEnvironmentValidator.validate(gameEnv);
if (!validation.isValid) {
    console.error('Game state invalid:', validation.errors);
}
```

### Clear APIs
```typescript
// Self-documenting methods
const player = gameEnv.getPlayer('player_1');
const handSize = player.getHandSize();
const canDraw = player.getDeckSize() > 0;
const currentLeader = player.getCurrentLeaderCardId();
```

### Error Prevention
```typescript
// Prevents common errors
gameEnv.playCard('invalid_player', 'c-1', ZoneType.TOP); // Returns false
gameEnv.zones.isZoneOccupied('player_1', 'invalid_zone'); // TypeScript error
```

## File Structure

```
src/
├── models/
│   └── GameEnvironment.ts          # Main class definitions
├── utils/
│   └── GameEnvironmentAdapter.ts   # Conversion and utility functions
└── examples/
    ├── GameEnvironmentUsage.ts     # Usage examples
    └── GameLogicIntegration.ts     # Integration examples
```

## API Reference

### Enums

- `GamePhase`: Game phase constants
- `ZoneType`: Zone type constants  
- `ActionType`: Player action types
- `EventType`: Game event types

### Main Classes

- `GameEnvironment`: Primary game state container
- `Player`: Individual player management
- `GameZones`: Zone and card placement management
- `EventManager`: Event tracking and management
- `PlaySequenceManager`: Action sequence tracking

### Utility Classes

- `GameEnvironmentAdapter`: Conversion utilities
- `GameEnvironmentValidator`: Validation utilities
- `GameEnvironmentHelper`: Helper functions

## Migration Checklist

### Phase 1: Setup ✅
- [x] Create GameEnvironment class structure
- [x] Create adapter utilities
- [x] Create usage examples
- [x] Ensure TypeScript compilation

### Phase 2: Integration (Next Steps)
- [ ] Update GameLogic.js to use adapter utilities
- [ ] Replace zone manipulation with class methods
- [ ] Replace player operations with class methods
- [ ] Replace event handling with class methods

### Phase 3: Validation
- [ ] Add validation to all game operations
- [ ] Replace manual JSON checks with validator
- [ ] Add type safety to existing functions

### Phase 4: Optimization
- [ ] Remove legacy JSON manipulation
- [ ] Use class-based approach as single source of truth
- [ ] Add performance optimizations

## Testing

Run the examples to verify functionality:

```bash
# Compile TypeScript
npm run build

# Run usage examples (when implemented)
npm run test:gameenv-examples
```

## Backward Compatibility

The system maintains **100% backward compatibility** with existing code:

1. **Existing JSON format**: Still supported through adapters
2. **Existing APIs**: Continue to work unchanged
3. **File storage**: No changes to storage format required
4. **Frontend**: No changes required

## Next Steps

1. **Integration**: Start using adapters in GameLogic.js
2. **Method Replacement**: Replace JSON operations with class methods
3. **Validation**: Add validation throughout the codebase
4. **Type Safety**: Gradually add TypeScript to existing JavaScript files
5. **Optimization**: Remove legacy code once migration is complete

## Support

For questions or issues with the GameEnvironment class system:

1. Check the examples in `src/examples/`
2. Review the adapter utilities in `src/utils/`
3. Refer to the TypeScript interfaces for type information
4. Test integration patterns before full migration