# Zone Restrictions Workflow - Complete Understanding Guide

## 🎯 Overview
This document explains how zone restrictions flow from leader cards through the unified effect system to appear in API responses. Understanding this workflow will help you debug and extend the system.

## 🔄 Complete Data Flow

### Step 1: Leader Data (JSON) → Zone Compatibility Rules
**Location**: `src/data/leaderCards.json`
```javascript
// Example: Trump (s-1)
{
  "s-1": {
    "name": "特朗普",
    "zoneCompatibility": {
      "top": ["右翼", "自由", "經濟"],
      "left": ["右翼", "自由", "愛國者"], 
      "right": ["右翼", "愛國者", "經濟"]
    }
  }
}
```

### Step 2: Game Action → Play Sequence Recording
**Location**: `GameLogic.js` - various game action methods
- When leader is played: `PLAY_LEADER` action recorded in `gameEnv.playSequence.plays`
- For test scenarios: `injectGameState` detects missing leader plays and records them automatically

### Step 3: Effect Simulation → Zone Restrictions Calculated
**Location**: `EffectSimulator.js` - `simulateCardPlaySequence()`

#### 3a. Play Sequence Replay
```javascript
// Replays ALL actions in chronological order
for (const play of sortedPlays) {
    if (play.action === 'PLAY_LEADER') {
        await this.executePlay(simState, play);
        // ↓ This calls processCompleteLeaderEffects()
    }
}
```

#### 3b. Leader Effects Processing
```javascript
// processCompleteLeaderEffects() → applyLeaderZoneRestrictions()
simState.players[playerId].fieldEffects.zoneRestrictions = {
    TOP: ["右翼", "自由", "經濟"],
    LEFT: ["右翼", "自由", "愛國者"],
    RIGHT: ["右翼", "愛國者", "經濟"],
    HELP: ["ALL"],
    SP: ["ALL"]
};
```

#### 3c. Final State Calculation
```javascript
// calculateFinalState() copies restrictions to computedState
computedState.activeRestrictions[playerId] = simState.players[playerId].fieldEffects.zoneRestrictions;
```

### Step 4: Computed State → Main Game Environment Merge
**Location**: `GameLogic.js` and `mozGamePlay.js` - after `simulateCardPlaySequence()` calls

```javascript
// CRITICAL MERGE STEP - This was the bug that was fixed!
for (const playerId of playerList) {
    if (computedState.activeRestrictions && computedState.activeRestrictions[playerId]) {
        gameEnv.players[playerId].fieldEffects.zoneRestrictions = computedState.activeRestrictions[playerId];
    }
}
```

### Step 5: API Response → Frontend Receives Zone Restrictions
**Location**: API endpoints return `gameEnv.players[playerId].fieldEffects.zoneRestrictions`

```javascript
// API Response Structure
{
  "gameEnv": {
    "players": {
      "playerId_1": {
        "fieldEffects": {
          "zoneRestrictions": {
            "TOP": ["右翼", "自由", "經濟"],
            "LEFT": ["右翼", "自由", "愛國者"],
            "RIGHT": ["右翼", "愛國者", "經濟"],
            "HELP": ["ALL"],
            "SP": ["ALL"]
          }
        }
      }
    }
  }
}
```

## 🔧 Key Functions and Their Roles

### `injectGameState()` - Test Environment Setup
- **Purpose**: Initialize test scenarios with proper leader effects
- **Key Fix**: Auto-records missing `PLAY_LEADER` actions in play sequence
- **Result**: Test scenarios now properly apply leader restrictions

### `simulateCardPlaySequence()` - Effect Calculation Engine
- **Purpose**: Replay entire game sequence to calculate all effects
- **Input**: `gameEnv` with complete play sequence
- **Output**: `computedState` with calculated zone restrictions
- **Key**: Processes `PLAY_LEADER` actions to set zone restrictions

### `processCompleteLeaderEffects()` - Leader Effect Processor
- **Purpose**: Apply all effects from a specific leader
- **Key Method**: `applyLeaderZoneRestrictions()` sets the actual restrictions
- **Input**: Leader JSON data with `zoneCompatibility`
- **Output**: Updates `simState.players[playerId].fieldEffects.zoneRestrictions`

### Field Effects Merge - Critical Integration Step
- **Purpose**: Copy calculated effects back to main `gameEnv`
- **Why Needed**: `computedState` is separate from `gameEnv`
- **What Happens**: Zone restrictions become visible in API responses
- **Where**: After every `simulateCardPlaySequence()` call

## 🐛 What Was Fixed

### The Bug
Zone restrictions were calculated correctly but never appeared in API responses because:
1. ✅ EffectSimulator calculated restrictions → stored in `computedState.activeRestrictions`
2. ❌ No merge back to main gameEnv → restrictions stayed in separate object
3. ❌ API response sent `gameEnv.players` → zone restrictions missing

### The Fix
Added merge step after every `simulateCardPlaySequence()` call:
```javascript
// Copy restrictions from computedState back to gameEnv
gameEnv.players[playerId].fieldEffects.zoneRestrictions = computedState.activeRestrictions[playerId];
```

## 🧪 Testing the System

### Test Zone Restrictions
```bash
# Call injectGameState with leaders
curl -X POST -H "Content-Type: application/json" -d '{
  "gameId": "test",
  "gameEnv": {
    "players": { ... },
    "zones": {
      "playerId_1": {"leader": {"id": "s-1", "name": "特朗普"}}
    }
  }
}' http://localhost:8080/api/game/test/injectGameState

# Check response for fieldEffects.zoneRestrictions
```

### Expected Results
- Trump: Restrictive zones (TOP: [右翼, 自由, 經濟])
- Biden: More permissive zones (all types allowed)
- Powell: Cross-player effects (nullifies opponent's economic cards)

## 🚀 Future Extensions

### Adding New Leader Effects
1. Update `leaderCards.json` with new `zoneCompatibility` or `effects.rules`
2. Effects automatically processed by unified system
3. No code changes needed for basic zone restrictions
4. Complex effects may need new effect types in EffectSimulator

### Debugging Zone Restrictions
1. Check `gameEnv.playSequence.plays` for `PLAY_LEADER` actions
2. Verify `computedState.activeRestrictions` after simulation
3. Confirm merge step copies to `gameEnv.players[playerId].fieldEffects`
4. Validate API response includes `fieldEffects.zoneRestrictions`

## 📋 Summary
The zone restrictions system works through a complete replay-based simulation where:
1. Leaders are recorded as `PLAY_LEADER` actions in the play sequence
2. EffectSimulator replays the sequence and calculates all effects including zone restrictions
3. Calculated effects are merged back into the main game environment
4. API responses include the zone restrictions for frontend validation

This unified approach ensures consistency and makes the system easy to extend and debug.