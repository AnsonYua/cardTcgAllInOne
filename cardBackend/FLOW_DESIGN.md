# Card Game Flow Design: Zone Restrictions + Active Effects → Victory Points

## Overview
This document describes the complete flow of how card plays update field effects, which then drive victory point calculations in the optimized card game system.

## Core Flow Architecture

### 1. Card Play Trigger (OptimizedGameEngine)

**Input**: `playCard(gameEnv, playerId, cardId, zone, faceDown)`

**Process**:
```javascript
// STEP 1: Instant validation using existing fieldEffects
validateCardPlayInstant(gameEnv, playerId, cardId, zone, faceDown)
  ↓ Uses gameEnv.fieldEffects[playerId].zoneRestrictions
  ↓ Checks gameEnv.fieldEffects[playerId].specialEffects

// STEP 2: Update game state
executeCardPlay(gameEnv, playerId, cardId, zone, faceDown)
  ↓ Remove card from hand
  ↓ Place in zone
  ↓ Record in play sequence

// STEP 3: Process incremental effects (O(1) optimization)
IncrementalEffectManager.processNewEffects(gameEnv)
  ↓ Process only NEW card effects
  ↓ Update fieldEffects incrementally
```

### 2. Field Effects Update (IncrementalEffectManager)

**What Gets Updated in `gameEnv.fieldEffects[playerId]`**:

```javascript
{
  // Zone Restrictions (from Leaders)
  zoneRestrictions: {
    top: ["右翼", "自由", "經濟"],      // Trump's top zone restrictions
    left: ["右翼", "自由", "愛國者"],   // Trump's left zone restrictions
    right: ["右翼", "愛國者", "經濟"],  // Trump's right zone restrictions
    help: "ALL",                      // Help zone (usually unrestricted)
    sp: "ALL"                         // SP zone (usually unrestricted)
  },
  
  // Active Effects (from All Cards)
  activeEffects: [
    {
      effectId: "s-1_powerBoost",
      source: "s-1",                 // Trump card ID
      type: "powerBoost",
      target: { 
        scope: "SELF", 
        gameTypes: ["右翼", "愛國者"] 
      },
      value: 45                      // +45 power boost
    },
    {
      effectId: "c-21_powerBoost", 
      source: "c-21",                // Obama card ID
      type: "powerBoost",
      target: { 
        scope: "SELF", 
        zones: ["top", "left", "right"] 
      },
      value: 50                      // +50 to first ally
    }
  ],
  
  // Calculated Powers (Result of Active Effects)
  calculatedPowers: {
    "c-43": 195,  // 150 base + 45 Trump boost = 195
    "c-44": 150,  // 150 base (no applicable boosts)
    "c-21": 200   // 150 base + 50 boost = 200
  },
  
  // Special Effects (Gameplay Modifiers)
  specialEffects: {
    zonePlacementFreedom: false,     // Can place any card anywhere
    immuneToNeutralization: false    // Immune to nullification effects
  },
  
  // Disabled Cards (Effect-based)
  disabledCards: ["c-15"],          // Cards disabled by opponent effects
  
  // Victory Point Modifiers
  victoryPointModifiers: 0          // Additional VP modifications
}
```

### 3. Victory Point Calculation (BattleCalculator)

**Trigger**: When battle phase starts or manual calculation requested

**Process**: 6-step calculation using the updated `fieldEffects`:

```javascript
// Step 1: Base Power Calculation
calculateBasePower(calculationContext)
  ↓ Extract face-up character cards
  ↓ Use fieldEffects.calculatedPowers for modified values

// Step 2: Leader Effects  
applyLeaderEffects(calculationContext)
  ↓ Apply fieldEffects.activeEffects from leader cards
  ↓ Power boosts/penalties from zone compatibility

// Step 3: Utility Card Effects
applyUtilityCardEffects(calculationContext)
  ↓ Process Help and SP card effects from fieldEffects.activeEffects
  ↓ Apply special rules (neutralization, immunity)

// Step 4: Total Power Calculation
calculateTotalPower(calculationContext)
  ↓ Sum all modified character powers
  ↓ Apply fieldEffects.victoryPointModifiers

// Step 5: Combo Bonuses
calculateComboBonuses(calculationContext)
  ↓ Same-type combos: +250 (all 3), +50 (any 2)
  ↓ Special combos: Freedom+Economy, Right-wing+Patriot, etc.

// Step 6: Final Effects
applyFinalEffects(calculationContext)
  ↓ Post-combo modifications from SP cards
  ↓ Final fieldEffects adjustments
```

## Key Architectural Benefits

### 1. Single Source of Truth
- **Before**: Separate `validationState` and `fieldEffects` requiring manual sync
- **After**: Only `fieldEffects` contains all effect data
- **Impact**: No data duplication, no sync issues

### 2. O(1) Performance Optimization
- **Before**: Full game replay for every card play (O(n²))
- **After**: Incremental processing of only new effects (O(1))
- **Impact**: Massive performance improvement for large games

### 3. Real-time Effect Tracking
- **Zone Restrictions**: Updated immediately when leaders change
- **Active Effects**: Processed incrementally as cards are played  
- **Calculated Powers**: Cached and updated only when effects change
- **Victory Points**: Calculated on-demand using cached effect data

## Flow Examples

### Example 1: Playing Trump (Leader) + Character Cards

```javascript
// 1. Play Trump as Leader
playCard(gameEnv, "playerId_1", "s-1", "leader", false)
  ↓ Updates fieldEffects.zoneRestrictions
  ↓ Updates fieldEffects.activeEffects (+45 to 右翼/愛國者)

// 2. Play Character Card (right-wing type)
playCard(gameEnv, "playerId_1", "c-43", "top", false)  
  ↓ Validated against zoneRestrictions.top (允許 右翼)
  ↓ Card placed successfully
  ↓ Power calculated: 150 base + 45 Trump boost = 195
  ↓ Stored in fieldEffects.calculatedPowers["c-43"] = 195

// 3. Battle Calculation
calculatePlayerPoints(gameEnv, "playerId_1")
  ↓ Uses fieldEffects.calculatedPowers["c-43"] = 195
  ↓ Applies combo bonuses if applicable
  ↓ Returns total victory points
```

### Example 2: Opponent Nullification Effect

```javascript
// 1. Opponent plays neutralization card
playCard(gameEnv, "playerId_2", "h-1", "help", false)
  ↓ Updates fieldEffects.activeEffects (nullification rule)
  ↓ Targets specific opponent card based on effect rules

// 2. Effect Processing
processNewEffects(gameEnv)
  ↓ Applies nullification to target card
  ↓ Updates fieldEffects.calculatedPowers["target"] = 0
  ↓ May add to fieldEffects.disabledCards if applicable

// 3. Victory Point Recalculation
calculatePlayerPoints(gameEnv, "playerId_1")
  ↓ Uses updated fieldEffects.calculatedPowers (now includes nullified card)
  ↓ Total victory points reduced due to nullification
```

## Integration Points

### Frontend Integration
- **API Response**: `fieldEffects` included in standard `gameEnv` response
- **Real-time Updates**: Effects visible immediately after card play
- **Validation**: Frontend can use `fieldEffects.zoneRestrictions` for instant validation

### Performance Monitoring
- **Effect Processing Time**: Tracked per card play
- **Cache Hit Rate**: Validation cache performance metrics
- **Memory Usage**: Field effects storage optimization

## Future Enhancements

### 1. Effect Rollback System
- Store effect deltas for undo functionality
- Support for complex effect interactions
- Debugging tools for effect chains

### 2. Advanced Combos
- Multi-player combo detection
- Cross-zone combination bonuses
- Dynamic combo rule loading

### 3. Real-time Multiplayer
- Field effects synchronization across clients
- Optimistic updates with server validation
- Conflict resolution for simultaneous plays

---

This flow ensures that every card play immediately updates the game's tactical landscape (zone restrictions + active effects), which then drives the strategic victory point calculations in real-time with optimal performance.