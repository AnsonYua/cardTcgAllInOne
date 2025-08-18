/**
 * EffectMigrationHelper.ts - Utility for migrating from old effect system to new ActiveEffect system
 * 
 * Provides compatibility layer and migration tools for transitioning from the
 * CalculatedEffect -> FieldEffect approach to the direct JSON -> ActiveEffect approach.
 */

import { ActiveEffect, EffectRule } from '../models/ActiveEffect';
import { FieldEffect } from '../models/GameEnvironment';

/**
 * Migration helper for transitioning effect systems
 */
export class EffectMigrationHelper {
    
    /**
     * Convert legacy FieldEffect to ActiveEffect
     */
    static convertLegacyFieldEffectToActiveEffect(fieldEffect: FieldEffect): ActiveEffect | null {
        try {
            // Reconstruct EffectRule from legacy FieldEffect
            const rule: EffectRule = {
                id: fieldEffect.effectId.split('_').pop() || fieldEffect.type,
                type: 'continuous', // Default assumption
                trigger: {
                    event: 'always',
                    conditions: []
                },
                target: {
                    owner: fieldEffect.target.scope === 'OPPONENT' ? 'opponent' : 'self',
                    zones: Array.isArray(fieldEffect.target.zones) ? fieldEffect.target.zones.map(z => z.toString()) : [],
                    filters: this.reconstructFilters(fieldEffect.target.gameTypes, fieldEffect.target.traits)
                },
                effect: {
                    type: fieldEffect.type as 'powerBoost' | 'setPower' | 'drawCards' | 'searchCard' | 'neutralizeEffect' | 'preventSummon',
                    value: fieldEffect.value
                }
            };
            
            // Create ActiveEffect from reconstructed rule
            return ActiveEffect.fromCardRule(
                rule,
                fieldEffect.source,
                fieldEffect.sourcePlayerId || '',
                fieldEffect.target.playerId
            );
        } catch (error) {
            console.error(`Failed to convert legacy FieldEffect to ActiveEffect:`, error);
            return null;
        }
    }
    
    /**
     * Convert ActiveEffect to legacy FieldEffect for backward compatibility
     */
    static convertActiveEffectToLegacyFieldEffect(activeEffect: ActiveEffect): FieldEffect {
        return {
            effectId: activeEffect.effectId,
            source: activeEffect.sourceCardUid,
            sourcePlayerId: activeEffect.sourcePlayerId,
            type: activeEffect.effectType,
            target: {
                scope: (activeEffect.targetScope === 'opponent' ? 'OPPONENT' : activeEffect.targetScope === 'both' ? 'ALL' : 'SELF') as 'OPPONENT' | 'ALL' | 'SELF',
                zones: activeEffect.rule.target.zones as any,
                gameTypes: activeEffect.rule.target.filters?.filter(f => f.type === 'gameType').map(f => f.value || '').filter(Boolean),
                traits: activeEffect.rule.target.filters?.filter(f => f.type === 'trait').map(f => f.value || '').filter(Boolean)
            },
            value: activeEffect.effectValue,
            isEnabled: activeEffect.isActive,
            createdAt: activeEffect.createdAt
        };
    }
    
    
    /**
     * Reconstruct filters from legacy gameTypes and traits arrays
     */
    private static reconstructFilters(gameTypes?: string[], traits?: string[]): any[] {
        const filters: any[] = [];
        
        if (gameTypes && gameTypes.length > 0) {
            for (const gameType of gameTypes) {
                filters.push({
                    type: 'gameType',
                    value: gameType
                });
            }
        }
        
        if (traits && traits.length > 0) {
            for (const trait of traits) {
                filters.push({
                    type: 'trait',
                    value: trait
                });
            }
        }
        
        return filters;
    }
    
    
    /**
     * Validate effect compatibility between old and new systems
     */
    static validateEffectCompatibility(legacyEffect: FieldEffect, activeEffect: ActiveEffect): boolean {
        try {
            // Check if essential properties match using direct properties
            const legacyConverted = {
                effectId: activeEffect.effectId,
                source: activeEffect.sourceCardUid,
                sourcePlayerId: activeEffect.sourcePlayerId,
                type: activeEffect.effectType,
                target: {
                    scope: (activeEffect.targetScope === 'opponent' ? 'OPPONENT' : activeEffect.targetScope === 'both' ? 'ALL' : 'SELF') as 'OPPONENT' | 'ALL' | 'SELF',
                    zones: activeEffect.rule.target.zones as any,
                    gameTypes: activeEffect.rule.target.filters?.filter(f => f.type === 'gameType').map(f => f.value || '').filter(Boolean),
                    traits: activeEffect.rule.target.filters?.filter(f => f.type === 'trait').map(f => f.value || '').filter(Boolean)
                },
                value: activeEffect.effectValue,
                    isEnabled: activeEffect.isActive,
                createdAt: activeEffect.createdAt
            };
            
            return (
                legacyEffect.type === legacyConverted.type &&
                legacyEffect.value === legacyConverted.value &&
                legacyEffect.target.scope === legacyConverted.target.scope
            );
        } catch (error) {
            console.error('Effect compatibility validation failed:', error);
            return false;
        }
    }
    
    
    
}

/**
 * Utility functions for effect system transition
 */
export class EffectSystemUtils {
    
    
    
    /**
     * Validate effect system consistency
     */
    static validateEffectSystemConsistency(gameEnv: any): any {
        const issues: string[] = [];
        const warnings: string[] = [];
        
        for (const [playerId, player] of Object.entries(gameEnv.players || {})) {
            const fieldEffects = (player as any).fieldEffects;
            if (!fieldEffects) continue;
            
            // Validate activeEffects structure (unified system)
            const effectsCount = fieldEffects.activeEffects?.length || 0;
            
            if (fieldEffects.activeEffects) {
                for (const effect of fieldEffects.activeEffects) {
                    if (!effect.effectId || !effect.type) {
                        issues.push(`Player ${playerId} has malformed effect: missing effectId or type`);
                    }
                }
            }
        }
        
        return {
            isValid: issues.length === 0,
            issues,
            warnings,
            recommendation: issues.length > 0 ? 'FIX_ISSUES_BEFORE_MIGRATION' : 'SYSTEM_READY'
        };
    }
}