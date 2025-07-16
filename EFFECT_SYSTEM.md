# Card Effect Execution System

## Overview

The Card Effect Execution System provides replay-based simulation for handling complex card interactions and effects in the trading card game. The system ensures consistent game state by replaying the entire card play sequence from scratch whenever the game state changes.

## Core Philosophy

**Replay-Based Simulation**: Instead of tracking and applying effects incrementally, the system replays the entire sequence of card plays from the beginning each time. This approach:

- **Guarantees Consistency**: Every calculation starts from a clean state
- **Handles Complex Interactions**: Effects that change during the sequence are properly handled
- **Eliminates State Bugs**: No accumulated state errors
- **Perfect Conflict Resolution**: Natural precedence through play order

## Architecture

### Core Components

#### 1. PlaySequenceManager (`src/services/PlaySequenceManager.js`)
Tracks all card plays in chronological order.

**Key Features**:
- Records leader plays during game setup
- Records card plays during gameplay
- Maintains sequence integrity with unique IDs
- Provides filtering and statistics

**Data Structure**:
```javascript
gameEnv.playSequence = {
  globalSequence: 0,
  plays: [
    {
      sequenceId: 1,
      playerId: "player1",
      cardId: "S002",
      action: "PLAY_LEADER",
      zone: "leader",
      data: { isInitialPlacement: true },
      timestamp: "2025-01-01T10:00:00Z",
      turnNumber: 0,
      phaseWhenPlayed: "READY_PHASE"
    }
  ]
}
```

#### 2. CardEffectRegistry (`src/services/CardEffectRegistry.js`)
Manages card effect definitions and processing logic.

**Supported Effect Types**:
- `DISABLE_OPPONENT_CARDS`: Disable opponent's SP and HELP cards
- `POWER_NULLIFICATION`: Set card power to 0
- `POWER_MODIFICATION`: Modify card power values
- `ZONE_RESTRICTION`: Change zone compatibility rules
- `POWER_BOOST`: Add power bonuses to cards

#### 3. EffectSimulator (`src/services/EffectSimulator.js`)
Executes the replay-based simulation.

**Simulation Process**:
1. Create clean simulation state
2. Replay each action in sequence order
3. Execute card placement
4. Activate immediate effects
5. Check triggered effects from other cards
6. Calculate final computed state

### Integration Points

#### GameLogic Integration
The effect system is integrated into key points in `GameLogic.js`:

1. **Game Setup** (`startReady`): Records leader plays and runs initial simulation
2. **Card Plays** (`processPlayerAction`): Records card plays and triggers simulation
3. **Frontend Response** (`transformGameStateForFrontend`): Includes computed state

#### Frontend Integration
The frontend `GameStateManager.js` includes new methods:

- `getComputedCardPower()`: Get final power after effects
- `isCardDisabled()`: Check if card is disabled
- `getComputedZoneRestrictions()`: Get active zone restrictions
- `canPlayCardInZoneComputed()`: Validate card placement with effects

## Effect Examples

### Trump Card Effect
**Card**: `c-7` (特朗普(天選之人))

**Effect**: "如我方場上有角色卡或領導卡名字為特朗普，對方場上的SP卡和HELP效果變為無效"

**Implementation**:
```javascript
{
  "type": "DISABLE_OPPONENT_CARDS",
  "conditions": {
    "requiresCard": {
      "name": "特朗普",
      "zones": ["leader", "top", "left", "right"],
      "playerId": "self"
    }
  },
  "targets": {
    "playerId": "opponent",
    "cardTypes": ["SP", "HELP"]
  },
  "action": "DISABLE"
}
```

### Power Nullification Effect
**Card**: `h-nullify` (能力封印)

**Effect**: "對方一張角色卡，原能力值變成0"

**Implementation**:
```javascript
{
  "type": "POWER_NULLIFICATION",
  "targets": {
    "playerId": "opponent",
    "cardTypes": ["character"],
    "count": 1
  },
  "action": "SET_POWER_ZERO"
}
```

## Computed State Structure

The simulation produces a computed state that contains the final game state after all effects:

```javascript
gameEnv.computedState = {
  playerPowers: {
    "player1": {
      "c-1": {
        originalPower: 100,
        finalPower: 0,        // After nullification
        zone: "top",
        isDisabled: false
      }
    }
  },
  activeRestrictions: {
    "player1": {
      "TOP": ["右翼", "自由", "經濟"],
      "LEFT": ["右翼", "自由", "愛國者"],
      "RIGHT": ["右翼", "愛國者", "經濟"]
    }
  },
  disabledCards: [
    {
      cardId: "h-1",
      playerId: "player2",
      zone: "help",
      disabledBy: "player1"
    }
  ],
  victoryPointModifiers: {
    "player1": 0,
    "player2": 0
  }
}
```

## Trigger Points

The simulation is triggered at these key moments:

1. **Game Setup**: After both players are ready and leaders are placed
2. **Card Play**: Immediately after any card is played
3. **Phase Change**: When game phase transitions
4. **Leader Change**: When advancing to new round with different leaders

## Testing

### Test Suite
Comprehensive tests in `src/tests/effectSystem.test.js`:

- **Play Sequence Recording**: Validates that all plays are recorded correctly
- **Trump Disable Effect**: Tests opponent card disabling
- **Power Nullification**: Tests power modification effects
- **Replay Consistency**: Ensures identical results from same sequence

### Running Tests
```bash
# Run effect system tests
npm test -- --testNamePattern="effectSystem"

# Run all tests
npm test
```

## Development Guidelines

### Adding New Effect Types

1. **Define Effect in Card Data**:
```javascript
{
  "effects": {
    "rules": [
      {
        "type": "NEW_EFFECT_TYPE",
        "conditions": { /* conditions */ },
        "targets": { /* targets */ },
        "action": "EFFECT_ACTION"
      }
    ]
  }
}
```

2. **Implement in CardEffectRegistry**:
```javascript
case 'NEW_EFFECT_TYPE':
  this.applyNewEffect(effect, simState, sourcePlayerId, targetPlayerId);
  break;
```

3. **Add Processing Logic**:
```javascript
applyNewEffect(effect, simState, sourcePlayerId, targetPlayerId) {
  // Implementation logic
}
```

### Best Practices

1. **Effect Conditions**: Always check conditions before applying effects
2. **Target Validation**: Validate targets exist before modification
3. **State Immutability**: Don't modify original game state during simulation
4. **Logging**: Use descriptive console logs for debugging
5. **Testing**: Add test cases for new effects

## Performance Considerations

### Optimization Strategies
- **Clean State Creation**: Minimal state initialization
- **Efficient Filtering**: Use built-in array methods for card filtering
- **Conditional Processing**: Skip processing when no effects present
- **Result Caching**: Cache computed state until next trigger

### Performance Metrics
- **Simulation Time**: Target <50ms for typical game states
- **Memory Usage**: Minimal additional memory overhead
- **Trigger Frequency**: Only when actual changes occur

## Error Handling

### Common Issues
1. **Missing Card Details**: Cards not found in card registry
2. **Invalid Conditions**: Condition checks failing
3. **Target Resolution**: Target players or cards not found
4. **Sequence Integrity**: Gaps or duplicates in sequence IDs

### Debugging
- Check console logs for effect activation messages
- Validate play sequence integrity with `validatePlaySequence()`
- Use `getPlayStatistics()` for sequence analysis
- Inspect computed state structure for unexpected values

## Future Enhancements

### Planned Features
1. **Effect Priority System**: Explicit priority ordering for complex interactions
2. **Triggered Effects**: Effects that activate on specific game events
3. **Duration Effects**: Temporary effects with expiration
4. **Stack-Based Resolution**: Magic: The Gathering style effect stack
5. **Effect Visualization**: Frontend display of active effects

### Extension Points
- **Custom Conditions**: Add new condition types
- **Effect Modifiers**: Effects that modify other effects
- **Cross-Turn Effects**: Effects that persist across turns
- **Zone-Specific Effects**: Effects that only apply in certain zones

## Conclusion

The Card Effect Execution System provides a robust, consistent foundation for handling complex card interactions. The replay-based approach ensures correctness while maintaining performance and extensibility for future enhancements.

The system successfully handles the specific requirements:
- ✅ Trump card disabling opponent SP/HELP cards
- ✅ Power nullification effects  
- ✅ Play sequence dependency
- ✅ Effect conflict resolution through replay order
- ✅ Consistent state calculation