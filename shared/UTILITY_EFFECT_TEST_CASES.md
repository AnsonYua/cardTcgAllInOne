# Utility Effect Test Cases - Complete Documentation

## Overview

This document provides comprehensive documentation for all utility card effect test scenarios in the "Revolution and Rebellion" card game. All test cases use the **per-card format** with focused testing to validate individual utility card effects.

**Test Location**: `shared/testScenarios/gameStates/UtilityEffects/`  
**Test Format**: Per-card scenarios for individual effect testing  
**Coverage**: 25/25 utility cards (100% complete)  
**Created**: January 2025 - Complete per-card utility effect testing suite

## Quick Start - Test Commands

```bash
# Run any individual scenario
cd cardBackend
npm run test:dynamic [SCENARIO_FILE].json

# Examples:
npm run test:dynamic h1_card.json                    # Test h-1 neutralization
npm run test:dynamic sp2_card.json                   # Test sp-2 power boost  
npm run test:dynamic utility_comprehensive_test.json # Run full integration test
```

---

## Complete Per-Card Test Coverage

### Test Strategy
- **Per-Card Focus**: Each scenario tests exactly ONE utility card
- **Minimal Setup**: Just enough game state to validate the specific effect
- **Clear Validation**: Simple expected results for focused testing
- **Effect Isolation**: No complex multi-card interactions

### Coverage Summary

| Card Type | Total Cards | Test Files Created | Coverage |
|-----------|-------------|------------------|----------|
| **Help Cards** | 15 | 15 | ✅ 100% |
| **SP Cards** | 10 | 10 | ✅ 100% |
| **Total** | **25** | **25** | ✅ **100%** |

---

## Help Card Test Scenarios

### H-1: Deep State (Neutralization Selection)
**File**: `h1_card.json`  
**Effect**: Manual card selection to neutralize one opponent Help/SP card  
**Test Focus**: Card selection mechanics and neutralization

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h1_card.json
```

### H-2: Make America Great Again (Automatic Targeting)  
**File**: `h2_card.json`  
**Effect**: Automatically sets first opponent character power to 0  
**Test Focus**: Automatic targeting without player selection

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h2_card.json
```

### H-3: Doge Assembly (Trait Power Boost)
**File**: `h3_card.json`  
**Effect**: +40 power boost to all Doge trait characters  
**Test Focus**: Trait-based targeting and power modification

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h3_card.json
```

### H-4: Liberation Day (Silence Summon Effects)
**File**: `h4_card.json`  
**Effect**: Silences all opponent character summon effects  
**Test Focus**: Summon effect suppression

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h4_card.json
```

### H-5: Dementia (Zone Freedom)
**File**: `h5_zone_freedom.json`  
**Effect**: Zone placement freedom - allows placing cards in restricted zones  
**Test Focus**: Zone restriction override

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h5_zone_freedom.json
```

### H-5: Dementia (Power Boost)
**File**: `h5_power_boost.json`  
**Effect**: +20 power boost to all ally characters  
**Test Focus**: Universal ally power boost

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h5_power_boost.json
```

### H-5: Dementia (Immunity)
**File**: `h5_immunity.json`  
**Effect**: Immunity to neutralization - cannot be targeted by h-1  
**Test Focus**: Neutralization immunity mechanics

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h5_immunity.json
```

### H-6: You Have No Card (Conditional Discard)
**File**: `h6_card.json`  
**Effect**: Force opponent to discard 2 random cards if they have ≥4 cards  
**Test Focus**: Conditional hand manipulation

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h6_card.json
```

### H-7: Biden Withdrawal (Prevent Help Cards)
**File**: `h7_card.json`  
**Effect**: Prevents opponent from playing Help cards  
**Test Focus**: Card type restriction

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h7_card.json
```

### H-8: Break Low (Nerf 自由/經濟 Traits)
**File**: `h8_card.json`  
**Effect**: -30 power to opponent 自由 or 經濟 characters  
**Test Focus**: Multi-type targeting with power reduction

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h8_card.json
```

### H-9: Bitcoin (Draw Cards)
**File**: `h9_card.json`  
**Effect**: Draw 2 cards from deck to hand  
**Test Focus**: Card draw mechanics

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h9_card.json
```

### H-10: California Fire (Neutralize Opponent Help)
**File**: `h10_card.json`  
**Effect**: Neutralizes all opponent Help card effects  
**Test Focus**: Blanket Help card neutralization

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h10_card.json
```

### H-11: Mar-a-Lago (Deck Search)
**File**: `h11_card.json`  
**Effect**: Search top 5 cards for 1 character card, add to hand  
**Test Focus**: Deck search and card selection

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h11_card.json
```

### H-12: Debt Crisis (SP Neutralization + Force SP Play)
**File**: `h12_card.json`  
**Effect**: Neutralizes opponent SP cards AND forces them to play SP in SP phase  
**Test Focus**: Dual effect - neutralization and forced play

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h12_card.json
```

### H-13: TikTok Ban (平民 Trait Boost)
**File**: `h13_card.json`  
**Effect**: +30 power boost to all ally 平民 trait characters  
**Test Focus**: Specific trait targeting

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h13_card.json
```

### H-14: Federal Judge (特朗普家族 Trait Nerf)
**File**: `h14_card.json`  
**Effect**: -60 power to first opponent 特朗普家族 trait character  
**Test Focus**: Automatic targeting with trait filtering

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h14_card.json
```

### H-15: Genius Act (經濟 GameType Boost)
**File**: `h15_card.json`  
**Effect**: +50 power boost to all ally 經濟 gameType characters  
**Test Focus**: GameType-based targeting

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic h15_card.json
```

---

## SP Card Test Scenarios

### SP-1: Chosen One (Conditional Neutralization)
**File**: `sp1_card.json`  
**Effect**: Neutralizes opponent SP/Help cards if ally 特朗普 is present  
**Test Focus**: Conditional effect activation

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic sp1_card.json
```

### SP-2: Rate Cut (Universal Ally Boost) 
**File**: `sp2_card.json`  
**Effect**: +30 power boost to all ally characters  
**Test Focus**: Universal ally power boost during battle phase

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic sp2_card.json
```

### SP-3: Rate Hike (Universal Opponent Nerf)
**File**: `sp3_card.json`  
**Effect**: -30 power to all opponent characters  
**Test Focus**: Universal opponent power reduction

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic sp3_card.json
```

### SP-4: Tariff Sweep (Both Sides 自由/經濟 Nerf)
**File**: `sp4_card.json`  
**Effect**: -50 power to all 自由 or 經濟 characters on both sides  
**Test Focus**: Both-sides targeting with type filtering

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic sp4_card.json
```

### SP-5: Break High (Ally 自由/經濟 Boost)
**File**: `sp5_card.json`  
**Effect**: +30 power to ally 自由 or 經濟 characters  
**Test Focus**: Ally-only type-filtered boost

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic sp5_card.json
```

### SP-6: DeepSeek Storm (Final Calculation Nerf)
**File**: `sp6_card.json`  
**Effect**: -80 to opponent total power after final calculation  
**Test Focus**: Final calculation timing and total power modification

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic sp6_card.json
```

### SP-7: No King Day (特朗普家族 Trait Nerf)
**File**: `sp7_card.json`  
**Effect**: -30 power to opponent 特朗普家族 trait characters  
**Test Focus**: Opponent trait-based targeting

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic sp7_card.json
```

### SP-8: Tesla Takedown (Doge Nerf + Musk Combo Disable)
**File**: `sp8_card.json`  
**Effect**: -40 power to opponent Doge traits + disable Musk combos  
**Test Focus**: Dual effect - power nerf and combo disruption

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic sp8_card.json
```

### SP-9: Capitol Riot (特朗普 Combo Disable)
**File**: `sp9_card.json`  
**Effect**: Disables opponent combo bonuses when 特朗普 is present  
**Test Focus**: Conditional combo disruption

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic sp9_card.json
```

### SP-10: Democratic Rally (左翼 GameType Boost)
**File**: `sp10_card.json`  
**Effect**: +30 power boost to ally 左翼 gameType characters  
**Test Focus**: GameType-specific ally boost

```bash
# Run this specific test
cd cardBackend
npm run test:dynamic sp10_card.json
```

---

## Bulk Test Running Scripts

### Run All Help Card Tests
```bash
cd cardBackend
echo "Running all Help card tests..."
for file in h1_card h2_card h3_card h4_card h5_zone_freedom h5_power_boost h5_immunity h6_card h7_card h8_card h9_card h10_card h11_card h12_card h13_card h14_card h15_card; do
  echo "Testing $file..."
  npm run test:dynamic $file.json
done
```

### Run All SP Card Tests  
```bash
cd cardBackend
echo "Running all SP card tests..."
for file in sp1_card sp2_card sp3_card sp4_card sp5_card sp6_card sp7_card sp8_card sp9_card sp10_card; do
  echo "Testing $file..."
  npm run test:dynamic $file.json
done
```

### Run All Utility Effect Tests
```bash
cd cardBackend
echo "Running ALL utility effect tests..."
for file in h1_card h2_card h3_card h4_card h5_zone_freedom h5_power_boost h5_immunity h6_card h7_card h8_card h9_card h10_card h11_card h12_card h13_card h14_card h15_card sp1_card sp2_card sp3_card sp4_card sp5_card sp6_card sp7_card sp8_card sp9_card sp10_card; do
  echo "Testing $file..."
  npm run test:dynamic $file.json
done
```

### Run Specific Effect Type Tests
```bash
# Power modification effects
cd cardBackend
for file in h2_card h3_card h8_card h13_card h14_card h15_card sp2_card sp3_card sp4_card sp5_card sp7_card sp10_card; do
  echo "Testing power effect: $file..."
  npm run test:dynamic $file.json
done

# Neutralization effects  
for file in h1_card h10_card h12_card sp1_card; do
  echo "Testing neutralization effect: $file..."
  npm run test:dynamic $file.json
done

# Special mechanics
for file in h5_zone_freedom h5_immunity h6_card h7_card h9_card h11_card sp6_card sp8_card sp9_card; do
  echo "Testing special mechanic: $file..."
  npm run test:dynamic $file.json
done
```

---

## Effect Categories

### 1. Power Modification Effects
**Cards**: h-2, h-3, h-8, h-13, h-14, h-15, sp-2, sp-3, sp-4, sp-5, sp-7, sp-10  
**Types**: Boost, nerf, set power, universal, type-filtered, trait-filtered

### 2. Neutralization Effects  
**Cards**: h-1, h-10, h-12, sp-1  
**Types**: Manual selection, automatic, conditional, immunity support

### 3. Zone & Placement Effects
**Cards**: h-5, h-7, h-12  
**Types**: Zone freedom, card type restriction, forced play

### 4. Resource Manipulation
**Cards**: h-6, h-9, h-11  
**Types**: Hand discard, card draw, deck search

### 5. Combo Disruption
**Cards**: sp-8, sp-9  
**Types**: Conditional combo disable, leader-based conditions

### 6. Special Mechanics
**Cards**: h-4, h-5, sp-6  
**Types**: Summon silencing, immunity, final calculation effects

---

## Validation Points

### Per-Card Test Structure
```json
{
  "gameId": "[card]_card",
  "description": "Test [card] card [primary effect]",
  "testType": "per_card",
  "validationPoints": {
    "[card]_[effect]": {
      "description": "[card] [effect description]",
      "expected": {
        "primaryEffect": true,
        "powerBefore": 100,
        "powerAfter": 130,
        "effectValue": 30
      }
    }
  }
}
```

### Common Validation Types
- **Effect Activation**: Verify effects trigger correctly
- **Power Calculations**: Validate final power values  
- **Targeting**: Confirm correct card targeting
- **Conditions**: Test conditional effect activation
- **State Changes**: Verify game state updates

---

## Usage Guidelines

### Development Testing
```bash
# Test a specific card during development
cd cardBackend
npm run test:dynamic [CARD]_card.json

# Examples:
npm run test:dynamic h1_card.json
npm run test:dynamic sp2_card.json
npm run test:dynamic h5_zone_freedom.json
```

### Comprehensive Test Scenarios
```bash
# Run the main comprehensive integration tests
cd cardBackend
npm run test:dynamic utility_comprehensive_test.json
npm run test:dynamic utility_neutralization_immunity_test.json
npm run test:dynamic utility_final_calculation_test.json
```

### Automated Testing
```bash
# Run all utility tests through Jest
cd cardBackend
npm test -- --testNamePattern="utility"

# Run specific utility effect type
npm test -- --testNamePattern="neutralization"
```

### Frontend Testing
```bash
# Load scenarios in demo mode for visual testing
cd cardFrontend
npm run dev
# Navigate to scenario testing UI
```

---

## Summary

✅ **Complete Coverage**: 25/25 utility cards (100%)  
✅ **Per-Card Focus**: Individual effect testing for clarity  
✅ **Ready to Run**: Individual scripts for each scenario  
✅ **Bulk Testing**: Scripts for testing by category  
✅ **Effect Types**: All 12 effect types covered across cards

*Last Updated: January 2025*  
*Implementation Status: ✅ Complete*  
*Test Coverage: 25 per-card scenarios covering all utility effects*  
*Backend Integration: Full per-card testing support*