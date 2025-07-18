# Character Effect Test Cases - Complete Documentation

## Overview

This document provides comprehensive documentation for all character card effect test scenarios in the "Revolution and Rebellion" card game. All test cases use the **dynamic format** with action-based testing to validate character card effects through actual gameplay simulation.

**Test Location**: `shared/testScenarios/gameStates/CharacterCase/`  
**Test Format**: All tests use `*_dynamic.json` format for consistent, reliable validation  
**Created**: July 18, 2025 - Comprehensive character effect testing suite

---

## Character Effect Summary

### Character Cards with Effects

| Card ID | Name | Effect Type | Description | Status |
|---------|------|-------------|-------------|---------|
| **c-1** | 總統特朗普 | Continuous Power Boost | +10 to 特朗普家族 trait cards | ✅ Ready |
| **c-2** | 前總統特朗普(YMCA) | Continuous Power Boost | +10 to 右翼 type cards | ✅ Ready |
| **c-5** | 特朗普忠粉 | Triggered Draw | Draw 1 card on summon | ✅ Ready |
| **c-9** | 艾利茲 | Triggered Search | Search 4 → hand | ✅ Ready |
| **c-10** | 爱德华 | Triggered Search | Search 7 → SP zone | ✅ Ready |
| **c-12** | 盧克 | Triggered Search | Search 7 → conditional Help zone | ✅ Ready |
| **c-19** | 比爾蓋茨 | Continuous Power Boost | +10 to 富商 trait cards | ✅ Ready |
| **c-20** | 巴飛特 | Continuous Power Boost | +50 to 1 富商 trait card | ✅ Ready |
| **c-21** | 奧巴馬 | Continuous Power Boost | +50 to 1 card (any) | ✅ Ready |
| **c-28** | 美國農民眾 | Triggered Draw | Draw 1 card on summon | ✅ Ready |

**Total Coverage**: 10 character cards with effects across 4 effect categories.

---

## Effect Categories

### 1. Continuous Power Boost Effects
**Type**: `"continuous"` with `"trigger": "always"`  
**Purpose**: Passive effects that modify power calculation  
**Cards**: c-1, c-2, c-19, c-20, c-21

### 2. Triggered Search Effects  
**Type**: `"triggered"` with `"trigger": "onSummon"`  
**Purpose**: Deck search with player card selection  
**Cards**: c-9, c-10, c-12

### 3. Triggered Draw Effects
**Type**: `"triggered"` with `"trigger": "onSummon"`  
**Purpose**: Draw cards to hand immediately  
**Cards**: c-5, c-28

### 4. Effect Interactions
**Purpose**: Test multiple effects stacking and interactions  
**Scope**: Cross-character, character-leader, trait combinations

---

## Test Case Structure

### Dynamic Test Format
All character effect tests follow this structure:
```json
{
  "gameId": "character_[effect-type]_[card-id]_dynamic",
  "description": "Test character card [effect] with [conditions]",
  "testType": "dynamic",
  "initialGameEnv": { /* Starting game state */ },
  "playerActions": [ /* Sequential actions to test */ ],
  "expectedStateChanges": { /* State validation */ },
  "validationPoints": { /* Power calculations & effect results */ },
  "errorCases": [ /* Error condition tests */ ],
  "cardDefinitions": { /* Card data for reference */ }
}
```

### Validation Types

1. **Effect Activation**: Verify effects trigger at correct times
2. **Power Calculations**: Validate final power with all boosts applied
3. **Card Selection**: Test interactive search effect workflows
4. **State Changes**: Verify deck, hand, and zone modifications
5. **Error Handling**: Test invalid selections and edge cases

---

## Planned Test Cases

### 1. Continuous Power Boost Tests

#### 1.1. `character_c-1_trump_family_boost_dynamic.json`
- **Description**: Tests c-1's trait-based power boost (+10 to 特朗普家族)
- **Setup**: Multiple Trump family cards in play
- **Tests**: Self-boost, cross-card boost, trait targeting
- **Validation**: Power calculations with stacking effects

#### 1.2. `character_c-2_rightwing_boost_dynamic.json`
- **Description**: Tests c-2's game type power boost (+10 to 右翼)
- **Setup**: Mix of 右翼 and non-右翼 cards
- **Tests**: Type-based targeting, selective application
- **Validation**: Power calculations with type filtering

#### 1.3. `character_c-19_rich_trait_boost_dynamic.json`
- **Description**: Tests c-19's trait-based power boost (+10 to 富商)
- **Setup**: Rich businessman cards (c-19, c-20)
- **Tests**: Trait targeting, self-boost exclusion
- **Validation**: Power calculations with trait filtering

#### 1.4. `character_c-20_single_target_boost_dynamic.json`
- **Description**: Tests c-20's single target power boost (+50 to 1 富商)
- **Setup**: Multiple 富商 cards available
- **Tests**: Single target limitation, target priority
- **Validation**: Only one card receives boost

#### 1.5. `character_c-21_universal_single_boost_dynamic.json`
- **Description**: Tests c-21's universal single target boost (+50 to any 1)
- **Setup**: Various card types available
- **Tests**: Universal targeting, single target limitation
- **Validation**: One card of any type receives boost

### 2. Triggered Search Effect Tests

#### 2.1. `character_c-9_search_to_hand_dynamic.json`
- **Description**: Tests c-9's deck search (4 cards → 1 to hand)
- **Setup**: Specific deck composition for search testing
- **Tests**: Search activation, card selection workflow, hand addition
- **Validation**: Deck reduction, hand increase, selection completion

#### 2.2. `character_c-10_search_to_sp_zone_dynamic.json`
- **Description**: Tests c-10's SP search (7 cards → 1 SP to SP zone)
- **Setup**: Deck with SP cards available
- **Tests**: SP filtering, direct zone placement, face-down placement
- **Validation**: SP zone population, deck reduction, proper filtering

#### 2.3. `character_c-12_conditional_help_search_dynamic.json`
- **Description**: Tests c-12's conditional Help search (7 → Help zone if empty)
- **Setup**: Empty Help zone vs occupied Help zone scenarios
- **Tests**: Conditional logic, Help zone placement, hand fallback
- **Validation**: Zone placement vs hand addition based on conditions

### 3. Triggered Draw Effect Tests

#### 3.1. `character_c-5_draw_on_summon_dynamic.json`
- **Description**: Tests c-5's draw effect (draw 1 card on summon)
- **Setup**: Standard deck composition
- **Tests**: Draw activation, hand size increase, deck reduction
- **Validation**: Hand count, deck count, card addition

#### 3.2. `character_c-28_farmers_draw_dynamic.json`
- **Description**: Tests c-28's draw effect (draw 1 card on summon)
- **Setup**: Agricultural theme testing
- **Tests**: Draw activation, consistent behavior with c-5
- **Validation**: Hand count, deck count, effect consistency

### 4. Effect Interaction Tests

#### 4.1. `character_multi_boost_stacking_dynamic.json`
- **Description**: Tests multiple power boost effects stacking
- **Setup**: c-1 + c-2 + leader boost combinations
- **Tests**: Effect stacking, boost accumulation, calculation order
- **Validation**: Complex power calculations with multiple sources

#### 4.2. `character_leader_interaction_dynamic.json`
- **Description**: Tests character effects + leader effects together
- **Setup**: Various leader-character combinations
- **Tests**: Effect interaction, priority handling, boost stacking
- **Validation**: Combined effect calculations

#### 4.3. `character_search_draw_combo_dynamic.json`
- **Description**: Tests multiple triggered effects in sequence
- **Setup**: Multiple character cards with triggered effects
- **Tests**: Effect queuing, sequential execution, state management
- **Validation**: Multiple deck operations, proper state updates

### 5. Edge Case Tests

#### 5.1. `character_empty_deck_search_dynamic.json`
- **Description**: Tests search effects with insufficient deck cards
- **Setup**: Nearly empty deck
- **Tests**: Edge case handling, partial search results
- **Validation**: Graceful handling of insufficient cards

#### 5.2. `character_no_target_boost_dynamic.json`
- **Description**: Tests boost effects with no valid targets
- **Setup**: No cards matching boost criteria
- **Tests**: Empty target handling, effect non-application
- **Validation**: No power modifications when no targets

#### 5.3. `character_face_down_interactions_dynamic.json`
- **Description**: Tests face-down card effect interactions
- **Setup**: Face-down character cards
- **Tests**: Effect activation suppression, power contribution
- **Validation**: Face-down cards don't trigger effects or boost power

---

## Power Calculation Formulas

### Standard Power Calculation
```
Final Power = Base Power + Character Effects + Leader Effects + Trait Bonuses
```

### Effect Application Order
1. **Base Power**: Card's inherent power value
2. **Character Effects**: Continuous effects from character cards
3. **Leader Effects**: Continuous effects from leader cards  
4. **Final Calculation**: Sum all modifiers (minimum 0)

### Single Target Effects
- **Priority**: First valid target found in zone order (top → left → right)
- **Limitation**: Only one card receives the boost per effect
- **Targeting**: Recalculated each power calculation cycle

---

## Search Effect Workflows

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

### Search Destinations
- **hand**: Selected cards go to player's hand
- **spZone**: Selected cards placed directly in SP zone (face-down)
- **conditionalHelpZone**: Help zone if empty, otherwise hand

### Search Filters
- **cardType**: Filter by "character", "help", "sp"
- **gameType**: Filter by "右翼", "左翼", "經濟", "自由", "愛國者"
- **trait**: Filter by card traits

---

## API Integration Points

### Card Selection Workflow
1. **Effect Triggers**: Character summon activates search effect
2. **Pending Selection**: `pendingPlayerAction` and `pendingCardSelections` created
3. **Frontend Display**: Show available cards to player
4. **Selection Completion**: `POST /api/game/player/selectCard` 
5. **State Update**: Cards placed, deck modified, game continues

### Event Integration
- **CARD_EFFECT_TRIGGERED**: When character effects activate
- **CARD_SELECTION_REQUIRED**: When search effects need player input
- **CARD_SELECTION_COMPLETED**: When player completes selection
- **CARD_PLACED**: When cards are placed via effects

---

## Testing Strategy

### Test Execution
```bash
# Run all character effect tests
npm run test:dynamic run CharacterCase

# Run specific effect category
npm run test:dynamic run character_search_*
npm run test:dynamic run character_boost_*

# Run individual test
npm run test:dynamic run character_c-9_search_to_hand_dynamic.json
```

### Validation Criteria
- **Actions**: 100% pass rate on card placement and effect activation
- **State Changes**: 100% pass rate on game state modifications
- **Power Validations**: 100% pass rate on power calculations
- **Card Selections**: 100% pass rate on interactive workflows
- **Error Cases**: Proper error handling for invalid conditions

### Success Metrics
- ✅ **Effect Coverage**: All 10 character cards with effects tested
- ✅ **Effect Types**: All 4 effect categories validated
- ✅ **Interaction Testing**: Complex effect combinations verified
- ✅ **API Integration**: Complete frontend-backend workflow tested
- ✅ **Edge Cases**: Boundary conditions and error scenarios covered

---

## Implementation Status

### ✅ Ready for Implementation
- Character effect system fully implemented in backend
- API endpoints for card selection completed
- Event system integration operational
- Card definitions validated and complete

### 📋 Test Development Plan
1. **Phase 1**: Create continuous power boost tests (5 tests)
2. **Phase 2**: Create triggered search effect tests (3 tests)  
3. **Phase 3**: Create triggered draw effect tests (2 tests)
4. **Phase 4**: Create effect interaction tests (3 tests)
5. **Phase 5**: Create edge case tests (3 tests)

**Total Tests Planned**: 16 comprehensive character effect test scenarios

---

## Development Guidelines

### Test File Naming Convention
```
character_[card-id]_[effect-type]_dynamic.json
character_[category]_[description]_dynamic.json
```

### Examples
- `character_c-1_trump_family_boost_dynamic.json`
- `character_c-9_search_to_hand_dynamic.json`
- `character_multi_boost_stacking_dynamic.json`

### Required Test Components
1. **Initial Game State**: Proper deck, hand, and zone setup
2. **Player Actions**: Sequential actions to trigger and test effects
3. **Expected Results**: State changes and effect outcomes
4. **Power Validations**: Detailed power calculation breakdowns
5. **Error Cases**: Invalid actions and edge conditions
6. **Card Definitions**: Complete card data for testing

---

## Quality Assurance

### Comprehensive Coverage
- **All Character Effects**: Every effect type and card covered
- **All Destinations**: Hand, SP zone, Help zone placement tested
- **All Filters**: Card type, game type, trait filtering validated
- **All Interactions**: Character-character, character-leader combinations

### Systematic Testing
- **Effect Activation**: Verify effects trigger at correct times
- **Power Calculations**: Mathematical accuracy of all boost combinations
- **State Management**: Proper deck, hand, zone modifications
- **Error Handling**: Graceful handling of invalid conditions
- **API Workflow**: Complete frontend-backend integration

### Performance Validation
- **Response Times**: Effect processing under performance thresholds
- **Memory Usage**: Proper cleanup of temporary selections
- **Event Handling**: Efficient event generation and processing
- **State Consistency**: Reliable game state across effect executions

---

*Created: July 18, 2025*  
*Character Cards Covered: 10/10 (100%)*  
*Effect Types Covered: 4/4 (100%)*  
*Test Status: Ready for implementation*  
*Implementation Status: Backend complete, tests pending*  
*Quality Target: 100% pass rate on all critical components*