# Dialog Refactor Testing Guide

## Overview
This document outlines comprehensive test cases and flows to validate the DialogUIManager refactor from complex `eligibleCards` objects to simplified `items` array format.

## Pre-Refactor vs Post-Refactor Comparison

### Before (Complex eligibleCards):
```javascript
selection = {
  eligibleCards: [
    {
      cardData: { name, ap, hp, id },
      carduid: "unit_123",
      zone: "slot1", 
      playerId: "player_2",
      currentHP: 5, currentAP: 3,
      // ... 20+ more properties
    }
  ]
}
```

### After (Simplified items):
```javascript
selection = {
  items: [
    { type: 'slot', playerId: 'player_2', zone: 'slot1', constraints: ['has-unit'] }
  ]
}
```

---

## Test Categories

### 🎯 **Category 1: Slot-Based Dialogs (3 types)**

#### **Test Case 1.1: Pilot Attachment Selection**
**File**: `CardActionHandler.js` - Pilot card attachment to units
**Trigger**: Play a pilot card from hand

**Pre-Conditions**:
- Player has units in slots 1, 3, 5 (no pilots attached)
- Player has units in slots 2, 4 (with pilots already attached)
- Player has pilot card in hand

**Test Flow**:
1. Select pilot card from hand
2. Click "打出[Pilot]" action button
3. Dialog should appear with title "Select Unit to Pilot"
4. Should show only slots 1, 3, 5 (units without pilots)
5. Should NOT show slots 2, 4 (units with pilots)
6. Should show unit names and current AP/HP
7. Select a unit → Pilot should attach successfully
8. Cancel → Dialog closes, no action taken

**Expected Results**:
- ✅ Dialog displays exactly 3 selectable units
- ✅ Unit+pilot combination shown after attachment
- ✅ Backend receives correct pilot attachment action

---

#### **Test Case 1.2: Attack Target Selection**
**File**: `CardActionHandler.js` - Attack opponent units
**Trigger**: Play unit card, then select "攻擊機體" action

**Pre-Conditions**:
- Player has unit in slot (able to attack)
- Opponent has units in slots 1, 3, 4 
- Opponent has no units in slots 2, 5, 6

**Test Flow**:
1. Select player unit in slot
2. Click "攻擊機體" action button  
3. Dialog should appear with title "选择攻击目标"
4. Should show opponent slots 1, 3, 4 with units
5. Should NOT show empty opponent slots 2, 5, 6
6. Should display unit+pilot combinations if pilots exist
7. Select target → Attack action executes
8. Cancel → Dialog closes, no attack

**Expected Results**:
- ✅ Dialog displays exactly 3 opponent targets
- ✅ Shows combined unit+pilot stats (total AP/HP)
- ✅ Backend receives correct attack target data

---

#### **Test Case 1.3: Deploy Effect Target Selection**
**File**: `DialogManager.js` - Backend-driven target selection
**Trigger**: Backend sends `DEPLOY_TARGET_CHOICE` event

**Pre-Conditions**:
- Deploy effect triggered from backend
- Backend specifies specific available targets
- Targets include mix of unit-only and unit+pilot slots

**Test Flow**:
1. Backend sends event with `availableTargets: [{ carduid, zone, playerId }]`
2. Dialog should appear with title "🎯 Deploy Effect Target Selection"
3. Should show ONLY the targets specified by backend
4. Should display correct unit+pilot combinations
5. Should show current AP/HP values (affected by game effects)
6. Select target → Deploy effect executes on selected target
7. Cancel → Deploy effect cancelled

**Expected Results**:
- ✅ Dialog shows exactly the backend-specified targets
- ✅ Displays current (not original) AP/HP values
- ✅ Backend receives selected target data correctly

---

### 🎴 **Category 2: Carduid-Based Dialogs (2 types)**

#### **Test Case 2.1: Burst Effect Confirmation**
**File**: `DialogManager.js` - Burst effect activation choice
**Trigger**: Backend sends `BURST_EFFECT_CHOICE` event

**Pre-Conditions**:
- Card with burst effect played
- Backend sends burst choice event

**Test Flow**:
1. Backend sends burst effect event with specific `cardId`
2. Dialog should appear with title "💥 Burst Effect Available"
3. Should show the specific card that triggered burst
4. Card should be pre-selected (autoSelectFirst: true)
5. Should show effect description
6. Click "ACTIVATE" → Burst effect activates
7. Click "SKIP" → Burst effect skipped

**Expected Results**:
- ✅ Dialog shows exactly 1 card (the burst trigger)
- ✅ Card is automatically pre-selected
- ✅ Backend receives correct burst choice (true/false)

---

#### **Test Case 2.2: Trash Area Viewing**
**File**: `GameScene.js` - View cards in trash area
**Trigger**: Click on trash pile icon

**Pre-Conditions**:
- Player has 3 cards in trash area
- Opponent has 5 cards in trash area

**Test Flow**:
1. Click player trash pile → Should show "Your Trash Area" with 3 cards
2. Click opponent trash pile → Should show "Opponent's Trash Area" with 5 cards
3. Dialog should be read-only (selectCount: 0)
4. Should display all cards in trash with correct names/stats
5. Close dialog → No selection needed, just viewing

**Expected Results**:
- ✅ Shows exactly the cards in respective trash areas
- ✅ Read-only mode (no selection possible)
- ✅ Correct card data display

---

## Edge Cases & Error Handling

### **Test Case 3.1: Empty Slot Selection**
**Scenario**: Pilot attachment when no valid units available
**Expected**: Error message "No units available to pilot"

### **Test Case 3.2: Invalid Backend Targets**
**Scenario**: Deploy effect with targets that no longer exist
**Expected**: Skip invalid targets, show only valid ones

### **Test Case 3.3: Missing Card Data**
**Scenario**: Card referenced in trash but missing cardData
**Expected**: Show placeholder with "Unknown Card" or skip

### **Test Case 3.4: Multiple Dialog Prevention**
**Scenario**: Attempt to open dialog while another is active
**Expected**: Close existing dialog, open new one

---

## Performance & Regression Testing

### **Test Case 4.1: Dialog Opening Speed**
**Measure**: Time from trigger to dialog display
**Baseline**: < 200ms for simple dialogs, < 500ms for complex slot dialogs
**Post-Refactor**: Should be faster due to simplified data structure

### **Test Case 4.2: Memory Usage**
**Measure**: Memory consumption during dialog operations
**Expected**: Reduced memory usage due to eliminated object duplication

### **Test Case 4.3: Backward Compatibility**
**Test**: Ensure old format still works during transition period
**Expected**: Both `eligibleCards` and `items` formats accepted

---

## Integration Testing Scenarios

### **Test Case 5.1: Full Game Flow**
**Scenario**: Complete game from start to finish
1. Start game → Join room
2. Play units in slots
3. Attach pilots (test pilot selection dialog)
4. Attack opponents (test attack target dialog) 
5. Deploy effects triggered (test deploy target dialog)
6. Burst effects activated (test burst dialog)
7. View trash areas (test trash dialog)
8. Complete game

### **Test Case 5.2: Rapid Dialog Switching**
**Scenario**: Quickly trigger multiple dialog types
1. Open pilot selection → Cancel
2. Immediately open attack selection → Cancel  
3. Immediately open trash viewing → Close
4. Verify no memory leaks or UI artifacts

### **Test Case 5.3: Network Error During Dialog**
**Scenario**: Network issues while dialog is open
1. Open deploy target dialog
2. Simulate network disconnection
3. Attempt selection
4. Verify graceful error handling

---

## Data Validation Testing

### **Test Case 6.1: Item Resolver Validation**
**Test**: Each item type resolves to correct data structure
```javascript
// slot → unit+pilot data with current stats
// carduid → specific card with metadata  
// trash → array of cards from trash area
```

### **Test Case 6.2: Constraint Validation**
**Test**: Constraints properly filter available items
```javascript
// 'has-unit' → only slots with units
// 'no-pilot' → only slots without pilots
// 'has-pilot' → only slots with pilots
```

### **Test Case 6.3: Cross-Player Data Access**
**Test**: Proper access to opponent vs player data
- Player items: Access own gameEnv.players[currentPlayerId]
- Opponent items: Access gameEnv.players[opponentPlayerId]
- Verify no data leakage between players

---

## Automated Test Script Template

```javascript
// Test Case Automation Framework
describe('Dialog Refactor Validation', () => {
  
  beforeEach(() => {
    // Setup game state with known configuration
    setupTestGameState();
  });

  describe('Slot-Based Dialogs', () => {
    test('Pilot Selection Dialog', async () => {
      // Trigger pilot card play
      // Verify dialog shows correct units
      // Test selection and cancellation
    });
    
    test('Attack Target Dialog', async () => {
      // Trigger attack action
      // Verify opponent targets shown
      // Test target selection
    });
    
    test('Deploy Effect Dialog', async () => {
      // Mock backend deploy event
      // Verify correct targets displayed
      // Test effect execution
    });
  });

  describe('Carduid-Based Dialogs', () => {
    test('Burst Effect Dialog', async () => {
      // Mock burst effect event
      // Verify single card shown
      // Test activation/skip choices
    });
    
    test('Trash Viewing Dialog', async () => {
      // Click trash pile
      // Verify correct cards shown
      // Test read-only behavior
    });
  });

  describe('Error Handling', () => {
    test('Empty Results', async () => {
      // Test dialogs with no valid items
      // Verify appropriate error messages
    });
    
    test('Invalid Data', async () => {
      // Test with corrupted game state
      // Verify graceful degradation
    });
  });
});
```

---

## Success Criteria

### ✅ **Functional Requirements**
- [ ] All 5 dialog types work identically to pre-refactor
- [ ] Correct data displayed in all scenarios
- [ ] Proper selection handling and callbacks
- [ ] Error cases handled gracefully

### ✅ **Performance Requirements**  
- [ ] Dialog opening time ≤ 500ms
- [ ] Memory usage reduced by ≥ 30%
- [ ] No memory leaks during dialog operations

### ✅ **Code Quality Requirements**
- [ ] Eliminated complex object construction (25+ properties)
- [ ] Single source of truth (gameEnv access)
- [ ] Type-safe item specifications
- [ ] Maintainable resolver pattern

### ✅ **Backward Compatibility**
- [ ] Transition period supports both formats
- [ ] Gradual migration possible
- [ ] No breaking changes during rollout

---

## Testing Checklist

### Pre-Refactor Baseline
- [ ] Document current dialog behavior (screenshots/videos)
- [ ] Record performance metrics
- [ ] Identify all dialog trigger points
- [ ] Create test game states for each scenario

### During Refactor
- [ ] Test each resolver function independently
- [ ] Validate item type specifications
- [ ] Check constraint filtering logic
- [ ] Verify data access patterns

### Post-Refactor Validation
- [ ] Run complete test suite
- [ ] Compare against baseline behavior
- [ ] Performance regression testing
- [ ] User acceptance testing

### Production Readiness
- [ ] Load testing with multiple concurrent dialogs
- [ ] Cross-browser compatibility verification
- [ ] Mobile device testing
- [ ] Network reliability testing

---

**This testing guide ensures comprehensive validation of the dialog refactor while maintaining existing functionality and improving code maintainability.**