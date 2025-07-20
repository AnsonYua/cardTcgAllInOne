# Migration Guide: specialStates to fieldEffects

This guide covers the migration from the old `specialStates` system to the new unified `fieldEffects` structure implemented in January 2025.

## Overview

The system has been upgraded from a dual data structure approach to a single source of truth for all effect-related data. This eliminates synchronization issues and simplifies the codebase significantly.

## Breaking Changes

### 1. Data Structure Changes

#### Before (Old Structure)
```javascript
gameEnv = {
  // Separate data structures for different effect types
  specialStates: {
    playerId_1: {
      zonePlacementFreedom: true
    }
  },
  disabledEffects: {
    playerId_1: {
      comboBonus: true,
      summonEffects: true
    }
  },
  neutralizedEffects: {
    playerId_1: {
      allEffects: true,
      zones: ["help", "sp"]
    }
  }
}
```

#### After (New Structure)
```javascript
gameEnv = {
  players: {
    playerId_1: {
      fieldEffects: {
        // Zone restrictions from leaders (single source of truth)
        zoneRestrictions: {
          TOP: ["右翼", "自由", "經濟"],
          LEFT: ["右翼", "自由", "愛國者"],
          RIGHT: ["右翼", "愛國者", "經濟"],
          HELP: ["ALL"],
          SP: ["ALL"]
        },
        
        // All active effects from cards
        activeEffects: [
          {
            effectId: "h-1_neutralize",
            source: "h-1",
            type: "neutralizeEffect",
            target: { scope: "OPPONENT", zones: ["help", "sp"] },
            value: true
          }
        ],
        
        // Special gameplay effects (consolidated)
        specialEffects: {
          zonePlacementFreedom: true,
          immuneToNeutralization: false
        },
        
        // Pre-calculated card powers
        calculatedPowers: {
          "43": 195,
          "44": 150
        },
        
        // Disabled cards tracking
        disabledCards: [],
        
        // Victory point modifiers
        victoryPointModifiers: 0
      }
    }
  },
  
  // Legacy fields (still used for backward compatibility)
  disabledEffects: { /* ... */ },
  neutralizedEffects: { /* ... */ }
}
```

### 2. API Response Changes

#### Before
```javascript
// Zone placement freedom check
if (gameEnv.specialStates?.playerId_1?.zonePlacementFreedom) {
  // Allow placement
}

// Effect neutralization check
if (gameEnv.neutralizedEffects?.playerId_1?.allEffects) {
  // Effects are neutralized
}
```

#### After
```javascript
// Zone placement freedom check
if (gameEnv.players.playerId_1.fieldEffects.specialEffects?.zonePlacementFreedom) {
  // Allow placement
}

// Effect neutralization check - now in activeEffects
const neutralizeEffect = gameEnv.players.playerId_1.fieldEffects.activeEffects
  .find(effect => effect.type === 'neutralizeEffect');
if (neutralizeEffect) {
  // Effects are neutralized
}
```

## Migration Steps

### 1. Frontend Code Updates

#### Update Game State Access
```javascript
// OLD: specialStates access
const hasZoneFreedom = gameEnv.specialStates?.[playerId]?.zonePlacementFreedom;

// NEW: fieldEffects access
const hasZoneFreedom = gameEnv.players[playerId].fieldEffects.specialEffects?.zonePlacementFreedom;
```

#### Update Zone Restriction Checks
```javascript
// OLD: Separate zone restriction logic
const restrictions = getZoneRestrictionsFromLeader(leader);

// NEW: Pre-calculated restrictions
const restrictions = gameEnv.players[playerId].fieldEffects.zoneRestrictions;
```

#### Update Power Calculations
```javascript
// OLD: Manual power calculation with effects
const finalPower = calculatePowerWithEffects(card, effects);

// NEW: Pre-calculated power
const finalPower = gameEnv.players[playerId].fieldEffects.calculatedPowers[cardId];
```

### 2. Backend Code Updates

#### Remove Deprecated Method Calls
```javascript
// REMOVE: Manual field effect processing
// processLeaderFieldEffects(gameEnv, playerId);
// clearPlayerLeaderEffects(gameEnv, playerId);

// REPLACE WITH: Unified effect simulation
await effectSimulator.simulateCardPlaySequence(gameEnv);
```

#### Update Test Scenarios
```javascript
// OLD: Test setup with specialStates
const gameEnv = {
  specialStates: {
    playerId_1: { zonePlacementFreedom: true }
  }
};

// NEW: Test setup with fieldEffects
const gameEnv = {
  players: {
    playerId_1: {
      fieldEffects: {
        specialEffects: { zonePlacementFreedom: true }
      }
    }
  }
};
```

### 3. Testing Updates

#### Update Test Assertions
```javascript
// OLD: specialStates assertions
expect(gameEnv.specialStates.playerId_1.zonePlacementFreedom).toBe(true);

// NEW: fieldEffects assertions
expect(gameEnv.players.playerId_1.fieldEffects.specialEffects.zonePlacementFreedom).toBe(true);
```

#### Update Scenario Files
```json
// OLD: Test scenario structure
{
  "gameEnv": {
    "specialStates": {
      "playerId_1": { "zonePlacementFreedom": true }
    }
  }
}

// NEW: Test scenario structure
{
  "gameEnv": {
    "players": {
      "playerId_1": {
        "fieldEffects": {
          "specialEffects": { "zonePlacementFreedom": true }
        }
      }
    }
  }
}
```

## Backward Compatibility

### Temporary Dual Support
During the migration period, both old and new structures are supported:

```javascript
// Backward compatible access pattern
function getZonePlacementFreedom(gameEnv, playerId) {
  // Try new structure first
  if (gameEnv.players?.[playerId]?.fieldEffects?.specialEffects?.zonePlacementFreedom) {
    return true;
  }
  
  // Fallback to old structure
  if (gameEnv.specialStates?.[playerId]?.zonePlacementFreedom) {
    return true;
  }
  
  return false;
}
```

### Legacy Field Cleanup
Some legacy fields remain for compatibility:
- `gameEnv.disabledEffects` - Still used by some utility card effects
- `gameEnv.neutralizedEffects` - Still used for effect neutralization tracking
- `gameEnv.playRestrictions` - Still used for card play restrictions

These will be migrated to the unified structure in future updates.

## Benefits of Migration

### 1. Single Source of Truth
- All effect data in one unified structure
- No risk of desynchronization between multiple data stores
- Simplified debugging and maintenance

### 2. Performance Improvements
- Pre-calculated powers eliminate repeated calculations
- Single simulation pass instead of multiple effect processing
- Reduced memory usage with consolidated data

### 3. Developer Experience
- Consistent API responses across all endpoints
- Immediate availability of effect data without merge operations
- Clearer data flow and easier testing

### 4. Architecture Simplification
- Eliminated 300+ lines of merge logic
- Removed dual data structure complexity
- Unified effect processing pipeline

## Timeline

### Phase 1: Implementation (Completed - January 2025)
- ✅ Unified fieldEffects structure implemented
- ✅ Single source of truth architecture established
- ✅ Backward compatibility maintained

### Phase 2: Migration (Current)
- 🔄 Update documentation and guides
- 🔄 Migrate test scenarios to new structure
- 🔄 Update frontend integration code

### Phase 3: Cleanup (Future)
- ⏳ Remove legacy field support
- ⏳ Complete migration of remaining effects
- ⏳ Archive old migration code

## Support

### Common Issues

#### Issue: Zone freedom not working
**Old Code:**
```javascript
if (gameEnv.specialStates?.[playerId]?.zonePlacementFreedom) {
  // This may not work anymore
}
```

**Solution:**
```javascript
if (gameEnv.players[playerId].fieldEffects.specialEffects?.zonePlacementFreedom) {
  // Updated access pattern
}
```

#### Issue: Power calculations incorrect
**Problem:** Using manual calculation instead of pre-calculated values

**Solution:** Use `fieldEffects.calculatedPowers[cardId]` for consistent results

#### Issue: Test scenarios failing
**Problem:** Using old specialStates structure in test data

**Solution:** Update test scenarios to use `players[].fieldEffects.specialEffects`

### Getting Help

1. Check the updated API documentation in `GAME_FLOW_README.md`
2. Review test examples in `src/tests/utilityEffectsSimple.test.js`
3. Examine the unified field effects architecture in `CLAUDE.md`
4. Consult the zone restrictions workflow in `ZONE_RESTRICTIONS_WORKFLOW.md`

---

*Last Updated: January 2025*  
*Migration Status: Phase 2 - Documentation and Integration*  
*Backward Compatibility: Maintained until Phase 3*