# Character Card Effects - Implementation Guide

## Overview
This document provides comprehensive guidance for implementing and maintaining character card effects in the "Revolution and Rebellion" card game backend system.

## System Architecture

### Core Components

1. **Character Card Data** (`/src/data/characterCards.json`)
   - Card definitions with effects and rules
   - Standardized effect rule format
   - Combo system definitions

2. **Effect Processing** (`/src/mozGame/mozGamePlay.js`)
   - `processCharacterSummonEffects()` - Handles triggered effects on summon
   - `executeEffectRule()` - Main effect execution logic
   - `searchCardEffect()` - Deck search implementation
   - `completeCardSelection()` - Player card selection workflow

3. **Power Calculation** (`/src/mozGame/mozGamePlay.js`)
   - `calculatePlayerPoint()` - Main power calculation with effect application
   - `applyEffectRule()` - Applies continuous power modification effects

## Effect Types

### 1. Continuous Effects
**Type**: `"continuous"`
**Trigger**: `"always"`
**Purpose**: Passive effects that are always active

**Examples**:
- Power boost effects (c-1, c-2, c-19, c-20, c-21)
- Trait-based bonuses
- Single-target effects with `targetCount: 1`

```json
{
  "type": "continuous",
  "trigger": { "event": "always", "conditions": [] },
  "target": {
    "owner": "self",
    "zones": ["top", "left", "right"],
    "filters": [{ "type": "trait", "value": "特朗普家族" }]
  },
  "effect": { "type": "powerBoost", "value": 10 }
}
```

### 2. Triggered Effects
**Type**: `"triggered"`
**Trigger Events**: `"onSummon"`, `"onPlay"`, `"spPhase"`
**Purpose**: One-time effects that activate on specific events

**Examples**:
- Draw cards on summon (c-5, c-6, c-28)
- Search deck effects (c-9, c-10, c-12)
- Deck manipulation effects

```json
{
  "type": "triggered",
  "trigger": { "event": "onSummon", "conditions": [] },
  "target": { "owner": "self", "zones": [], "filters": [] },
  "effect": { "type": "drawCards", "value": 1 }
}
```

## Search Card Effects

### Implementation Details

The search card system supports multiple destination types:

1. **Hand** (`"hand"`) - Default destination for selected cards
2. **SP Zone** (`"spZone"`) - Direct placement in SP zone (face-down)
3. **Conditional Help Zone** (`"conditionalHelpZone"`) - Help zone if empty, otherwise hand

### Search Effect Structure

```json
{
  "type": "searchCard",
  "searchCount": 4,        // Number of cards to look at
  "selectCount": 1,        // Number of cards to select
  "destination": "hand",   // Where selected cards go
  "filters": [             // Optional filters
    { "type": "cardType", "value": "sp" }
  ]
}
```

### Supported Filters

- **cardType**: Filter by card type ("character", "help", "sp")
- **gameType**: Filter by game type ("右翼", "左翼", "經濟", "自由", "愛國者")
- **trait**: Filter by card traits

## Card Selection Workflow

### Backend Process

1. **Search Initiation**: `searchCardEffect()` creates pending selection
2. **Selection Storage**: Data stored in `gameEnv.pendingCardSelections`
3. **Frontend Interaction**: Player selects cards via API
4. **Selection Completion**: `completeCardSelection()` applies results

### API Integration

**Selection Required Response**:
```json
{
  "requiresCardSelection": true,
  "gameEnv": { /* updated game state */ }
}
```

**Selection Completion Endpoint**:
```javascript
POST /api/game/completeCardSelection
{
  "gameId": "game123",
  "playerId": "playerId_1",
  "selectionId": "playerId_1_1640995200001",
  "selectedCardIds": ["sp-1"]
}
```

## Power Calculation System

### Calculation Flow

1. **Initialize Base Powers**: Get all character cards' base power values
2. **Apply Character Effects**: Process character card continuous effects
3. **Apply Leader Effects**: Process leader card continuous effects  
4. **Apply Utility Effects**: Process help/SP card continuous effects
5. **Calculate Final Powers**: Sum all power values (minimum 0)
6. **Add Combo Bonuses**: Apply combo bonuses based on card types

### Effect Application Order

1. Character card effects (self-boosting)
2. Leader continuous effects
3. Utility card continuous effects
4. Power floor enforcement (minimum 0)
5. Combo bonus calculation

## Card Examples

### c-1 (總統特朗普) - Trait-based Power Boost
```json
{
  "description": "我方場上全部擁有特朗普家族特徵的角色卡 原能力值加 +10",
  "rules": [{
    "type": "continuous",
    "target": {
      "owner": "self",
      "zones": ["top", "left", "right"],
      "filters": [{ "type": "trait", "value": "特朗普家族" }]
    },
    "effect": { "type": "powerBoost", "value": 10 }
  }]
}
```

### c-9 (艾利茲) - Search Effect
```json
{
  "description": "當這個卡登場時，可以從自己的卡組上面查看4張卡片，自由選出一張卡加進手牌，其餘放到卡組之下。",
  "rules": [{
    "type": "triggered",
    "trigger": { "event": "onSummon", "conditions": [] },
    "effect": {
      "type": "searchCard",
      "searchCount": 4,
      "selectCount": 1,
      "destination": "hand",
      "filters": []
    }
  }]
}
```

### c-10 (爱德华) - SP Zone Search
```json
{
  "description": "當這個卡登場時，可以從自己的卡組上面查看7張卡片，選出一張SP卡 放到打出到 SP 卡區，其餘放到卡組之下。",
  "rules": [{
    "type": "triggered",
    "trigger": { "event": "onSummon", "conditions": [] },
    "effect": {
      "type": "searchCard",
      "searchCount": 7,
      "selectCount": 1,
      "destination": "spZone",
      "filters": [{ "type": "cardType", "value": "sp" }]
    }
  }]
}
```

### c-12 (盧克) - Conditional Help Zone Search
```json
{
  "description": "當這個卡登場時，可以從自己的卡組上面查看7張卡片，如HELP 卡區域為空，選出一張HELP卡 打出到 HELP 卡區，其餘放到卡組之下。",
  "rules": [{
    "type": "triggered",
    "trigger": { "event": "onSummon", "conditions": [] },
    "effect": {
      "type": "searchCard",
      "searchCount": 7,
      "selectCount": 1,
      "destination": "conditionalHelpZone",
      "filters": [{ "type": "cardType", "value": "help" }]
    }
  }]
}
```

## Implementation Status

### ✅ Completed Features

1. **Continuous Power Boost Effects**
   - Trait-based targeting (c-1, c-19)
   - Game type targeting (c-2)
   - Single target effects (c-20, c-21)

2. **Triggered Draw Effects**
   - Draw cards on summon (c-5, c-6, c-28)
   - Proper event integration

3. **Search Card Effects**
   - Multi-destination support (hand, spZone, conditionalHelpZone)
   - Filter system implementation
   - Card selection workflow

4. **Power Calculation System**
   - Multi-step calculation process
   - Effect priority ordering
   - Combo bonus integration

### 🔧 Recent Improvements

1. **Enhanced Search System**
   - Added support for new filter format
   - Implemented destination-based placement
   - Added backward compatibility

2. **Code Cleanup**
   - Removed legacy `getMonsterPoint()` method
   - Fixed `drawCards` vs `drawCard` inconsistency
   - Improved error handling

3. **Documentation Updates**
   - Fixed c-20 description text
   - Validated all card effect rules

## Testing Guidelines

### Unit Tests

**Test Categories**:
1. **Continuous Effects**: Verify power boost calculations
2. **Triggered Effects**: Test event activation and execution
3. **Search Effects**: Validate card selection and placement
4. **Error Handling**: Test invalid selections and edge cases

**Example Test Structure**:
```javascript
describe('Character Card Effects', () => {
  test('c-1 Trump family boost', () => {
    // Test trait-based power boost
  });
  
  test('c-9 Elijah search effect', () => {
    // Test deck search with hand destination
  });
  
  test('c-10 Edward SP search', () => {
    // Test SP zone placement
  });
});
```

### Integration Tests

**Test Scenarios**:
1. **Complete Game Flow**: Test effects in actual game context
2. **Card Selection UI**: Verify frontend integration
3. **Power Calculation**: Test complex effect interactions
4. **Edge Cases**: Test boundary conditions

## Development Workflow

### Adding New Character Cards

1. **Define Card Data**: Add to `characterCards.json`
2. **Implement Effects**: Update effect processing logic if needed
3. **Add Tests**: Create unit and integration tests
4. **Validate**: Test in game environment
5. **Document**: Update this README

### Modifying Existing Effects

1. **Update Card Data**: Modify rules in JSON file
2. **Update Implementation**: Modify processing logic if needed
3. **Update Tests**: Adjust test cases
4. **Validate**: Test changes don't break existing functionality

## Common Issues & Solutions

### Issue: Card Selection Not Working
**Cause**: Missing `pendingCardSelections` in game environment
**Solution**: Ensure `searchCardEffect()` properly initializes selection state

### Issue: Power Calculations Incorrect
**Cause**: Effect application order or missing rule conditions
**Solution**: Verify `calculatePlayerPoint()` processes effects in correct order

### Issue: Search Effects Not Triggering
**Cause**: Incorrect trigger event or missing `processCharacterSummonEffects()` call
**Solution**: Ensure summon effects are called during character placement

## API Reference

### Key Methods

#### `processCharacterSummonEffects(gameEnv, playerId, cardDetails)`
Processes triggered effects when character is summoned.

#### `executeEffectRule(rule, gameEnv, playerId)`
Executes a specific effect rule.

#### `searchCardEffect(gameEnv, playerId, effect)`
Handles deck search effects with player selection.

#### `completeCardSelection(gameEnv, selectionId, selectedCardIds)`
Completes pending card selection.

#### `calculatePlayerPoint(gameEnv, playerId)`
Calculates total power including all effects.

## Future Enhancements

### Planned Features

1. **Advanced Filters**
   - Name-based filtering
   - Power-based filtering
   - Complex condition combinations

2. **New Effect Types**
   - Disable card effects
   - Conditional power modifications
   - Turn-based effects

3. **Performance Improvements**
   - Effect caching
   - Batch processing
   - Optimization algorithms

### Extension Points

1. **Custom Effect Types**: Add new effect types in `executeEffectRule()`
2. **Filter System**: Extend filter logic in `searchCardEffect()`
3. **Targeting System**: Add new target types in `applyEffectRule()`

## Conclusion

The character card effects system provides a robust foundation for implementing complex card interactions. The system is designed for extensibility while maintaining consistency and performance.

For questions or issues, refer to the test scenarios in `/src/tests/` or create new test cases to validate functionality.

---

*Last Updated: July 18, 2025*  
*Version: 1.0*  
*Implementation Status: Production Ready*