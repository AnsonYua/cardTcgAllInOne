// src/models/ContinuousEffects.ts
// Continuous effects system interfaces and types

export interface StoredContinuousEffect {
    effectId: string;              // "pair_ap_boost_all"
    type: string;                  // "static"
    timing: string[];              // ["YOUR_TURN"]
    effect: {
        action: string;            // "modifyAP"
        parameters: {
            modifier: string;      // "+1"
        };
        duration: string;          // "while_paired"
    };
    
    // Runtime fields (added by system)
    sourceCardUid: string;         // Who created this effect
    active: boolean;               // Currently applying?
    appliedValue: number;          // Calculated value currently applied
}

/**
 * Helper function to create a unique key for duplicate detection
 */
export function getEffectUniqueKey(effectId: string, sourceCardUid: string): string {
    return `${effectId}_${sourceCardUid}`;
}

/**
 * Helper function to find effect in array by unique key
 */
export function findEffectByKey(effects: ContinuousEffectsCollection, effectId: string, sourceCardUid: string): StoredContinuousEffect | undefined {
    const uniqueKey = getEffectUniqueKey(effectId, sourceCardUid);
    return effects.find(effect => getEffectUniqueKey(effect.effectId, effect.sourceCardUid) === uniqueKey);
}

/**
 * Collection of continuous effects on a card (array-based for better duplicate management)
 */
export type ContinuousEffectsCollection = StoredContinuousEffect[];

export interface EffectRule {
    effectId: string;
    type: string;
    trigger: string;               // Will be removed when storing
    conditions: string[];          // Will be removed when storing  
    timing: string[];
    target: {
        type: string;              // Will be removed when storing
        scope: string;             // Will be removed when storing
        filters?: {
            controller?: string;   // Will be removed when storing
        };
    };
    effect: {
        action: string;
        parameters: {
            modifier: string;
        };
        duration: string;
    };
}

export interface EffectProcessingResult {
    success: boolean;
    effectsProcessed: number;
    effectsActivated: number;
    effectsDeactivated: number;
    error?: string;
}

/**
 * Helper functions for managing array-based continuous effects
 */
export class ContinuousEffectsHelper {
    /**
     * Add effect to collection with duplicate prevention
     */
    static addEffect(collection: ContinuousEffectsCollection, newEffect: StoredContinuousEffect): boolean {
        // Check for duplicates using effectId + sourceCardUid
        const existing = findEffectByKey(collection, newEffect.effectId, newEffect.sourceCardUid);
        
        if (existing) {
            console.log(`⚠️ Duplicate effect prevented: ${newEffect.effectId} from ${newEffect.sourceCardUid}`);
            return false; // Duplicate found, not added
        }
        
        collection.push(newEffect);
        console.log(`✅ Added effect: ${newEffect.effectId} from ${newEffect.sourceCardUid}`);
        return true; // Successfully added
    }
    
    /**
     * Remove effect from collection by effectId and sourceCardUid
     */
    static removeEffect(collection: ContinuousEffectsCollection, effectId: string, sourceCardUid: string): boolean {
        const index = collection.findIndex(effect => 
            getEffectUniqueKey(effect.effectId, effect.sourceCardUid) === getEffectUniqueKey(effectId, sourceCardUid)
        );
        
        if (index !== -1) {
            collection.splice(index, 1);
            console.log(`🗑️ Removed effect: ${effectId} from ${sourceCardUid}`);
            return true;
        }
        
        return false;
    }
    
    /**
     * Remove all effects from a specific source card
     */
    static removeEffectsFromSource(collection: ContinuousEffectsCollection, sourceCardUid: string): number {
        const initialLength = collection.length;
        
        // Filter out effects from the specified source
        for (let i = collection.length - 1; i >= 0; i--) {
            if (collection[i].sourceCardUid === sourceCardUid) {
                collection.splice(i, 1);
            }
        }
        
        const removedCount = initialLength - collection.length;
        if (removedCount > 0) {
            console.log(`🗑️ Removed ${removedCount} effects from source: ${sourceCardUid}`);
        }
        
        return removedCount;
    }
    
    /**
     * Get all active effects from collection
     */
    static getActiveEffects(collection: ContinuousEffectsCollection): StoredContinuousEffect[] {
        return collection.filter(effect => effect.active);
    }
    
    /**
     * Update effect activity status
     */
    static updateEffectActivity(collection: ContinuousEffectsCollection, effectId: string, sourceCardUid: string, active: boolean): boolean {
        const effect = findEffectByKey(collection, effectId, sourceCardUid);
        
        if (effect && effect.active !== active) {
            effect.active = active;
            console.log(`🔄 Updated effect activity: ${effectId} from ${sourceCardUid} → ${active ? 'active' : 'inactive'}`);
            return true;
        }
        
        return false;
    }
}

// Timing conditions
export enum EffectTiming {
    YOUR_TURN = "YOUR_TURN",
    OPPONENT_TURN = "OPPONENT_TURN", 
    ALWAYS = "ALWAYS",
    START_OF_TURN = "START_OF_TURN",
    END_OF_TURN = "END_OF_TURN"
}

// Duration conditions
export enum EffectDuration {
    WHILE_PAIRED = "while_paired",
    PERMANENT = "permanent",
    THIS_TURN = "this_turn",
    UNTIL_END_OF_GAME = "until_end_of_game"
}

// Effect actions
export enum EffectAction {
    MODIFY_AP = "modifyAP",
    MODIFY_HP = "modifyHP", 
    MODIFY_ENERGY = "modifyEnergy",
    ADD_TRAIT = "addTrait",
    REMOVE_TRAIT = "removeTrait"
}

// Target scopes
export enum EffectScope {
    SELF = "self",
    SELF_ALL_UNIT = "self_all_unit",
    OPPONENT = "opponent",
    OPPONENT_ALL = "opponent_all",
    ALL = "all"
}

/**
 * Initialize empty continuous effects collection
 */
export function createEmptyContinuousEffectsCollection(): ContinuousEffectsCollection {
    return [];
}