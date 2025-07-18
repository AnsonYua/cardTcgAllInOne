# Leader Effect Test Cases - Complete Documentation

## Overview

This document provides comprehensive documentation for all leader effect test scenarios in the "Revolution and Rebellion" card game. All test cases use the **dynamic format** with action-based testing to validate leader effects through actual gameplay simulation.

**Test Location**: `shared/testScenarios/gameStates/`  
**Test Format**: All tests use `*_dynamic.json` format for consistent, reliable validation  
**Last Updated**: July 18, 2025

---

## Complete Leader Coverage

### Test Summary by Leader

| Leader | Test Files | Effects Tested | Status |
|--------|------------|----------------|---------|
| **s-1 Trump** | 2 tests | Power boosts, conditional nerfs | ✅ Complete |
| **s-2 Biden** | 1 test | Universal boost | ✅ Complete |
| **s-3 Musk** | 2 tests | Type boost, trait boost, stacking | ✅ Complete |
| **s-4 Harris** | 3 tests | Multiple boosts, conditional nerf | ✅ Complete |
| **s-5 Vance** | 1 test | Triple boost system | ✅ Complete |
| **s-6 Powell** | 3 tests | Base boost, conditional boost, restrictions | ✅ Complete |

**Total Coverage**: 12 dynamic test cases covering all 6 leaders and all effect types.

---

## Dynamic Test Cases

### 1. Trump (s-1) Leader Tests

#### 1.1. `leader_s-1_trump_boost_corrected_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Trump's core effect: +45 power boost to Right-Wing (右翼) OR Patriot (愛國者) cards
- **Setup**:
  - **Player 1**: Trump (s-1) - 右翼 leader
  - **Player 2**: Biden (s-2) - 左翼 leader (allows all card types)
- **Actions Tested**:
  1. **Step 1**: Trump plays `c-1` (總統特朗普, 愛國者, 100 power) in LEFT zone
     - Zone compatible: LEFT allows [右翼, 自由, 愛國者]
     - Expected: Success with Trump boost + family trait boost
- **Power Validation**:
  - `c-1` final power: **155** (100 base + 45 Trump boost + 10 family trait)
- **Zone Compatibility**: Trump's restricted zones: TOP [右翼,自由,經濟], LEFT [右翼,自由,愛國者], RIGHT [右翼,愛國者,經濟]
- **Test Status**: ✅ **PASSING**

#### 1.2. `leader_s-1_trump_vs_powell_nerf_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Trump's conditional effect vs Powell: Economy (經濟) cards get power set to 0
- **Setup**:
  - **Player 1**: Trump (s-1) - 右翼 leader
  - **Player 2**: Powell (s-6) - 經濟 leader
- **Actions Tested**:
  1. **Step 1**: Trump plays `c-19` (比爾蓋茨 Bill gates, 經濟, 70 power) in TOP zone
     - Expected: Success but power nerfed to 0 by conditional effect
- **Power Validation**:
  - `c-19` final power: **0** (70 base power → 0 due to Trump vs Powell nerf)
- **Effect Type**: setPower effect (overrides all other boosts)
- **Test Status**: ✅ **PASSING**

---

### 2. Biden (s-2) Leader Tests

#### 2.1. `leader_s-2_biden_boost_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Biden's universal effect: +40 power boost to ALL cards regardless of type
- **Setup**:
  - **Player 1**: Biden (s-2) - 左翼 leader (allows all card types in all zones)
  - **Player 2**: Trump (s-1) - 右翼 leader
- **Actions Tested**:
  1. **Step 1**: Biden plays `c-5` (特朗普忠粉, 左翼, 50 power) in TOP zone
  2. **Step 2**: Trump plays `c-1` (總統特朗普, 愛國者, 100 power) in LEFT zone
  3. **Step 3**: Biden plays `c-3` (拜登 Sleepy Joe, 左翼, 110 power) in LEFT zone
- **Power Validation**:
  - `c-5` final power: **90** (50 base + 40 Biden universal boost)
  - `c-3` final power: **150** (110 base + 40 Biden universal boost)
  - `c-1` final power: **155** (100 base + 45 Trump boost + 10 family trait)
- **Key Features**: Universal boost applies to ANY card type, no restrictions
- **Test Status**: ✅ **PASSING**

---

### 3. Musk (s-3) Leader Tests

#### 3.1. `leader_s-3_musk_doge_boost_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Musk's dual effect system: +50 power to Freedom (自由) cards AND +20 power to cards with "Doge" in name
- **Setup**:
  - **Player 1**: Musk (s-3) - 自由 leader
  - **Player 2**: Biden (s-2) - 左翼 leader
- **Actions Tested**:
  1. **Step 1**: Musk plays `c-8` (馬斯克 Father Of Doge, 自由, 80 power) in TOP zone
     - Qualifies for BOTH Freedom boost AND Doge boost (stacking)
  2. **Step 2**: Biden plays `c-3` (拜登 Sleepy Joe, 左翼, 110 power) in TOP zone
  3. **Step 3**: Musk plays `c-15` (Tik Tok難民, 自由, 50 power) in LEFT zone
     - Qualifies for Freedom boost only (no "Doge" in name)
- **Power Validation**:
  - `c-8` final power: **150** (80 base + 50 Freedom boost + 20 Doge boost)
  - `c-15` final power: **100** (50 base + 50 Freedom boost)
  - `c-3` final power: **150** (110 base + 40 Biden universal boost)
- **Key Features**: 
  - **Effect Stacking**: Cards can receive multiple boosts if they meet multiple criteria
  - **Name Filter**: "nameContains" filter for Doge bonus
  - **Type Filter**: "gameType" filter for Freedom bonus
- **Test Status**: ✅ **PASSING**

#### 3.2. `leader_s-3_musk_freedom_boost_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Musk's Freedom boost in isolation: +50 power to Freedom (自由) cards
- **Setup**:
  - **Player 1**: Musk (s-3) - 自由 leader
  - **Player 2**: Biden (s-2) - 左翼 leader
- **Actions Tested**:
  1. **Step 1**: Musk plays `c-16` (朱克伯格, 自由, 70 power) in TOP zone
  2. **Step 2**: Biden plays `c-3` (拜登 Sleepy Joe, 左翼, 110 power) in TOP zone
  3. **Step 3**: Musk plays `c-18` (提姆·庫克 Tim Cook, 自由, 60 power) in LEFT zone
- **Power Validation**:
  - `c-16` final power: **120** (70 base + 50 Freedom boost)
  - `c-18` final power: **110** (60 base + 50 Freedom boost)
  - `c-3` final power: **150** (110 base + 40 Biden universal boost)
- **Key Features**: Focused testing of single effect type without stacking complexity
- **Test Status**: ❌ **NEEDS FIXING** (turn timing issues)

---

### 4. Harris (s-4) Leader Tests

#### 4.1. `leader_s-4_harris_leftwing_boost_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Harris's Left-Wing boost: +40 power to Left-Wing (左翼) cards
- **Setup**:
  - **Player 1**: Harris (s-4) - 左翼 leader
  - **Player 2**: Biden (s-2) - 左翼 leader
- **Actions Tested**:
  1. **Step 1**: Harris plays `c-3` (拜登 Sleepy Joe, 左翼, 110 power) in TOP zone
  2. **Step 2**: Biden plays `c-19` (比爾蓋茨 Bill gates, 經濟, 70 power) in TOP zone
  3. **Step 3**: Harris plays `c-4` (拜登 2020, 左翼, 120 power) in LEFT zone
  4. **Step 4**: Harris plays `c-5` (特朗普忠粉, 左翼, 50 power) in RIGHT zone
- **Power Validation**:
  - `c-3` final power: **150** (110 base + 40 Harris Left-Wing boost)
  - `c-4` final power: **160** (120 base + 40 Harris Left-Wing boost)
  - `c-5` final power: **90** (50 base + 40 Harris Left-Wing boost)
  - `c-19` final power: **110** (70 base + 40 Biden universal boost)
- **Key Features**: Tests Harris's primary boost effect in isolation
- **Test Status**: ❌ **NEEDS FIXING** (turn timing issues)

#### 4.2. `leader_s-4_harris_economy_boost_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Harris's Economy boost: +20 power to Economy (經濟) cards
- **Setup**:
  - **Player 1**: Harris (s-4) - 左翼 leader
  - **Player 2**: Biden (s-2) - 左翼 leader
- **Actions Tested**:
  1. **Step 1**: Harris plays `c-24` (佩洛西, 經濟, 60 power) in TOP zone
  2. **Step 2**: Biden plays `c-3` (拜登 Sleepy Joe, 左翼, 110 power) in TOP zone
  3. **Step 3**: Harris plays `c-17` (貝索斯, 經濟, 60 power) in LEFT zone
- **Power Validation**:
  - `c-24` final power: **80** (60 base + 20 Harris Economy boost)
  - `c-17` final power: **80** (60 base + 20 Harris Economy boost)
  - `c-3` final power: **150** (110 base + 40 Biden universal boost)
- **Key Features**: Tests Harris's secondary boost effect
- **Test Status**: ❌ **NEEDS FIXING** (error case issues)

#### 4.3. `leader_s-4_harris_vs_trump_nerf_dynamic.json`
- **Test Type**: Dynamic (action-based)  
- **Description**: Tests Harris's conditional effect vs Trump: cards in RIGHT zone get power set to 0
- **Setup**:
  - **Player 1**: Harris (s-4) - 左翼 leader
  - **Player 2**: Trump (s-1) - 右翼 leader
- **Actions Tested**:
  1. **Step 1**: Harris plays `c-3` (拜登 Sleepy Joe, 左翼, 110 power) in RIGHT zone
     - Will be nerfed to 0 by Harris vs Trump conditional
  2. **Step 2**: Trump plays `c-1` (總統特朗普, 愛國者, 100 power) in LEFT zone
  3. **Step 3**: Harris plays `c-4` (拜登 2020, 左翼, 120 power) in TOP zone
     - Normal boost applies (TOP zone not affected)
- **Power Validation**:
  - `c-3` final power: **0** (110 base + 40 Harris boost → 0 by setPower effect)
  - `c-4` final power: **160** (120 base + 40 Harris boost, TOP zone not affected)
  - `c-1` final power: **155** (100 base + 45 Trump boost + 10 family trait)
- **Key Features**: 
  - **setPower Effect**: Overrides all other boosts and sets final power to specific value
  - **Zone-Specific**: Only affects RIGHT zone when facing Trump
  - **Conditional**: Only triggers when opponent leader is Trump (特朗普)
- **Test Status**: ✅ **PASSING** (fixed error case issues)

---

### 5. Vance (s-5) Leader Tests

#### 5.1. `leader_s-5_vance_boosts_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Vance's triple boost system: +40 to Right-Wing (右翼), +20 to Freedom (自由), +10 to Economy (經濟)
- **Setup**:
  - **Player 1**: Vance (s-5) - 右翼 leader
  - **Player 2**: Biden (s-2) - 左翼 leader
- **Actions Tested**:
  1. **Step 1**: Vance plays `c-2` (前總統特朗普(YMCA), 右翼, 80 power) in TOP zone
     - Gets Vance Right-Wing boost (+40) AND card's own Right-Wing boost (+10)
  2. **Step 2**: Biden plays `c-3` (拜登 Sleepy Joe, 左翼, 110 power) in TOP zone
  3. **Step 3**: Vance plays `c-16` (朱克伯格, 自由, 70 power) in LEFT zone
  4. **Step 4**: Vance plays `c-17` (貝索斯, 經濟, 60 power) in RIGHT zone
- **Power Validation**:
  - `c-2` final power: **130** (80 base + 40 Vance Right-Wing boost + 10 card boost)
  - `c-16` final power: **90** (70 base + 20 Vance Freedom boost)
  - `c-17` final power: **70** (60 base + 10 Vance Economy boost)
  - `c-3` final power: **150** (110 base + 40 Biden universal boost)
- **Zone Compatibility**: Vance zones: TOP [右翼,經濟,自由], LEFT [右翼,經濟], RIGHT [右翼,自由,愛國者]
- **Key Features**: 
  - **Multiple Boost Values**: Different boost amounts for different card types
  - **Effect Stacking**: Leader boost + card-specific boost both apply
  - **Zone Restrictions**: Tests proper zone compatibility enforcement
- **Test Status**: ❌ **NEEDS FIXING** (zone compatibility issues)

---

### 6. Powell (s-6) Leader Tests

#### 6.1. `leader_s-6_powell_boost_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Powell's base effect: +30 power to Freedom (自由) OR Economy (經濟) cards
- **Setup**:
  - **Player 1**: Powell (s-6) - 經濟 leader
  - **Player 2**: Biden (s-2) - 左翼 leader
- **Actions Tested**:
  1. **Step 1**: Powell plays `c-16` (朱克伯格, 自由, 70 power) in TOP zone
  2. **Step 2**: Biden plays `c-3` (拜登 Sleepy Joe, 左翼, 110 power) in TOP zone
  3. **Step 3**: Powell plays `c-17` (貝索斯, 經濟, 60 power) in LEFT zone
  4. **Step 4**: Powell plays `c-18` (提姆·庫克 Tim Cook, 自由, 60 power) in RIGHT zone
- **Power Validation**:
  - `c-16` final power: **100** (70 base + 30 Powell Freedom/Economy boost)
  - `c-17` final power: **90** (60 base + 30 Powell Freedom/Economy boost)
  - `c-18` final power: **90** (60 base + 30 Powell Freedom/Economy boost)
  - `c-3` final power: **150** (110 base + 40 Biden universal boost)
- **Zone Compatibility**: Powell zones: TOP [經濟,自由], LEFT [經濟,左翼,右翼], RIGHT [經濟,左翼,右翼]
- **Key Features**: 
  - **OR Logic**: Single boost applies to Freedom OR Economy cards
  - **Single Boost Value**: Same +30 boost for both qualifying types
- **Test Status**: ❌ **NEEDS FIXING** (turn timing issues)

#### 6.2. `leader_s-6_powell_vs_trump_boost_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Powell's enhanced effect vs Trump: +30 base + 20 extra = +50 total to Economy cards
- **Setup**:
  - **Player 1**: Powell (s-6) - 經濟 leader  
  - **Player 2**: Trump (s-1) - 右翼 leader
- **Actions Tested**:
  1. **Step 1**: Powell plays `c-17` (貝索斯, 經濟, 60 power) in TOP zone
     - Gets base +30 AND conditional +20 vs Trump
  2. **Step 2**: Trump plays `c-1` (總統特朗普, 愛國者, 100 power) in LEFT zone
  3. **Step 3**: Powell plays `c-19` (比爾蓋茨, 經濟, 70 power) in LEFT zone
     - Gets base +30 AND conditional +20 vs Trump AND own rich trait +10
  4. **Step 4**: Powell plays `c-16` (朱克伯格, 自由, 70 power) in RIGHT zone
     - Gets only base +30 (no extra vs Trump for Freedom cards)
- **Power Validation**:
  - `c-17` final power: **110** (60 base + 30 Powell base + 20 Powell vs Trump)
  - `c-19` final power: **130** (70 base + 30 Powell base + 20 Powell vs Trump + 10 rich trait)
  - `c-16` final power: **100** (70 base + 30 Powell base only)
  - `c-1` final power: **155** (100 base + 45 Trump boost + 10 family trait)
- **Key Features**:
  - **Conditional Stacking**: Base boost + conditional boost both apply
  - **Type-Specific Conditional**: Extra boost only for Economy cards, not Freedom
  - **Cross-Leader Effects**: Both players get their respective leader boosts
- **Test Status**: ❌ **NEEDS FIXING** (turn timing issues)

#### 6.3. `leader_s-6_powell_vs_trump_restriction_dynamic.json`
- **Test Type**: Dynamic (action-based)
- **Description**: Tests Powell's restriction vs Trump: cannot summon Right-Wing (右翼) cards
- **Setup**:
  - **Player 1**: Powell (s-6) - 經濟 leader
  - **Player 2**: Trump (s-1) - 右翼 leader
- **Actions Tested**:
  1. **Step 1**: Powell plays `c-17` (貝索斯, 經濟, 60 power) in TOP zone
     - Allowed: Economy card
  2. **Step 2**: Trump plays `c-1` (總統特朗普, 愛國者, 100 power) in LEFT zone
  3. **Step 3**: Powell plays `c-16` (朱克伯格, 自由, 70 power) in LEFT zone
     - Allowed: Freedom card
- **Power Validation**:
  - `c-17` final power: **110** (60 base + 30 Powell base + 20 Powell vs Trump)
  - `c-16` final power: **100** (70 base + 30 Powell base only)
  - `c-1` final power: **155** (100 base + 45 Trump boost + 10 family trait)
- **Restriction Tests**: 
  - **Error Case**: Attempt to play `c-2` (Right-Wing card) should be blocked
  - **Expected Error**: `LEADER_EFFECT_RESTRICTION`
- **Key Features**:
  - **preventSummon Effect**: Completely blocks placement of restricted cards
  - **Type-Specific**: Only blocks Right-Wing cards, not other types
  - **Conditional**: Only when facing Trump as opponent
- **Test Status**: ❌ **NEEDS FIXING** (zone compatibility and restriction issues)

---

## Effect Types Tested

### Power Modification Effects

| Effect Type | Description | Example | Test Coverage |
|-------------|-------------|---------|---------------|
| **powerBoost** | Adds fixed amount to card power | +40, +45, +50 | ✅ Complete |
| **setPower** | Sets card power to specific value | Set to 0 (nerf) | ✅ Complete |

### Targeting Systems

| Filter Type | Description | Example | Test Coverage |
|-------------|-------------|---------|---------------|
| **gameType** | Target by card type | "左翼", "經濟", "自由" | ✅ Complete |
| **gameTypeOr** | Target multiple types | ["右翼", "愛國者"] | ✅ Complete |
| **trait** | Target by card trait | "特朗普家族", "富商" | ✅ Complete |
| **nameContains** | Target by name content | "Doge" in name | ✅ Complete |
| **opponentLeader** | Conditional on opponent | "特朗普", "鮑威爾" | ✅ Complete |

### Restriction Effects

| Effect Type | Description | Example | Test Coverage |
|-------------|-------------|---------|---------------|
| **preventSummon** | Block card placement | Right-Wing vs Trump | ✅ Complete |

---

## Test Status Summary

### ✅ Passing Tests (5/12)
1. `leader_s-1_trump_boost_corrected_dynamic.json` - ✅ **ALL TESTS PASSED**
2. `leader_s-1_trump_vs_powell_nerf_dynamic.json` - ✅ **ALL TESTS PASSED**
3. `leader_s-2_biden_boost_dynamic.json` - ✅ **ALL TESTS PASSED**
4. `leader_s-3_musk_doge_boost_dynamic.json` - ✅ **ALL TESTS PASSED**
5. `leader_s-4_harris_vs_trump_nerf_dynamic.json` - ✅ **ALL TESTS PASSED**

### ❌ Tests Needing Fixes (7/12)
6. `leader_s-3_musk_freedom_boost_dynamic.json` - ❌ Turn timing issues
7. `leader_s-4_harris_economy_boost_dynamic.json` - ❌ Error case issues
8. `leader_s-4_harris_leftwing_boost_dynamic.json` - ❌ Turn timing issues
9. `leader_s-5_vance_boosts_dynamic.json` - ❌ Zone compatibility errors
10. `leader_s-6_powell_boost_dynamic.json` - ❌ Turn timing issues
11. `leader_s-6_powell_vs_trump_boost_dynamic.json` - ❌ Turn timing issues
12. `leader_s-6_powell_vs_trump_restriction_dynamic.json` - ❌ Zone compatibility and restriction issues

---

## Common Issues & Solutions

### Issue Categories

1. **Turn Timing Errors**: "Not your turn" errors when tests expect specific player to act
   - **Cause**: currentPlayer doesn't match expected player after previous actions
   - **Solution**: Fix turn progression logic and player action sequences

2. **Zone Compatibility Errors**: Cards placed in zones not allowed by leader
   - **Cause**: Test placing cards in zones incompatible with leader's zoneCompatibility rules
   - **Solution**: Update card placements to respect zone restrictions

3. **Error Case Issues**: Error tests using wrong players or unavailable cards
   - **Cause**: Error tests targeting wrong current player or cards not in hand
   - **Solution**: Update error tests to use correct player context and available cards

### Recommended Next Steps

1. **Fix Turn Management**: Update failing tests to have correct currentPlayer progression
2. **Validate Zone Compatibility**: Ensure all card placements respect leader zone rules
3. **Update Error Cases**: Fix error tests to use appropriate players and available cards
4. **Comprehensive Testing**: Re-run all tests after fixes to ensure 100% pass rate

---

## Development Guidelines

### Dynamic Test Structure

All dynamic tests follow this structure:
```json
{
  "gameId": "test_identifier",
  "description": "Test description",
  "testType": "dynamic",
  "initialGameEnv": { /* Starting game state */ },
  "playerActions": [ /* Sequential actions to test */ ],
  "expectedStateChanges": { /* State validation */ },
  "validationPoints": { /* Power calculations */ },
  "errorCases": [ /* Error condition tests */ ],
  "cardDefinitions": { /* Card data for reference */ }
}
```

### Power Calculation Formula

```
Final Power = Base Power + Leader Boosts + Card Effects + Trait Bonuses
```

**Note**: `setPower` effects override all other calculations and set the final power directly.

### Effect Priority Order

1. **Base Power**: Card's inherent power value
2. **Leader Effects**: Continuous effects from leader cards
3. **Card Effects**: Continuous effects from the card itself
4. **setPower Effects**: Override all previous calculations (highest priority)

---

*Last Updated: July 18, 2025*  
*Total Test Cases: 12 dynamic tests*  
*Leader Coverage: 6/6 leaders (100%)*  
*Effect Coverage: All major effect types tested*