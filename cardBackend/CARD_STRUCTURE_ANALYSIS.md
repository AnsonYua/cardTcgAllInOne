# Card Structure Analysis & ZoneCard Design

## Data Structure Analysis (January 2025)

### Character Cards Structure
```json
{
  "id": "c-1",
  "name": "總統特朗普", 
  "cardType": "character",
  "gameType": "愛國者",           // Single classification
  "power": 100,                  // Combat power
  "traits": ["特朗普家族"],        // Array of abilities
  "rarity": "legendary",         // Card rarity
  "effects": {                   // Complex effect system
    "description": "我方場上全部擁有特朗普家族特徵的角色卡 原能力值加 +10",
    "rules": [
      {
        "id": "trump_president_boost",
        "type": "continuous",
        "trigger": { "event": "always" },
        "target": {
          "owner": "self",
          "zones": ["top", "left", "right"],
          "filters": [{ "type": "trait", "value": "特朗普家族" }]
        },
        "effect": { "type": "powerBoost", "value": 10 }
      }
    ]
  }
}
```

**Key Properties:**
- **Power-based**: Combat strength for battle calculations
- **Single gameType**: Zone placement classification
- **Multiple traits**: Effect targeting and abilities
- **Complex effects**: Continuous, triggered, targeted effects

### Leader Cards Structure
```json
{
  "id": "s-1",
  "name": "特朗普",
  "cardType": "leader", 
  "gameType": "右翼",
  "initialPoint": 110,           // Victory points (NOT power)
  "level": 7,                    // Leader tier/strength
  "rarity": "legendary",
  "zoneCompatibility": {         // CRITICAL: Zone restriction rules
    "top": ["右翼", "自由", "經濟"],
    "left": ["右翼", "自由", "愛國者"],
    "right": ["右翼", "愛國者", "經濟"]
  },
  "effects": {                   // Battlefield-wide effects
    "description": "全部召喚出來的角色擁有右翼或愛國者屬性能力值 +45",
    "rules": [
      {
        "type": "continuous",
        "target": { 
          "owner": "self", 
          "zones": ["top", "left", "right"],
          "filters": [{ "type": "gameTypeOr", "values": ["右翼", "愛國者"] }]
        },
        "effect": { "type": "powerBoost", "value": 45 }
      }
    ]
  }
}
```

**Key Properties:**
- **initialPoint**: Victory scoring (different from character power)
- **zoneCompatibility**: Critical zone restriction system
- **Global effects**: Affect all player cards continuously
- **Level system**: Determines SP card execution priority

### Utility Cards Structure
```json
{
  "id": "h-1", 
  "name": "Deep State",
  "cardType": "help",           // help or sp types
  "effects": {
    "description": "選擇對方場上的一張SP卡或HELP卡，立即移除該卡的效果",
    "rules": [
      {
        "type": "triggered",
        "trigger": { "event": "onPlay" },
        "target": {
          "owner": "opponent",
          "zones": ["help", "sp"],
          "requiresSelection": true,  // CRITICAL: Player interaction
          "selectCount": 1
        },
        "effect": { "type": "neutralizeEffect", "value": true }
      }
    ]
  },
  "immuneToNeutralization": true  // Special property (optional)
}
```

**Key Properties:**
- **No power/points**: Pure effect-based cards
- **Player interaction**: Many require target selection
- **Cross-zone effects**: Can affect opponent cards/zones
- **Special immunities**: Some cards have unique properties

## Architectural Insights

### 1. Unified vs Specialized Properties
**Common Properties (All Cards):**
- `id`, `name`, `cardType`, `rarity`, `effects`

**Type-Specific Properties:**
- **Characters**: `power`, `gameType` (single), `traits` (array)
- **Leaders**: `initialPoint`, `level`, `gameType`, `zoneCompatibility`
- **Utilities**: No power/points, special flags like `immuneToNeutralization`

### 2. Effect System Complexity
**Three Effect Types:**
- **continuous**: Always active (leader auras, passive boosts)
- **triggered**: Activate on events (onSummon, onPlay, spPhase)
- **restriction**: Block actions (prevent summons, disable cards)

**Targeting System:**
- **owner**: "self", "opponent", "both"
- **zones**: ["top", "left", "right"], ["help"], ["sp"]
- **filters**: gameType, trait, nameContains matching
- **requiresSelection**: Interactive player choices

### 3. Zone System Architecture
**Character Zones** (TOP/LEFT/RIGHT):
- Restricted by leader zoneCompatibility
- Contribute to power calculation
- Subject to gameType-based effects

**Utility Zones** (HELP/SP):
- No zone restrictions (any card can go face-down)
- No power contribution
- Special phase-based rules (SP cards face-down only in SP_PHASE)

**Leader Zone**:
- Single leader per player
- Provides zone restrictions and global effects
- Changes between rounds

## Design Recommendations

### 1. Polymorphic ZoneCard Architecture
Create type-safe interfaces that preserve card-specific properties while providing unified zone operations.

### 2. Effect-Aware Design
ZoneCard objects should embed complete effect data for immediate access without lookups.

### 3. Transition-Safe Implementation
Support both legacy card structure and new unified format during migration period.

### 4. Performance Optimization
Pre-resolve card data during zone placement to avoid repeated JSON lookups.
