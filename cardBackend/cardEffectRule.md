# Card Effect Rules Reference

This document provides a comprehensive overview of all card effects implemented in the "Revolution and Rebellion" card game backend system.

## Overview

The game uses a sophisticated effect system with three main categories of cards:
- **Leader Cards**: Provide continuous zone compatibility and power boosts
- **Character Cards**: Offer continuous power boosts and triggered effects
- **Utility Cards**: Include Help and SP cards with diverse effects

## Effect System Architecture

### Effect Types
- **`continuous`**: Always active while card is in play
- **`triggered`**: Activated by specific events (onSummon, onPlay, etc.)
- **`restriction`**: Prevents certain actions or placements

### Target System
- **`owner`**: "self", "opponent", "both"
- **`zones`**: ["top", "left", "right", "help", "sp", "hand"]
- **`filters`**: Card filtering by gameType, trait, name, etc.

## Leader Card Effects

### Power Boost Effects

#### Conditional Power Boosts
- **Trump (s-1)**: +45 to 右翼/愛國者 characters
- **Biden (s-2)**: +40 to all characters (universal boost)
- **Kamala Harris (s-4)**: +40 to 左翼, +20 to 經濟 characters
- **Vance (s-5)**: +40 to 右翼, +20 to 自由, +10 to 經濟
- **Musk (s-3)**: +50 to 自由 characters, +20 to characters with "Doge" in name
- **Powell (s-6)**: +30 to 自由/經濟 characters

#### Leader vs Leader Interactions
- **Trump vs Powell**: Trump's 經濟 characters → power = 0
- **Harris vs Trump**: Harris's right zone characters → power = 0
- **Powell vs Trump**: Powell's 經濟 characters get additional +20 boost

### Restriction Effects
- **Powell vs Trump**: Cannot summon 右翼 characters

## Character Card Effects

### Continuous Power Boosts
- **c-1 (總統特朗普)**: +10 to all ally 特朗普家族 trait characters
- **c-2 (前總統特朗普YMCA)**: +10 to all ally 右翼 gameType characters
- **c-19 (比爾蓋茨)**: +10 to all ally 富商 trait characters
- **c-20 (巴飛特)**: +50 to one ally 富商 trait character (targetCount: 1)
- **c-21 (奧巴馬)**: +50 to one ally character (any type, targetCount: 1)

### Triggered Effects (onSummon)

#### Draw Card Effects
- **c-5 (特朗普忠粉)**: Draw 1 card when summoned
- **c-6 (拜登忠粉)**: Draw 1 card when summoned
- **c-28 (美國農民眾)**: Draw 1 card when summoned

#### Search Card Effects
- **c-9 (艾利茲)**: Search top 4 cards, select 1 to hand
- **c-10 (爱德华)**: Search top 7 cards, select 1 SP card to SP zone
- **c-12 (盧克)**: Search top 7 cards, select 1 Help card to Help zone

## Utility Card Effects

### Help Cards (h-X)

#### Neutralization Effects
- **h-1 (Deep State)**: Select and neutralize opponent's help/SP card
- **h-10 (加洲大火)**: Neutralize all opponent help cards
- **h-12 (美債危機)**: Neutralize all opponent SP cards + force SP phase card play (SP card or face-down)

#### Power Modification Effects
- **h-2 (Make America Great Again)**: Set selected opponent character power to 0
- **h-3 (doge 全員集合)**: +40 to ally Doge trait characters
- **h-5 (失智老人)**: +20 to all ally characters + zone placement freedom
- **h-8 (破低)**: -30 to opponent 自由/經濟 characters
- **h-13 (TikTok下架)**: +30 to ally 平民 trait characters
- **h-14 (聯邦大法官)**: -60 to one opponent 特朗普家族 character
- **h-15 (天才法案)**: +50 to ally 經濟 characters

#### Special Mechanics
- **h-4 (解放日)**: Silence opponent onSummon effects
- **h-6 (You have no card)**: Force discard 2 cards if opponent has ≥4 hand cards
- **h-7 (拜登退選)**: Prevent opponent from playing help cards
- **h-9 (bitcoin 真香)**: Draw 2 cards
- **h-11 (海湖莊園)**: Search 5 cards, select 1 character to hand

### SP Cards (sp-X)

#### Power Modification Effects
- **sp-2 (減息周期)**: +30 to all ally characters
- **sp-3 (加息周期)**: -30 to all opponent characters
- **sp-4 (關稅掃射)**: -50 to all 自由/經濟 characters (both players)
- **sp-5 (破頂)**: +30 to ally 自由/經濟 characters
- **sp-7 (No King Day)**: -30 to opponent 特朗普家族 characters
- **sp-10 (民主黨集結)**: +30 to ally 左翼 characters

#### Special Mechanics
- **sp-1 (天選之人)**: Neutralize opponent help/SP if ally has "特朗普" name
- **sp-6 (DeepSeek風暴)**: -80 to opponent total power (finalCalculation trigger)
- **sp-8 (反特斯拉示威)**: -40 to opponent Doge characters + disable combos if opponent leader is "馬斯克"
- **sp-9 (國會山莊騷亂)**: Disable combo bonus if opponent has "特朗普" name

## Effect Implementation Details

### Effect Types by Backend Handler

#### PowerBoost Effects
```javascript
effect: {
  type: "powerBoost",
  value: [number] // Can be positive or negative
}
```

#### SetPower Effects
```javascript
effect: {
  type: "setPower",
  value: [number] // Overrides original power
}
```

#### Neutralization Effects
```javascript
effect: {
  type: "neutralizeEffect",
  value: true,
  undoEffect: true // Optional: removes existing effects
}
```

#### Search Card Effects
```javascript
effect: {
  type: "searchCard",
  searchCount: [number],
  selectCount: [number],
  destination: "hand|spZone|helpZone",
  filters: [...] // Card type/trait filters
}
```

#### Draw Card Effects
```javascript
effect: {
  type: "drawCards",
  value: [number]
}
```

#### Restriction Effects
```javascript
effect: {
  type: "preventSummon|preventPlay|forceSPPlay",
  value: true
}
```

##### h-12 (美債危機) - Complex SP Phase Enforcement
```javascript
// Dual effect: Neutralize + Force Play
{
  type: "neutralizeEffect",  // Neutralize all opponent SP cards
  target: { owner: "opponent", zones: ["sp"] }
},
{
  type: "forceSPPlay",       // Force SP phase card placement
  trigger: { event: "spPhase" },
  target: { owner: "opponent" }
}
```

**Game Mechanics Explanation:**
- **Phase Rule**: Players can only play SP cards during SP phase
- **Force Play**: During SP phase, opponent MUST place a card in SP zone
- **Options Available**: 
  - Play SP card face-up (but neutralized → no effect)
  - Play any card face-down (no effect regardless)
- **Strategic Impact**: Forces resource waste while denying SP benefits

#### Special Effects
```javascript
// Zone placement freedom
effect: {
  type: "zonePlacementFreedom",
  value: true
}

// Silence onSummon effects
effect: {
  type: "silenceOnSummon",
  value: true
}

// Random discard
effect: {
  type: "randomDiscard",
  value: [number]
}

// Total power modification
effect: {
  type: "totalPowerNerf",
  value: [number]
}

// Combo bonus disable
effect: {
  type: "disableComboBonus",
  value: true
}
```

### Targeting Filters

#### GameType Filters
- `gameType`: Single type match ("左翼", "右翼", "自由", "經濟", "愛國者")
- `gameTypeOr`: Multiple type match (["自由", "經濟"])

#### Trait Filters
- `trait`: Single trait match ("特朗普家族", "富商", "平民", "Deep State", "Doge")

#### Name Filters
- `nameContains`: Partial name match ("Doge", "特朗普")

#### Conditional Filters
- `allyFieldContainsName`: Check if ally field has specific name
- `opponentFieldContainsName`: Check if opponent field has specific name
- `opponentLeader`: Check opponent's leader name
- `opponentHandCount`: Check opponent's hand card count

### Special Properties

#### Immunity
- **h-5 (失智老人)**: `immuneToNeutralization: true` - Cannot be neutralized

#### Target Count Limitation
- Some effects specify `targetCount: 1` to affect only one card instead of all matching cards

### Event Triggers

#### Always Active
- `always`: Continuous effects that are always active

#### Game Events
- `onSummon`: When character card is summoned
- `onPlay`: When help/SP card is played
- `spPhase`: During SP phase
- `finalCalculation`: During final power calculation

## Player Selection Effects System

Many card effects require player interaction to choose targets or select cards. The backend implements three distinct selection mechanisms:

### 1. Deck Search Selection (`searchCard` + `selectCount`)

**Mechanism**: Player searches deck, selects specific cards for placement
```javascript
effect: {
  type: "searchCard",
  searchCount: [number],  // Cards revealed from deck
  selectCount: [number],  // Cards player must choose  
  destination: "hand|spZone|helpZone",
  filters: [...]  // Card type/trait restrictions
}
```

**Cards Requiring Deck Search Selection**:
- **c-9 (艾利茲)**: Search 4 cards → select 1 to hand
- **c-10 (爱德华)**: Search 7 cards → select 1 SP card to SP zone
- **c-12 (盧克)**: Search 7 cards → select 1 Help card to Help zone
- **h-11 (海湖莊園)**: Search 5 cards → select 1 character to hand

**Zone Placement Consistency**:
Both SP zone and Help zone follow identical placement logic - they can only hold one card each:
- **c-10 (Edward)**: SP card → SP zone (if empty) or hand (if occupied)
- **c-12 (Luke)**: Help card → Help zone (if empty) or hand (if occupied)
- The mechanism is consistent across both zone types, simplifying implementation

**Backend Implementation Required**:
- Generate `CARD_SELECTION_REQUIRED` event with card options
- Store selection data in `gameEnv.pendingCardSelections`
- Process selection via `POST /player/selectCards` endpoint
- Apply destination logic and update game state

### 2. Field Target Selection (`requiresSelection` + `selectCount`)

**Mechanism**: Player chooses target cards from battlefield zones
```javascript
target: {
  owner: "opponent|self",
  zones: ["top", "left", "right", "help", "sp"],
  requiresSelection: true,
  selectCount: [number],  // Number of targets to choose
  filters: [...]  // Optional: restrict target types
}
```

**Cards Requiring Field Target Selection**:
- **h-1 (Deep State)**: Select 1 opponent help/SP card → neutralize effect
- **h-2 (Make America Great Again)**: Select 1 opponent character → set power to 0

**Backend Implementation Required**:
- Scan specified zones for valid targets based on filters
- Generate selection UI with valid target options
- Record target selection for effect application
- Apply effect to selected target(s)

### 3. Single Target Selection (`targetCount` - Player Chooses One)

**Mechanism**: Player selects exactly one target from valid options
```javascript
target: {
  targetCount: 1,  // Player must select exactly 1 target
  filters: [...],  // Must match criteria
  // No requiresSelection field needed - targetCount implies selection
}
```

**Cards Using Single Target Selection**:
- **h-14 (聯邦法官)**: Player selects one opponent 特朗普家族 character (-60 power)
- **c-20 (巴飛特)**: Player selects one ally 富商 character (+50 power)  
- **c-21 (奧巴馬)**: Player selects one ally character (+50 power)

**Important Gameplay Rule**:
- **Target Requirement**: Valid targets matching the filter criteria MUST exist on the field
- **No Effect Without Targets**: If no valid targets are found, the effect does nothing
- **Player Selection Required**: Player must choose which specific target to affect
- **Selection Limit**: Player can only select ONE target (enforced by targetCount: 1)

**Backend Implementation**: 
1. Scan battlefield for cards matching filter criteria
2. If valid targets found → generate selection UI with valid options
3. Player selects exactly one target → apply effect to selected target
4. If no valid targets found → effect does nothing (no error)

### Selection Effect Implementation Priority

**High Priority - Core Gameplay**:
1. **Deck Search Selection** - Required for 4 cards, breaks deck manipulation mechanics
2. **Field Target Selection** - Required for 2 cards, breaks targeted removal mechanics  
3. **Single Target Selection** - Required for 3 cards, affects single-target power boosts and removal

### Selection Workflow Integration

**Game Flow**:
1. Card played → Effect triggered
2. **Selection Required**: Generate `CARD_SELECTION_REQUIRED` event
3. **Game Blocks**: Phase cannot advance until selection completed
4. **Player Selects**: Via UI interaction with valid options
5. **Selection Processed**: Backend applies effect to chosen targets
6. **Game Continues**: Normal phase progression resumes

**API Endpoints Required**:
- `POST /player/selectCards` - Process card selections
- `GET /player/selectionOptions` - Get available selection targets
- Event types: `CARD_SELECTION_REQUIRED`, `CARD_SELECTION_COMPLETED`

## Backend Implementation Status & Requirements Analysis

### Current Implementation Status (From Code Analysis)

#### ✅ **IMPLEMENTED Effect Types (3/13)**
```javascript
// In EffectSimulator.js (unified effect system)
case 'powerBoost':     // ✅ FULLY IMPLEMENTED - 25 instances across all cards
case 'setPower':       // ✅ FULLY IMPLEMENTED - 3 instances (leaders + h-2)  
case 'preventSummon':  // ✅ PARTIALLY IMPLEMENTED - 1 instance (Powell leader)
```

#### ❌ **MISSING Effect Types (10/13) - CRITICAL GAPS**

Based on systematic code analysis of all JSON card data, these effect types exist in cards but have **NO backend handlers**:

```javascript
// CardEffectRegistry.js switch statement MISSING these cases:
case 'drawCards':           // ❌ MISSING - 4 instances (c-5, c-6, c-28, h-9)
case 'searchCard':          // ❌ MISSING - 4 instances (c-9, c-10, c-12, h-11)  
case 'neutralizeEffect':    // ❌ MISSING - 4 instances (sp-1, h-1, h-10, h-12)
case 'silenceOnSummon':     // ❌ MISSING - 1 instance (h-4)
case 'zonePlacementFreedom': // ❌ MISSING - 1 instance (h-5)
case 'randomDiscard':       // ❌ MISSING - 1 instance (h-6)  
case 'preventPlay':         // ❌ MISSING - 1 instance (h-7)
case 'forceSPPlay':         // ❌ MISSING - 1 instance (h-12) - Forces SP phase card play
case 'totalPowerNerf':      // ❌ MISSING - 1 instance (sp-6)
case 'disableComboBonus':   // ❌ MISSING - 2 instances (sp-8, sp-9)

// ❌ MISSING: Player Selection System
// - Deck search selection (4 cards): c-9, c-10, c-12, h-11  
// - Field target selection (2 cards): h-1, h-2
// - Requires: CARD_SELECTION_REQUIRED events, pendingCardSelections, POST /player/selectCards
```

### Quantitative Analysis

**Total Effect Instances in Game**: 50+ effect instances across 88 cards
- **Leader Cards**: 14 effect instances (13 powerBoost + 1 preventSummon)
- **Character Cards**: 10 effect instances (6 powerBoost + 4 drawCards/searchCard)  
- **Utility Cards**: 26+ effect instances (diverse types)

**Implementation Coverage**: **23% Complete** (3 of 13 effect types implemented)

**Critical Missing Functionality**: 
- **77% of effect types** have zero backend implementation
- **18 card effect instances** will not work (35% of utility card effects)
- **Core gameplay mechanics** like deck search and neutralization are non-functional

### Backend Implementation Requirements

The backend **MUST implement 11 missing effect handlers** to achieve functional gameplay:

#### **Priority 1 - Core Gameplay (Breaks Game Without These)**
1. **`drawCards`** - Required for 4 cards, core resource mechanic
2. **`searchCard`** - Required for 4 cards, deck manipulation mechanic  
3. **`neutralizeEffect`** - Required for 4 cards, counter-play mechanic
4. **Player Selection System** - Required for 6 cards, interactive target/card selection

#### **Priority 2 - Advanced Mechanics (Reduces Strategy Without These)**
5. **`silenceOnSummon`** - Effect prevention system
6. **`zonePlacementFreedom`** - Special placement rules
7. **`preventPlay`** - Card type restrictions
8. **`totalPowerNerf`** - Final calculation modifiers

#### **Priority 3 - Edge Cases (Nice to Have)**
9. **`randomDiscard`** - Hand manipulation
10. **`forceSPPlay`** - Phase enforcement  
11. **`disableComboBonus`** - Combo prevention

### Implementation Location

**All missing handlers must be added to**:
- `CardEffectRegistry.js` - Add 10 new `case` statements in `applyEffect()` method
- `EffectSimulator.js` - Add trigger event processing for `onPlay`, `finalCalculation` 
- Integration with existing `mozGamePlay.js` event system

**Code Structure Pattern**:
```javascript
// In CardEffectRegistry.js line ~145
switch (effect.type) {
    // ... existing cases ...
    case 'drawCards':
        this.applyDrawCards(effect, simState, sourcePlayerId, targetPlayerId);
        break;
    case 'searchCard':
        this.applySearchCard(effect, simState, sourcePlayerId, targetPlayerId);
        break;
    case 'forceSPPlay':
        this.applyForceSPPlay(effect, simState, sourcePlayerId, targetPlayerId);
        break;
    // ... 7 more missing cases
}

// Example forceSPPlay handler implementation:
applyForceSPPlay(effect, simState, sourcePlayerId, targetPlayerId) {
    // Store phase restriction in fieldEffects for SP_PHASE validation
    const targetPlayerFieldEffects = simState.gameEnv.players[targetPlayerId].fieldEffects;
    
    // Add SP phase enforcement effect
    if (!targetPlayerFieldEffects.spPhaseRestrictions) {
        targetPlayerFieldEffects.spPhaseRestrictions = [];
    }
    
    targetPlayerFieldEffects.spPhaseRestrictions.push({
        type: 'forceSPPlay',
        sourceCard: effect.source,
        mustPlayCard: true // During SP phase, must place card in SP zone
    });
    
    console.log(`🎯 Applied forceSPPlay to ${targetPlayerId} - must play card during SP phase`);
}
```

### Integration with Game Flow (mozGamePlay.js)

**SP Phase Validation Logic** for forceSPPlay effect:
```javascript
// In mozGamePlay.js SP_PHASE processing
processSPPhase(gameEnv, playerId) {
    const playerFieldEffects = gameEnv.players[playerId].fieldEffects;
    
    // Check for forceSPPlay restrictions
    const hasForceSPPlay = playerFieldEffects.spPhaseRestrictions?.some(
        restriction => restriction.type === 'forceSPPlay'
    );
    
    if (hasForceSPPlay) {
        // Player MUST place a card in SP zone during SP phase
        if (gameEnv.zones[playerId].sp.length === 0) {
            // Force player to make choice: SP card or face-down
            return {
                requiresAction: true,
                actionType: 'FORCED_SP_PLAY',
                options: [
                    'PlaySPCard',      // Play SP card (will be neutralized)
                    'PlayCardFaceDown' // Play any card face-down (no effect)
                ]
            };
        }
    }
    
    // Normal SP phase processing...
}
```

**Action Validation** in processAction():
```javascript
// Validate SP phase actions with forceSPPlay
if (gameEnv.phase === 'SP_PHASE' && hasForceSPPlay) {
    if (action.type === 'Pass') {
        // Cannot pass if forceSPPlay is active
        return this.createErrorResponse('FORCE_SP_PLAY_ACTIVE', 
            'Must play card during SP phase due to 美債危機 effect');
    }
}
```

**Estimated Implementation**: **Each handler requires 20-50 lines** of code following existing patterns in the file.

This comprehensive effect system creates deep strategic gameplay through card interactions, conditional bonuses, and counter-play mechanics - **but currently only 23% is functional**.