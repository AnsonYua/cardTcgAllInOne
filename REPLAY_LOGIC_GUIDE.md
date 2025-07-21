# 🎬 Replay Logic System Guide

This document provides a comprehensive guide to understanding the replay logic system in the card game backend.

## 🗺️ **START HERE**: Entry Points Map

### **1. PRIMARY ENTRY POINT**: `src/mozGame/mozGamePlay.js`

**Main Functions**:
- `applySetPowerSelection()` - Card selection processing with replay tracking (lines 2417+)
- Calls `effectSimulator.simulateCardPlaySequence()` - The core replay function

**What to look for**:
- Step-by-step comments explaining card selection workflow
- Play sequence integration with `APPLY_SET_POWER` action type
- Effect application after simulation to prevent clearing

### **2. REPLAY ENGINE**: `src/services/EffectSimulator.js`

**Main Functions**:
- `simulateCardPlaySequence()` - THE CORE replay function (lines 117+)
- `processCompleteLeaderEffectsUnified()` - Leader effect processing (lines 1069+)
- `calculateFinalPowersUnified()` - Final power calculation (lines 1389+)

**What to look for**:
- Unified field effects system (single source of truth)
- Complete architectural comments explaining the consolidation
- Step-by-step replay workflow with detailed explanations

### **3. SEQUENCE TRACKING**: `src/services/PlaySequenceManager.js`

**Main Functions**:
- `recordCardPlay()` - Records all game actions (lines 124+)
- `getPlaySequence()` - Provides sorted sequence for replay (lines 182+)

**What to look for**:
- Action type documentation (PLAY_LEADER, PLAY_CARD, APPLY_SET_POWER)
- Data structure examples showing card selection tracking
- Integration with replay simulation

## 📊 Complete Replay Logic Flow

```mermaid
graph TD
    A[Game Action Occurs] --> B[PlaySequenceManager.recordCardPlay()]
    B --> C[Action Stored in gameEnv.playSequence.plays]
    
    D[Effect Simulation Needed] --> E[EffectSimulator.simulateCardPlaySequence()]
    E --> F[1. Initialize Field Effects]
    F --> G[2. Get Sorted Play Sequence]
    G --> H[3. Replay Each Action]
    H --> I[3a. executePlayUnified()]
    I --> J[3b. activateEffectsUnified()]
    J --> K[3c. checkTriggeredEffectsUnified()]
    K --> L[4. calculateFinalPowersUnified()]
    L --> M[Effects Applied to gameEnv.players[].fieldEffects]
    
    N[Card Selection Occurs] --> O[applySetPowerSelection()]
    O --> P[1. Validate Selection]
    P --> Q[2. Run Effect Simulation FIRST]
    Q --> E
    M --> R[3. Apply setPower Effects AFTER]
    R --> S[4. Add APPLY_SET_POWER to Play Sequence]
    S --> T[5. Recalculate Player Points]
    T --> U[6. Cleanup and Events]
```

## 🎯 **CRITICAL UNDERSTANDING**: The Two-Phase Pattern

### Phase 1: Replay from Sequence
1. **Read** entire `gameEnv.playSequence.plays` array
2. **Replay** every action in chronological order (sequenceId)
3. **Rebuild** all effects from scratch (zone restrictions, power boosts, etc.)
4. **Result**: Clean, consistent state based purely on action sequence

### Phase 2: Apply New Effects
1. **Add** new effects AFTER replay simulation
2. **Record** new actions in play sequence for future replays
3. **Update** immediate values (playerPoint, valueOnField)
4. **Result**: New effects persisted and ready for next replay

## 🔄 Card Selection Integration (h-2 Example)

### Traditional Flow (Before Selection Enhancement):
```
Player plays h-2 → Effect triggers → Player selects c-1 → Power changes → Done
```

### Enhanced Flow (With Replay Integration):
```
Player plays h-2 → PLAY_CARD recorded → Effect triggers → 
Player selects c-1 → Run full replay simulation → Apply setPower effects → 
Record APPLY_SET_POWER action → Update playerPoint → Done
```

### Key Difference:
The enhanced flow **preserves card selection information** in the play sequence, enabling:
- ✅ Complete replay consistency  
- ✅ Debug tracing of selections
- ✅ Cross-player effect tracking
- ✅ Future state reconstruction

## 📋 Action Types Reference

### PLAY_LEADER
```javascript
{
  sequenceId: 1,
  playerId: "playerId_1", 
  cardId: "s-1",
  action: "PLAY_LEADER",
  zone: "leader",
  data: { isInjectedState: true }
}
```

### PLAY_CARD  
```javascript
{
  sequenceId: 4,
  playerId: "playerId_2",
  cardId: "h-2",
  action: "PLAY_CARD", 
  zone: "help",
  data: { isFaceDown: false, cardIndex: 0, fieldIndex: 3 }
}
```

### APPLY_SET_POWER (NEW - January 2025)
```javascript
{
  sequenceId: 5,
  playerId: "playerId_2",
  cardId: "h-2",
  action: "APPLY_SET_POWER",
  zone: "effect",
  data: {
    selectionId: "playerId_2_setPower_123",
    selectedCardIds: ["c-1"],
    targetPlayerId: "playerId_1", 
    effectType: "setPower",
    powerValue: 0,
    sourceCard: "h-2"
  }
}
```

## 🔍 Debugging the Replay System

### 1. Check Play Sequence
```javascript
// In browser console or Node.js debug:
console.log(gameEnv.playSequence.plays);
```
Look for:
- ✅ Correct sequenceId order (1, 2, 3, 4, 5...)
- ✅ All actions present (leaders, cards, effects)
- ✅ APPLY_SET_POWER entries for card selections

### 2. Verify Field Effects
```javascript
console.log(gameEnv.players.playerId_1.fieldEffects);
```
Look for:
- ✅ `calculatedPowers` with correct values
- ✅ `zoneRestrictions` from leaders
- ✅ `activeEffects` with power modifications

### 3. Test Replay Consistency
```javascript
// Save current state
const beforeReplay = JSON.parse(JSON.stringify(gameEnv.players));

// Run replay simulation
await effectSimulator.simulateCardPlaySequence(gameEnv);

// Compare results - should be identical
const afterReplay = gameEnv.players;
```

## 🚨 Common Issues and Solutions

### Issue: Effects get cleared after card plays
**Cause**: Effects applied BEFORE simulation instead of AFTER
**Solution**: Always call `simulateCardPlaySequence()` FIRST, then add new effects

### Issue: Card selection not preserved in replay
**Cause**: Missing `APPLY_SET_POWER` entry in play sequence  
**Solution**: Ensure `applySetPowerSelection()` adds selection action to sequence

### Issue: playerPoint not updated after setPower
**Cause**: `calculatePlayerPoint()` not called after effect application
**Solution**: Always recalculate playerPoint after modifying card powers

### Issue: Zone restrictions not applied
**Cause**: Leader play sequence missing or not replayed
**Solution**: Ensure leaders recorded as `PLAY_LEADER` actions in sequence

## 🔧 Development Tips

### Adding New Effect Types
1. **Record** the effect in play sequence with appropriate action type
2. **Handle** the action type in `EffectSimulator.executePlayUnified()`
3. **Apply** effects in correct order (simulation first, then new effects)
4. **Test** replay consistency with your new effect type

### Extending Card Selection System
1. **Follow** the `APPLY_SET_POWER` pattern in `applySetPowerSelection()`
2. **Create** new action type (e.g., `APPLY_CARD_DRAW`)
3. **Record** selection details in `data` field
4. **Ensure** replay simulation can process the new action type

### Performance Considerations
- Replay simulation runs on every effect trigger
- Keep action sequences reasonable length (<100 actions)
- Consider checkpointing for very long games
- Use efficient data structures in field effects

## 📚 Related Files

- `EFFECT_SYSTEM.md` - Overall effect system architecture
- `cardBackend/API_README.md` - API integration with play sequences
- `cardBackend/CLAUDE.md` - Backend development guidelines
- `shared/testScenarios/` - Example game states for testing replay

This guide should give you a complete understanding of how the replay system works and how to navigate the codebase effectively.