/**
 * ActiveEffect.ts - TypeScript class-based effect system
 * 
 * Eliminates unnecessary transformation layers by directly using JSON effect structures
 * with runtime context additions. Provides clear, type-safe effect processing.
 */

import { GameEnvironment } from './GameEnvironment.js';

/**
 * Effect filter interface matching JSON structure
 */
export interface EffectFilter {
    type: 'trait' | 'gameType' | 'name' | 'nameContains' | 'gameTypeOr';
    value?: string;
    values?: string[];
}

/**
 * Effect target interface matching JSON structure
 */
export interface EffectTarget {
    owner: 'self' | 'opponent' | 'both';
    zones: string[];
    filters?: EffectFilter[];
    targetCount?: number;
    requiresSelection?: boolean;
    selectCount?: number;
}

/**
 * Effect trigger interface matching JSON structure
 */
export interface EffectTrigger {
    event: string; // Allow any string for flexibility with existing JSON
    conditions?: any[];
}

/**
 * Base effect definition interface matching JSON structure
 */
export interface EffectDefinition {
    type: string; // Allow any string for flexibility with existing JSON
    value: number | boolean;
    undoEffect?: boolean;
    searchCount?: number;
    selectCount?: number;
    destination?: 'hand' | 'spZone' | 'helpZone' | 'conditionalHelpZone';
    filters?: EffectFilter[];
}

/**
 * Effect rule interface matching JSON structure
 */
export interface EffectRule {
    id: string;
    type: 'continuous' | 'triggered' | 'restriction';
    trigger: EffectTrigger;
    target: EffectTarget;
    effect: EffectDefinition;
}

/**
 * Runtime context for active effects
 */
export interface EffectRuntimeContext {
    effectId: string;
    sourceCardUid: string;
    sourcePlayerId: string;
    targetPlayerId: string;
    createdAt: number;
    isActive: boolean;
}

/**
 * ActiveEffect class - Direct JSON structure with runtime context
 * 
 * Eliminates CalculatedEffect intermediate layer by directly using JSON effect rules
 * with minimal runtime additions for tracking and context.
 */
export class ActiveEffect {
    // Runtime context (the only additions needed)
    public readonly effectId: string;
    public readonly sourceCardUid: string;
    public readonly sourcePlayerId: string;
    public readonly targetPlayerId: string;
    public readonly createdAt: number;
    public isActive: boolean;
    
    // Original JSON structure preserved directly
    public readonly rule: EffectRule;
    
    constructor(rule: EffectRule, context: EffectRuntimeContext) {
        // Runtime context
        this.effectId = context.effectId;
        this.sourceCardUid = context.sourceCardUid;
        this.sourcePlayerId = context.sourcePlayerId;
        this.targetPlayerId = context.targetPlayerId;
        this.createdAt = context.createdAt;
        this.isActive = context.isActive;
        
        // Preserve original JSON structure
        this.rule = rule;
    }
    
    /**
     * Factory method: Create ActiveEffect directly from JSON card rule
     */
    static fromCardRule(
        rule: EffectRule,
        sourceCardUid: string,
        sourcePlayerId: string,
        targetPlayerId?: string
    ): ActiveEffect {
        const context: EffectRuntimeContext = {
            effectId: `${sourceCardUid}_${rule.id}`,
            sourceCardUid,
            sourcePlayerId,
            targetPlayerId: targetPlayerId || (rule.target.owner === 'opponent' ? 'opponent_id' : sourcePlayerId),
            createdAt: Date.now(),
            isActive: true
        };
        
        return new ActiveEffect(rule, context);
    }
    
    /**
     * Check if this effect applies to a specific card
     */
    appliesTo(cardId: string, cardData: any, zone: string, playerId: string): boolean {
        // Check target player scope
        if (!this.matchesPlayerScope(playerId)) {
            return false;
        }
        
        // Check zone targeting
        if (!this.matchesZone(zone)) {
            return false;
        }
        
        // Check filter conditions
        return this.matchesFilters(cardData);
    }
    
    /**
     * Check if effect applies to target player
     */
    private matchesPlayerScope(playerId: string): boolean {
        if (this.rule.target.owner === 'self') {
            return playerId === this.sourcePlayerId;
        } else if (this.rule.target.owner === 'opponent') {
            return playerId !== this.sourcePlayerId;
        }
        return false;
    }
    
    /**
     * Check if effect applies to target zone
     */
    private matchesZone(zone: string): boolean {
        if (!this.rule.target.zones || this.rule.target.zones.length === 0) {
            return true; // No zone restriction
        }
        return this.rule.target.zones.includes(zone);
    }
    
    /**
     * Check if card matches filter conditions
     */
    private matchesFilters(cardData: any): boolean {
        if (!this.rule.target.filters || this.rule.target.filters.length === 0) {
            return true; // No filter restrictions
        }
        
        for (const filter of this.rule.target.filters) {
            if (!this.matchesFilter(filter, cardData)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Check if card matches a specific filter
     */
    private matchesFilter(filter: EffectFilter, cardData: any): boolean {
        switch (filter.type) {
            case 'trait':
                return cardData.traits?.includes(filter.value);
                
            case 'gameType':
                return cardData.gameType === filter.value;
                
            case 'name':
                return cardData.name === filter.value;
                
            case 'nameContains':
                return cardData.name?.includes(filter.value) ?? false;
                
            case 'gameTypeOr':
                return filter.values?.includes(cardData.gameType) ?? false;
                
            default:
                console.warn(`Unknown filter type: ${filter.type}`);
                return false;
        }
    }
    
    /**
     * Apply this effect to a target card's power
     */
    applyToPower(currentPower: number): number {
        if (!this.isActive) {
            return currentPower;
        }
        
        switch (this.rule.effect.type) {
            case 'powerBoost':
                return currentPower + (this.rule.effect.value as number);
                
            case 'setPower':
                return this.rule.effect.value as number;
                
            default:
                return currentPower;
        }
    }
    
    /**
     * Check if this effect should trigger for a specific event
     */
    shouldTrigger(event: string): boolean {
        return this.isActive && this.rule.trigger.event === event;
    }
    
    /**
     * Get effect type for switching logic
     */
    get effectType(): string {
        return this.rule.effect.type;
    }
    
    /**
     * Get effect value
     */
    get effectValue(): number | boolean {
        return this.rule.effect.value;
    }
    
    /**
     * Get target scope
     */
    get targetScope(): 'self' | 'opponent' | 'both' {
        return this.rule.target.owner;
    }
    
    /**
     * Check if effect requires player selection
     */
    get requiresSelection(): boolean {
        return this.rule.target.requiresSelection ?? false;
    }
    
    
    /**
     * Create a copy of this effect (for incremental processing)
     */
    clone(): ActiveEffect {
        return new ActiveEffect(
            { ...this.rule },
            {
                effectId: this.effectId,
                sourceCardUid: this.sourceCardUid,
                sourcePlayerId: this.sourcePlayerId,
                targetPlayerId: this.targetPlayerId,
                createdAt: this.createdAt,
                isActive: this.isActive
            }
        );
    }
    
    /**
     * Deactivate this effect
     */
    deactivate(): void {
        this.isActive = false;
    }
    
    /**
     * Activate this effect
     */
    activate(): void {
        this.isActive = true;
    }
    
    /**
     * Get a human-readable description of this effect
     */
    getDescription(): string {
        const target = this.rule.target.owner === 'self' ? 'ally' : 'enemy';
        const zones = this.rule.target.zones.join(', ');
        const filters = this.rule.target.filters?.map(f => `${f.type}:${f.value || f.values?.join('|')}`).join(', ') || 'none';
        
        return `${this.rule.effect.type} (${this.rule.effect.value}) targeting ${target} in [${zones}] with filters [${filters}]`;
    }
    
    /**
     * Serialize for JSON storage
     */
    toJSON(): any {
        return {
            effectId: this.effectId,
            sourceCardUid: this.sourceCardUid,
            sourcePlayerId: this.sourcePlayerId,
            targetPlayerId: this.targetPlayerId,
            createdAt: this.createdAt,
            isActive: this.isActive,
            rule: this.rule
        };
    }
    
    /**
     * Deserialize from JSON storage
     */
    static fromJSON(data: any): ActiveEffect {
        return new ActiveEffect(data.rule, {
            effectId: data.effectId,
            sourceCardUid: data.sourceCardUid,
            sourcePlayerId: data.sourcePlayerId,
            targetPlayerId: data.targetPlayerId,
            createdAt: data.createdAt,
            isActive: data.isActive
        });
    }
}

/**
 * Effect collection class for managing multiple active effects
 */
export class ActiveEffectCollection {
    private effects: Map<string, ActiveEffect> = new Map();
    
    /**
     * Add an effect to the collection
     */
    add(effect: ActiveEffect): void {
        this.effects.set(effect.effectId, effect);
    }
    
    /**
     * Remove an effect from the collection
     */
    remove(effectId: string): boolean {
        return this.effects.delete(effectId);
    }
    
    /**
     * Get an effect by ID
     */
    get(effectId: string): ActiveEffect | undefined {
        return this.effects.get(effectId);
    }
    
    /**
     * Get all effects
     */
    getAll(): ActiveEffect[] {
        return Array.from(this.effects.values());
    }
    
    /**
     * Get active effects only
     */
    getActive(): ActiveEffect[] {
        return this.getAll().filter(effect => effect.isActive);
    }
    
    /**
     * Get effects by source card
     */
    getBySource(sourceCardUid: string): ActiveEffect[] {
        return this.getAll().filter(effect => effect.sourceCardUid === sourceCardUid);
    }
    
    /**
     * Get effects by type
     */
    getByType(effectType: string): ActiveEffect[] {
        return this.getAll().filter(effect => effect.effectType === effectType);
    }
    
    /**
     * Get effects that apply to a specific card
     */
    getApplicableTo(cardId: string, cardData: any, zone: string, playerId: string): ActiveEffect[] {
        return this.getActive().filter(effect => 
            effect.appliesTo(cardId, cardData, zone, playerId)
        );
    }
    
    /**
     * Calculate total power modification for a card
     */
    calculatePowerModification(cardId: string, cardData: any, zone: string, playerId: string, basePower: number): number {
        let modifiedPower = basePower;
        
        const applicableEffects = this.getApplicableTo(cardId, cardData, zone, playerId);
        
        for (const effect of applicableEffects) {
            modifiedPower = effect.applyToPower(modifiedPower);
        }
        
        return modifiedPower;
    }
    
    /**
     * Clear all effects
     */
    clear(): void {
        this.effects.clear();
    }
    
    /**
     * Get collection size
     */
    get size(): number {
        return this.effects.size;
    }
    
    /**
     * Convert to array for JSON serialization
     */
    toJSON(): any[] {
        return this.getAll().map(effect => effect.toJSON());
    }
    
    /**
     * Load from JSON array
     */
    static fromJSON(data: any[]): ActiveEffectCollection {
        const collection = new ActiveEffectCollection();
        
        for (const effectData of data) {
            const effect = ActiveEffect.fromJSON(effectData);
            collection.add(effect);
        }
        
        return collection;
    }
}