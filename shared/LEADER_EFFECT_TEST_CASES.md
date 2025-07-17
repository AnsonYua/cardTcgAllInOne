# Leader Effect Scenario Test Cases

This document outlines the test scenarios created to validate the leader card effects in the game. Each scenario is designed to test a specific rule or interaction as defined in the card data.

## Test Scenario Files

All scenarios are located in `shared/testScenarios/gameStates/`.

---

### 1. Trump (s-1)

#### 1.1. `leader_s-1_trump_boost.json`
- **Description**: Tests Trump's standard effect that boosts 'Right-Wing' and 'Patriot' cards by +45 power.
- **Setup**:
  - **Player 1**: Trump (s-1)
  - **Player 2**: Biden (s-2)
  - **Player 1 Field**:
    - `c-1` ('Patriot', 100 power)
    - `c-2` ('Right-Wing', 80 power)
- **Expected Outcome**:
  - `c-1` final power should be 155 (100 + 45 boost + 10 self-effect).
  - `c-2` final power should be 145 (80 + 45 boost + 10 self-effect).

#### 1.2. `leader_s-1_trump_vs_powell_nerf.json`
- **Description**: Tests Trump's conditional effect against Powell (s-6), which sets the power of 'Economy' cards to 0.
- **Setup**:
  - **Player 1**: Trump (s-1)
  - **Player 2**: Powell (s-6)
  - **Player 1 Field**: `c-13` ('Economy', 40 power)
- **Expected Outcome**:
  - `c-13` final power should be 0.

---

### 2. Biden (s-2)

#### 2.1. `leader_s-2_biden_boost.json`
- **Description**: Tests Biden's universal effect that boosts all cards by +40 power.
- **Setup**:
  - **Player 1**: Biden (s-2)
  - **Player 2**: Trump (s-1)
  - **Player 1 Field**: `c-5` (50 power)
- **Expected Outcome**:
  - `c-5` final power should be 90 (50 + 40 boost).

---

### 3. Musk (s-3)

#### 3.1. `leader_s-3_musk_freedom_boost.json`
- **Description**: Tests Musk's effect that boosts 'Freedom' cards by +50 power.
- **Setup**:
  - **Player 1**: Musk (s-3)
  - **Player 2**: Biden (s-2)
  - **Player 1 Field**: `c-9` ('Freedom', 30 power)
- **Expected Outcome**:
  - `c-9` final power should be 80 (30 + 50 boost).

#### 3.2. `leader_s-3_musk_doge_boost.json`
- **Description**: Tests Musk's effect that boosts cards with 'Doge' in the name by +20 power, and its stacking with the 'Freedom' boost.
- **Setup**:
  - **Player 1**: Musk (s-3)
  - **Player 2**: Biden (s-2)
  - **Player 1 Field**: `c-8` ('Freedom', 'Doge' trait, 80 power)
- **Expected Outcome**:
  - `c-8` final power should be 150 (80 + 50 'Freedom' boost + 20 'Doge' boost).

---

### 4. Harris (s-4)

#### 4.1. `leader_s-4_harris_leftwing_boost.json`
- **Description**: Tests Harris's effect that boosts 'Left-Wing' cards by +40 power.
- **Setup**:
  - **Player 1**: Harris (s-4)
  - **Player 2**: Biden (s-2)
  - **Player 1 Field**: `c-3` ('Left-Wing', 110 power)
- **Expected Outcome**:
  - `c-3` final power should be 150 (110 + 40 boost).

#### 4.2. `leader_s-4_harris_economy_boost.json`
- **Description**: Tests Harris's effect that boosts 'Economy' cards by +20 power.
- **Setup**:
  - **Player 1**: Harris (s-4)
  - **Player 2**: Biden (s-2)
  - **Player 1 Field**: `c-24` ('Economy', 60 power)
- **Expected Outcome**:
  - `c-24` final power should be 80 (60 + 20 boost).

#### 4.3. `leader_s-4_harris_vs_trump_nerf.json`
- **Description**: Tests Harris's conditional effect against Trump (s-1), which sets the power of any card in the right zone to 0.
- **Setup**:
  - **Player 1**: Harris (s-4)
  - **Player 2**: Trump (s-1)
  - **Player 1 Field**: `c-3` (110 power) in the right zone.
- **Expected Outcome**:
  - `c-3` final power should be 0.

---

### 5. Vance (s-5)

#### 5.1. `leader_s-5_vance_boosts.json`
- **Description**: Tests Vance's multiple boost effects.
- **Setup**:
  - **Player 1**: Vance (s-5)
  - **Player 2**: Biden (s-2)
  - **Player 1 Field**:
    - `c-2` ('Right-Wing', 80 power)
    - `c-15` ('Freedom', 50 power)
    - `c-17` ('Economy', 60 power)
- **Expected Outcome**:
  - `c-2` final power should be 120 (80 + 40 boost).
  - `c-15` final power should be 70 (50 + 20 boost).
  - `c-17` final power should be 70 (60 + 10 boost).

---

### 6. Powell (s-6)

#### 6.1. `leader_s-6_powell_boost.json`
- **Description**: Tests Powell's standard effect that boosts 'Freedom' and 'Economy' cards by +30 power.
- **Setup**:
  - **Player 1**: Powell (s-6)
  - **Player 2**: Biden (s-2)
  - **Player 1 Field**:
    - `c-9` ('Freedom', 30 power)
    - `c-13` ('Economy', 40 power)
- **Expected Outcome**:
  - `c-9` final power should be 60 (30 + 30 boost).
  - `c-13` final power should be 70 (40 + 30 boost).

#### 6.2. `leader_s-6_powell_vs_trump_boost.json`
- **Description**: Tests Powell's conditional effect against Trump (s-1), which gives an additional +20 boost to 'Economy' cards.
- **Setup**:
  - **Player 1**: Powell (s-6)
  - **Player 2**: Trump (s-1)
  - **Player 1 Field**: `c-13` ('Economy', 40 power)
- **Expected Outcome**:
  - `c-13` final power should be 90 (40 + 30 standard boost + 20 conditional boost).

#### 6.3. `leader_s-6_powell_vs_trump_restriction.json`
- **Description**: Tests Powell's conditional effect against Trump (s-1), which should prevent the summoning of 'Right-Wing' cards.
- **Setup**:
  - **Player 1**: Powell (s-6)
  - **Player 2**: Trump (s-1)
  - **Player 1 Hand**: `c-2` ('Right-Wing')
- **Expected Outcome**:
  - The game should prevent Player 1 from summoning `c-2`. The validation point checks if the summon action is disallowed.

---

## Dynamic Test Cases

### 1. Trump Leader Dynamic Tests

#### 1.1. `leader_s-1_trump_boost_corrected_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Trump's leader effects through actual card placement actions and power calculations
- **Setup**:
  - **Player 1**: Trump (s-1) - 右翼 leader
  - **Player 2**: Biden (s-2) - 左翼 leader
  - **Initial Turn**: Player 1 (currentTurn: 0)
- **Actions**:
  1. **Step 1**: Player 1 plays `c-1` (總統特朗普, 愛國者, 100 power) in LEFT zone
     - Expected: Success, card placed with effects applied
  2. **Step 2**: Player 2 plays `c-21` (奧巴馬, 左翼, 80 power) in TOP zone
     - Expected: Success, turn switches properly
- **Power Validation**:
  - `c-1` final power: 155 (100 base + 45 Trump leader boost + 10 Trump family trait)
  - `c-21` final power: 120 (80 base + 40 Biden leader boost)
- **Zone Compatibility Tests**:
  - Trump leader zones: TOP (右翼/自由/經濟), LEFT (右翼/自由/愛國者), RIGHT (右翼/愛國者/經濟)
  - Biden leader zones: ALL types allowed in all zones
- **Error Cases**:
  - Invalid zone placement
  - Zone compatibility violations
  - Occupied zone placement attempts

#### 1.2. `leader_s-1_trump_vs_powell_nerf_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Trump's nerf effect against Powell for Economy cards
- **Setup**:
  - **Player 1**: Trump (s-1) - 右翼 leader
  - **Player 2**: Powell (s-6) - 經濟 leader
  - **Initial Turn**: Player 1 (currentTurn: 0)
- **Actions**:
  1. **Step 1**: Player 1 plays `c-19` (比爾蓋茨 Bill gates, 經濟, 70 power) in top zone
     - Expected: Success with nerf applied
- **Power Validation**:
  - `c-19` final power: 0 (70 base power nerfed to 0 by Trump vs Powell effect)
- **Test Status**: ✅ PASSING
- **Issues Resolved**:
  - Fixed zone naming: uppercase "TOP" → lowercase "top"
  - Fixed turn management: currentTurn: 1 → currentTurn: 0
  - Added missing fieldEffects structure with zone restrictions
  - Added missing turnAction arrays in player data
  - Updated card ID from custom `c-eco-1` to standard `c-19`

---

## Test Execution Issues

### Common Problems

1. **Card Definition Mismatches**:
   - Some test scenarios use cards not defined in main data files
   - Cards defined in test scenarios may have different IDs than expected
   - Missing card definitions cause validation failures

2. **Turn Management**:
   - Dynamic tests fail with "Not your turn" errors
   - currentTurn vs currentPlayer synchronization issues
   - Turn switching logic not properly handling test scenarios

3. **Zone Compatibility**:
   - Zone restrictions not properly enforced in dynamic tests
   - Face-down card placement bypassing compatibility checks
   - Zone occupation validation inconsistencies

### Recommendations

1. **Standardize Card Data**:
   - Use consistent card IDs across all test scenarios
   - Reference cards from main data files rather than defining in tests
   - Validate card existence before running tests

2. **Fix Turn Management**:
   - Ensure currentTurn and currentPlayer are properly synchronized
   - Handle turn switching in dynamic test scenarios
   - Validate turn order before executing actions

3. **Improve Test Framework**:
   - Add better error messages for common failures
   - Implement retry mechanisms for turn-based issues
   - Add validation for card definitions before test execution
