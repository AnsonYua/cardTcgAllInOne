# Unified TARGET_CHOICE System Design

## Overview

Design for a unified target choice system that replaces the current DEPLOY_TARGET_CHOICE with a general TARGET_CHOICE event that can handle pairing effects, deploy effects, and future effect types requiring player target selection.

## Current System Analysis

### Deploy Target Choice (Existing)
- **Event**: `DEPLOY_TARGET_CHOICE`
- **Flow**: Effect triggered → Check requires choice → Create event → User selects → Apply effect
- **Features**: HP/status filtering, user choice UI, validation, effect application
- **Location**: `DeployEffectManager.ts`, `GameEngine.ts`

### Pairing Effect (Current - No Choice)
- **Event**: `PAIRING_EFFECT_TRIGGERED` 
- **Flow**: Pairing complete → Automatic target selection (first eligible)
- **Features**: Level filtering, scope resolution, automatic application
- **Location**: `PairingEffect.ts`
- **Issue**: ST01-006 should let player choose target, not auto-select first

## Unified Design Architecture

### 1. Event Type Hierarchy

```typescript
// Replace DEPLOY_TARGET_CHOICE with unified TARGET_CHOICE
export enum EventType {
    // Unified target choice system
    TARGET_CHOICE = 'TARGET_CHOICE',
    
    // Keep existing triggers  
    DEPLOY_EFFECT_TRIGGERED = 'DEPLOY_EFFECT_TRIGGERED',
    PAIRING_EFFECT_TRIGGERED = 'PAIRING_EFFECT_TRIGGERED'
}
```

### 2. Target Choice Event Interface

```typescript
export interface TargetChoiceEvent extends BaseGameEvent {
    type: EventType.TARGET_CHOICE;
    data: {
        // Common fields
        playerId: string;           // Player making the choice
        choiceId: string;           // Unique choice identifier
        userDecisionMade: boolean;  // Choice completion status
        
        // Source information
        sourceType: 'DEPLOY' | 'PAIRING' | 'ACTIVATION' | 'CONTINUOUS';
        sourceCarduid: string;      // Card triggering the effect
        sourceCardId: string;
        sourceSlot?: string;        // For pairing effects
        
        // Effect information
        effect: {
            effectId: string;
            description: string;
            action: string;         // 'modifyAP', 'damage', 'rest', etc.
            parameters: any;        // Effect parameters
        };
        
        // Target configuration
        targetConfig: {
            type: 'unit' | 'pilot' | 'card';
            scope: 'self' | 'opponent' | 'any';
            count: number;          // How many targets to select
            filters: {
                level?: string;     // "<=5", ">=3", etc.
                hp?: string;        // "<=2", ">1", etc.
                status?: string;    // "rested", "active"
                traits?: string[];  // Trait requirements
                zone?: string[];    // Specific zones only
            };
        };
        
        // Available targets (computed)
        availableTargets: Array<{
            carduid: string;
            cardId: string;
            zone: string;
            playerId: string;
            cardData?: any;         // For display purposes
        }>;
        
        // User selection result
        selectedTargets?: Array<{
            carduid: string;
            zone: string;
            playerId: string;
        }>;
    };
}
```

### 3. Target Choice Manager (New Service)

```typescript
export class TargetChoiceManager {
    
    /**
     * Create TARGET_CHOICE event for any effect requiring player selection
     */
    static createTargetChoiceEvent(
        gameEnv: GameEnvironment,
        playerId: string,
        sourceType: string,
        sourceCarduid: string,
        effect: any,
        targetConfig: any
    ): TargetChoiceEvent;
    
    /**
     * Generate available targets based on filters
     */
    static generateAvailableTargets(
        gameEnv: GameEnvironment,
        playerId: string,
        targetConfig: any
    ): any[];
    
    /**
     * Execute target choice when user makes selection
     */
    static executeTargetChoice(
        event: TargetChoiceEvent,
        gameEnv: GameEnvironment
    ): ExecutionResult;
    
    /**
     * Apply effect to selected targets
     */
    static applyEffectToTargets(
        gameEnv: GameEnvironment,
        effect: any,
        selectedTargets: any[],
        sourcePlayerId: string
    ): ExecutionResult;
    
    /**
     * Unified target filtering with all filter types
     */
    private static validateTargetFilters(
        unit: any,
        filters: any
    ): boolean;
}
```

### 4. Migration Strategy

#### Phase 1: Create Unified Infrastructure
1. **New EventType**: Add `TARGET_CHOICE` to `GameEnums.ts`
2. **New Interface**: Add `TargetChoiceEvent` to `GameEvent.ts`
3. **New Manager**: Create `TargetChoiceManager.ts`
4. **Event Factory**: Add `createTargetChoiceEvent()` method

#### Phase 2: Migrate Deploy Effects
1. **Replace Event Type**: `DEPLOY_TARGET_CHOICE` → `TARGET_CHOICE` with `sourceType: 'DEPLOY'`
2. **Update DeployEffectManager**: Use `TargetChoiceManager` for target choice
3. **Maintain Compatibility**: Keep same API endpoints, change internal implementation

#### Phase 3: Add Pairing Choice Support
1. **Update PairingEffect**: Check if effect requires player choice
2. **Choice Logic**: If `target.count === 1` and multiple eligible targets → create TARGET_CHOICE
3. **Automatic Fallback**: If only one target available → auto-select (no choice needed)

#### Phase 4: Update GameEngine
1. **Event Routing**: Route `TARGET_CHOICE` to `TargetChoiceManager.executeTargetChoice`
2. **Remove Old Handler**: Remove `DEPLOY_TARGET_CHOICE` case
3. **API Compatibility**: Update choice resolution API to handle unified events

## Specific Use Case: ST01-006 Pairing Effect

### Current Behavior (Auto-Select)
```typescript
// In executePairingModifyAPEffect - Line 432-438
const targetUnit = eligibleTargets[0];  // ❌ Always first target
```

### New Behavior (Player Choice)
```typescript
// In PairingEffect.executePairingModifyAPEffect
if (target.count === 1 && eligibleTargets.length > 1) {
    // Create TARGET_CHOICE event for player selection
    const choiceEvent = TargetChoiceManager.createTargetChoiceEvent(
        gameEnv,
        playerId,
        'PAIRING',
        effect.unitCard.carduid,
        {
            effectId: effect.effectId,
            action: 'modifyAP',
            parameters: parameters
        },
        target
    );
    
    // Add to event queue - processing pauses until player chooses
    gameEnv.eventQueue.addEvent(choiceEvent);
    return { success: true, requiresSelection: true };
}
```

## Filter System Unification

### Combined Filter Support
```typescript
interface UnifiedFilters {
    // Deploy filters (existing)
    hp?: string;        // "<=2", ">1"
    status?: string;    // "rested"
    
    // Pairing filters (existing) 
    level?: string;     // "<=5", ">=3"
    
    // Future extensibility
    traits?: string[];  // ["Academy", "Earth Federation"]
    zone?: string[];    // ["slot1", "slot2"] - specific zones only
    cardType?: string[]; // ["unit", "pilot"]
    cost?: string;      // "<=3"
    ap?: string;        // ">2"
}
```

### Validation Logic
```typescript
static validateTargetFilters(unit: any, filters: UnifiedFilters): boolean {
    // HP filter (from DeployEffectManager)
    if (filters.hp && !this.validateHpFilter(unit, filters.hp)) return false;
    
    // Level filter (from PairingEffect)
    if (filters.level && !this.validateLevelFilter(unit, filters.level)) return false;
    
    // Status filter
    if (filters.status && !this.validateStatusFilter(unit, filters.status)) return false;
    
    // Trait filter
    if (filters.traits && !this.validateTraitFilter(unit, filters.traits)) return false;
    
    return true;
}
```

## Frontend Integration

### Event Polling Enhancement
```typescript
// Frontend detects TARGET_CHOICE events in polling
if (event.type === 'TARGET_CHOICE') {
    // Show unified target selection UI
    showTargetSelectionDialog({
        sourceCard: event.data.sourceCardId,
        effect: event.data.effect,
        availableTargets: event.data.availableTargets,
        count: event.data.targetConfig.count,
        onSelection: (targets) => submitTargetChoice(event.id, targets)
    });
}
```

### API Compatibility
```typescript
// Existing endpoint enhanced to handle unified choices
POST /api/game/player/resolveChoice
{
    "playerId": "playerId_1",
    "gameId": "game-123", 
    "choiceId": "target_choice_pairing_123",
    "selectedTargets": [
        {
            "carduid": "ST01-001_target",
            "zone": "slot1",
            "playerId": "playerId_2"
        }
    ]
}
```

## Benefits

### 1. **Code Reuse**
- Single target filtering system for all effect types
- Unified effect application logic
- Shared validation and error handling

### 2. **Consistency**
- Same UI experience for all target selection
- Consistent API for frontend integration
- Unified event processing flow

### 3. **Extensibility**
- Easy to add new effect types requiring target selection
- Flexible filter system supports any criteria
- Modular design allows independent enhancement

### 4. **Player Experience**
- ST01-006 now allows strategic target choice
- Consistent interaction patterns across all effects
- Clear visual feedback for all target selections

## Implementation Priority

### High Priority
1. ✅ **TargetChoiceManager.ts** - Core unified logic
2. ✅ **EventType.TARGET_CHOICE** - New event type
3. ✅ **Pairing Effect Integration** - Enable choice for ST01-006

### Medium Priority  
4. ⬜ **Deploy Effect Migration** - Replace DEPLOY_TARGET_CHOICE
5. ⬜ **Frontend UI Update** - Handle unified events

### Low Priority
6. ⬜ **Filter Extensions** - Add trait/cost filters
7. ⬜ **Choice Optimization** - Auto-select when only one target

## Testing Strategy

### Unit Tests
- `TargetChoiceManager.generateAvailableTargets()` with various filters
- `TargetChoiceManager.validateTargetFilters()` with edge cases

### Integration Tests  
- ST01-006 pairing effect with multiple eligible targets
- Deploy effects migrated to new system
- Frontend polling and choice submission

### Backward Compatibility Tests
- Existing deploy effects continue working
- API endpoints remain functional
- Event processing maintains same results

---

**Next Steps**: Implement TargetChoiceManager.ts with unified target filtering and choice processing logic.